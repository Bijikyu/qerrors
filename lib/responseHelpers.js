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
const sendJsonResponse = (res, status, data) => res.status(status).json(data);

/**
 * Sends success response (200) with data
 * @param {Object} res - Express response object
 * @param {any} data - Response data
 * @param {Object} [options] - Response options
 * @param {boolean} [options.includeProcessingTime] - Include processing time in response
 * @param {number} [options.startTime] - Request start time for processing time calculation
 * @returns {Object} Express response
 */
const sendSuccessResponse = (res, data, options = {}) => {
  const { includeProcessingTime = false, startTime = null } = options;
  const responseData = { success: true, data };
  includeProcessingTime && startTime && (responseData.processingTime = Date.now() - startTime);
  return sendJsonResponse(res, 200, responseData);
};

/**
 * Sends created response (201) with data
 * @param {Object} res - Express response object
 * @param {any} data - Response data
 * @returns {Object} Express response
 */
const sendCreatedResponse = (res, data) => sendJsonResponse(res, 201, { success: true, data });

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
const sendErrorResponse = (res, status, message, details = null, options = {}) => {
  const { requestId = null, processingTime = null } = options;
  const responseData = { success: false, error: status, message };
  requestId && (responseData.requestId = requestId);
  processingTime !== null && (responseData.processingTime = processingTime);
  if (details) {
    if (status === 400 && Array.isArray(details)) {
      responseData.errors = details;
    } else {
      responseData.details = details;
    }
  }
  return sendJsonResponse(res, status, responseData);
};

/**
 * Sends validation error response (400) with formatted errors
 * @param {Object} res - Express response object
 * @param {Array|string} errors - Validation errors
 * @param {Object} [options] - Response options
 * @returns {Object} Express response
 */
const sendValidationErrorResponse = (res, errors, options = {}) => {
  const { requestId = null } = options;
  return sendErrorResponse(res, 400, 'Validation failed', errors, { requestId });
};

/**
 * Sends not found response (404)
 * @param {Object} res - Express response object
 * @param {string} [message] - Not found message
 * @returns {Object} Express response
 */
const sendNotFoundResponse = (res, message = 'Resource not found') => sendErrorResponse(res, 404, message);

/**
 * Sends unauthorized response (401)
 * @param {Object} res - Express response object
 * @param {string} [message] - Unauthorized message
 * @returns {Object} Express response
 */
const sendUnauthorizedResponse = (res, message = 'Unauthorized') => sendErrorResponse(res, 401, message);

/**
 * Sends forbidden response (403)
 * @param {Object} res - Express response object
 * @param {string} [message] - Forbidden message
 * @returns {Object} Express response
 */
const sendForbiddenResponse = (res, message = 'Forbidden') => sendErrorResponse(res, 403, message);

/**
 * Sends server error response (500)
 * @param {Object} res - Express response object
 * @param {string} [message] - Server error message
 * @returns {Object} Express response
 */
const sendServerErrorResponse = (res, message = 'Internal server error') => sendErrorResponse(res, 500, message);

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
const createResponseHelper = (res, startTime = null) => ({
  success: (data, options = {}) => sendSuccessResponse(res, data, { ...options, startTime }),
  created: (data) => sendCreatedResponse(res, data),
  error: (status, message, details, options = {}) => sendErrorResponse(res, status, message, details, { ...options, startTime }),
  validation: (errors, options = {}) => sendValidationErrorResponse(res, errors, { ...options, startTime }),
  notFound: (message) => sendNotFoundResponse(res, message),
  unauthorized: (message) => sendUnauthorizedResponse(res, message),
  forbidden: (message) => sendForbiddenResponse(res, message),
  serverError: (message) => sendServerErrorResponse(res, message)
});

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
const globalErrorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500, expose = err.expose !== false && status < 500, message = expose ? err.message : 'Internal Server Error';
  try {
    const utils = require('./utils');
    if (typeof utils.safeQerrors === 'function') {
      utils.safeQerrors(err, 'globalErrorHandler', {
        status,
        path: req.path,
        method: req.method
      }).catch(() => {});
    }
  } catch {}
  if (!res.headersSent) {
    res.status(status).json({
      error: message,
      details: err.details || (expose && err instanceof Error ? err.message : undefined)
    });
  }
};

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
const handleError = async (error, context, res, next) => {
  try {
    const qerrors = await import('./qerrors.js');
    if (qerrors.handleControllerError) {
      await qerrors.handleControllerError(res, error, context, {});
    } else {
      const message = error instanceof Error ? error.message : 'Unknown error';
      !res.headersSent && res.status(500).json({ error: message, context });
    }
  } catch {
    const message = error instanceof Error ? error.message : 'Unknown error';
    !res.headersSent && res.status(500).json({ error: message, context });
  }
};

module.exports = { sendJsonResponse, sendSuccessResponse, sendCreatedResponse, sendErrorResponse, sendValidationErrorResponse, sendNotFoundResponse, sendUnauthorizedResponse, sendForbiddenResponse, sendServerErrorResponse, createResponseHelper, globalErrorHandler, handleError };
