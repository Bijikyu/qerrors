'use strict';

const { randomUUID } = require('crypto');
const errorTypes = require('./errorTypes');
const logger = require('./logger');
const escapeHtml = require('escape-html');
const localVars = require('../config/localVars');

const { scheduleAnalysis, getQueueRejectCount, getQueueLength } = require('./qerrorsQueue');
const { clearAdviceCache, purgeExpiredAdvice, startAdviceCleanup, stopAdviceCleanup } = require('./qerrorsCache');
const { axiosInstance, postWithRetry } = require('./qerrorsHttpClient');
const { analyzeError } = require('./qerrorsAnalysis');
const { ADVICE_CACHE_LIMIT } = require('./qerrorsConfig');
const { ScalableErrorHandler } = require('./scalabilityFixes');

let scalableErrorHandler = null;
let shutdownListenersAdded = false;
let cleanupInterval = null;

/**
 * Get or create scalable error handler instance with memory-efficient settings
 * Implements proper singleton pattern with memory leak prevention
 */
const getScalableErrorHandler = () => scalableErrorHandler || (scalableErrorHandler = new ScalableErrorHandler({
  maxErrorHistory: 50, // Reduced history size for memory efficiency
  queue: {
    maxQueueSize: 200, // Smaller queue to prevent memory bloat
    maxConcurrency: 2  // Reduced concurrency for better resource management
  },
  cache: {
    maxSize: 100, // Smaller cache to control memory usage
    ttl: 300000   // 5 minutes TTL
  }
}));

/**
 * Add process shutdown listeners for graceful cleanup
 */
const addShutdownListeners = () => {
  if (!shutdownListenersAdded) {
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, cleaning up qerrors...');
      cleanup();
    });
    
    process.on('SIGINT', () => {
      console.log('Received SIGINT, cleaning up qerrors...');
      cleanup();
    });
    
    shutdownListenersAdded = true;
  }
};

/**
 * Cleanup function for resource management
 */
const cleanup = () => {
  try {
    // Clear cache
    clearAdviceCache();
    
    // Stop cleanup intervals
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }
    
    // Stop advice cleanup
    stopAdviceCleanup();
    
    console.log('qerrors cleanup completed');
  } catch (error) {
    console.error('Error during qerrors cleanup:', error);
  }
};

/**
 * Generate unique error identifier
 */
const generateErrorId = () => randomUUID().replace(/-/g, '').substring(0, 12);

/**
 * Extract safe context information for error analysis
 */
const extractContext = (error, context = {}) => {
  try {
    const safeContext = {
      timestamp: new Date().toISOString(),
      errorType: error.constructor.name,
      message: error.message,
      stack: error.stack ? error.stack.split('\n').slice(0, 10) : [],
      ...context
    };
    
    // Remove potentially sensitive information
    if (safeContext.password) delete safeContext.password;
    if (safeContext.token) delete safeContext.token;
    if (safeContext.apiKey) delete safeContext.apiKey;
    
    return safeContext;
  } catch (extractionError) {
    console.error('Failed to extract error context:', extractionError.message);
    return { timestamp: new Date().toISOString(), extractionFailed: true };
  }
};

/**
 * Main qerrors function for error handling and analysis
 */
const qerrors = (error, location, context = {}) => {
  try {
    // Use scalable error handler for processing
    const handler = getScalableErrorHandler();
    return handler.handleError(error, location, context);
  } catch (handlingError) {
    // Fail-safe fallback
    console.error('qerrors failed to handle error:', handlingError.message);
    console.error('Original error:', error.message);
    
    // Log to console as last resort
    if (error && error.stack) {
      console.error(error.stack);
    }
  }
};

/**
 * Express middleware for qerrors integration
 */
const qerrorsMiddleware = (options = {}) => {
  const handler = getScalableErrorHandler();
  
  return (error, req, res, next) => {
    try {
      const context = extractContext(error, {
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress
      });
      
      // Handle error through scalable handler
      handler.handleError(error, 'express.middleware', context)
        .then(result => {
          // Send appropriate response based on request type
          if (req.accepts('html')) {
            sendHtmlError(res, error, result);
          } else {
            sendJsonError(res, error, result);
          }
        })
        .catch(middlewareError => {
          console.error('Middleware error:', middlewareError);
          sendFallbackError(res, error);
        });
      
    } catch (middlewareError) {
      console.error('Express middleware failed:', middlewareError.message);
      sendFallbackError(res, error);
    }
  };
};

/**
 * Send HTML error response
 */
const sendHtmlError = (res, error, analysis) => res.status(500).set('Content-Type', 'text/html').send(`
    <!DOCTYPE html>
    <html>
    <head><title>Error</title></head>
    <body>
      <h1>Internal Server Error</h1>
      <p>Error ID: ${analysis.errorId || 'N/A'}</p>
      <pre>${escapeHtml(error.message || 'Unknown error')}</pre>
    </body>
    </html>
  `);

/**
 * Send JSON error response
 */
const sendJsonError = (res, error, analysis) => res.status(500).json({
  error: 'Internal Server Error',
  errorId: analysis.errorId,
  message: error.message,
  timestamp: new Date().toISOString()
});

/**
 * Send fallback error response
 */
const sendFallbackError = (res, error) => {
  const errorId = generateErrorId();
  
  if (res.get('Content-Type') && res.get('Content-Type').includes('html')) {
    res.status(500).send(`Error ID: ${errorId}`);
  } else {
    res.status(500).json({ error: 'Internal Server Error', errorId });
  }
};

// Initialize on first load
addShutdownListeners();

module.exports = qerrors;
module.exports.middleware = qerrorsMiddleware;
module.exports.generateErrorId = generateErrorId;
module.exports.extractContext = extractContext;
module.exports.cleanup = cleanup;

// Export additional utilities
module.exports.getQueueStats = () => ({
  length: getQueueLength(),
  rejectCount: getQueueRejectCount()
});

module.exports.getAnalysisCache = () => ({
  clear: clearAdviceCache,
  purgeExpired: purgeExpiredAdvice,
  startCleanup: startAdviceCleanup,
  stopCleanup: stopAdviceCleanup
});