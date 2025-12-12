/**
 * Unified Operation Contracts
 * 
 * Standardized interfaces for async operations, error handling, logging,
 * and performance monitoring across all modules.
 */

const { LOG_LEVELS } = require('./constants');
const { createUnifiedTimer } = require('./execution');
const { safeLogError, safeLogInfo, safeLogDebug, safeLogWarn } = require('./logging');

/**
 * Standard operation options contract
 * @typedef {Object} StandardOperationOptions
 * @property {string} operationName - Human-readable operation name
 * @property {string} [requestId] - Request tracking identifier
 * @property {Object} [context] - Additional context data
 * @property {boolean} [enableTiming=true] - Enable performance timing
 * @property {boolean} [enableLogging=true] - Enable operation logging
 * @property {string} [logLevel=LOG_LEVELS.INFO] - Default log level
 * @property {number} [timeout] - Operation timeout in milliseconds
 * @property {Function} [onSuccess] - Success callback
 * @property {Function} [onError] - Error callback
 * @property {Function} [onComplete] - Completion callback
 * @property {Object} [metrics] - Custom metrics collection
 * @property {boolean} [rethrowErrors=true] - Whether to rethrow errors after handling
 */

/**
 * Standard error handling contract
 * @typedef {Object} StandardErrorOptions
 * @property {Error} error - The error object
 * @property {string} operationName - Operation where error occurred
 * @property {string} [requestId] - Request tracking identifier
 * @property {Object} [context] - Additional context data
 * @property {string} [severity=LOG_LEVELS.ERROR] - Error severity level
 * @property {boolean} [shouldLog=true] - Whether to log the error
 * @property {boolean} [shouldRethrow=true] - Whether to rethrow the error
 * @property {Function} [customHandler] - Custom error handling logic
 * @property {Object} [response] - Response object for error responses
 */

/**
 * Standard response contract
 * @typedef {Object} StandardResponse
 * @property {boolean} success - Operation success status
 * @property {*} data - Response data (if successful)
 * @property {Error} error - Error object (if failed)
 * @property {Object} metadata - Response metadata
 * @property {string} [requestId] - Request tracking identifier
 * @property {number} [duration] - Operation duration in milliseconds
 * @property {string} [timestamp] - Operation timestamp
 * @property {Object} [context] - Additional context
 */

/**
 * Standard logging contract
 * @typedef {Object} StandardLogEntry
 * @property {string} message - Log message
 * @property {string} level - Log level
 * @property {string} [requestId] - Request tracking identifier
 * @property {Object} [context] - Additional context
 * @property {number} [timestamp] - Log timestamp
 * @property {string} [operationName] - Operation name
 * @property {number} [duration] - Operation duration (if applicable)
 */

/**
 * Operation contract validator
 */
class OperationContractValidator {
  /**
   * Validate standard operation options
   * @param {StandardOperationOptions} options - Options to validate
   * @returns {Object} Validation result
   */
  static validateOperationOptions(options = {}) {
    const errors = [];
    const warnings = [];

    // Required field validation
    if (!options.operationName || typeof options.operationName !== 'string') {
      errors.push('operationName is required and must be a string');
    }

    // Type validation
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

    // Value validation
    if (options.timeout && (typeof options.timeout !== 'number' || options.timeout <= 0)) {
      errors.push('timeout must be a positive number');
    }

    // Warnings for common issues
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
   * @param {StandardOperationOptions} options - Options to normalize
   * @returns {StandardOperationOptions} Normalized options
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
 * Unified operation executor with standardized contract
 */
class StandardOperationExecutor {
  /**
   * Execute an operation with standard contract
   * @param {Function} operation - Operation function to execute
   * @param {StandardOperationOptions} options - Operation options
   * @returns {Promise<StandardResponse>} Standardized response
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

      // Create success response
      const response = this.createSuccessResponse(result, normalizedOptions, timer);

      // Handle success callback
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
      
      // Handle error callback
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
      // Handle completion callback
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