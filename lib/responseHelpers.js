/**
 * Response Helper Utilities
 * 
 * Purpose: Standardized Express.js response utilities for consistent API responses.
 * Solves inconsistent response formats across endpoints by centralizing response patterns.
 * Essential for microservices architectures where consistent response formats are crucial.
 * 
 * Features:
 * - Standard success/error response formats
 * - Request ID tracking
 * - Processing time calculation
 * - Validation error formatting
 * - Backward compatibility with existing patterns
 */

/**
 * Sends JSON response with status code
 * @param {Object} res - Express response object
 * @param {number} status - HTTP status code
 * @param {any} data - Response data
 * @returns {Object} Express response
 */
function sendJsonResponse(res, status, data) { //core JSON response sender
  return res.status(status).json(data);
}

/**
 * Sends success response (200) with data
 * @param {Object} res - Express response object
 * @param {any} data - Response data
 * @param {Object} [options] - Response options
 * @param {boolean} [options.includeProcessingTime] - Include processing time in response
 * @param {number} [options.startTime] - Request start time for processing time calculation
 * @returns {Object} Express response
 */
function sendSuccessResponse(res, data, options = {}) { //standardized success response
  const { includeProcessingTime = false, startTime = null } = options;
  
  const responseData = { success: true, data };
  
  if (includeProcessingTime && startTime) {
    responseData.processingTime = Date.now() - startTime; //(calculate elapsed time)
  }
  
  return sendJsonResponse(res, 200, responseData);
}

/**
 * Sends created response (201) with data
 * @param {Object} res - Express response object
 * @param {any} data - Response data
 * @returns {Object} Express response
 */
function sendCreatedResponse(res, data) { //standardized 201 response for resource creation
  return sendJsonResponse(res, 201, { success: true, data });
}

/**
 * Sends error response with standard format
 * @param {Object} res - Express response object
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @param {any} [details] - Error details
 * @param {Object} [options] - Response options
 * @param {string} [options.requestId] - Request ID for tracking
 * @param {number} [options.processingTime] - Processing time in ms
 * @returns {Object} Express response
 */
function sendErrorResponse(res, status, message, details = null, options = {}) { //standardized error response
  const { requestId = null, processingTime = null } = options;
  
  const responseData = { 
    success: false, 
    error: status, 
    message 
  };
  
  if (requestId) responseData.requestId = requestId; //(add request tracking)
  if (processingTime !== null) responseData.processingTime = processingTime;
  if (details) {
    if (status === 400 && Array.isArray(details)) {
      responseData.errors = details; //(validation errors as array)
    } else {
      responseData.details = details; //(general error details)
    }
  }
  
  return sendJsonResponse(res, status, responseData);
}

/**
 * Sends validation error response (400) with formatted errors
 * @param {Object} res - Express response object
 * @param {Array|string} errors - Validation errors
 * @param {Object} [options] - Response options
 * @returns {Object} Express response
 */
function sendValidationErrorResponse(res, errors, options = {}) { //400 validation error response
  const { requestId = null } = options;
  return sendErrorResponse(res, 400, 'Validation failed', errors, { requestId });
}

/**
 * Sends not found response (404)
 * @param {Object} res - Express response object
 * @param {string} [message] - Not found message
 * @returns {Object} Express response
 */
function sendNotFoundResponse(res, message = 'Resource not found') { //404 response
  return sendErrorResponse(res, 404, message);
}

/**
 * Sends unauthorized response (401)
 * @param {Object} res - Express response object
 * @param {string} [message] - Unauthorized message
 * @returns {Object} Express response
 */
function sendUnauthorizedResponse(res, message = 'Unauthorized') { //401 response
  return sendErrorResponse(res, 401, message);
}

/**
 * Sends forbidden response (403)
 * @param {Object} res - Express response object
 * @param {string} [message] - Forbidden message
 * @returns {Object} Express response
 */
function sendForbiddenResponse(res, message = 'Forbidden') { //403 response
  return sendErrorResponse(res, 403, message);
}

/**
 * Sends server error response (500)
 * @param {Object} res - Express response object
 * @param {string} [message] - Server error message
 * @returns {Object} Express response
 */
function sendServerErrorResponse(res, message = 'Internal server error') { //500 response
  return sendErrorResponse(res, 500, message);
}

/**
 * Creates response helper object with consistent interface
 * @param {Object} res - Express response object
 * @param {number} [startTime] - Request start time for processing time tracking
 * @returns {Object} Response helper functions
 * 
 * @example
 * app.get('/users/:id', (req, res) => {
 *   const startTime = Date.now();
 *   const response = createResponseHelper(res, startTime);
 *   
 *   try {
 *     const user = await getUser(req.params.id);
 *     if (!user) return response.notFound('User not found');
 *     return response.success(user, { includeProcessingTime: true });
 *   } catch (err) {
 *     return response.serverError('Failed to fetch user');
 *   }
 * });
 */
function createResponseHelper(res, startTime = null) { //factory for response helper object
  return {
    success: (data, options = {}) => sendSuccessResponse(res, data, { ...options, startTime }),
    created: (data) => sendCreatedResponse(res, data),
    error: (status, message, details, options = {}) => sendErrorResponse(res, status, message, details, { ...options, startTime }),
    validation: (errors, options = {}) => sendValidationErrorResponse(res, errors, { ...options, startTime }),
    notFound: (message) => sendNotFoundResponse(res, message),
    unauthorized: (message) => sendUnauthorizedResponse(res, message),
    forbidden: (message) => sendForbiddenResponse(res, message),
    serverError: (message) => sendServerErrorResponse(res, message)
  };
}

/**
 * Global Error Handler
 * 
 * Purpose: Centralized Express error handler middleware with consistent formatting.
 * Integrates with qerrors for enhanced logging while providing fallback behavior.
 * Handles HTTP errors properly and sends standardized JSON error responses.
 * 
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 * 
 * @example
 * // Add as the last middleware in Express app
 * app.use(globalErrorHandler);
 */
function globalErrorHandler(err, req, res, next) { //centralized Express error handler
  if (res.headersSent) { //(avoid double-sending headers)
    return next(err);
  }
  
  const status = err.status || err.statusCode || 500; //(extract HTTP status)
  const expose = err.expose !== false && status < 500; //(only expose client errors by default)
  const message = expose ? err.message : 'Internal Server Error';
  
  try { //(async logging without blocking response)
    const utils = require('./utils');
    if (typeof utils.safeQerrors === 'function') {
      utils.safeQerrors(err, 'globalErrorHandler', {
        status,
        path: req.path,
        method: req.method
      }).catch(() => {}); //(fire-and-forget logging)
    }
  } catch { //(swallow logging failures)
  }
  
  if (!res.headersSent) {
    res.status(status).json({
      error: message,
      details: err.details || (expose && err instanceof Error ? err.message : undefined)
    });
  }
}

/**
 * Handle controller errors with dynamic qerrors import and fallback support
 * 
 * Design rationale: Provides robust error handling that works in both CJS and ESM
 * environments through dynamic import. Includes comprehensive fallback chain to
 * ensure the application never crashes due to error handler failures.
 * 
 * @param {unknown} error - The error to handle
 * @param {string} context - Context string for logging (e.g., function name)
 * @param {Object} res - Express response object
 * @param {Function} [next] - Express next function (optional)
 * @returns {Promise<void>} Resolves after response is written
 * 
 * @example
 * app.post('/api/users', async (req, res, next) => {
 *   try {
 *     const user = await createUser(req.body);
 *     res.json(user);
 *   } catch (error) {
 *     await handleError(error, 'createUser', res, next);
 *   }
 * });
 */
async function handleError(error, context, res, next) { //async error handler with dynamic import
  try {
    const qerrors = await import('./qerrors.js'); //(dynamic import for ESM compatibility)
    
    if (qerrors.handleControllerError) { //(use qerrors when available)
      await qerrors.handleControllerError(res, error, context, {});
    } else { //(fallback when handleControllerError not available)
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (!res.headersSent) {
        res.status(500).json({ error: message, context });
      }
    }
  } catch { //(ultimate fallback if import fails)
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (!res.headersSent) {
      res.status(500).json({ error: message, context });
    }
  }
}

module.exports = {
  sendJsonResponse, //(core JSON response)
  sendSuccessResponse, //(200 success)
  sendCreatedResponse, //(201 created)
  sendErrorResponse, //(general error)
  sendValidationErrorResponse, //(400 validation)
  sendNotFoundResponse, //(404 not found)
  sendUnauthorizedResponse, //(401 unauthorized)
  sendForbiddenResponse, //(403 forbidden)
  sendServerErrorResponse, //(500 server error)
  createResponseHelper, //(factory for response helper object)
  globalErrorHandler, //(centralized Express error handler)
  handleError //(async error handler with dynamic import and fallback)
};
