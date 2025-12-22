/**
 * Unified Operation Contracts Module
 * 
 * Purpose: Defines standardized interfaces and contracts for all async
 * operations, error handling, logging, and performance monitoring across
 * the qerrors module. This ensures consistency and reliability in how
 * operations are executed, monitored, and handled.
 * 
 * Design Philosophy:
 * - Interface consistency: All operations follow the same contract
 * - Comprehensive validation: All inputs are validated before execution
 * - Performance awareness: Built-in timing and metrics for all operations
 * - Error resilience: Standardized error handling and recovery patterns
 * - Audit capability: Complete operation lifecycle tracking
 * 
 * Benefits:
 * - Predictable behavior across all modules
 * - Easy testing and debugging through consistent interfaces
 * - Performance monitoring built into every operation
 * - Standardized error reporting and handling
 * - Request correlation for distributed tracing
 */

const { LOG_LEVELS } = require('./constants');
const { createUnifiedTimer } = require('./execution');
const { safeLogError, safeLogInfo, safeLogDebug, safeLogWarn } = require('./logging');

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
 * @property {Object} [context] - Additional context data related to the error
 * @property {string} [severity=LOG_LEVELS.ERROR] - Error severity level for logging
 * @property {boolean} [shouldLog=true] - Whether to log the error occurrence
 * @property {boolean} [shouldRethrow=true] - Whether to rethrow the error after handling
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
 * @property {Object} [context] - Additional context data for the log entry
 * @property {number} [timestamp] - Unix timestamp of the log entry
 * @property {string} [operationName] - Name of operation that generated the log
 * @property {number} [duration] - Operation duration in milliseconds (if applicable)
 */

/**
 * Operation Contract Validator Class
 * 
 * Purpose: Provides comprehensive validation for operation options and
 * contracts. This validator ensures that all operations conform to
 * standardized interfaces before execution.
 * 
 * Validation Strategy:
 * - Required field validation: Ensures critical fields are present
 * - Type validation: Confirms field types match expected interfaces
 * - Value validation: Checks for logical constraints and ranges
 * - Warning generation: Identifies potential configuration issues
 * - Normalization: Provides consistent option formatting
 */
class OperationContractValidator {
  /**
   * Validate standard operation options with comprehensive checks
   * 
   * Purpose: Performs thorough validation of operation options to ensure
   * they meet all contract requirements before execution. This prevents
   * runtime errors and provides early feedback on configuration issues.
   * 
   * Validation Categories:
   * - Required fields: Critical fields that must be present
   * - Type checking: Ensures data types match expected interfaces
   * - Value validation: Checks for logical constraints and ranges
   * - Warning generation: Identifies potential operational issues
   * 
   * @param {StandardOperationOptions} options - Options to validate
   * @returns {Object} Validation result with errors, warnings, and normalized options
   */
  static validateOperationOptions(options = {}) {
    const errors = [];
    const warnings = [];

    // Required field validation
    if (!options.operationName || typeof options.operationName !== 'string') {
      errors.push('operationName is required and must be a string');
    }

    // Type validation for callback functions
    if (options.context && typeof options.context !== 'object') {
      errors.push('context must be an object');
    }

    if (options.onSuccess && typeof options.onSuccess !== 'function') {
      errors.push('onSuccess must be a function');
    }

    if (options.onError && typeof options.onError !== 'function') {
      errors.push('onError must be a function');
    }

    if (options.onComplete && typeof options.onComplete !== 'function') {
      errors.push('onComplete must be a function');
    }

    // Value validation for constraints
    if (options.timeout && (typeof options.timeout !== 'number' || options.timeout <= 0)) {
      errors.push('timeout must be a positive number');
    }

    // Warnings for common operational issues
    if (!options.requestId && options.enableLogging !== false) {
      warnings.push('requestId not provided - operation tracking may be incomplete');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      normalizedOptions: this.normalizeOperationOptions(options)
    };
  }

/**
 * Normalize operation options to standard format
 * 
 * Purpose: Converts user-provided options into standardized
 * format with sensible defaults. This ensures consistent
 * option structure across all operations.
 * 
 * Normalization Rules:
 * - Provides defaults for missing optional fields
 * - Preserves existing values while adding missing ones
 * - Ensures consistent data types and structures
 * - Applies logical defaults for boolean flags
 * 
 * @param {StandardOperationOptions} options - Options to normalize
 * @returns {StandardOperationOptions} Normalized options with defaults
 */
  static normalizeOperationOptions(options = {}) {
    return {
      operationName: options.operationName || 'unnamed_operation',
      requestId: options.requestId || null,
      context: options.context || {},
      enableTiming: options.enableTiming !== false,
      enableLogging: options.enableLogging !== false,
      logLevel: options.logLevel || LOG_LEVELS.INFO,
      timeout: options.timeout || null,
      onSuccess: options.onSuccess || null,
      onError: options.onError || null,
      onComplete: options.onComplete || null,
      metrics: options.metrics || {},
      rethrowErrors: options.rethrowErrors !== false
    };
  }

  /**
   * Validate error options
   * @param {StandardErrorOptions} options - Error options to validate
   * @returns {Object} Validation result
   */
  static validateErrorOptions(options = {}) {
    const errors = [];

    if (!options.error || !(options.error instanceof Error)) {
      errors.push('error is required and must be an Error instance');
    }

    if (!options.operationName || typeof options.operationName !== 'string') {
      errors.push('operationName is required and must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalizedOptions: this.normalizeErrorOptions(options)
    };
  }

  /**
   * Normalize error options
   * @param {StandardErrorOptions} options - Options to normalize
   * @returns {StandardErrorOptions} Normalized options
   */
  static normalizeErrorOptions(options = {}) {
    return {
      error: options.error,
      operationName: options.operationName || 'unknown_operation',
      requestId: options.requestId || null,
      context: options.context || {},
      severity: options.severity || LOG_LEVELS.ERROR,
      shouldLog: options.shouldLog !== false,
      shouldRethrow: options.shouldRethrow !== false,
      customHandler: options.customHandler || null,
      response: options.response || null
    };
  }
}

/**
 * Unified Operation Executor with Standardized Contract
 * 
 * Purpose: Provides comprehensive operation execution with integrated
 * validation, timing, logging, error handling, and callback management.
 * This executor implements the complete operation lifecycle defined
 * in the operation contracts.
 * 
 * Execution Flow:
 * 1. Validate operation options against contract
 * 2. Setup timing and logging if enabled
 * 3. Execute operation with optional timeout
 * 4. Handle success/error responses consistently
 * 5. Execute appropriate callbacks (onSuccess, onError, onComplete)
 * 6. Return standardized response object
 */
class StandardOperationExecutor {
  /**
   * Execute an operation with full contract compliance
   * 
   * Purpose: Orchestrates complete operation lifecycle with comprehensive
   * error handling, performance monitoring, and callback execution.
   * This is the main entry point for standardized operation execution.
   * 
   * Execution Steps:
   * - Validate operation options against contract requirements
   * - Setup performance timing if enabled
   * - Log operation start if logging enabled
   * - Execute operation with optional timeout protection
   * - Handle success/error responses with appropriate callbacks
   * - Execute completion callback in finally block
   * - Return standardized response object
   * 
   * @param {Function} operation - Operation function to execute
   * @param {StandardOperationOptions} options - Operation configuration options
   * @returns {Promise<StandardResponse>} Standardized response with comprehensive metadata
   */
  static async execute(operation, options = {}) {
    const validation = OperationContractValidator.validateOperationOptions(options);
    
    if (!validation.isValid) {
      const error = new Error(`Invalid operation options: ${validation.errors.join(', ')}`);
      return this.createErrorResponse(error, validation.normalizedOptions);
    }

    const normalizedOptions = validation.normalizedOptions;
    let timer = null;
    let result = null;

    try {
      // Setup timing if enabled
      if (normalizedOptions.enableTiming) {
        timer = createUnifiedTimer(normalizedOptions.operationName);
      }

      // Log operation start if enabled
      if (normalizedOptions.enableLogging) {
        safeLogInfo(`Starting operation: ${normalizedOptions.operationName}`, {
          requestId: normalizedOptions.requestId,
          operationName: normalizedOptions.operationName,
          context: normalizedOptions.context
        });
      }

      // Execute with timeout if specified
      if (normalizedOptions.timeout) {
        result = await this.executeWithTimeout(operation, normalizedOptions.timeout);
      } else {
        result = await operation();
      }

      // Create success response with timing data
      const response = this.createSuccessResponse(result, normalizedOptions, timer);

      // Handle success callback with error isolation
      if (normalizedOptions.onSuccess) {
        try {
          await normalizedOptions.onSuccess(response);
        } catch (callbackError) {
          safeLogError('Success callback failed', {
            operationName: normalizedOptions.operationName,
            requestId: normalizedOptions.requestId,
            error: callbackError.message
          });
        }
      }

      // Log completion if enabled
      if (normalizedOptions.enableLogging) {
        safeLogInfo(`Completed operation: ${normalizedOptions.operationName}`, {
          requestId: normalizedOptions.requestId,
          operationName: normalizedOptions.operationName,
          duration: response.duration,
          success: true
        });
      }

      return response;

    } catch (error) {
      const errorResponse = await this.handleOperationError(error, normalizedOptions, timer);
      
      // Handle error callback with error isolation
      if (normalizedOptions.onError) {
        try {
          await normalizedOptions.onError(errorResponse);
        } catch (callbackError) {
          safeLogError('Error callback failed', {
            operationName: normalizedOptions.operationName,
            requestId: normalizedOptions.requestId,
            error: callbackError.message
          });
        }
      }

      return errorResponse;

    } finally {
      // Handle completion callback with error isolation (always executed)
      if (normalizedOptions.onComplete) {
        try {
          await normalizedOptions.onComplete();
        } catch (callbackError) {
          safeLogError('Completion callback failed', {
            operationName: normalizedOptions.operationName,
            requestId: normalizedOptions.requestId,
            error: callbackError.message
          });
        }
      }
    }
  }

  /**
   * Execute operation with timeout
   * @param {Function} operation - Operation to execute
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<*>} Operation result
   */
  static async executeWithTimeout(operation, timeout) {
    return Promise.race([
      operation(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
      )
    ]);
  }

  /**
   * Create standardized success response
   * @param {*} result - Operation result
   * @param {StandardOperationOptions} options - Operation options
   * @param {Object} timer - Performance timer
   * @returns {StandardResponse} Standardized response
   */
  static createSuccessResponse(result, options, timer = null) {
    return {
      success: true,
      data: result,
      error: null,
      metadata: {
        operationName: options.operationName,
        timestamp: new Date().toISOString(),
        ...options.metrics
      },
      requestId: options.requestId,
      duration: timer ? timer.getDuration() : null,
      context: options.context
    };
  }

  /**
   * Create standardized error response
   * @param {Error} error - Error object
   * @param {StandardOperationOptions} options - Operation options
   * @param {Object} timer - Performance timer
   * @returns {StandardResponse} Standardized error response
   */
  static createErrorResponse(error, options, timer = null) {
    const normalizedOptions = options && typeof options === 'object' ? options : {};
    return {
      success: false,
      data: null,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      },
      metadata: {
        operationName: normalizedOptions.operationName || 'unknown_operation',
        timestamp: new Date().toISOString(),
        ...(normalizedOptions.metrics || {})
      },
      requestId: normalizedOptions.requestId || null,
      duration: timer ? timer.getDuration() : null,
      context: normalizedOptions.context || {}
    };
  }

  /**
   * Handle operation errors with standardized contract
   * @param {Error} error - Error that occurred
   * @param {StandardOperationOptions} options - Operation options
   * @param {Object} timer - Performance timer
   * @returns {Promise<StandardResponse>} Error response
   */
  static async handleOperationError(error, options, timer = null) {
    // Log error if enabled
    if (options.enableLogging) {
      safeLogError(`Operation failed: ${options.operationName}`, {
        requestId: options.requestId,
        operationName: options.operationName,
        error: error.message,
        duration: timer ? timer.getDuration() : null
      });
    }

    const response = this.createErrorResponse(error, options, timer);

    // Rethrow if specified
    if (options.rethrowErrors) {
      throw error;
    }

    return response;
  }
}

module.exports = {
  StandardOperationExecutor,
  OperationContractValidator,
  // Export types for documentation
  StandardOperationOptions: {},
  StandardErrorOptions: {},
  StandardResponse: {},
  StandardLogEntry: {}
};