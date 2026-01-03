'use strict';
const { randomUUID } = require('crypto');
const { ScalableErrorHandler } = require('./scalabilityFixes');
const { getQueueRejectCount, getQueueLength } = require('./qerrorsQueue');
const { clearAdviceCache, purgeExpiredAdvice, startAdviceCleanup, stopAdviceCleanup } = require('./qerrorsCache');
const escapeHtml = require('escape-html');
let scalableErrorHandler;
let shutdownListenersAdded = false;
/**
 * Get or create the scalable error handler instance
 * @returns {ScalableErrorHandler} The error handler instance
 */
const getScalableErrorHandler = () => {
    if (!scalableErrorHandler) {
        scalableErrorHandler = new ScalableErrorHandler({
            maxErrorHistory: 50,
            queue: {
                maxQueueSize: 200,
                maxConcurrency: 2
            },
            cache: {
                maxSize: 100,
                ttl: 300000
            }
        });
    }
    return scalableErrorHandler;
};
/**
 * Add shutdown listeners for graceful cleanup
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
 * Cleanup resources and shutdown gracefully
 */
const cleanup = () => {
    try {
        clearAdviceCache();
        stopAdviceCleanup();
        console.log('qerrors cleanup completed');
    }
    catch (error) {
        console.error('Error during qerrors cleanup:', error);
    }
};
/**
 * Generate a unique error identifier
 * @returns {string} A 12-character error ID
 */
const generateErrorId = () => {
    return randomUUID().replace(/-/g, '').substring(0, 12);
};
/**
 * Extract safe context from an error object
 * @param {Error} error - The error object
 * @param {object} context - Additional context
 * @returns {object} Sanitized context object
 */
const extractContext = (error, context = {}) => {
    try {
        const safeContext = {
            timestamp: new Date().toISOString(),
            errorType: error.constructor.name,
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 10) || [],
            ...context
        };
        // Remove sensitive data
        delete safeContext.password;
        delete safeContext.token;
        delete safeContext.apiKey;
        return safeContext;
    }
    catch (extractionError) {
        console.error('Failed to extract error context:', extractionError.message);
        return {
            timestamp: new Date().toISOString(),
            extractionFailed: true
        };
    }
};
/**
 * Main qerrors error handler function
 * @param {Error} error - The error to handle
 * @param {string} location - Where the error occurred
 * @param {object} context - Additional context
 * @returns {Promise<object|null>} Error analysis result
 */
const qerrors = (error, location, context = {}) => {
    try {
        const handler = getScalableErrorHandler();
        return handler.handleError(error, location, context);
    }
    catch (handlingError) {
        console.error('qerrors failed to handle error:', handlingError.message);
        if (error?.message) {
            console.error('Original error:', error.message);
        }
        if (error?.stack) {
            console.error(error.stack);
        }
        return null;
    }
};
/**
 * Express middleware for error handling
 * @param {object} options - Middleware options
 * @returns {function} Express middleware function
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
            handler.handleError(error, 'express.middleware', context)
                .then(result => {
                if (req.accepts('html')) {
                    sendHtmlError(res, error, result);
                }
                else {
                    sendJsonError(res, error, result);
                }
            })
                .catch(middlewareError => {
                console.error('Middleware error:', middlewareError);
                sendFallbackError(res, error);
            })
                .finally(() => {
                if (next) {
                    next();
                }
            });
        }
        catch (middlewareError) {
            console.error('Express middleware failed:', middlewareError.message);
            sendFallbackError(res, error);
            if (next) {
                next();
            }
        }
    };
};
/**
 * Send HTML error response
 * @param {object} res - Express response object
 * @param {Error} error - The error
 * @param {object} analysis - Error analysis
 */
const sendHtmlError = (res, error, analysis) => {
    res.status(500)
        .set('Content-Type', 'text/html')
        .send(`<!DOCTYPE html>
<html>
<head>
  <title>Error</title>
</head>
<body>
  <h1>Internal Server Error</h1>
  <p>Error ID: ${analysis.errorId || 'N/A'}</p>
  <pre>${escapeHtml(error.message || 'Unknown error')}</pre>
</body>
</html>`);
};
/**
 * Send JSON error response
 * @param {object} res - Express response object
 * @param {Error} error - The error
 * @param {object} analysis - Error analysis
 */
const sendJsonError = (res, error, analysis) => {
    res.status(500).json({
        error: 'Internal Server Error',
        errorId: analysis.errorId,
        message: error.message,
        timestamp: new Date().toISOString()
    });
};
/**
 * Send fallback error response
 * @param {object} res - Express response object
 * @param {Error} error - The error
 */
const sendFallbackError = (res, error) => {
    try {
        const errorId = generateErrorId();
        const contentType = res.get('Content-Type') || '';
        if (contentType.includes('html')) {
            res.status(500).send(`Error ID: ${errorId}`);
        }
        else {
            res.status(500).json({
                error: 'Internal Server Error',
                errorId
            });
        }
    }
    catch (fallbackError) {
        console.error('Failed to send fallback error:', fallbackError);
        res.status(500).end('Internal Server Error');
    }
};
// Initialize shutdown listeners
addShutdownListeners();
// Export the main function and utilities
module.exports = qerrors;
module.exports.middleware = qerrorsMiddleware;
module.exports.generateErrorId = generateErrorId;
module.exports.extractContext = extractContext;
module.exports.cleanup = cleanup;
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
//# sourceMappingURL=qerrors.js.map