'use strict';

/**
 * Error types and utilities module - Standardized error handling system
 * 
 * This module provides a comprehensive error classification and handling system
 * that standardizes error responses across the application. It includes custom
 * error classes, utility functions, and factory methods for creating consistent
 * error objects with proper HTTP status codes and severity levels.
 * 
 * Design rationale:
 * - Standardize error responses for API consumers
 * - Provide clear error classification for monitoring and debugging
 * - Enable proper HTTP status code mapping based on error types
 * - Support both Express middleware and standalone error handling
 */

// Import configuration constants that define error classifications and mappings
const localVars = require('../config/localVars');
const { 
  ErrorTypes,           // Enumeration of standard error types (VALIDATION, AUTH, etc.)
  ErrorSeverity,        // Enumeration of severity levels (CRITICAL, HIGH, MEDIUM, LOW)
  ERROR_STATUS_MAP,     // Maps error types to HTTP status codes
  ERROR_SEVERITY_MAP    // Maps error types to severity levels
} = localVars;

/**
 * Custom ServiceError class - Enhanced error objects with standardized properties
 * 
 * This class extends the native Error class to provide additional properties
 * needed for proper error handling in web applications. It automatically maps
 * error types to HTTP status codes and severity levels, includes context
 * information, and provides clean JSON serialization for API responses.
 * 
 * @param {string} message - Human-readable error message
 * @param {string} type - Error type from ErrorTypes enumeration
 * @param {Object} context - Additional context information (optional)
 * @param {Error|null} cause - Original error that caused this error (optional)
 */
class ServiceError extends Error {
  constructor(message, type, context = {}, cause = null) {
    super(message);  // Call parent constructor with message
    
    // Set custom properties for enhanced error handling
    this.name = 'ServiceError';                    // Class name for identification
    this.type = type;                              // Error classification
    this.context = context;                        // Additional context data
    this.cause = cause;                            // Original error (chaining)
    
    // Auto-map error type to HTTP status code and severity
    this.statusCode = ERROR_STATUS_MAP[type] || 500;  // Default to 500 if unknown
    this.severity = ERROR_SEVERITY_MAP[type] || ErrorSeverity.MEDIUM; // Default severity
    this.timestamp = new Date().toISOString();     // Error occurrence time
    
    // Capture stack trace for debugging (only available in V8/Node.js)
    Error.captureStackTrace && Error.captureStackTrace(this, ServiceError);
  }

  /**
   * JSON serialization for API responses
   * 
   * This method provides a clean, serializable representation of the error
   * that can be safely sent to API consumers. It includes all relevant
   * information while excluding circular references and internal details.
   * 
   * @returns {Object} Serializable error object
   */
  toJSON() {
    return {
      name: this.name,                    // Error class name
      message: this.message,              // Human-readable message
      type: this.type,                    // Error classification
      context: this.context,              // Additional context
      statusCode: this.statusCode,        // HTTP status code
      severity: this.severity,            // Error severity level
      timestamp: this.timestamp,          // When error occurred
      cause: this.cause ? {               // Original error info (if any)
        message: this.cause.message,
        stack: this.cause.stack
      } : null
    };
  }
}

/**
 * Error utilities collection - Factory functions for common error scenarios
 * 
 * This object provides convenient factory methods for creating standardized
 * errors for common scenarios like validation failures, authentication issues,
 * and external API errors. Each method creates a properly configured ServiceError
 * with appropriate type, message, and context.
 */
const errorUtils = {
  /**
   * Create a validation error with field-specific information
   * 
   * @param {string} field - Name of the field that failed validation
   * @param {*} value - The value that was provided (for debugging)
   * @returns {ServiceError} Validation error object
   */
  validation: (field, value) => {
    // Generate appropriate message based on validation failure type
    const message = value === undefined || value === null || value === ''
      ? `${field} is required`                    // Missing value
      : `Invalid ${field}: ${typeof value} ${value}`; // Invalid value
    
    return new ServiceError(message, ErrorTypes.VALIDATION, { field, value });
  },

  /**
   * Create an authentication error for service-specific failures
   * 
   * @param {string} serviceName - Name of the service that failed authentication
   * @returns {ServiceError} Authentication error object
   */
  authentication: serviceName => new ServiceError(
    `${serviceName} authentication failed`,
    ErrorTypes.AUTHENTICATION,
    { serviceName }
  ),

  /**
   * Create an authorization error for permission-based failures
   * 
   * @param {string} action - The action that user was not authorized to perform
   * @returns {ServiceError} Authorization error object
   */
  authorization: action => new ServiceError(
    `Insufficient permissions to ${action}`,
    ErrorTypes.AUTHORIZATION,
    { action }
  ),

  /**
   * Create an external API error with original error chaining
   * 
   * @param {string} serviceName - Name of the external service
   * @param {Error} originalError - The original error from the external service
   * @returns {ServiceError} Network/external API error object
   */
  externalApi: (serviceName, originalError) => new ServiceError(
    `${serviceName} API error: ${originalError.message}`,
    ErrorTypes.NETWORK,
    { serviceName },
    originalError  // Chain the original error for debugging
  ),

  /**
   * Create an internal system error
   * 
   * @param {string} message - Error message describing the internal issue
   * @param {Object} context - Additional context information
   * @returns {ServiceError} System error object
   */
  internal: (message, context = {}) => new ServiceError(
    message,
    ErrorTypes.SYSTEM,
    context
  ),

  /**
   * Wrap any error in a ServiceError for consistent handling
   * 
   * This utility ensures that all errors are ServiceError instances,
   * providing consistent error handling throughout the application.
   * 
   * @param {Error|*} error - The error to wrap (can be any type)
   * @param {string} defaultMessage - Default message if error is not an Error object
   * @returns {ServiceError} Wrapped error object
   */
  wrap: (error, defaultMessage) => {
    // If it's already a ServiceError, return as-is
    if (error instanceof ServiceError) return error;
    
    // If it's a native Error, wrap it with system type
    if (error instanceof Error) {
      return new ServiceError(error.message, ErrorTypes.SYSTEM, undefined, error);
    }
    
    // For non-Error objects, create a system error with the object as context
    return new ServiceError(defaultMessage, ErrorTypes.SYSTEM, { originalError: error });
  },

  /**
   * Async error handler wrapper for operations
   * 
   * This function wraps async operations and automatically converts any
   * thrown errors to ServiceError instances. It's useful for controller
   * functions and other async operations that need consistent error handling.
   * 
   * @param {Function} operation - Async function to execute
   * @param {string} errorMessage - Default error message if operation fails
   * @returns {*} Result of the operation or throws wrapped error
   */
  asyncHandler: async (operation, errorMessage) => {
    try {
      return await operation();
    } catch (error) {
      // Wrap and re-throw any errors as ServiceError instances
      throw errorUtils.wrap(error, errorMessage);
    }
  }
};

/**
 * Safe utilities collection - Error-safe operations that never throw
 * 
 * This object provides utilities that execute operations safely and return
 * result objects instead of throwing exceptions. This is useful for scenarios
 * where you need to handle errors gracefully without try-catch blocks.
 */
const safeUtils = {
  /**
   * Execute an async operation safely and return a result object
   * 
   * This function executes any async operation and catches any errors,
   * returning a standardized result object that indicates success or failure.
   * It never throws, making it safe to use in contexts where exceptions
   * would be problematic.
   * 
   * @param {Function} operation - Async function to execute
   * @returns {Object} Result object with success flag and data or error
   */
  execute: async operation => {
    try {
      const data = await operation();
      return { success: true, data };  // Successful execution
    } catch (error) {
      return { success: false, error };  // Failed execution
    }
  },

  /**
   * Validate a value using a validator function safely
   * 
   * This function validates a value using a provided validator function.
   * It handles both validation failures and validator function errors,
   * returning a standardized result object. The validator should return
   * true for valid values and false for invalid values.
   * 
   * @param {*} value - Value to validate
   * @param {Function} validator - Function that returns true/false for validity
   * @param {string} field - Field name for error messages
   * @returns {Object} Result object with success flag and data or error
   */
  validate: (value, validator, field) => {
    try {
      const isValid = validator(value);
      if (isValid) {
        return { success: true, data: value };  // Validation passed
      }
      // Validation failed - create appropriate error
      return { 
        success: false, 
        error: errorUtils.validation(field, value) 
      };
    } catch (error) {
      // Validator function threw an error
      return { success: false, error };
    }
  }
};

/**
 * Create a typed ServiceError with optional error code
 * 
 * This factory function creates a ServiceError with the specified parameters.
 * It's a lower-level factory that provides more control over error creation
 * compared to the more specific factory methods in ErrorFactory.
 * 
 * @param {string} message - Human-readable error message
 * @param {string} type - Error type from ErrorTypes enumeration
 * @param {string|null} code - Optional error code for API responses
 * @param {Object} context - Additional context information
 * @returns {ServiceError} Configured error object
 */
const createTypedError = (message, type, code = null, context = {}) => {
  const error = new ServiceError(message, type, context);
  if (code) error.code = code;  // Set error code if provided
  return error;
};

/**
 * Create a standard error with code, message, type, and context
 * 
 * This is a convenience wrapper around createTypedError that follows
 * a common pattern for API error responses where you need all four
 * parameters in a specific order.
 * 
 * @param {string} code - Error code for API responses
 * @param {string} message - Human-readable error message
 * @param {string} type - Error type from ErrorTypes enumeration
 * @param {Object} context - Additional context information
 * @returns {ServiceError} Configured error object
 */
const createStandardError = (code, message, type, context = {}) => {
  return createTypedError(message, type, code, context);
};

/**
 * ErrorFactory - High-level factory for creating standardized errors
 * 
 * This object provides factory methods for creating common error types
 * with appropriate error codes, messages, and context. Each factory method
 * is tailored for a specific error scenario and provides sensible defaults
 * while allowing customization through parameters.
 */
const ErrorFactory = {
  /**
   * Create a validation error with optional field context
   * 
   * @param {string} message - Validation error message
   * @param {string|null} field - Field name that failed validation (optional)
   * @returns {ServiceError} Validation error object
   */
  validation: (message, field = null) => createTypedError(
    message,
    ErrorTypes.VALIDATION,
    'VALIDATION_ERROR',
    field ? { field } : {}  // Include field in context if provided
  ),

  /**
   * Create an authentication error with default message
   * 
   * @param {string} message - Authentication error message (optional)
   * @returns {ServiceError} Authentication error object
   */
  authentication: (message = 'Authentication failed') => createTypedError(
    message,
    ErrorTypes.AUTHENTICATION,
    'AUTHENTICATION_ERROR'
  ),

  /**
   * Create an authorization error with default message
   * 
   * @param {string} message - Authorization error message (optional)
   * @returns {ServiceError} Authorization error object
   */
  authorization: (message = 'Insufficient permissions') => createTypedError(
    message,
    ErrorTypes.AUTHORIZATION,
    'AUTHORIZATION_ERROR'
  ),

  /**
   * Create a not found error for missing resources
   * 
   * @param {string} resource - Type/name of resource that was not found
   * @returns {ServiceError} Not found error object
   */
  notFound: (resource = 'Resource') => createTypedError(
    `${resource} not found`,
    ErrorTypes.NOT_FOUND,
    'NOT_FOUND_ERROR',
    { resource }
  ),

  /**
   * Create a rate limit error
   * 
   * @param {string} message - Rate limit error message (optional)
   * @returns {ServiceError} Rate limit error object
   */
  rateLimit: (message = 'Rate limit exceeded') => createTypedError(
    message,
    ErrorTypes.RATE_LIMIT,
    'RATE_LIMIT_ERROR'
  ),

  /**
   * Create a network error with optional service context
   * 
   * @param {string} message - Network error message
   * @param {string|null} service - Service name that failed (optional)
   * @param {Object} context - Additional context information
   * @returns {ServiceError} Network error object
   */
  network: (message, service = null, context = {}) => createTypedError(
    message,
    ErrorTypes.NETWORK,
    'NETWORK_ERROR',
    { service, ...context }  // Merge service with additional context
  ),

  /**
   * Create a database error with optional operation context
   * 
   * @param {string} message - Database error message
   * @param {string|null} operation - Database operation that failed (optional)
   * @returns {ServiceError} Database error object
   */
  database: (message, operation = null) => createTypedError(
    message,
    ErrorTypes.DATABASE,
    'DATABASE_ERROR',
    { operation }
  ),

  /**
   * Create a system error for internal failures
   * 
   * @param {string} message - System error message
   * @param {Object} context - Additional context information
   * @returns {ServiceError} System error object
   */
  system: (message, context = {}) => createTypedError(
    message,
    ErrorTypes.SYSTEM,
    'SYSTEM_ERROR',
    context
  ),

  /**
   * Create a configuration error with optional field context
   * 
   * @param {string} message - Configuration error message
   * @param {string|null} field - Configuration field name (optional)
   * @returns {ServiceError} Configuration error object
   */
  configuration: (message, field = null) => createTypedError(
    message,
    ErrorTypes.CONFIGURATION,
    'CONFIGURATION_ERROR',
    { field }
  )
};

/**
 * Handle any error and return a standardized API response format
 * 
 * This function processes any error (native Error, ServiceError, or other types)
 * and converts it to a standardized response format suitable for API consumers.
 * It ensures all errors are wrapped in ServiceError instances and includes
 * all relevant information for debugging and error handling.
 * 
 * @param {Error|*} error - The error to handle (can be any type)
 * @param {Object} context - Additional context to merge with error context
 * @returns {Object} Standardized error response object
 */
const handleSimpleError = (error, context = {}) => {
  // Ensure we have a ServiceError instance for consistent handling
  if (!(error instanceof ServiceError)) {
    error = errorUtils.wrap(error, 'An unexpected error occurred');
  }
  
  // Return standardized error response format
  return {
    success: false,  // Always false for error responses
    error: {
      code: error.code || 'INTERNAL_ERROR',  // Error code for API consumers
      message: error.message,                 // Human-readable message
      type: error.type,                       // Error classification
      severity: error.severity,               // Error severity level
      context: { ...error.context, ...context }, // Merged context information
      timestamp: error.timestamp              // When error occurred
    }
  };
};

/**
 * Express error middleware - Standardized error handling for Express applications
 * 
 * This middleware function handles errors in Express applications by converting
 * them to standardized JSON responses. It automatically includes request context
 * information (path, method, IP, user agent) and uses the appropriate HTTP status
 * code from the error object. This ensures consistent error responses across
 * all Express routes.
 * 
 * @param {Error} err - The error that occurred
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function (not used in this middleware)
 */
const errorMiddleware = (err, req, res, next) => {
  // Create standardized error response with request context
  const errorResponse = handleSimpleError(err, {
    path: req.path,                    // Request path for debugging
    method: req.method,                // HTTP method
    ip: req.ip,                        // Client IP address
    userAgent: req.get('User-Agent')   // Client user agent
  });

  // Use status code from error or default to 500
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json(errorResponse);
};

/**
 * Module exports - Complete error handling system
 * 
 * This module exports a comprehensive error handling system that provides
 * everything needed for consistent error management in Node.js applications.
 * The exports are organized by functionality for easy importing.
 */
module.exports = {
  // Core error class
  ServiceError,                    // Enhanced error class with additional properties
  
  // Utility collections
  errorUtils,                      // Factory functions for common error scenarios
  safeUtils,                       // Error-safe operations that never throw
  
  // Factory functions
  createTypedError,                // Low-level error factory with full control
  createStandardError,             // Standard error factory with common pattern
  
  // Enumerations and constants
  ErrorTypes,                      // Error type classifications
  ErrorSeverity,                   // Error severity levels
  ERROR_STATUS_MAP,               // Maps error types to HTTP status codes
  ERROR_SEVERITY_MAP,             // Maps error types to severity levels
  
  // High-level factories and handlers
  ErrorFactory,                    // High-level factory for common error types
  handleSimpleError,              // Convert any error to standardized response
  errorMiddleware                  // Express error handling middleware
};