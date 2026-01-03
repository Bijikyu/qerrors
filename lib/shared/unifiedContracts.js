/**
 * Unified Contracts Module
 *
 * Purpose: Consolidates error contracts, operation contracts, and validation
 * into a single comprehensive module to eliminate duplication and provide
 * consistent interfaces across the qerrors codebase.
 *
 * Design Philosophy:
 * - Unification: Merge related contract definitions
 * - Consistency: Standardized interfaces across all operations
 * - Security: Built-in sanitization and validation
 * - Performance: Optimized for high-throughput scenarios
 * - Maintainability: Single source of truth for all contracts
 */

const { LOG_LEVELS } = require('./constants');
const { createUnifiedTimer } = require('./execution');
const { safeLogError, safeLogInfo, safeLogDebug, safeLogWarn } = require('./logging');
const localVars = require('../../config/localVars');
const config = require('../config');

// Import security utilities for sanitization
const { sanitizeErrorMessage, sanitizeContextForLog } = require('./security');

/**
 * Standard Operation Options Contract
 *
 * Defines the standardized interface for all async operations in qerrors.
 * This contract ensures consistent behavior and comprehensive tracking
 * across all operation types.
 *
 * @typedef {Object} StandardOperationOptions
 * @property {string} operationName - Human-readable operation name for logging/debugging
 * @property {string} [requestId] - Request tracking identifier for correlation
 * @property {Object} [context] - Additional context data for logging and error handling
 * @property {boolean} [enableTiming=true] - Enable performance timing for operation
 * @property {boolean} [enableLogging=true] - Enable operation lifecycle logging
 * @property {string} [logLevel=LOG_LEVELS.INFO] - Default log level for operation events
 * @property {number} [timeout] - Operation timeout in milliseconds to prevent hanging
 * @property {Function} [onSuccess] - Callback function executed on successful completion
 * @property {Function} [onError] - Callback function executed when error occurs
 * @property {Function} [onComplete] - Callback function executed on completion (success or failure)
 * @property {Object} [metrics] - Custom metrics collection object for additional monitoring
 * @property {boolean} [rethrowErrors=true] - Whether to rethrow errors after handling
 */

/**
 * Standard Error Options Contract
 *
 * Defines the standardized interface for error handling operations.
 * This ensures consistent error processing and reporting across all modules.
 *
 * @typedef {Object} StandardErrorOptions
 * @property {Error} error - The error object to be handled
 * @property {string} operationName - Name of operation where error occurred
 * @property {string} [requestId] - Request tracking identifier for error correlation
 * @property {Object} [context] - Additional context data related to error
 * @property {string} [severity=LOG_LEVELS.ERROR] - Error severity level for logging
 * @property {boolean} [shouldLog=true] - Whether to log error occurrence
 * @property {boolean} [shouldRethrow=true] - Whether to rethrow error after handling
 * @property {Function} [customHandler] - Custom error handling logic function
 * @property {Object} [response] - Response object for generating error responses
 */

/**
 * Standard Response Contract
 *
 * Defines the standardized response format for all operations.
 * This ensures consistent response structure across the application.
 *
 * @typedef {Object} StandardResponse
 * @property {boolean} success - Operation success status (true/false)
 * @property {*} data - Response data (if successful)
 * @property {Error} error - Error object (if failed)
 * @property {Object} metadata - Response metadata including timing and tracking
 * @property {string} [requestId] - Request tracking identifier for correlation
 * @property {number} [duration] - Operation duration in milliseconds
 * @property {string} [timestamp] - ISO timestamp of operation completion
 * @property {Object} [context] - Additional context data from operation
 */

/**
 * Standard Log Entry Contract
 *
 * Defines the standardized format for all log entries generated
 * by the qerrors module and shared utilities.
 *
 * @typedef {Object} StandardLogEntry
 * @property {string} message - Log message content
 * @property {string} level - Log level (error, warn, info, debug)
 * @property {string} [requestId] - Request tracking identifier for log correlation
 * @property {Object} [context] - Additional context data for log entry
 * @property {number} [timestamp] - Unix timestamp of log entry
 * @property {string} [operationName] - Name of operation that generated the log
 * @property {number} [duration] - Operation duration in milliseconds (if applicable)
 */

// Import shared constants from localVars
const { ERROR_SEVERITY_MAP_CONTRACTS: ERROR_SEVERITY_MAP, STANDARD_ERROR_RESPONSE } = localVars;

/**
 * Unified Input Sanitization
 *
 * Consolidates sanitization functions from multiple modules to provide
 * a single, consistent interface for input validation and cleaning.
 */

/**
 * Sanitize and validate error input to prevent security issues
 * @param {*} error - Error input to validate
 * @returns {Error} Sanitized error object
 */
function sanitizeErrorInput (error) {
  // Handle null/undefined inputs
  if (error === null || error === undefined) {
    return new Error('Unknown error occurred');
  }

  // Ensure we have an Error object
  if (!(error instanceof Error)) {
    if (typeof error === 'string') {
      // Use existing sanitizeErrorMessage for consistency
      const sanitized = sanitizeErrorMessage(error);
      return new Error(sanitized);
    } else if (typeof error === 'object') {
      // Convert object to error with safe serialization
      try {
        const message = JSON.stringify(error).slice(0, 1000);
        return new Error(message);
      } catch (serializeError) {
        return new Error('Object error could not be serialized');
      }
    } else {
      return new Error(String(error).slice(0, 1000));
    }
  }

  // Validate and sanitize error properties
  const sanitizedError = new Error(error.message ? sanitizeErrorMessage(error.message) : 'Error occurred');
  sanitizedError.name = error.name ? String(error.name).slice(0, 100) : 'Error';

  // Copy safe properties only
  if (error.code && typeof error.code === 'string' && error.code.length < 100) {
    sanitizedError.code = error.code;
  }
  if (error.status && (typeof error.status === 'number' && error.status >= 100 && error.status < 1000)) {
    sanitizedError.status = error.status;
  }
  if (error.statusCode && (typeof error.statusCode === 'number' && error.statusCode >= 100 && error.statusCode < 1000)) {
    sanitizedError.statusCode = error.statusCode;
  }

  // Limit stack trace length
  if (error.stack) {
    sanitizedError.stack = String(error.stack).slice(0, 5000);
  }

  return sanitizedError;
}

/**
 * Validate and sanitize options object for error handling
 * @param {Object} options - Options object to validate
 * @returns {Object} Sanitized options object
 */
function sanitizeErrorOptions (options) {
  if (!options || typeof options !== 'object') {
    return {};
  }

  const sanitized = {};

  // Sanitize operation name
  if (options.operationName && typeof options.operationName === 'string') {
    sanitized.operationName = options.operationName.slice(0, 100);
  }

  // Sanitize request ID
  if (options.requestId && typeof options.requestId === 'string') {
    sanitized.requestId = options.requestId.slice(0, 100);
  }

  // Sanitize context
  if (options.context && typeof options.context === 'object') {
    try {
      sanitized.context = JSON.parse(JSON.stringify(options.context));
    } catch (error) {
      sanitized.context = { sanitized: true, original: '[Context too large or invalid]' };
    }
  }

  // Copy safe boolean and numeric properties
  if (typeof options.shouldLog === 'boolean') {
    sanitized.shouldLog = options.shouldLog;
  }
  if (typeof options.shouldRethrow === 'boolean') {
    sanitized.shouldRethrow = options.shouldRethrow;
  }
  if (typeof options.severity === 'string' && LOG_LEVELS[options.severity.toUpperCase()]) {
    sanitized.severity = options.severity;
  }

  return sanitized;
}

/**
 * Unified Contract Validator
 *
 * Consolidates validation logic from multiple contract modules to provide
 * consistent validation across all operations.
 */
class UnifiedContractValidator {
  /**
   * Validate operation options against standard contract
   * @param {Object} options - Options to validate
   * @returns {Object} Validation result with isValid and errors
   */
  static validateOperationOptions (options = {}) {
    const errors = [];
    const warnings = [];

    // Required field validation
    if (!options.operationName || typeof options.operationName !== 'string') {
      errors.push('operationName is required and must be a string');
    }

    // Type validation
    if (options.timeout && (typeof options.timeout !== 'number' || options.timeout < 0)) {
      errors.push('timeout must be a positive number');
    }

    if (options.context && typeof options.context !== 'object') {
      errors.push('context must be an object');
    }

    // Log level validation
    if (options.logLevel && !Object.values(LOG_LEVELS).includes(options.logLevel)) {
      warnings.push(`Invalid logLevel: ${options.logLevel}, using default`);
    }

    // Performance warnings
    if (options.timeout && options.timeout > 300000) {
      warnings.push('Operation timeout exceeds 5 minutes - consider breaking into smaller operations');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: sanitizeErrorOptions(options)
    };
  }

  /**
   * Validate error options against standard contract
   * @param {Object} options - Options to validate
   * @returns {Object} Validation result with isValid and errors
   */
  static validateErrorOptions (options = {}) {
    const errors = [];
    const warnings = [];

    // Required field validation
    if (!options.operationName || typeof options.operationName !== 'string') {
      errors.push('operationName is required for error handling');
    }

    if (!options.error) {
      errors.push('error object is required');
    } else if (!(options.error instanceof Error)) {
      warnings.push('error is not an Error instance - will be converted');
    }

    // Severity validation
    if (options.severity && !Object.values(LOG_LEVELS).includes(options.severity)) {
      warnings.push(`Invalid severity: ${options.severity}, using default ERROR`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized: sanitizeErrorOptions(options)
    };
  }
}

/**
 * Enhanced Error Handler with Unified Contracts
 *
 * Consolidates error handling logic from multiple modules into a single
 * comprehensive handler that respects all contract requirements.
 */
class UnifiedErrorHandler {
  /**
   * Handle errors with standardized contract validation
   * @param {Error} error - Error to handle
   * @param {Object} options - Error handling options
   * @returns {Object} Standardized error response
   */
  static async handleError (error, options = {}) {
    // Validate inputs first
    const validation = UnifiedContractValidator.validateErrorOptions({ error, ...options });

    if (!validation.isValid) {
      console.error('Invalid error options:', validation.errors);
    }

    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning => console.warn('Error handling warning:', warning));
    }

    const sanitizedError = sanitizeErrorInput(error);
    const sanitizedOptions = validation.sanitized;

    // Log the error if enabled
    if (sanitizedOptions.shouldLog !== false) {
      const logContext = {
        ...sanitizedOptions.context,
        errorType: sanitizedError.name,
        errorMessage: sanitizedError.message,
        operation: sanitizedOptions.operationName,
        requestId: sanitizedOptions.requestId
      };

      const logLevel = sanitizedOptions.severity || LOG_LEVELS.ERROR;

      try {
        safeLogError(sanitizedError, logContext);
      } catch (logError) {
        console.error('Failed to log error:', logError.message);
      }
    }

    // Generate standardized error response
    const errorResponse = {
      success: false,
      error: {
        message: sanitizedError.message,
        type: sanitizedError.name,
        code: sanitizedError.code,
        operation: sanitizedOptions.operationName
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: sanitizedOptions.requestId
      }
    };

    // Execute custom handler if provided
    if (sanitizedOptions.customHandler && typeof sanitizedOptions.customHandler === 'function') {
      try {
        await sanitizedOptions.customHandler(sanitizedError, errorResponse, sanitizedOptions);
      } catch (handlerError) {
        console.error('Custom error handler failed:', handlerError.message);
      }
    }

    return errorResponse;
  }
}

// Export all unified contracts and utilities
module.exports = {
  // Contracts
  ERROR_SEVERITY_MAP,
  STANDARD_ERROR_RESPONSE,

  // Sanitization utilities
  sanitizeErrorInput,
  sanitizeErrorOptions,

  // Validation
  UnifiedContractValidator,

  // Error handling
  UnifiedErrorHandler,

  // Constants
  LOG_LEVELS
};
