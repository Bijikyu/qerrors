/**
 * Standardized Error Response Utility
 * 
 * Purpose: Provides consistent error response formatting across all qerrors
 * server implementations to ensure frontend-backend integration compatibility.
 * 
 * Design Rationale:
 * - Consistency: Unified error response structure across all servers
 * - Security: Prevents information disclosure through proper error filtering
 * - Compatibility: Supports both HTML and JSON responses with content negotiation
 * - Flexibility: Handles different error types and severity levels
 * - Debugging: Includes useful metadata for troubleshooting while maintaining security
 */

const crypto = require('crypto');

/**
 * Standard error response structure
 */
const ERROR_TYPES = {
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication', 
  AUTHORIZATION: 'authorization',
  NOT_FOUND: 'not_found',
  RATE_LIMIT: 'rate_limit',
  SERVER: 'server',
  CLIENT: 'client',
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  CRITICAL: 'critical'
};

/**
 * Error severity levels
 */
const SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Generate unique error identifier
 * @returns {string} Unique error ID
 */
function generateErrorId() {
  return `err_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Sanitize error message for public consumption
 * @param {string} message - Original error message
 * @param {boolean} includeStack - Whether to include stack trace (debug mode only)
 * @returns {string} Sanitized error message
 */
function sanitizeErrorMessage(message, includeStack = false) {
  if (!message || typeof message !== 'string') {
    return 'An unexpected error occurred';
  }
  
  // Remove potentially sensitive information
  let sanitized = message
    // Remove file paths (Windows and Unix)
    .replace(/[a-zA-Z]:\\[^\\s]*\//g, '[PATH]')
    .replace(/\/[^\\s]*\//g, '[PATH]')
    // Remove potential secrets
    .replace(/[A-Z0-9]{20,}/g, '[REDACTED]')
    // Remove database connection strings
    .replace(/(mongodb|mysql|postgres):\/\/[^\\s]*/gi, '[DB_CONNECTION]')
    // Remove API keys pattern
    .replace(/(api[_-]?key|token|secret)[\\s]*[:=][\\s]*['\"]?[^\\s'"]*/gi, '$1 [REDACTED]');
  
  // Truncate very long messages
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 497) + '...';
  }
  
  return sanitized.trim();
}

/**
 * Create standardized error response object
 * @param {Error} error - The error object
 * @param {Object} options - Additional options
 * @returns {Object} Standardized error response
 */
function createErrorResponse(error, options = {}) {
  const {
    type = ERROR_TYPES.SERVER,
    severity = SEVERITY_LEVELS.MEDIUM,
    includeStack = false,
    sanitize = true,
    additionalContext = {}
  } = options;
  
  const errorId = generateErrorId();
  const timestamp = new Date().toISOString();
  
  // Sanitize message if requested
  const message = sanitize 
    ? sanitizeErrorMessage(error.message, includeStack)
    : (error.message || 'An unexpected error occurred');
  
  // Base response structure
  const response = {
    success: false,
    error: {
      errorId,
      message,
      type,
      severity,
      timestamp,
      name: error.name || 'Error'
    }
  };
  
  // Add optional fields based on options and environment
  if (includeStack && error.stack && process.env.NODE_ENV !== 'production') {
    response.error.stack = sanitizeErrorMessage(error.stack, false);
  }
  
  if (error.code) {
    response.error.code = error.code;
  }
  
  if (error.status || error.statusCode) {
    response.error.httpStatus = error.status || error.statusCode;
  }
  
  // Add additional context if provided
  if (Object.keys(additionalContext).length > 0) {
    response.error.context = additionalContext;
  }
  
  return response;
}

/**
 * Create success response object
 * @param {Object} data - Response data
 * @param {Object} options - Additional options
 * @returns {Object} Standardized success response
 */
function createSuccessResponse(data, options = {}) {
  const {
    message = 'Operation successful',
    count = null,
    pagination = null,
    metadata = {}
  } = options;
  
  const response = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };
  
  // Add optional fields
  if (count !== null) {
    response.count = count;
  }
  
  if (pagination) {
    response.pagination = pagination;
  }
  
  if (Object.keys(metadata).length > 0) {
    response.metadata = metadata;
  }
  
  return response;
}

/**
 * Content negotiation helper
 * @param {Object} req - Express request object
 * @returns {boolean} Whether client wants JSON response
 */
function wantsJson(req) {
  return req.accepts('json');
}

/**
 * Send standardized error response
 * @param {Object} res - Express response object
 * @param {Error} error - The error object
 * @param {Object} options - Response options
 */
function sendErrorResponse(res, error, options = {}) {
  const { httpStatus = 500, ...responseOptions } = options;
  
  const errorResponse = createErrorResponse(error, responseOptions);
  
  if (wantsJson(res.req)) {
    return res.status(httpStatus).json(errorResponse);
  } else {
    // HTML response with XSS protection
    const escapedMessage = errorResponse.error.message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    return res.status(httpStatus).send(`<!DOCTYPE html>
<html>
<head>
  <title>Error - ${errorResponse.error.type}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .error-container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .error-id { color: #666; font-size: 14px; }
    .error-type { color: #d32f2f; font-weight: bold; }
    .error-message { margin: 20px 0; line-height: 1.5; }
    .timestamp { color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="error-container">
    <h1>Error: ${errorResponse.error.type}</h1>
    <div class="error-message">${escapedMessage}</div>
    <div class="error-id">Error ID: ${errorResponse.error.errorId}</div>
    <div class="timestamp">Time: ${errorResponse.error.timestamp}</div>
  </div>
</body>
</html>`);
  }
}

/**
 * Send standardized success response
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {Object} options - Response options
 */
function sendSuccessResponse(res, data, options = {}) {
  const successResponse = createSuccessResponse(data, options);
  
  if (wantsJson(res.req)) {
    return res.json(successResponse);
  } else {
    // Simple HTML success response
    return res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Success</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .success-container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .success { color: #2e7d32; font-weight: bold; }
  </style>
</head>
<body>
  <div class="success-container">
    <h1 class="success">${successResponse.message}</h1>
    <div class="timestamp">Time: ${successResponse.timestamp}</div>
  </div>
</body>
</html>`);
  }
}

/**
 * Error handler middleware for Express
 * @param {Object} options - Middleware options
 * @returns {Function} Express error handler middleware
 */
function createErrorHandler(options = {}) {
  const {
    includeStack = false,
    sanitize = true,
    defaultType = ERROR_TYPES.SERVER,
    defaultSeverity = SEVERITY_LEVELS.MEDIUM
  } = options;
  
  return (error, req, res, next) => {
    // Skip if headers already sent
    if (res.headersSent) {
      return next(error);
    }
    
    // Determine error type and HTTP status
    let type = defaultType;
    let severity = defaultSeverity;
    let httpStatus = 500;
    
    // Classify error based on properties
    if (error.name === 'ValidationError') {
      type = ERROR_TYPES.VALIDATION;
      severity = SEVERITY_LEVELS.LOW;
      httpStatus = 400;
    } else if (error.name === 'UnauthorizedError' || error.type === 'auth') {
      type = ERROR_TYPES.AUTHENTICATION;
      severity = SEVERITY_LEVELS.MEDIUM;
      httpStatus = 401;
    } else if (error.status === 403) {
      type = ERROR_TYPES.AUTHORIZATION;
      severity = SEVERITY_LEVELS.MEDIUM;
      httpStatus = 403;
    } else if (error.status === 404 || error.code === 'ENOENT') {
      type = ERROR_TYPES.NOT_FOUND;
      severity = SEVERITY_LEVELS.LOW;
      httpStatus = 404;
    } else if (error.type === 'rate_limit') {
      type = ERROR_TYPES.RATE_LIMIT;
      severity = SEVERITY_LEVELS.MEDIUM;
      httpStatus = 429;
    } else if (error.severity === 'critical') {
      type = ERROR_TYPES.CRITICAL;
      severity = SEVERITY_LEVELS.CRITICAL;
      httpStatus = 500;
    }
    
    // Additional context from request
    const additionalContext = {
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    };
    
    sendErrorResponse(res, error, {
      httpStatus,
      type,
      severity,
      includeStack,
      sanitize,
      additionalContext
    });
  };
}

module.exports = {
  ERROR_TYPES,
  SEVERITY_LEVELS,
  generateErrorId,
  sanitizeErrorMessage,
  createErrorResponse,
  createSuccessResponse,
  wantsJson,
  sendErrorResponse,
  sendSuccessResponse,
  createErrorHandler
};