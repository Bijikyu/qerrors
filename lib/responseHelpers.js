'use strict';

const { safeQerrors } = require('./utils');

// HTTP Status Code Constants
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};

// Standard Response Messages
const DEFAULT_MESSAGES = {
  VALIDATION_FAILED: 'Validation failed',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  INTERNAL_ERROR: 'Internal server error'
};

/**
 * Base JSON response sender
 */
const sendJsonResponse = (res, status, data) => {
  return res.status(status).json(data);
};

/**
 * Create standardized response data structure
 */
const createResponseData = (success, dataOrMessage, options = {}) => {
  const { includeProcessingTime = false, startTime = null } = options;
  const responseData = { success };
  
  if (success) {
    responseData.data = dataOrMessage;
  } else {
    responseData.error = typeof dataOrMessage === 'number' ? dataOrMessage : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    responseData.message = typeof dataOrMessage === 'string' ? dataOrMessage : DEFAULT_MESSAGES.INTERNAL_ERROR;
  }
  
  if (includeProcessingTime && startTime) {
    responseData.processingTime = Date.now() - startTime;
  }
  
  return responseData;
};

/**
 * Add optional metadata to response
 */
const addResponseMetadata = (responseData, options = {}) => {
  const { requestId = null, processingTime = null, details = null } = options;
  
  if (requestId) responseData.requestId = requestId;
  if (processingTime !== null) responseData.processingTime = processingTime;
  
  if (details) {
    if (responseData.error === HTTP_STATUS.BAD_REQUEST && Array.isArray(details)) {
      responseData.errors = details;
    } else {
      responseData.details = details;
    }
  }
  
  return responseData;
};

/**
 * Success response with optional processing time
 */
const sendSuccessResponse = (res, data, options = {}) => {
  const responseData = createResponseData(true, data, options);
  return sendJsonResponse(res, HTTP_STATUS.OK, responseData);
};

/**
 * Created resource response (201)
 */
const sendCreatedResponse = (res, data) => {
  const responseData = createResponseData(true, data);
  return sendJsonResponse(res, HTTP_STATUS.CREATED, responseData);
};

/**
 * Generic error response with metadata
 */
const sendErrorResponse = (res, status, message, details = null, options = {}) => {
  const responseData = createResponseData(false, message, options);
  addResponseMetadata(responseData, { ...options, details });
  return sendJsonResponse(res, status, responseData);
};

/**
 * HTTP status-specific response helpers
 */
const createStatusResponseHelper = (status, defaultMessage) => {
  return (res, message = defaultMessage, options = {}) => {
    return sendErrorResponse(res, status, message, null, options);
  };
};

const sendValidationErrorResponse = (res, errors, options = {}) => {
  return sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, DEFAULT_MESSAGES.VALIDATION_FAILED, errors, options);
};

const sendNotFoundResponse = createStatusResponseHelper(HTTP_STATUS.NOT_FOUND, DEFAULT_MESSAGES.NOT_FOUND);
const sendUnauthorizedResponse = createStatusResponseHelper(HTTP_STATUS.UNAUTHORIZED, DEFAULT_MESSAGES.UNAUTHORIZED);
const sendForbiddenResponse = createStatusResponseHelper(HTTP_STATUS.FORBIDDEN, DEFAULT_MESSAGES.FORBIDDEN);
const sendServerErrorResponse = createStatusResponseHelper(HTTP_STATUS.INTERNAL_SERVER_ERROR, DEFAULT_MESSAGES.INTERNAL_ERROR);

/**
 * Response helper factory for controllers
 */
const createResponseHelper = (res, startTime = null) => ({
  success: (data, options = {}) => sendSuccessResponse(res, data, { ...options, startTime }),
  created: data => sendCreatedResponse(res, data),
  error: (status, message, details, options = {}) => sendErrorResponse(res, status, message, details, { ...options, startTime }),
  validation: (errors, options = {}) => sendValidationErrorResponse(res, errors, { ...options, startTime }),
  notFound: message => sendNotFoundResponse(res, message),
  unauthorized: message => sendUnauthorizedResponse(res, message),
  forbidden: message => sendForbiddenResponse(res, message),
  serverError: message => sendServerErrorResponse(res, message)
});

/**
 * Global Express error handler
 */
const globalErrorHandler = (err, req, res, _next) => {
  if (res.headersSent) return _next(err);
  
  const status = err.status || err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const expose = err.expose !== false && status < HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = expose ? err.message : 'Internal Server Error';
  
  // Log error using shared utilities
  safeQerrors(err, 'globalErrorHandler', { 
    status, 
    path: req.path, 
    method: req.method 
  }).catch(() => {});
  
  if (!res.headersSent) {
    res.status(status).json({ 
      error: message, 
      details: err.details || (expose && err instanceof Error ? err.message : undefined) 
    });
  }
};

/**
 * Centralized error handling for controllers
 */
const handleError = async (error, context, res, next) => {
  try {
    const qerrors = await import('./qerrors.js');
    if (qerrors.handleControllerError) {
      await qerrors.handleControllerError(res, error, context, {});
    } else {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (!res.headersSent) {
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: message, context });
      }
    }
  } catch {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (!res.headersSent) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: message, context });
    }
  }
};

module.exports = {
  // Core utilities
  sendJsonResponse,
  createResponseData,
  addResponseMetadata,
  
  // Response helpers
  sendSuccessResponse,
  sendCreatedResponse,
  sendErrorResponse,
  sendValidationErrorResponse,
  sendNotFoundResponse,
  sendUnauthorizedResponse,
  sendForbiddenResponse,
  sendServerErrorResponse,
  
  // Factory functions
  createResponseHelper,
  createStatusResponseHelper,
  
  // Error handlers
  globalErrorHandler,
  handleError,
  
  // Constants
  HTTP_STATUS,
  DEFAULT_MESSAGES
};