'use strict';

/**
 * Core qerrors module - Intelligent error handling middleware with AI-powered analysis
 * 
 * This module implements the main error handling logic that combines traditional error
 * logging with AI-powered debugging suggestions. It's designed to be "error-safe" meaning
 * any failure in qerrors itself should fail gracefully without breaking the application.
 * 
 * Key design principles:
 * - Never cause additional errors when processing existing errors
 * - Maintain fast response times by deferring AI analysis to background
 * - Use caching to control AI API costs and prevent redundant analysis
 * - Provide both HTML and JSON error responses based on content negotiation
 */

// Core dependencies for error handling and logging
const errorTypes = require('./errorTypes');  // Standardized error types and utilities
const logger = require('./logger');          // Winston-based logging system
const { randomUUID } = require('crypto');    // Generate unique error identifiers
const escapeHtml = require('escape-html');   // Prevent XSS in HTML error responses
const localVars = require('../config/localVars'); // Local configuration variables

// Import specialized modules for AI-powered error analysis
const { scheduleAnalysis, getQueueRejectCount, getQueueLength } = require('./qerrorsQueue');
const { clearAdviceCache, purgeExpiredAdvice, startAdviceCleanup, stopAdviceCleanup } = require('./qerrorsCache');
const { axiosInstance, postWithRetry } = require('./qerrorsHttpClient');
const { analyzeError } = require('./qerrorsAnalysis');
const { ADVICE_CACHE_LIMIT } = require('./qerrorsConfig');

// Import scalability fixes
const { ScalableErrorHandler } = require('./scalabilityFixes');

// Global scalable error handler instance with optimized configuration
let scalableErrorHandler = null;

/**
 * Get or create scalable error handler instance with memory-efficient settings
 */
function getScalableErrorHandler() {
  if (!scalableErrorHandler) {
    scalableErrorHandler = new ScalableErrorHandler({
      maxErrorHistory: 50, // Reduced history size for memory efficiency
      queue: {
        maxQueueSize: 200, // Smaller queue to prevent memory bloat
        maxConcurrency: 2  // Reduced concurrency for better resource management
      },
      cache: {
        maxSize: 200, // Smaller cache size
        ttl: 1800000  // 30 minutes TTL for faster cleanup
      }
    });
    
    // Set up graceful shutdown
    process.on('SIGTERM', () => {
      if (scalableErrorHandler) {
        scalableErrorHandler.shutdown();
      }
    });
    
    process.on('SIGINT', () => {
      if (scalableErrorHandler) {
        scalableErrorHandler.shutdown();
      }
    });
  }
  return scalableErrorHandler;
}

// Import shared utilities for consistent behavior across modules
const { stringifyContext, verboseLog } = require('./shared/logging');
const { createErrorContext } = require('./shared/errorContext');
const { sanitizeErrorMessage, sanitizeContextForLog } = require('./shared/security');

/**
 * Helper function for async logger access with error-safe fallback
 * 
 * This function handles the asynchronous nature of the logger module and provides
 * a graceful fallback if the logger fails. This prevents qerrors from causing
 * additional errors when the logging system is unavailable.
 * 
 * @param {string} level - Log level (error, warn, info, debug, etc.)
 * @param {Object|string} message - Message to log
 */
function logAsync(level, message) {
  // Use setImmediate to avoid blocking the main thread
  setImmediate(() => {
    try {
      // Use non-async logger access to prevent blocking
      const log = require('./logger');
      if (log && typeof log[level] === 'function') {
        log[level](message);
      }
    } catch (err) {
      // Fallback to console if logger fails - truncate to prevent log spam
      console.error("Logger error:", String(err.message || "").substring(0, 100));
    }
  });
}

/**
 * Error logger middleware that logs errors and provides AI-powered suggestions.
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 * @param {Object} [req] - Express request object (optional)
 * @param {Object} [res] - Express response object (optional)
 * @param {Function} [next] - Express next function (optional)
 * @returns {Promise<void>}
 * @throws {Error} When logging system fails completely
 * @throws {TypeError} When error parameter is not an Error object
 */
async function qerrors(error, context, req, res, next) {
  if (!error) {
    console.warn('qerrors called without an error object');
    return;
  }
  
  context = context || 'unknown context';
  const contextString = stringifyContext(context);
  const uniqueErrorName = `ERROR:${error.name}_${randomUUID()}`;
  
  const timestamp = new Date().toISOString();
  const { message = 'An error occurred', statusCode = 500, isOperational = true } = error;
  
  // Use scalable error handler for memory-efficient processing
  const handler = getScalableErrorHandler();
  const errorContext = {
    function: context,
    statusCode: Number(statusCode) || 500,
    isOperational: Boolean(isOperational),
    request: req,
    response: res,
    next: next
  };

  // Process error through scalable handler
  const errorRecord = await handler.handleError(error, errorContext);

  // Create optimized error log with bounded memory usage
  const errorLog = {
    id: errorRecord.id,
    timestamp: errorRecord.timestamp,
    message: errorRecord.message,
    statusCode: errorContext.statusCode,
    isOperational: errorContext.isOperational,
    context: contextString.substring(0, 100), // Reduced context length
    stack: process.env.NODE_ENV === 'development' ? errorRecord.stack : undefined
  };
  
  error.uniqueErrorName = uniqueErrorName;
  
  // Non-blocking logging - don't wait for it
  logAsync('error', errorLog);
  
  if (res && !res.headersSent) {
    const acceptHeader = req?.headers?.['accept'] || null;
    
    if (acceptHeader && acceptHeader.includes('text/html')) {
      const safeMsg = escapeHtml(message);
      const safeStatusCode = escapeHtml(String(statusCode));
      const isDevelopment = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';
      const safeStack = isDevelopment ? escapeHtml(error.stack || 'No stack trace available') : 'Stack trace hidden in production';
      const stackSection = isDevelopment ? `<pre>${safeStack}</pre>` : '';
      const htmlErrorPage = `<!DOCTYPE html><html><head><title>Error: ${safeStatusCode}</title><style>body { font-family: sans-serif; padding: 2em; } .error { color: #d32f2f; } pre { background: #f5f5f5; padding: 1em; border-radius: 4px; overflow: auto; }</style></head><body><h1 class="error">Error: ${safeStatusCode}</h1><h2>${safeMsg}</h2>${stackSection}</body></html>`;
      res.status(statusCode).send(htmlErrorPage);
    } else {
      res.status(statusCode).json({ error: errorLog });
    }
  }
  
  if (next) {
    if (!res || !res.headersSent) {
      next(error);
    }
  }
  
  // Schedule AI analysis in background without blocking response
  setImmediate(() => {
    scheduleAnalysis(error, contextString, analyzeError).catch(analysisErr => {
      logAsync('error', analysisErr);
    });
  });
  
  verboseLog(`qerrors ran`);
}

/**
 * Enhanced error logging with severity-based console output
 * 
 * This function provides a higher-level interface for error logging that includes
 * severity classification and additional console output for critical errors.
 * The severity determines both the logging level and whether additional console
 * alerts are generated for immediate visibility.
 * 
 * @param {Error} error - The error object to log
 * @param {string} functionName - Name of the function where error occurred
 * @param {Object} context - Additional context information
 * @param {string} severity - Error severity level (CRITICAL, HIGH, MEDIUM, LOW)
 */
function logErrorWithSeverity(error, functionName, context = {}, severity = errorTypes.ErrorSeverity.MEDIUM) {
  // Create enhanced error context with severity and request tracking
  const logContext = createErrorContext(context, severity, context.req, errorTypes.getRequestId);
  
  // Delegate to core qerrors function for actual logging and response handling
  qerrors(error, functionName, logContext.req, logContext.res, logContext.next);
  
  // Additional console alerts for high-severity errors (truncated for readability)
  if (severity === errorTypes.ErrorSeverity.CRITICAL) {
    console.error("CRITICAL ERROR in:", String(functionName || "unknown").substring(0, 50));
  } else if (severity === errorTypes.ErrorSeverity.HIGH) {
    console.error("HIGH SEVERITY ERROR in:", String(functionName || "unknown").substring(0, 50));
  }
}

/**
 * Controller-specific error handling with standardized responses
 * 
 * This function provides a specialized error handling interface for controller
 * functions that need to return consistent API responses while also logging
 * the error appropriately. It maps error types to HTTP status codes and
 * creates standardized error response objects.
 * 
 * @param {Object} res - Express response object
 * @param {Error} error - The error that occurred
 * @param {string} functionName - Name of the controller function
 * @param {Object} context - Additional context information
 * @param {string|null} userMessage - Optional user-friendly error message
 */
function handleControllerError(res, error, functionName, context = {}, userMessage = null) {
  // Determine error classification from error type or default to SYSTEM
  const errorType = error.type || errorTypes.ErrorTypes.SYSTEM;
  const severity = errorTypes.ERROR_SEVERITY_MAP[errorType];
  const statusCode = errorTypes.ERROR_STATUS_MAP[errorType];
  
  // Log the error with appropriate severity
  logErrorWithSeverity(error, functionName, context, severity);
  
  // Create standardized error response for API consumers
  const errorResponse = errorTypes.createStandardError(
    error.code || 'INTERNAL_ERROR',
    userMessage || error.message || 'An internal error occurred',
    errorType,
    context
  );
  
  // Send the error response with proper HTTP status code
  errorTypes.sendErrorResponse(res, statusCode, errorResponse);
}

/**
 * Higher-order function for wrapping operations with error handling
 * 
 * This function provides a clean way to add error handling to any async operation
 * without requiring try-catch blocks. It returns a fallback value on error and
 * logs the error appropriately. This is useful for controller functions and
 * other operations where you want graceful degradation on failure.
 * 
 * @param {Function} operation - Async function to execute
 * @param {string} functionName - Name of the operation for logging
 * @param {Object} context - Additional context for error logging
 * @param {*} fallback - Value to return if operation fails
 * @returns {*} Result of operation or fallback value
 */
async function withErrorHandling(operation, functionName, context = {}, fallback = null) {
  try {
    // Execute the operation and log success for debugging
    const result = await operation();
    verboseLog(`${functionName} completed successfully`);
    return result;
  } catch (error) {
    // Log the error with appropriate severity and return fallback
    const severity = error.severity || errorTypes.ErrorSeverity.MEDIUM;
    await logErrorWithSeverity(error, functionName, context, severity);
    return fallback;
  }
}

/**
 * Module exports - Provide both the main qerrors function and utilities
 * 
 * The export strategy provides multiple access patterns:
 * - Default export: The main qerrors middleware function
 * - Named exports: Additional utilities for advanced usage
 * - Compatibility exports: Maintain backward compatibility
 */

// Primary export - the main qerrors middleware function
module.exports = qerrors;

// AI analysis and HTTP client utilities
module.exports.analyzeError = analyzeError;                    // Core AI analysis function
module.exports.axiosInstance = axiosInstance;                // Configured HTTP client for AI APIs
module.exports.postWithRetry = postWithRetry;                // Retry logic for API calls

// Queue management utilities
module.exports.getQueueRejectCount = getQueueRejectCount;    // Monitor queue overflow
module.exports.getQueueLength = getQueueLength;              // Current queue size

// Cache management utilities
module.exports.clearAdviceCache = clearAdviceCache;          // Manual cache clearing
module.exports.purgeExpiredAdvice = purgeExpiredAdvice;      // Cleanup expired entries
module.exports.startAdviceCleanup = startAdviceCleanup;      // Start background cleanup
module.exports.stopAdviceCleanup = stopAdviceCleanup;        // Stop background cleanup

// Enhanced error handling utilities
module.exports.logErrorWithSeverity = logErrorWithSeverity;  // Severity-based logging
module.exports.handleControllerError = handleControllerError; // Controller error handling
module.exports.withErrorHandling = withErrorHandling;        // Operation wrapper

// Error types and utilities for convenience
module.exports.errorTypes = errorTypes;                      // All error type definitions

// Configuration utility
const getAdviceCacheLimit = () => ADVICE_CACHE_LIMIT;        // Cache size limit
module.exports.getAdviceCacheLimit = getAdviceCacheLimit;