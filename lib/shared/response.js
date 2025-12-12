'use strict';

const { HTTP_STATUS, DEFAULT_MESSAGES } = require('./constants');
const { safeQerrors } = require('./safeWrappers');

/**
 * Response Builder for complex, chained response construction
 */
class ResponseBuilder {
  constructor(res) {
    this.res = res;
    this.status = HTTP_STATUS.OK;
    this.data = null;
    this.error = null;
    this.message = '';
    this.success = true;
    this.metadata = {};
    this.headers = {};
  }

  /**
   * Set response status
   */
  setStatus(status) {
    this.status = status;
    if (status >= 400) {
      this.success = false;
    }
    return this;
  }

  /**
   * Set success state
   */
  setSuccess(success) {
    this.success = success;
    return this;
  }

  /**
   * Set response data
   */
  setData(data) {
    this.data = data;
    return this;
  }

  /**
   * Set error information
   */
  setError(error, message = null) {
    this.error = error;
    this.success = false;
    if (message) {
      this.message = message;
    }
    if (this.status === HTTP_STATUS.OK) {
      this.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    }
    return this;
  }

  /**
   * Set response message
   */
  setMessage(message) {
    this.message = message;
    return this;
  }

  /**
   * Add metadata
   */
  addMetadata(key, value) {
    if (typeof key === 'object') {
      this.metadata = { ...this.metadata, ...key };
    } else {
      this.metadata[key] = value;
    }
    return this;
  }

  /**
   * Add response header
   */
  addHeader(key, value) {
    this.headers[key] = value;
    return this;
  }

  /**
   * Add multiple headers
   */
  addHeaders(headers) {
    this.headers = { ...this.headers, ...headers };
    return this;
  }

  /**
   * Add request ID to metadata
   */
  setRequestId(requestId) {
    return this.addMetadata('requestId', requestId);
  }

  /**
   * Add processing time to metadata
   */
  setProcessingTime(startTime) {
    if (startTime) {
      this.addMetadata('processingTime', Date.now() - startTime);
    }
    return this;
  }

  /**
   * Add pagination metadata
   */
  setPagination(page, limit, total) {
    return this.addMetadata({
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  }

  /**
   * Add validation errors
   */
  setValidationErrors(errors) {
    this.error = HTTP_STATUS.BAD_REQUEST;
    this.success = false;
    this.message = DEFAULT_MESSAGES.VALIDATION_FAILED;
    this.addMetadata('errors', errors);
    this.setStatus(HTTP_STATUS.BAD_REQUEST);
    return this;
  }

  /**
   * Build response object
   */
  build() {
    const response = {
      success: this.success
    };

    if (this.success) {
      response.data = this.data;
    } else {
      if (this.error !== null) {
        response.error = this.error;
      }
      if (this.message) {
        response.message = this.message;
      }
    }

    // Add metadata
    Object.keys(this.metadata).forEach(key => {
      response[key] = this.metadata[key];
    });

    return response;
  }

  /**
   * Send the response
   */
  send() {
    // Apply headers
    Object.entries(this.headers).forEach(([key, value]) => {
      this.res.set(key, value);
    });

    const response = this.build();
    return this.res.status(this.status).json(response);
  }

  // Convenience methods for common response types

  /**
   * Create success response
   */
  success(data, options = {}) {
    return this.setStatus(HTTP_STATUS.OK)
      .setData(data)
      .setSuccess(true)
      .addMetadata(options);
  }

  /**
   * Create created response (201)
   */
  created(data, options = {}) {
    return this.setStatus(HTTP_STATUS.CREATED)
      .setData(data)
      .setSuccess(true)
      .addMetadata(options);
  }

  /**
   * Create not found response
   */
  notFound(message = DEFAULT_MESSAGES.NOT_FOUND) {
    return this.setStatus(HTTP_STATUS.NOT_FOUND)
      .setError(HTTP_STATUS.NOT_FOUND, message);
  }

  /**
   * Create unauthorized response
   */
  unauthorized(message = DEFAULT_MESSAGES.UNAUTHORIZED) {
    return this.setStatus(HTTP_STATUS.UNAUTHORIZED)
      .setError(HTTP_STATUS.UNAUTHORIZED, message);
  }

  /**
   * Create forbidden response
   */
  forbidden(message = DEFAULT_MESSAGES.FORBIDDEN) {
    return this.setStatus(HTTP_STATUS.FORBIDDEN)
      .setError(HTTP_STATUS.FORBIDDEN, message);
  }

  /**
   * Create validation error response
   */
  validation(errors) {
    return this.setValidationErrors(errors);
  }

  /**
   * Create server error response
   */
  serverError(message = DEFAULT_MESSAGES.INTERNAL_ERROR) {
    return this.setStatus(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .setError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }

  /**
   * Create bad request response
   */
  badRequest(message = DEFAULT_MESSAGES.NOT_FOUND) {
    return this.setStatus(HTTP_STATUS.BAD_REQUEST)
      .setError(HTTP_STATUS.BAD_REQUEST, message);
  }
}

// Functional helpers for backward compatibility and convenience

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
    const qerrors = require('../qerrors');
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

// Factory function to create response builders
const createResponseBuilder = (res) => new ResponseBuilder(res);

// Middleware to attach response builder to response object
const responseBuilderMiddleware = (_req, res, next) => {
  res.builder = () => createResponseBuilder(res);
  next();
};

module.exports = {
  // Response Builder class
  ResponseBuilder,
  createResponseBuilder,
  responseBuilderMiddleware,
  
  // Functional helpers
  sendJsonResponse,
  createResponseData,
  addResponseMetadata,
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
  
  // Re-exported constants for convenience
  HTTP_STATUS,
  DEFAULT_MESSAGES
};