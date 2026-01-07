## API
### @qerrors/response-builder
**Purpose:** Fluent API response builder for Express.js with comprehensive HTTP response handling.
**Explanation:**  
This module provides a flexible, chainable interface for building complex HTTP responses in Express.js applications. It implements the builder pattern to enable readable, maintainable response construction with comprehensive metadata management, error handling, and performance tracking. This is valuable for any Express.js application that needs consistent response formatting, error handling, and metadata management across API endpoints.

Key problems solved:
- Provides consistent response structure across all API endpoints
- Enables fluent, readable response construction with method chaining
- Integrates performance tracking and metadata management
- Handles various HTTP status codes and error scenarios automatically
- Supports pagination, validation errors, and custom headers

```javascript
// Exact current implementation copied from the codebase
const localVars = require('../../config/localVars');
const { HTTP_STATUS, DEFAULT_MESSAGES } = localVars;
const { safeQerrors } = require('./safeWrappers');

class ResponseBuilder {
  constructor (res) {
    this.res = res;
    this.status = HTTP_STATUS.OK;
    this.data = null;
    this.error = null;
    this.message = '';
    this.success = true;
    this.metadata = {};
    this.headers = {};
  }

  setStatus (status) {
    this.status = status;
    if (status >= 400) {
      this.success = false;
    }
    return this;
  }

  setSuccess (success) {
    this.success = success;
    return this;
  }

  setData (data) {
    this.data = data;
    return this;
  }

  setError (error, message = null) {
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

  setMessage (message) {
    this.message = message;
    return this;
  }

  addMetadata (key, value) {
    if (typeof key === 'object') {
      this.metadata = { ...this.metadata, ...key };
    } else {
      this.metadata[key] = value;
    }
    return this;
  }

  addHeader (key, value) {
    this.headers[key] = value;
    return this;
  }

  addHeaders (headers) {
    this.headers = { ...this.headers, ...headers };
    return this;
  }

  setRequestId (requestId) {
    return this.addMetadata('requestId', requestId);
  }

  setProcessingTime (startTime) {
    if (startTime) {
      const processingTime = Date.now() - startTime;
      this.addMetadata('processingTime', processingTime);
    }
    return this;
  }

  setPagination (page, limit, total) {
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

  setValidationErrors (errors) {
    this.error = HTTP_STATUS.BAD_REQUEST;
    this.success = false;
    this.message = DEFAULT_MESSAGES.VALIDATION_FAILED;
    this.addMetadata('errors', errors);
    this.setStatus(HTTP_STATUS.BAD_REQUEST);
    return this;
  }

  build () {
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

    Object.assign(response, this.metadata);

    return response;
  }

  send () {
    for (const [key, value] of Object.entries(this.headers)) {
      this.res.set(key, value);
    }

    const response = this.build();
    return this.res.status(this.status).json(response);
  }

  success (data, options = {}) {
    return this.setStatus(HTTP_STATUS.OK)
      .setData(data)
      .setSuccess(true)
      .addMetadata(options);
  }

  created (data, options = {}) {
    return this.setStatus(HTTP_STATUS.CREATED)
      .setData(data)
      .setSuccess(true)
      .addMetadata(options);
  }

  notFound (message = DEFAULT_MESSAGES.NOT_FOUND) {
    return this.setStatus(HTTP_STATUS.NOT_FOUND)
      .setError(HTTP_STATUS.NOT_FOUND, message);
  }

  unauthorized (message = DEFAULT_MESSAGES.UNAUTHORIZED) {
    return this.setStatus(HTTP_STATUS.UNAUTHORIZED)
      .setError(HTTP_STATUS.UNAUTHORIZED, message);
  }

  forbidden (message = DEFAULT_MESSAGES.FORBIDDEN) {
    return this.setStatus(HTTP_STATUS.FORBIDDEN)
      .setError(HTTP_STATUS.FORBIDDEN, message);
  }

  validation (errors) {
    return this.setValidationErrors(errors);
  }

  serverError (message = DEFAULT_MESSAGES.INTERNAL_ERROR) {
    return this.setStatus(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .setError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }

  badRequest (message = DEFAULT_MESSAGES.NOT_FOUND) {
    return this.setStatus(HTTP_STATUS.BAD_REQUEST)
      .setError(HTTP_STATUS.BAD_REQUEST, message);
  }
}

const sendJsonResponse = (res, status, data) => {
  if (!res.headersSent) {
    return res.status(status).json(data);
  }
  return res;
};

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

const sendSuccessResponse = (res, data, options = {}) => {
  const responseData = createResponseData(true, data, options);
  return sendJsonResponse(res, HTTP_STATUS.OK, responseData);
};

const sendCreatedResponse = (res, data) => {
  const responseData = createResponseData(true, data);
  return sendJsonResponse(res, HTTP_STATUS.CREATED, responseData);
};

const sendErrorResponse = (res, status, message, details = null, options = {}) => {
  const responseData = createResponseData(false, message, options);
  addResponseMetadata(responseData, { ...options, details });
  return sendJsonResponse(res, status, responseData);
};

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

const globalErrorHandler = (err, req, res, _next) => {
  if (res.headersSent) return _next(err);

  const status = err.status || err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const expose = err.expose !== false && status < HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = expose ? err.message : 'Internal Server Error';

  safeQerrors(err, 'globalErrorHandler', {
    status,
    path: req.path,
    method: req.method
  }).catch(() => {});

  sendJsonResponse(res, status, {
    error: message,
    details: err.details || (expose && err instanceof Error ? err.message : undefined)
  });
};

const handleError = async (error, context, res, next) => {
  try {
    const qerrors = require('../qerrors');
    if (qerrors.handleControllerError) {
      await qerrors.handleControllerError(res, error, context, {});
    } else {
      const { safeErrorMessage } = require('./logging');
      const message = safeErrorMessage(error, 'Unknown error');
      sendJsonResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, { error: message, context });
    }
  } catch {
    const message = error instanceof Error ? error.message : 'Unknown error';
    sendJsonResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, { error: message, context });
  }
};

const createResponseBuilder = (res) => new ResponseBuilder(res);

const responseBuilderMiddleware = (_req, res, next) => {
  res.builder = () => createResponseBuilder(res);
  next();
};

module.exports = {
  ResponseBuilder,
  createResponseBuilder,
  responseBuilderMiddleware,
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
  createResponseHelper,
  createStatusResponseHelper,
  globalErrorHandler,
  handleError,
  HTTP_STATUS,
  DEFAULT_MESSAGES
};
```