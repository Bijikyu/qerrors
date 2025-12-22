'use strict';

/**
 * Safe Async Wrapper Utilities
 * 
 * Purpose: Provides standardized wrapper functions for async operations that include
 * comprehensive error handling, performance timing, and fallback mechanisms. These
 * wrappers ensure that the application remains stable even when individual operations
 * or dependencies fail.
 * 
 * Design Rationale:
 * - Defensive programming: All wrappers handle errors gracefully
 * - Performance monitoring: Integrated timing for all operations
 * - Fallback support: Optional fallback functions for resilience
 * - Consistent error handling: Standardized error reporting across all wrappers
 * - Silent operation: Configurable error output for production environments
 */

const { createUnifiedTimer } = require('./timers');

/**
 * Create safe async wrapper with standardized error handling
 * 
 * Purpose: Wraps async function calls with comprehensive error handling, performance
 * timing, and optional fallback execution. This wrapper is designed to protect against
 * module loading failures, function execution errors, and fallback function failures.
 * 
 * Use Cases:
 * - Wrapping calls to optional modules that may not be available
 * - Protecting against external dependency failures
 * - Providing graceful degradation when services are unavailable
 * - Adding performance monitoring to critical operations
 * 
 * @param {Object} options - Wrapper configuration options
 * @param {string} [options.modulePath='./qerrors'] - Path to module containing the function
 * @param {string} [options.functionName=''] - Name of function to call within the module
 * @param {Function} [options.fallbackFn] - Optional fallback function to execute on failure
 * @param {boolean} [options.silent=true] - Whether to suppress error output
 * @param {string} [options.errorMessage] - Custom error message for failures
 * @param {Object} [options.timer] - Optional timer instance for performance tracking
 * @returns {Function} Wrapped async function with comprehensive error handling
 */
const createSafeAsyncWrapper = (options) => {
  const { 
    modulePath = './qerrors', 
    functionName = '', 
    fallbackFn, 
    silent = true, 
    errorMessage,
    timer = null
  } = options;
  
  /**
   * Safe wrapper function with comprehensive error handling
   * 
   * This function implements a multi-layered error handling strategy:
   * 1. Module loading protection - handles require() failures
   * 2. Function existence validation - checks if function exists and is callable
   * 3. Execution error handling - catches errors during function execution
   * 4. Fallback execution - attempts fallback function if provided
   * 5. Performance tracking - logs timing and success/failure metrics
   * 
   * @param {...any} args - Arguments to pass to the target function
   * @returns {Promise<any>} Result from successful function or fallback execution
   */
  return async function safeWrapper(...args) {
    const opName = `${modulePath}.${functionName}`;
    const timerInstance = timer || createUnifiedTimer(opName, false);
    
    try {
      // Attempt to load the target module
      const module = require(modulePath);
      if (module && functionName) {
        // Validate that the function exists and is callable
        const fn = typeof module[functionName] === 'function' ? module[functionName] : null;
        if (fn) {
          // Execute the function with performance tracking
          const result = await fn(...args);
          await timerInstance.logPerformance(true, { function: functionName, args: args.length });
          return result;
        }
      }
    } catch (error) {
      // Log failure metrics and optionally output error details
      await timerInstance.logPerformance(false, { error: error.message, function: functionName });
      
      if (!silent) {
        const msg = errorMessage || `Failed to call ${functionName} from ${modulePath}`;
        console.warn(msg, error);
      }
    }
    
    // Attempt fallback execution if provided
    if (fallbackFn) {
      try {
        const fallbackResult = await fallbackFn(...args);
        return fallbackResult;
      } catch (fallbackError) {
        // Fallback failures are only logged if not in silent mode
        if (!silent) console.warn('Fallback function failed:', fallbackError);
      }
    }
  };
};

/**
 * Create safe logger wrapper with unified error handling
 * 
 * Purpose: Creates a specialized wrapper for logging functions that provides graceful
 * degradation when the primary logging system is unavailable. This ensures that
 * critical log messages are never lost due to logging system failures.
 * 
 * Design Rationale:
 * - Logging reliability: Ensures log messages are always captured
 * - Graceful degradation: Falls back to console logging when qerrors unavailable
 * - Consistent interface: Maintains same function signature as target logger
 * - Error isolation: Prevents logging errors from affecting application flow
 * 
 * @param {string} functionName - Name of the logging function to wrap (e.g., 'logError')
 * @param {string} [fallbackLevel='error'] - Console method to use as fallback
 * @returns {Function} Safe logging wrapper with fallback to console
 */
const createSafeLogger = (functionName, fallbackLevel = 'error') => {
  const fallbackFn = (message, details) => console[fallbackLevel](message, details);
  
  return createSafeAsyncWrapper({
    modulePath: './qerrors',
    functionName,
    fallbackFn,
    errorMessage: `qerrors.${functionName} unavailable, using console.${fallbackLevel}`
  });
};

/**
 * Create safe operation wrapper with integrated timing
 * 
 * Purpose: Wraps any async operation with comprehensive error handling, performance
 * monitoring, and optional error callbacks. This wrapper is designed for general
 * purpose operation protection where module loading is not a concern.
 * 
 * Use Cases:
 * - Protecting critical business logic operations
 * - Adding performance monitoring to existing functions
 * - Providing consistent error handling across operations
 * - Implementing retry patterns with error callbacks
 * 
 * Design Rationale:
 * - Operation isolation: Errors don't propagate beyond the wrapper
 * - Performance visibility: All operations are timed and logged
 * - Error notification: Optional callback for custom error handling
 * - Predictable behavior: Always returns a value (result or fallback)
 * 
 * @param {Function} asyncFn - Async function to wrap and protect
 * @param {*} [fallbackValue] - Value to return on operation failure
 * @param {Function} [onError] - Optional error callback function
 * @returns {Function} Safe operation wrapper with integrated timing
 */
const createSafeOperation = (asyncFn, fallbackValue, onError) => {
  return async function safeOperation(...args) {
    const opName = asyncFn.name || 'anonymous';
    const timerInstance = createUnifiedTimer(opName, false);
    
    try {
      // Execute the operation and track performance
      const result = await asyncFn(...args);
      await timerInstance.logPerformance(true, { args: args.length });
      return result;
    } catch (error) {
      // Log failure and optionally notify error callback
      await timerInstance.logPerformance(false, { error: error.message });
      onError && onError(error, ...args);
      return fallbackValue;
    }
  };
};

/**
 * Module exports - Safe wrapper utilities
 * 
 * These utilities provide different levels of protection for various scenarios:
 * - createSafeAsyncWrapper: General purpose module and function protection
 * - createSafeLogger: Specialized protection for logging functions
 * - createSafeOperation: Direct function wrapping with timing and error handling
 * 
 * Each wrapper is designed to fail gracefully and provide visibility into
 * operation performance and failure patterns.
 */
module.exports = {
  createSafeAsyncWrapper,
  createSafeLogger,
  createSafeOperation
};