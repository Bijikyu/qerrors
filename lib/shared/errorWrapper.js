/**
 * Unified Error Handling Wrapper
 * 
 * Purpose: Provides standardized error handling patterns to eliminate
 * duplicate error handling code across the qerrors module.
 * 
 * This module centralizes the common pattern of try-catch with qerrors
 * logging, ensuring consistent error handling behavior throughout the
 * codebase while reducing code duplication.
 * 
 * Design Philosophy:
 * - Consistency: All wrapped functions follow the same error handling pattern
 * - Safety: Error handling never causes additional errors
 * - Performance: Async error handling doesn't block main execution
 * - Flexibility: Support for different error handling strategies
 */



/**
 * Default error handling configuration
 */
const DEFAULT_CONFIG = {
  useAsyncLogging: true,
  rethrowError: true,
  logContext: {},
  fallbackToConsole: true
};

/**
 * Error context builder helper
 * @param {string} operation - Operation name where error occurred
 * @param {Object} context - Additional context information
 * @param {Object} config - Configuration options
 * @returns {Object} Complete error context
 */
function buildErrorContext(operation, context = {}, config = {}) {
  return {
    operation,
    timestamp: new Date().toISOString(),
    ...config.logContext,
    ...context
  };
}

/**
 * Async error logging that won't block the main execution flow
 * @param {Error} error - The error to log
 * @param {Object} errorContext - Context information for the error
 * @param {Object} config - Configuration options
 */
function logErrorAsync(error, errorContext, config = {}) {
  const errorMessage = `${errorContext.operation}: ${error.message}`;
  
  if (config.useAsyncLogging) {
    // Use setImmediate to avoid blocking the current execution stack
    setImmediate(() => {
      console.error(errorMessage);
      if (config.fallbackToConsole && errorContext) {
        console.error('Error context:', JSON.stringify(errorContext, null, 2));
      }
    });
  } else {
    // Synchronous logging (use sparingly)
    console.error(errorMessage);
    if (config.fallbackToConsole && errorContext) {
      console.error('Error context:', JSON.stringify(errorContext, null, 2));
    }
  }
}

/**
 * Creates a wrapped function with standardized error handling
 * @param {Function} operation - The function to wrap
 * @param {string} operationName - Name for logging/tracking
 * @param {Object} options - Configuration options
 * @returns {Function} Wrapped function with error handling
 */
function withQerrorsErrorHandling(operation, operationName, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  
  return async function wrappedOperation(...args) {
    try {
      // Execute the original operation
      const result = await operation.apply(this, args);
      return result;
    } catch (error) {
      // Build comprehensive error context
      const errorContext = buildErrorContext(operationName, {
        arguments: args.length > 0 ? '[arguments omitted for security]' : undefined,
        errorType: error.constructor.name,
        errorMessage: error.message
      }, config);
      
      // Log the error asynchronously
      logErrorAsync(error, errorContext, config);
      
      // Re-throw if configured to do so
      if (config.rethrowError) {
        throw error;
      }
      
      // Return error result if not rethrowing
      return {
        success: false,
        error: {
          message: error.message,
          type: error.constructor.name,
          operation: operationName
        }
      };
    }
  };
}

/**
 * Synchronous version of error handling wrapper
 * @param {Function} operation - The synchronous function to wrap
 * @param {string} operationName - Name for logging/tracking
 * @param {Object} options - Configuration options
 * @returns {Function} Wrapped synchronous function
 */
function withSyncErrorHandling(operation, operationName, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  
  return function wrappedSyncOperation(...args) {
    try {
      // Execute the original operation
      const result = operation.apply(this, args);
      return result;
    } catch (error) {
      // Build comprehensive error context
      const errorContext = buildErrorContext(operationName, {
        arguments: args.length > 0 ? '[arguments omitted for security]' : undefined,
        errorType: error.constructor.name,
        errorMessage: error.message
      }, config);
      
      // Log the error asynchronously (even for sync operations)
      logErrorAsync(error, errorContext, config);
      
      // Re-throw if configured to do so
      if (config.rethrowError) {
        throw error;
      }
      
      // Return error result if not rethrowing
      return {
        success: false,
        error: {
          message: error.message,
          type: error.constructor.name,
          operation: operationName
        }
      };
    }
  };
}

/**
 * Higher-order function for class methods
 * @param {string} operationName - Base name for operations
 * @param {Object} options - Configuration options
 * @returns {Function} Method decorator
 */
function wrapMethods(operationName, options = {}) {
  return function (target, propertyName, descriptor) {
    const originalMethod = descriptor.value;
    const methodName = `${operationName}.${propertyName}`;
    
    descriptor.value = withQerrorsErrorHandling(originalMethod, methodName, options);
    return descriptor;
  };
}

/**
 * Batch error handler for multiple operations
 * @param {Array} operations - Array of {fn, name, options} objects
 * @param {Object} globalOptions - Global configuration for all operations
 * @returns {Array} Array of wrapped operations
 */
function wrapBatch(operations, globalOptions = {}) {
  return operations.map(({ fn, name, options = {} }) => {
    const config = { ...globalOptions, ...options };
    return withQerrorsErrorHandling(fn, name, config);
  });
}

/**
 * Error handling middleware for Express.js
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware function
 */
function errorHandlingMiddleware(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  
  return function (req, res, next) {
    // Store original methods
    const originalNext = req.next || next;
    
    // Override next to capture errors
    req.next = function (error) {
      if (error) {
        const errorContext = buildErrorContext('express.middleware', {
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }, config);
        
        logErrorAsync(error, errorContext, config);
      }
      
      originalNext.call(this, error);
    };
    
    next();
  };
}

/**
 * Quick error logger for simple cases
 * @param {Error} error - Error to log
 * @param {string} operation - Operation name
 * @param {Object} context - Additional context
 */
function logError(error, operation, context = {}) {
  const errorContext = buildErrorContext(operation, context);
  logErrorAsync(error, errorContext, DEFAULT_CONFIG);
}

module.exports = {
  // Core wrapping functions
  withQerrorsErrorHandling,
  withSyncErrorHandling,
  
  // Decorators and middleware
  wrapMethods,
  errorHandlingMiddleware,
  
  // Batch processing
  wrapBatch,
  
  // Utilities
  logError,
  buildErrorContext,
  
  // Configuration
  DEFAULT_CONFIG
};