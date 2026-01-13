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
const { sanitizeErrorMessage, classifyError, createUserFriendlyMessage } = require('./errorFiltering');

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


  
  // Remove potentially sensitive information with comprehensive patterns
  let sanitized = message;
  
  // Remove file paths (Windows and Unix)
  sanitized = sanitized.replace(/[a-zA-Z]:\\\\[^\\\\s]*\\\\/g, '[PATH]');
  sanitized = sanitized.replace(/\/[^\\s]*\//g, '[PATH]');
  sanitized = sanitized.replace(/[a-zA-Z]:\\\\[^\\\\s]*/g, '[PATH]');
  
  // Remove potential secrets and tokens
  sanitized = sanitized.replace(/[A-Za-z0-9+\/]{20,}={0,2}/g, '[REDACTED]'); // Base64 patterns
  sanitized = sanitized.replace(/[A-Fa-f0-9]{32,}/g, '[REDACTED]'); // Hash patterns
  sanitized = sanitized.replace(/[A-Z0-9]{15,}/g, '[REDACTED]'); // API keys/tokens
  
  // Remove database connection strings
  sanitized = sanitized.replace(/(mongodb|mysql|postgres|redis):\/\/[^\\s]*/gi, '[DB_CONNECTION]');
  sanitized = sanitized.replace(/(password|pwd|pass)[\\s]*[:=][\\s]*[^\\s,;}\)]+/gi, '$1 [REDACTED]');
  
  // Remove API keys and tokens
  sanitized = sanitized.replace(/(api[_-]?key|token|secret|auth)[\\s]*[:=][\\s]*['\"]?[^\\s'\"]*/gi, '$1 [REDACTED]');
  
  // Remove environment variable references
  sanitized = sanitized.replace(/\\$\\{[^}]+\\}/g, '[ENV_VAR]');
  
  // Remove IP addresses (unless clearly localhost)
  sanitized = sanitized.replace(/\\b(?!127\\.0\\.0\\.1\\b)(?!localhost\\b)(\\d{1,3}\\.){3}\\d{1,3}\\b/g, '[IP_ADDRESS]');
  
  // Remove URLs with potential sensitive data
  sanitized = sanitized.replace(/https?:\/\/[^\\s]*[\\?\\#][^\\s]*/gi, '[URL_WITH_PARAMS]');
  
  // Remove SQL injection attempts from error messages
  sanitized = sanitized.replace(/(['\\\\']|[;]|--|\\s+(or|and)\\s+[\\d\\s=]+|\\s+(union|select|insert|update|delete|drop|create|alter|exec)\\s+/gi, '[SQL_ATTEMPT]');
  
  // Remove email addresses
  sanitized = sanitized.replace(/\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b/g, '[EMAIL]');
  
  // Remove phone numbers
  sanitized = sanitized.replace(/\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b/g, '[PHONE]');
  
  // Remove sensitive configuration keys
  sanitized = sanitized.replace(/(jwt_secret|private_key|access_key|secret_key)[\\s]*[:=][\\s]*[^\\s,;}\)]+/gi, '$1 [REDACTED]');
  
  // Remove excessive repeated characters that might indicate data leakage
  .replace(/(.)\1{10,}/g, '$1$1$1');
  
  // Truncate very long messages to prevent information disclosure
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 497) + '...';
  }
  
  // Additional cleanup for common error patterns that shouldn't be exposed
  sanitized = sanitized
    // Remove stack trace line numbers from error messages
    .replace(/:\d+:\d+/g, ':LINE:COL')
    // Remove internal module paths
    .replace(/node_modules[\\\/][^\\\/]*[\\\/]/g, 'node_modules/')
    .replace(/@[^\\\/]*[\\\/]/g, '@/');
    // Remove build/compile paths
    .replace(/[\\\/](dist|build|out)[\\\/]/g, '/build/');
  
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