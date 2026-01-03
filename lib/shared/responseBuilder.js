'use strict';

const localVars = require('../../config/localVars');
const { HTTP_STATUS } = localVars;

/**
 * Response Builder for complex, chained response construction
 */
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

  /**
   * Set response status
   */
  setStatus (status) {
    this.status = status;
    if (status >= 400) {
      this.success = false;
    }
    return this;
  }

  /**
   * Set success state
   */
  setSuccess (success) {
    this.success = success;
    return this;
  }

  /**
   * Set response data
   */
  setData (data) {
    this.data = data;
    return this;
  }

  /**
   * Set error information
   */
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

  /**
   * Set response message
   */
  setMessage (message) {
    this.message = message;
    return this;
  }

  /**
   * Add metadata
   */
  addMetadata (key, value) {
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
  addHeader (key, value) {
    this.headers[key] = value;
    return this;
  }

  /**
   * Add multiple headers
   */
  addHeaders (headers) {
    this.headers = { ...this.headers, ...headers };
    return this;
  }

  /**
   * Add request ID to metadata
   */
  setRequestId (requestId) {
    return this.addMetadata('requestId', requestId);
  }

  /**
   * Add processing time to metadata
   */
  setProcessingTime (startTime) {
    if (startTime) {
      this.addMetadata('processingTime', Date.now() - startTime);
    }
    return this;
  }

  /**
   * Add pagination metadata
   */
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

  /**
   * Add validation errors
   */
  setValidationErrors (errors) {
    this.error = HTTP_STATUS.BAD_REQUEST;
    this.success = false;
    this.message = 'Validation failed';
    this.addMetadata('errors', errors);
    this.setStatus(HTTP_STATUS.BAD_REQUEST);
    return this;
  }

  /**
   * Build response object
   */
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

    // Add metadata
    Object.keys(this.metadata).forEach(key => {
      response[key] = this.metadata[key];
    });

    return response;
  }

  /**
   * Send the response
   */
  send () {
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
  success (data, options = {}) {
    return this.setStatus(HTTP_STATUS.OK)
      .setData(data)
      .setSuccess(true)
      .addMetadata(options);
  }

  /**
   * Create created response (201)
   */
  created (data, options = {}) {
    return this.setStatus(HTTP_STATUS.CREATED)
      .setData(data)
      .setSuccess(true)
      .addMetadata(options);
  }

  /**
   * Create not found response
   */
  notFound (message = 'Resource not found') {
    return this.setStatus(HTTP_STATUS.NOT_FOUND)
      .setError(HTTP_STATUS.NOT_FOUND, message);
  }

  /**
   * Create unauthorized response
   */
  unauthorized (message = 'Unauthorized') {
    return this.setStatus(HTTP_STATUS.UNAUTHORIZED)
      .setError(HTTP_STATUS.UNAUTHORIZED, message);
  }

  /**
   * Create forbidden response
   */
  forbidden (message = 'Forbidden') {
    return this.setStatus(HTTP_STATUS.FORBIDDEN)
      .setError(HTTP_STATUS.FORBIDDEN, message);
  }

  /**
   * Create validation error response
   */
  validation (errors) {
    return this.setValidationErrors(errors);
  }

  /**
   * Create server error response
   */
  serverError (message = 'Internal server error') {
    return this.setStatus(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .setError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }

  /**
   * Create bad request response
   */
  badRequest (message = 'Bad request') {
    return this.setStatus(HTTP_STATUS.BAD_REQUEST)
      .setError(HTTP_STATUS.BAD_REQUEST, message);
  }
}

/**
 * Factory function to create response builders
 */
const createResponseBuilder = (res) => new ResponseBuilder(res);

/**
 * Middleware to attach response builder to response object
 */
const responseBuilderMiddleware = (_req, res, next) => {
  res.builder = () => createResponseBuilder(res);
  next();
};

module.exports = {
  ResponseBuilder,
  createResponseBuilder,
  responseBuilderMiddleware
};
