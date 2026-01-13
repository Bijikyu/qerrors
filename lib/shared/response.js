'use strict';

const localVars = require('../../config/localVars');
const { HTTP_STATUS, DEFAULT_MESSAGES } = localVars;
const { safeQerrors } = require('./safeWrappers');

/**
 * Response Builder Class - Fluent API for HTTP Response Construction
 *
 * Purpose: Provides a flexible, chainable interface for building complex HTTP
 * responses in Express.js applications. This class implements the builder pattern
 * to enable readable, maintainable response construction with comprehensive
 * metadata management and error handling.
 *
 * Design Rationale:
 * - Fluent interface: Enables method chaining for readable response construction
 * - Flexible metadata: Supports arbitrary metadata addition for debugging and monitoring
 * - Consistent structure: Ensures all responses follow the same format
 * - Error safety: Automatically handles error status codes and success flags
 * - Performance tracking: Built-in support for processing time measurement
 * - Header management: Allows custom HTTP headers to be set before sending
 *
 * Usage Pattern:
 * const builder = new ResponseBuilder(res);
 * await builder
 *   .setStatus(200)
 *   .setData(userData)
 *   .setRequestId(req.id)
 *   .setProcessingTime(startTime)
 *   .send();
 *
 * Response Structure:
 * {
 *   "success": boolean,
 *   "data": any,           // only for successful responses
 *   "error": number,       // only for error responses
 *   "message": string,     // only for error responses
 *   "requestId": string,   // optional metadata
 *   "processingTime": number, // optional metadata
 *   "pagination": {...}    // optional metadata
 * }
 */
class ResponseBuilder {
  /**
   * Initialize Response Builder with Express response object
   *
   * @param {Object} res - Express response object
   *
   * Constructor initializes default values for all response properties.
   * The builder starts in a successful state (HTTP 200) and can be
   * modified through chained method calls.
   */
  constructor (res) {
    this.res = res;
    this.status = HTTP_STATUS.OK; // Default to 200 OK
    this.data = null; // Response payload
    this.error = null; // Error code or details
    this.message = ''; // Error or success message
    this.success = true; // Success flag
    this.metadata = {}; // Additional response metadata
    this.headers = {}; // Custom HTTP headers
  }

  /**
   * Set HTTP status code and update success flag accordingly
   *
   * This method automatically sets the success flag to false for any
   * HTTP status code 400 or higher, ensuring consistency between the
   * status code and the success state of the response.
   *
   * @param {number} status - HTTP status code (e.g., 200, 404, 500)
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.setStatus(404); // Automatically sets success to false
   */
  setStatus (status) {
    this.status = status;
    // Automatically mark as failed for client/server error status codes
    if (status >= 400) {
      this.success = false;
    }
    return this;
  }

  /**
   * Manually set the success state of the response
   *
   * This method allows explicit control over the success flag,
   * which is useful when you need to override the automatic
   * success detection based on status codes.
   *
   * @param {boolean} success - Whether the response should be marked as successful
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.setSuccess(false).setStatus(200); // Custom failed response with 200 status
   */
  setSuccess (success) {
    this.success = success;
    return this;
  }

  /**
   * Set the response payload data
   *
   * This method sets the main data payload that will be included
   * in successful responses. The data can be any JSON-serializable
   value including objects, arrays, strings, numbers, etc.
   *
   * @param {*} data - Response payload data (any JSON-serializable value)
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.setData({ id: 1, name: 'John' });
   * builder.setData([1, 2, 3, 4, 5]);
   * builder.setData('Operation completed successfully');
   */
  setData (data) {
    this.data = data;
    return this;
  }

  /**
   * Set error information and automatically configure error response
   *
   * This method configures the response as an error response by setting
   * the error details, marking success as false, and automatically setting
   * an appropriate HTTP status code if none has been set yet.
   *
   * @param {*} error - Error information (can be error code, error object, or details)
   * @param {string|null} [message=null] - Optional error message override
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.setError(404, 'User not found');
   * builder.setError(new Error('Database connection failed'));
   * builder.setError('VALIDATION_ERROR', 'Invalid input data');
   */
  setError (error, message = null) {
    this.error = error;
    this.success = false; // Mark as failed response

    // Set custom error message if provided
    if (message) {
      this.message = message;
    }

    // Auto-set error status if still in default success state
    if (this.status === HTTP_STATUS.OK) {
      this.status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    }

    return this;
  }

  /**
   * Set the response message
   *
   * This method sets a human-readable message that will be included
   * in the response. Messages are typically used for error descriptions
   * or success notifications that provide context to the client.
   *
   * @param {string} message - Response message for client consumption
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.setMessage('User created successfully');
   * builder.setMessage('Invalid email format provided');
   */
  setMessage (message) {
    this.message = message;
    return this;
  }

  /**
   * Add metadata to the response (flexible key-value or object input)
   *
   * This method allows adding arbitrary metadata that will be included
   * in the response. Metadata is useful for debugging, monitoring,
   * pagination information, or any additional context that should
   * be provided to the client.
   *
   * The method supports two calling patterns:
   * 1. addMetadata(key, value) - Add single key-value pair
   * 2. addMetadata(object) - Merge object with existing metadata
   *
   * @param {string|Object} key - Either a metadata key string or an object to merge
   * @param {*} [value] - Value to set when key is a string (ignored when key is object)
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * // Single key-value pair
   * builder.addMetadata('requestId', 'req-123');
   * builder.addMetadata('version', '1.0.0');
   *
   * // Object merge
   * builder.addMetadata({
   *   requestId: 'req-123',
   *   processingTime: 150,
   *   pagination: { page: 1, total: 100 }
   * });
   */
  addMetadata (key, value) {
    if (typeof key === 'object') {
      // Merge object with existing metadata
      this.metadata = { ...this.metadata, ...key };
    } else {
      // Set single key-value pair
      this.metadata[key] = value;
    }
    return this;
  }

  /**
   * Add a custom HTTP header to the response
   *
   * This method allows setting custom HTTP headers that will be
   * included in the response when sent. Headers are useful for
   * caching, CORS, rate limiting, authentication tokens, and
   * other HTTP-level concerns.
   *
   * @param {string} key - HTTP header name (case-insensitive per HTTP spec)
   * @param {string} value - HTTP header value
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.addHeader('X-Request-ID', 'req-123');
   * builder.addHeader('Cache-Control', 'no-cache');
   * builder.addHeader('X-Rate-Limit-Remaining', '45');
   */
  addHeader (key, value) {
    this.headers[key] = value;
    return this;
  }

  /**
   * Add multiple HTTP headers at once
   *
   * This method allows setting multiple headers simultaneously by
   * merging a headers object with the existing headers. This is useful
   * when you need to set several headers at once, such as for CORS
   * configuration or authentication headers.
   *
   * @param {Object} headers - Object containing header key-value pairs
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.addHeaders({
   *   'Access-Control-Allow-Origin': '*',
   *   'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
   *   'X-Request-ID': 'req-123',
   *   'Cache-Control': 'no-cache, no-store'
   * });
   */
  addHeaders (headers) {
    this.headers = { ...this.headers, ...headers };
    return this;
  }

  /**
   * Set request ID for response tracking and debugging
   *
   * This convenience method adds a request ID to the response metadata,
   * which is essential for tracking requests across distributed systems,
   * debugging issues, and correlating logs with specific requests.
   *
   * @param {string} requestId - Unique identifier for this request
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.setRequestId('req-abc-123-def-456');
   * // Results in: { "requestId": "req-abc-123-def-456" }
   */
  setRequestId (requestId) {
    return this.addMetadata('requestId', requestId);
  }

  /**
   * Calculate and add processing time to response metadata
   *
   * This convenience method automatically calculates the time elapsed
   * since the provided start time and adds it to the response metadata.
   * Processing time is useful for performance monitoring, SLA tracking,
   * and identifying slow endpoints.
   *
   * @param {number} startTime - Timestamp (in milliseconds) when processing began
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * const startTime = Date.now();
   * // ... perform operations ...
   * builder.setProcessingTime(startTime);
   * // Results in: { "processingTime": 150 } (if 150ms elapsed)
   */
  setProcessingTime (startTime) {
    if (startTime) {
      const processingTime = Date.now() - startTime;
      this.addMetadata('processingTime', processingTime);
    }
    return this;
  }

  /**
   * Add comprehensive pagination metadata to response
   *
   * This convenience method creates detailed pagination information
   * that clients can use to implement pagination controls. The metadata
   * includes current page info, total counts, and navigation helpers
   * for building "next" and "previous" page links.
   *
   * @param {number} page - Current page number (1-based)
   * @param {number} limit - Number of items per page
   * @param {number} total - Total number of items across all pages
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.setPagination(2, 10, 95);
   * // Results in:
   * // {
   * //   "pagination": {
   * //     "page": 2,
   * //     "limit": 10,
   * //     "total": 95,
   * //     "totalPages": 10,
   * //     "hasNext": true,
   * //     "hasPrev": true
   * //   }
   * // }
   */
  setPagination (page, limit, total) {
    return this.addMetadata({
      pagination: {
        page, // Current page (1-based)
        limit, // Items per page
        total, // Total items across all pages
        totalPages: Math.ceil(total / limit), // Total number of pages
        hasNext: page * limit < total, // Whether next page exists
        hasPrev: page > 1 // Whether previous page exists
      }
    });
  }

  /**
   * Configure response for validation error with detailed error information
   *
   * This method is specifically designed for handling validation failures
   * by automatically setting the appropriate HTTP status code (400),
   * configuring the response as an error, and including detailed
   * validation error information that clients can use to fix their input.
   *
   * @param {Array|Object} errors - Validation error details (array of error objects or single error)
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.setValidationErrors([
   *   { field: 'email', message: 'Invalid email format' },
   *   { field: 'password', message: 'Password must be at least 8 characters' }
   * ]);
   *
   * // Results in:
   * // {
   * //   "success": false,
   * //   "error": 400,
   * //   "message": "Validation failed",
   * //   "errors": [
   * //     { "field": "email", "message": "Invalid email format" },
   * //     { "field": "password", "message": "Password must be at least 8 characters" }
   * //   ]
   * // }
   */
  setValidationErrors (errors) {
    this.error = HTTP_STATUS.BAD_REQUEST;
    this.success = false;
    this.message = DEFAULT_MESSAGES.VALIDATION_FAILED;
    this.addMetadata('errors', errors);
    this.setStatus(HTTP_STATUS.BAD_REQUEST);
    return this;
  }

  /**
   * Build the final response object based on current builder state
   *
   * This method constructs the final response object that will be sent
   * to the client. It follows a specific structure based on whether
   * the response is successful or an error, and includes all metadata
   * that has been added to the builder.
   *
   * The response structure varies based on success state:
   * - Success: includes data field, excludes error fields
   * - Error: includes error and message fields, excludes data field
   * - Both: include metadata fields at top level
   *
   * @returns {Object} Complete response object ready for JSON serialization
   *
   * Example Success Response:
   * {
   *   "success": true,
   *   "data": { "id": 1, "name": "John" },
   *   "requestId": "req-123",
   *   "processingTime": 150
   * }
   *
   * Example Error Response:
   * {
   *   "success": false,
   *   "error": 404,
   *   "message": "User not found",
   *   "requestId": "req-123"
   * }
   */
  build () {
    const response = {
      success: this.success
    };

    // Include data only for successful responses
    if (this.success) {
      response.data = this.data;
    } else {
      // Include error information only for failed responses
      if (this.error !== null) {
        response.error = this.error;
      }
      if (this.message) {
        response.message = this.message;
      }
    }

    // Add all metadata as top-level fields (optimized for scalability)
    // This allows metadata like requestId, processingTime, pagination, etc.
    // to be included directly in the response without nesting
    // Use Object.assign for better performance than forEach
    Object.assign(response, this.metadata);

    return response;
  }

  /**
   * Send the configured response via Express
   *
   * This method finalizes the response by applying all configured headers,
   * building the response object, and sending it through the Express
   * response object with the appropriate HTTP status code.
   *
   * The method handles all the low-level details of HTTP response
   * construction including header setting, status code application,
   * and JSON serialization. After calling this method, the response
   * is considered complete and no further modifications should be made.
   *
   * @returns {Object} Returns the Express response object for chaining
   *
   * Example:
   * const response = await builder
   *   .setData(userData)
   *   .setRequestId(req.id)
   *   .addHeader('X-Custom-Header', 'value')
   *   .send();
   */
  send () {
    // Apply all configured custom headers before sending (optimized for scalability)
    // Use multiple res.set calls which is more efficient than Object.entries + forEach
    for (const [key, value] of Object.entries(this.headers)) {
      this.res.set(key, value);
    }

    // Build the final response object and send with status code
    const response = this.build();
    return this.res.status(this.status).json(response);
  }

  // ====================================================================
  // CONVENIENCE METHODS - Common response patterns
  // ====================================================================

  /**
   * Create a standard success response (HTTP 200)
   *
   * This convenience method configures the builder for a successful
   * response with HTTP 200 status, sets the provided data, and
   * optionally adds metadata. This is the most common response pattern
   * for successful API operations.
   *
   * @param {*} data - Response payload data
   * @param {Object} [options={}] - Optional metadata to include
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.success({ id: 1, name: 'John' }, { requestId: 'req-123' });
   */
  success (data, options = {}) {
    return this.setStatus(HTTP_STATUS.OK)
      .setData(data)
      .setSuccess(true)
      .addMetadata(options);
  }

  /**
   * Create a resource created response (HTTP 201)
   *
   * This convenience method configures the builder for a successful
   * resource creation response with HTTP 201 status. This should be used
   * when a new resource has been successfully created as a result of
   * a POST request.
   *
   * @param {*} data - Created resource data or confirmation message
   * @param {Object} [options={}] - Optional metadata to include
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.created({ id: 123, name: 'New User', createdAt: '2024-01-01' });
   */
  created (data, options = {}) {
    return this.setStatus(HTTP_STATUS.CREATED)
      .setData(data)
      .setSuccess(true)
      .addMetadata(options);
  }

  /**
   * Create a not found error response (HTTP 404)
   *
   * This convenience method configures the builder for a 404 Not Found
   * error response. Use this when the requested resource does not exist
   * or cannot be found. The method automatically sets the error status
   * and configures the response as an error.
   *
   * @param {string} [message=DEFAULT_MESSAGES.NOT_FOUND] - Custom error message
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.notFound('User with ID 123 not found');
   * builder.notFound(); // Uses default message
   */
  notFound (message = DEFAULT_MESSAGES.NOT_FOUND) {
    return this.setStatus(HTTP_STATUS.NOT_FOUND)
      .setError(HTTP_STATUS.NOT_FOUND, message);
  }

  /**
   * Create an unauthorized error response (HTTP 401)
   *
   * This convenience method configures the builder for a 401 Unauthorized
   * error response. Use this when the client lacks valid authentication
   * credentials for the target resource. This indicates that authentication
   * is required but has not been provided or is invalid.
   *
   * @param {string} [message=DEFAULT_MESSAGES.UNAUTHORIZED] - Custom error message
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.unauthorized('Invalid or missing API key');
   * builder.unauthorized(); // Uses default message
   */
  unauthorized (message = DEFAULT_MESSAGES.UNAUTHORIZED) {
    return this.setStatus(HTTP_STATUS.UNAUTHORIZED)
      .setError(HTTP_STATUS.UNAUTHORIZED, message);
  }

  /**
   * Create a forbidden error response (HTTP 403)
   *
   * This convenience method configures the builder for a 403 Forbidden
   * error response. Use this when the client is authenticated but does
   * not have permission to access the requested resource. This differs
   * from 401 Unauthorized in that authentication was successful but
   * authorization failed.
   *
   * @param {string} [message=DEFAULT_MESSAGES.FORBIDDEN] - Custom error message
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.forbidden('Admin access required for this operation');
   * builder.forbidden(); // Uses default message
   */
  forbidden (message = DEFAULT_MESSAGES.FORBIDDEN) {
    return this.setStatus(HTTP_STATUS.FORBIDDEN)
      .setError(HTTP_STATUS.FORBIDDEN, message);
  }

  /**
   * Create a validation error response (HTTP 400)
   *
   * This convenience method configures the builder for a 400 Bad Request
   * response specifically for validation failures. It uses the specialized
   * setValidationErrors method to ensure proper error formatting and
   * includes detailed validation error information.
   *
   * @param {Array|Object} errors - Validation error details
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.validation([
   *   { field: 'email', message: 'Invalid format' },
   *   { field: 'age', message: 'Must be 18 or older' }
   * ]);
   */
  validation (errors) {
    return this.setValidationErrors(errors);
  }

  /**
   * Create a server error response (HTTP 500)
   *
   * This convenience method configures the builder for a 500 Internal Server
   * Error response. Use this when an unexpected condition was encountered
   * that prevented the server from fulfilling the request. This indicates a
   * server-side problem that is not the client's fault.
   *
   * @param {string} [message=DEFAULT_MESSAGES.INTERNAL_ERROR] - Custom error message
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.serverError('Database connection failed');
   * builder.serverError(); // Uses default message
   */
  serverError (message = DEFAULT_MESSAGES.INTERNAL_ERROR) {
    return this.setStatus(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .setError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }

  /**
   * Create a bad request error response (HTTP 400)
   *
   * This convenience method configures the builder for a 400 Bad Request
   * error response. Use this when the client sends a malformed request
   * or when the request cannot be processed due to client-side issues
   * that are not specifically validation errors.
   *
   * @param {string} [message=DEFAULT_MESSAGES.NOT_FOUND] - Custom error message
   * @returns {ResponseBuilder} Returns this instance for method chaining
   *
   * Example:
   * builder.badRequest('Invalid JSON format in request body');
   * builder.badRequest(); // Uses default message
   */
  badRequest (message = DEFAULT_MESSAGES.NOT_FOUND) {
    return this.setStatus(HTTP_STATUS.BAD_REQUEST)
      .setError(HTTP_STATUS.BAD_REQUEST, message);
  }
}

// ====================================================================
// FUNCTIONAL HELPERS - Backward compatibility and convenience functions
// ====================================================================

/**
 * Base JSON response sender with header safety check
 *
 * This is the foundational function for sending JSON responses. It includes
 * a safety check to prevent attempting to send a response if headers have
 * already been sent, which would cause a "Cannot set headers after they are sent"
 * error in Express.
 *
 * Design Rationale:
 * - Header safety: Prevents Express errors when headers already sent
 * - Simplicity: Provides the most basic response sending capability
 * - Reliability: Returns the response object whether sent or not
 *
 * @param {Object} res - Express response object
 * @param {number} status - HTTP status code
 * @param {*} data - Response data (will be JSON serialized)
 * @returns {Object} Express response object
 *
 * Example:
 * sendJsonResponse(res, 200, { success: true, data: userData });
 */
const sendJsonResponse = (res, status, data) => {
  // Safety check: only send if headers haven't been sent yet
  if (!res.headersSent) {
    return res.status(status).json(data);
  }
  return res;
};

/**
 * Create standardized response data structure with flexible input handling
 *
 * This function creates a consistent response object structure that varies
 * based on whether the response is successful or an error. It intelligently
 * handles different input types and automatically configures error responses
 * when needed.
 *
 * Design Rationale:
 * - Consistency: Ensures all responses follow the same structure
 * - Flexibility: Handles different input types (strings, numbers, objects)
 * - Performance tracking: Optional processing time calculation
 * - Error safety: Provides sensible defaults for error responses
 *
 * @param {boolean} success - Whether the response is successful
 * @param {*} dataOrMessage - Response data for success or error message for failures
 * @param {Object} [options={}] - Configuration options
 * @param {boolean} [options.includeProcessingTime=false] - Whether to include processing time
 * @param {number} [options.startTime=null] - Start time for processing time calculation
 * @returns {Object} Standardized response data object
 *
 * Example Success:
 * createResponseData(true, { id: 1, name: 'John' });
 * // Returns: { success: true, data: { id: 1, name: 'John' } }
 *
 * Example Error:
 * createResponseData(false, 'User not found');
 * // Returns: { success: false, error: 500, message: 'User not found' }
 *
 * Example with Processing Time:
 * createResponseData(true, userData, { includeProcessingTime: true, startTime: Date.now() - 100 });
 * // Returns: { success: true, data: userData, processingTime: 100 }
 */
const createResponseData = (success, dataOrMessage, options = {}) => {
  const { includeProcessingTime = false, startTime = null } = options;
  const responseData = { success };

  if (success) {
    // Success response: include data payload
    responseData.data = dataOrMessage;
  } else {
    // Error response: configure error code and message
    responseData.error = typeof dataOrMessage === 'number' ? dataOrMessage : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    responseData.message = typeof dataOrMessage === 'string' ? dataOrMessage : DEFAULT_MESSAGES.INTERNAL_ERROR;
  }

  // Optional processing time calculation
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

  sendJsonResponse(res, status, {
    error: message,
    details: err.details || (expose && err instanceof Error ? err.message : undefined)
  });
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
      const { safeErrorMessage } = require('./logging');
      const message = safeErrorMessage(error, 'Unknown error');
      sendJsonResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, { error: message, context });
    }
  } catch {
    const message = error instanceof Error ? error.message : 'Unknown error';
    sendJsonResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, { error: message, context });
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
