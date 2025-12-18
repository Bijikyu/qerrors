/**
 * Unified Error Handling Contracts
 * 
 * Standardized error handling across all modules with consistent
 * parameter ordering, severity mapping, and response structure.
 */

const localVars = require('../../config/localVars');
const { LOG_LEVELS } = localVars;
const { safeLogError, safeLogWarn, safeLogInfo, safeLogDebug } = require('./logging');
const { OperationContractValidator } = require('./contracts');

// Error severity mapping imported from localVars
const { ERROR_SEVERITY_MAP_CONTRACTS: ERROR_SEVERITY_MAP } = localVars;

/**
 * Standard error response structure
 */
// Standard error response imported from localVars
const { STANDARD_ERROR_RESPONSE } = localVars;

/**
 * Unified error handler
 */
class UnifiedErrorHandler {
  /**
   * Handle error with standardized contract
   * @param {Error} error - Error to handle
   * @param {Object} options - Error handling options
   * @returns {Object} Standardized error response
   */
  static async handleError(error, options = {}) {
    const validation = OperationContractValidator.validateErrorOptions({
      error,
      ...options
    });
    
    if (!validation.isValid) {
      // Fallback for invalid error options
      return this.createFallbackErrorResponse(error, options);
    }

    const normalizedOptions = validation.normalizedOptions;
    
    try {
      // Classify error
      const errorClassification = this.classifyError(error);
      
      // Create standard response
      const response = this.createStandardErrorResponse(error, errorClassification, normalizedOptions);
      
      // Log error if enabled
      if (normalizedOptions.shouldLog) {
        await this.logError(error, response, normalizedOptions);
      }
      
      // Apply custom handler if provided
      if (normalizedOptions.customHandler) {
        await this.applyCustomHandler(response, normalizedOptions);
      }
      
      return response;

    } catch (handlingError) {
      // Fallback if error handling itself fails
      safeLogError('Error handling failed', {
        originalError: error.message,
        handlingError: handlingError.message,
        operationName: normalizedOptions.operationName
      });
      
      return this.createFallbackErrorResponse(error, normalizedOptions);
    }
  }

  /**
   * Classify error by type and determine severity
   * @param {Error} error - Error to classify
   * @returns {Object} Error classification
   */
  static classifyError(error) {
    const errorName = error.name.toUpperCase();
    const errorMessage = error.message.toLowerCase();
    
    let category = 'UNKNOWN_ERROR';
    let severity = LOG_LEVELS.ERROR;
    
    // System errors
    if (errorMessage.includes('timeout') || errorName.includes('TIMEOUT')) {
      category = 'TIMEOUT_ERROR';
    } else if (errorMessage.includes('memory') || errorMessage.includes('heap')) {
      category = 'MEMORY_ERROR';
    } else if (errorMessage.includes('network') || errorMessage.includes('connection') || 
               errorMessage.includes('ECONN') || errorMessage.includes('ENOTFOUND')) {
      category = 'NETWORK_ERROR';
    } else if (errorName.includes('SYSTEM') || errorMessage.includes('system')) {
      category = 'SYSTEM_ERROR';
    }
    
    // Business logic errors
    else if (errorName.includes('VALIDATION') || errorMessage.includes('validation') || 
             errorMessage.includes('invalid') || errorMessage.includes('required')) {
      category = 'VALIDATION_ERROR';
      severity = LOG_LEVELS.WARN;
    } else if (errorName.includes('AUTHORIZATION') || errorMessage.includes('unauthorized') || 
               errorMessage.includes('forbidden') || errorMessage.includes('access denied')) {
      category = 'AUTHORIZATION_ERROR';
      severity = LOG_LEVELS.WARN;
    } else if (errorName.includes('NOT_FOUND') || errorMessage.includes('not found') || 
               errorMessage.includes('404')) {
      category = 'NOT_FOUND_ERROR';
      severity = LOG_LEVELS.INFO;
    } else if (errorName.includes('CONFLICT') || errorMessage.includes('conflict') || 
               errorMessage.includes('duplicate')) {
      category = 'CONFLICT_ERROR';
      severity = LOG_LEVELS.WARN;
    }
    
    // Operational errors
    else if (errorName.includes('CONFIGURATION') || errorMessage.includes('configuration') || 
             errorMessage.includes('config')) {
      category = 'CONFIGURATION_ERROR';
    } else if (errorMessage.includes('dependency') || errorMessage.includes('service unavailable')) {
      category = 'DEPENDENCY_ERROR';
    } else {
      category = 'OPERATION_ERROR';
    }
    
    // Map to severity
    severity = ERROR_SEVERITY_MAP[category] || LOG_LEVELS.ERROR;
    
    return {
      category,
      severity,
      isSystemError: severity === LOG_LEVELS.ERROR && !category.includes('OPERATION'),
      isBusinessError: severity === LOG_LEVELS.WARN || severity === LOG_LEVELS.INFO,
      isRetryable: this.isRetryableError(category, error)
    };
  }

  /**
   * Determine if error is retryable
   * @param {string} category - Error category
   * @param {Error} error - Error object
   * @returns {boolean} Whether error is retryable
   */
  static isRetryableError(category, error) {
    const retryableCategories = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'DEPENDENCY_ERROR'
    ];
    
    const retryablePatterns = [
      /timeout/i,
      /connection/i,
      /network/i,
      /temporary/i,
      /unavailable/i
    ];
    
    return retryableCategories.includes(category) || 
           retryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Create standardized error response
   * @param {Error} error - Original error
   * @param {Object} classification - Error classification
   * @param {Object} options - Normalized options
   * @returns {Object} Standard error response
   */
  static createStandardErrorResponse(error, classification, options) {
    return {
      ...STANDARD_ERROR_RESPONSE,
      error: {
        code: this.generateErrorCode(error, classification),
        message: this.generateErrorMessage(error, classification),
        severity: classification.severity,
        category: classification.category,
        details: this.extractErrorDetails(error),
        isRetryable: classification.isRetryable
      },
      metadata: {
        timestamp: new Date().toISOString(),
        operationName: options.operationName,
        requestId: options.requestId,
        stackTrace: error.stack
      },
      context: {
        ...options.context,
        errorName: error.name,
        errorMessage: error.message
      }
    };
  }

  /**
   * Generate standardized error code
   * @param {Error} error - Error object
   * @param {Object} classification - Error classification
   * @returns {string} Error code
   */
  static generateErrorCode(error, classification) {
    const prefix = classification.category.replace('_ERROR', '');
    const suffix = error.code ? `_${error.code}` : '';
    return `${prefix}${suffix}`.toUpperCase();
  }

  /**
   * Generate user-friendly error message
   * @param {Error} error - Original error
   * @param {Object} classification - Error classification
   * @returns {string} User-friendly message
   */
  static generateErrorMessage(error, classification) {
    // System errors should be generic for security
    if (classification.isSystemError) {
      return 'An internal system error occurred. Please try again later.';
    }
    
    // Business logic errors can be more specific
    if (classification.isBusinessError) {
      return error.message || 'A validation error occurred.';
    }
    
    // Operational errors
    if (classification.category === 'TIMEOUT_ERROR') {
      return 'The operation timed out. Please try again.';
    }
    
    if (classification.category === 'NETWORK_ERROR') {
      return 'A network error occurred. Please check your connection and try again.';
    }
    
    return error.message || 'An error occurred during operation.';
  }

  /**
   * Extract relevant error details
   * @param {Error} error - Error object
   * @returns {Object} Error details
   */
  static extractErrorDetails(error) {
    const details = {};
    
    // Include common error properties
    if (error.code) details.code = error.code;
    if (error.status) details.status = error.status;
    if (error.statusCode) details.statusCode = error.statusCode;
    
    // Include validation errors
    if (error.details) details.validation = error.details;
    if (error.errors) details.errors = error.errors;
    
    // Include network error details
    if (error.hostname) details.hostname = error.hostname;
    if (error.port) details.port = error.port;
    
    return Object.keys(details).length > 0 ? details : null;
  }

  /**
   * Log error with standardized format
   * @param {Error} error - Original error
   * @param {Object} response - Error response
   * @param {Object} options - Error options
   */
  static async logError(error, response, options) {
    const logData = {
      requestId: options.requestId,
      operationName: options.operationName,
      errorCode: response.error.code,
      errorCategory: response.error.category,
      errorSeverity: response.error.severity,
      isRetryable: response.error.isRetryable,
      context: options.context
    };
    
    // Choose appropriate log level based on severity
    switch (response.error.severity) {
      case LOG_LEVELS.ERROR:
        safeLogError(`[${response.error.code}] ${response.error.message}`, logData);
        break;
      case LOG_LEVELS.WARN:
        safeLogWarn(`[${response.error.code}] ${response.error.message}`, logData);
        break;
      case LOG_LEVELS.INFO:
        safeLogInfo(`[${response.error.code}] ${response.error.message}`, logData);
        break;
      case LOG_LEVELS.DEBUG:
      default:
        safeLogDebug(`[${response.error.code}] ${response.error.message}`, logData);
        break;
    }
  }

  /**
   * Apply custom error handler
   * @param {Object} response - Error response
   * @param {Object} options - Error options
   */
  static async applyCustomHandler(response, options) {
    try {
      await options.customHandler(response, options);
    } catch (customError) {
      safeLogError('Custom error handler failed', {
        originalError: response.error.message,
        customError: customError.message,
        operationName: options.operationName,
        requestId: options.requestId
      });
    }
  }

  /**
   * Create fallback error response
   * @param {Error} error - Original error
   * @param {Object} options - Error options
   * @returns {Object} Fallback response
   */
  static createFallbackErrorResponse(error, options = {}) {
    return {
      success: false,
      error: {
        code: 'FALLBACK_ERROR',
        message: 'An error occurred and could not be processed normally.',
        severity: LOG_LEVELS.ERROR,
        category: 'UNKNOWN_ERROR',
        details: null
      },
      metadata: {
        timestamp: new Date().toISOString(),
        operationName: options.operationName || 'unknown',
        requestId: options.requestId || null
      },
      context: options.context || {}
    };
  }
}

/**
 * Express middleware for unified error handling
 */
function unifiedErrorMiddleware(options = {}) {
  return async (error, req, res, next) => {
    try {
      const errorResponse = await UnifiedErrorHandler.handleError(error, {
        operationName: 'express_request',
        requestId: req.id || req.headers['x-request-id'],
        context: {
          method: req.method,
          url: req.url,
          userAgent: req.headers['user-agent'],
          ip: req.ip
        },
        shouldLog: true,
        ...options
      });
      
      // Determine appropriate HTTP status
      const httpStatus = mapErrorToHttpStatus(errorResponse.error);
      
      // Send response
      res.status(httpStatus).json({
        success: false,
        error: {
          code: errorResponse.error.code,
          message: errorResponse.error.message,
          category: errorResponse.error.category
        },
        metadata: {
          requestId: errorResponse.metadata.requestId,
          timestamp: errorResponse.metadata.timestamp
        }
      });
      
    } catch (handlingError) {
      // Ultimate fallback
      console.error('Error handling middleware failed:', handlingError);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred'
        }
      });
    }
  };
}

/**
 * Map error category to HTTP status code
 * @param {Object} errorInfo - Error information
 * @returns {number} HTTP status code
 */
function mapErrorToHttpStatus(errorInfo) {
  if (!errorInfo || !errorInfo.category) {
    return 500;
  }
  switch (errorInfo.category) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'AUTHORIZATION_ERROR':
      return 401;
    case 'NOT_FOUND_ERROR':
      return 404;
    case 'CONFLICT_ERROR':
      return 409;
    case 'TIMEOUT_ERROR':
      return 408;
    case 'DEPENDENCY_ERROR':
      return 503;
    case 'NETWORK_ERROR':
      return 503;
    case 'SYSTEM_ERROR':
    case 'CONFIGURATION_ERROR':
    case 'OPERATION_ERROR':
    default:
      return 500;
  }
}

module.exports = {
  UnifiedErrorHandler,
  unifiedErrorMiddleware,
  mapErrorToHttpStatus,
  ERROR_SEVERITY_MAP,
  STANDARD_ERROR_RESPONSE
};