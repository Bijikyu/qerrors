/**
 * API Server Error Handling Middleware
 * 
 * Extracted error handling for api-server.js to improve maintainability
 */

import qerrors from './lib/qerrors.js';

/**
 * Global error handling middleware - Integrates qerrors with Express
 * 
 * This middleware catches all errors in the Express application and
 * ensures they are properly handled with qerrors integration.
 * It provides consistent error responses and comprehensive logging.
 * 
 * Features:
 * - qerrors integration for intelligent error analysis
 * - Content negotiation (JSON/HTML)
 * - Memory context preservation
 * - Graceful degradation
 */
function configureErrorHandling(app) {
  app.use((err, req, res, next) => {
    // Don't send response if headers already sent
    if (res.headersSent) {
      console.error('Error occurred after headers sent:', err.message);
      return;
    }

    // Add memory context to error for better analysis
    const context = {
      url: req.url,
      method: req.method,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      memoryBefore: req.memoryContext,
      memoryAfter: res.memoryAfter,
      timestamp: Date.now()
    };

    // Use qerrors for sophisticated error handling and analysis
    // This provides AI-powered analysis, proper formatting, and logging
    qerrors(err, 'api-server.middleware.errorHandler', context, req, res, next).catch(error => {
      // Fallback error handling if qerrors itself fails
      console.error('qerrors error handling failed:', error.message);
      
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
          fallback: true
        });
      }
    });
  });
}

export {
  configureErrorHandling
};