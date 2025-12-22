'use strict';

const { createUnifiedTimer } = require('./timers');

/**
 * Safe synchronous execution wrapper with comprehensive error handling
 * 
 * Purpose: Provides a safe wrapper for synchronous function execution that catches
 * any exceptions and returns a fallback value instead of allowing the error to
 * propagate. This is essential for maintaining application stability when
 * executing optional or non-critical operations.
 * 
 * Design Rationale:
 * - Error isolation: Prevents function errors from affecting application flow
 * - Predictable behavior: Always returns a value (result or fallback)
 * - Error visibility: Logs errors with context for debugging while maintaining stability
 * - Synchronous safety: Designed for sync operations where async wrappers would be overkill
 * 
 * @param {string} name - Operation name for error logging and identification
 * @param {Function} fn - Synchronous function to execute safely
 * @param {*} fallback - Value to return if function throws an exception
 * @param {Object} info - Additional context information for error logging
 * @returns {*} Result of function execution or fallback value if error occurs
 */
const safeRun = (name, fn, fallback, info) => {
  try {
    return fn();
  } catch (err) {
    // Log error with operation name and context for debugging
    console.error(`${name} failed`, info);
    return fallback;
  }
};

/**
 * Deep clone utility using lodash for comprehensive object copying
 * 
 * Purpose: Provides deep object cloning using lodash's cloneDeep function,
 * which handles nested objects, arrays, dates, and other complex data types.
 * This is essential for creating independent copies of objects without
 * reference sharing, which prevents unintended mutations.
 * 
 * Design Rationale:
 * - Comprehensive copying: Handles all JavaScript data types including nested structures
 * - Reference independence: Creates completely separate object instances
 * - Performance optimization: Uses battle-tested lodash implementation
 * - Type safety: Preserves object types and prototypes during cloning
 * 
 * @param {*} obj - Object or value to deep clone
 * @returns {*} Deep cloned copy of the input object
 */
const deepClone = (obj) => {
  const { cloneDeep } = require('lodash');
  return cloneDeep(obj);
};

/**
 * Async operation wrapper with Result pattern for error-safe execution
 * 
 * Purpose: Executes async operations and returns a standardized Result object
 * that indicates success or failure without throwing exceptions. This pattern
 * is useful for operations where you want to handle errors explicitly rather
 * than using try-catch blocks throughout the codebase.
 * 
 * Design Rationale:
 * - Result pattern: Returns {ok, value} or {ok, error} instead of throwing
 * - Promise safety: Wraps function in Promise.resolve() to handle both sync and async
 * - Error capture: Catches all errors and returns them in the result object
 * - Explicit handling: Forces callers to check success status before using results
 * 
 * @param {Function} fn - Async function to execute
 * @returns {Promise<Object>} Result object with success status and data or error
 * @returns {boolean} returns.ok - True if operation succeeded, false if failed
 * @returns {*} returns.value - Result value if ok is true
 * @returns {Error} returns.error - Error object if ok is false
 */
const attempt = async (fn) => {
  try {
    // Ensure the function is wrapped in a promise for consistent async handling
    const value = await Promise.resolve().then(fn);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error };
  }
};

/**
 * Execute operation with comprehensive error handling, logging, and performance tracking
 * 
 * Purpose: Provides a unified interface for executing async operations with integrated
 * error handling, performance monitoring, and configurable failure behavior. This
 * function is designed for critical operations where you need detailed visibility
 * into execution performance and error patterns.
 * 
 * Design Rationale:
 * - Performance monitoring: Automatically tracks operation timing and success/failure rates
 * - Flexible error handling: Configurable rethrow behavior for different error scenarios
 * - Context preservation: Maintains operation context for debugging and monitoring
 * - Fallback support: Optional fallback values for graceful degradation
 * - Comprehensive logging: Detailed performance and error metrics for observability
 * 
 * @param {Object} options - Configuration object for operation execution
 * @param {string} options.opName - Operation name for logging and identification
 * @param {Function} options.operation - Async function to execute
 * @param {Object} [options.context={}] - Additional context information for logging
 * @param {string} [options.failureMessage] - Custom message to prepend to error messages
 * @param {string} [options.errorCode] - Error code for classification
 * @param {string} [options.errorType] - Error type for categorization
 * @param {boolean} [options.logMessage] - Whether to log performance metrics
 * @param {boolean} [options.rethrow=true] - Whether to rethrow errors or return fallback
 * @param {*} [options.fallbackValue] - Value to return if operation fails and rethrow is false
 * @param {Object} [options.timer=null] - Optional timer instance for performance tracking
 * @returns {Promise<*>} Operation result or fallback value
 * @throws {Error} If operation fails and rethrow is true
 */
const executeWithErrorHandling = async (options) => {
  // Destructure configuration options with sensible defaults
  const { 
    opName, 
    operation, 
    context = {}, 
    failureMessage, 
    errorCode, 
    errorType, 
    logMessage, 
    rethrow = true, 
    fallbackValue,
    timer = null
  } = options;
  
  // Use provided timer or create new one for performance tracking
  const timerInstance = timer || createUnifiedTimer(opName, false);
  
  try {
    // Execute the operation and measure performance
    const result = await operation();
    
    // Log successful operation with performance metrics if requested
    if (logMessage) {
      await timerInstance.logPerformance(true, { success: true, ...context });
    }
    
    return result;
  } catch (error) {
    // Build comprehensive error context for logging and debugging
    const errorContext = { opName, errorCode, errorType, ...context };
    
    // Log failed operation with detailed error information
    await timerInstance.logPerformance(false, { error: error.message, ...errorContext });
    
    // Handle error based on rethrow configuration
    if (rethrow) {
      // Enhance error message with failure context for better debugging
      if (error instanceof Error) {
        error.message = `${failureMessage}: ${error.message}`;
      }
      throw error; // Re-throw for caller to handle
    }
    
    // Return fallback value for graceful degradation
    return fallbackValue;
  }
};

/**
 * Legacy executeWithQerrors wrapper for backward compatibility
 * 
 * Purpose: Provides a backward-compatible wrapper around executeWithErrorHandling
 * for existing code that uses the old executeWithQerrors function name. This
 * ensures that existing imports and function calls continue to work without
 * modification while the underlying implementation uses the new unified function.
 * 
 * Design Rationale:
 * - Backward compatibility: Maintains existing API for legacy code
 * - Unified implementation: Delegates to the new executeWithErrorHandling function
 * - Migration path: Allows gradual migration to new function names
 * - Zero breaking changes: Existing code continues to work without modification
 * 
 * @deprecated Use executeWithErrorHandling instead for new code
 * @param {Object} options - Same options as executeWithErrorHandling
 * @returns {Promise<*>} Operation result or fallback value
 */
const executeWithQerrors = async (options) => {
  return executeWithErrorHandling(options);
};

/**
 * Format error message with context and comprehensive error handling
 * 
 * Purpose: Creates standardized error messages that include contextual information
 * for better debugging and error tracking. This function safely extracts error
 * messages from various error object types and formats them consistently with
 * optional context brackets.
 * 
 * Design Rationale:
 * - Message safety: Uses safeErrorMessage to handle various error object types
 * - Context preservation: Includes function context in brackets for debugging
 * - Consistent formatting: Provides uniform message format across the application
 * - Error resilience: Falls back to basic string conversion if logging utilities fail
 * - Debugging support: Context information helps trace error origins
 * 
 * @param {Error|string} error - Error object or error message to format
 * @param {string|null} context - Context information (function name, operation, etc.)
 * @returns {string} Formatted error message with optional context
 * 
 * Example:
 * formatErrorMessage(new Error('Database failed'), 'getUserData')
 * // Returns: "[getUserData] Database failed"
 * 
 * formatErrorMessage('Simple error message', null)
 * // Returns: "Simple error message"
 */
const formatErrorMessage = (error, context) => {
  try {
    // Use safe error message extraction to handle various error object types
    const { safeErrorMessage } = require('./logging');
    const message = safeErrorMessage(error, 'Unknown error');
    return context ? `[${context}] ${message}` : message;
  } catch {
    // Fallback if logging module is unavailable or fails
    const message = error instanceof Error ? error.message : String(error);
    return context ? `[${context}] ${message}` : message;
  }
};

module.exports = {
  safeRun,
  deepClone,
  attempt,
  executeWithErrorHandling,
  executeWithQerrors,
  formatErrorMessage
};