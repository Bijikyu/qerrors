/**
 * Common Utility Functions for qerrors module
 * 
 * This module centralizes utility functions that are used across multiple
 * components of the qerrors system. Provides safe operations, string processing,
 * and debugging helpers that maintain consistency throughout the codebase.
 * 
 * Design rationale:
 * - Centralized utilities prevent code duplication
 * - Safe operations provide consistent error handling
 * - String processing utilities handle various data types safely
 * - Debugging helpers maintain consistent logging patterns
 * - Performance utilities enable optimization tracking
 */

/**
 * Safe Function Execution Wrapper
 * 
 * Purpose: Provides consistent error handling for operations that might fail
 * Prevents crashes while maintaining observability of failures.
 */
const safeRun = (name, fn, fallback, info) => { try { return fn(); } catch (err) { console.error(`${name} failed`, info); return fallback; } };

/**
 * Safe Context Stringification
 * 
 * Purpose: Safely converts context objects to strings without throwing on circular references
 * Handles various data types and provides consistent output for logging and debugging.
 */
const stringifyContext = ctx => {
  try {
    if (typeof ctx === 'string') return ctx;
    if (typeof ctx === 'object' && ctx !== null) {
      const seen = new Set();
      return JSON.stringify(ctx, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (value === ctx) return '[Circular *1]';
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      });
    }
    return String(ctx);
  } catch (err) {
    return 'unknown context';
  }
};

/**
 * Conditional Verbose Logging
 * 
 * Purpose: Provides conditional console output for debugging without logger dependencies
 * Respects environment configuration for verbose output control.
 */
const verboseLog = msg => process.env.QERRORS_VERBOSE !== 'false' && console.log(msg);





/**
 * Deep Clone Utility
 * 
 * Purpose: Creates deep copies of objects without mutation risks.
 * Uses lodash for better performance and compatibility.
 */
const { cloneDeep } = require('lodash');

const deepClone = obj => cloneDeep(obj);

/**
 * Performance Timing Utilities
 * 
 * Purpose: Provides high-resolution timing for performance monitoring
 * Uses process.hrtime.bigint() for nanosecond precision when available.
 */
const createTimer = () => {
  const startTime = process.hrtime.bigint();
  return {
    elapsed() { return Number(process.hrtime.bigint() - startTime) / 1000000; },
    elapsedFormatted() {
      const ms = this.elapsed();
      return ms < 1000 ? `${ms.toFixed(2)}ms` : ms < 60000 ? `${(ms / 1000).toFixed(2)}s` : `${(ms / 60000).toFixed(2)}m`;
    }
  };
};



/**
 * Safe Error Message Extraction
 * 
 * Purpose: Safely extracts human-readable error messages from unknown error types.
 * Handles Error objects, primitive values, null/undefined cases with sensible fallbacks.
 * Essential for robust error handling where errors can come from various sources.
 * 
 * @param {unknown} error - The error value (can be Error, string, or any thrown value)
 * @param {string} fallback - Default message if error message cannot be extracted
 * @returns {string} Human-readable error message
 * 
 * @example
 * try { ... } catch (e) {
 *   const message = safeErrorMessage(e, 'An unexpected error occurred');
 * }
 */
const safeErrorMessage = (error, fallback) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String(error.message || '').trim();
    if (msg) return msg;
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  return fallback;
};

/**
 * Safe Structured Error Logger
 * 
 * Purpose: Unified structured error logging that never throws.
 * Prevents logging failures from breaking application flow.
 * Handles various qerrors export patterns gracefully.
 * Essential for production where logging reliability is crucial but failures shouldn't impact primary functionality.
 * 
 * @param {unknown} error - The error to log
 * @param {string} context - Context description where error occurred
 * @param {Object} [metadata] - Additional metadata for structured logging
 * @returns {void}
 * 
 * @example
 * try { ... } catch (e) {
 *   logError(e, 'UserService.createUser', { userId: 123 });
 * }
 */
const logError = (error, context, metadata = {}) => {
  try {
    const qerrors = require('./qerrors');
    if (typeof qerrors?.qerrors === 'function') { qerrors.qerrors(error, context, metadata); return; }
    if (typeof qerrors === 'function') { qerrors(error, context, metadata); return; }
    const logger = require('./logger');
    if (typeof logger?.logError === 'function') logger.logError(safeErrorMessage(error, 'Unknown error'), { context, ...metadata });
  } catch {}
};

/**
 * Safe Structured Info Logger
 * 
 * Purpose: Unified structured info logging that never throws.
 * 
 * @param {string} message - The message to log
 * @param {Object} [metadata] - Additional metadata
 * @returns {void}
 */
const logInfo = (message, metadata = {}) => { try { const logger = require('./logger'); typeof logger?.logInfo === 'function' && logger.logInfo(message, metadata); } catch {} };

/**
 * Safe Structured Warning Logger
 * 
 * Purpose: Unified structured warning logging that never throws.
 * 
 * @param {string} message - The message to log
 * @param {Object} [metadata] - Additional metadata
 * @returns {void}
 */
const logWarn = (message, metadata = {}) => { try { const logger = require('./logger'); typeof logger?.logWarn === 'function' && logger.logWarn(message, metadata); } catch {} };

/**
 * Safe Qerrors
 * 
 * Purpose: Safe wrapper around the main qerrors function with graceful console fallback.
 * Attempts to use qerrors when available, falls back to console.error when not.
 * Essential for applications that want enhanced logging but need to work without qerrors.
 * 
 * @param {unknown} error - The error to log
 * @param {string} context - Context/location where error occurred
 * @param {Object} [extra] - Additional metadata
 * @returns {Promise<void>}
 * 
 * @example
 * await safeQerrors(error, 'PaymentService.processPayment', { orderId });
 */
const safeQerrors = async (error, context, extra = {}) => {
  try {
    const qerrors = require('./qerrors');
    const fn = typeof qerrors?.qerrors === 'function' ? qerrors.qerrors : null;
    if (fn) { await fn(error, context, extra); return; }
  } catch {}
  try {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${context}]`, message, extra);
  } catch {}
};

/**
 * Attempt Result Type Pattern
 * 
 * Purpose: Safely attempts operations that might fail, returning result objects instead of throwing.
 * Provides predictable error handling with explicit success/failure states.
 * 
 * @template T
 * @param {() => T | Promise<T>} fn - Function to attempt
 * @returns {Promise<{ok: true, value: T} | {ok: false, error: unknown}>}
 * 
 * @example
 * const result = await attempt(() => JSON.parse(data));
 * if (result.ok) {
 *   console.log(result.value);
 * } else {
 *   console.error('Parse failed:', result.error);
 * }
 */
const attempt = async fn => { try { const value = await Promise.resolve().then(fn); return { ok: true, value }; } catch (error) { return { ok: false, error }; } };

/**
 * Execute With Qerrors
 * 
 * Purpose: Wraps async operations with comprehensive error handling and logging.
 * Consolidates qerrors usage so services don't duplicate try/catch logic.
 * Provides optional graceful degradation when caller wants to continue after logging.
 * 
 * @param {Object} options - Execution options
 * @param {string} options.opName - Operation name for logging
 * @param {() => Promise<T>} options.operation - Async operation to execute
 * @param {Object} [options.context] - Additional context for error logging
 * @param {string} options.failureMessage - Message to log on failure
 * @param {string} [options.errorCode] - Error code for typed errors
 * @param {string} [options.errorType] - Error type classification
 * @param {string} [options.logMessage] - Custom log message
 * @param {boolean} [options.rethrow=true] - Whether to rethrow after logging
 * @param {T} [options.fallbackValue] - Value to return on failure if rethrow=false
 * @returns {Promise<T>}
 * 
 * @example
 * const data = await executeWithQerrors({
 *   opName: 'fetchUser',
 *   operation: () => api.getUser(id),
 *   failureMessage: 'Failed to fetch user',
 *   context: { userId: id },
 *   rethrow: false,
 *   fallbackValue: null
 * });
 */
const executeWithQerrors = async options => {
  const { opName, operation, context = {}, failureMessage, errorCode, errorType, logMessage, rethrow = true, fallbackValue } = options;
  try {
    return await operation();
  } catch (error) {
    const errorContext = { opName, errorCode, errorType, ...context };
    logError(error, logMessage || failureMessage, errorContext);
    if (rethrow) {
      if (error instanceof Error) error.message = `${failureMessage}: ${error.message}`;
      throw error;
    }
    return fallbackValue;
  }
};

/**
 * Format Error Message
 * 
 * Purpose: Standardized error message formatting for consistent logging.
 * 
 * @param {unknown} error - The error to format
 * @param {string} context - Context where error occurred
 * @returns {string}
 */
const formatErrorMessage = (error, context) => {
  const message = safeErrorMessage(error, 'Unknown error');
  return context ? `[${context}] ${message}` : message;
};

/**
 * Create Safe Async Wrapper
 * 
 * Purpose: Creates a safe async wrapper that attempts to use a module function
 * and falls back to an alternative when unavailable.
 * Useful for optional dependencies and graceful degradation.
 * 
 * @param {Object} options - Wrapper configuration
 * @param {string} [options.modulePath] - Module path to load dynamically
 * @param {string} [options.functionName] - Function name to call on the loaded module
 * @param {Function} [options.fallbackFn] - Fallback function when module unavailable
 * @param {boolean} [options.silent=true] - Whether to suppress errors
 * @param {string} [options.errorMessage] - Custom error message
 * @returns {Function} Async function with fallback behavior
 * 
 * @example
 * const safeAnalyze = createSafeAsyncWrapper({
 *   modulePath: './analyzer',
 *   functionName: 'analyze',
 *   fallbackFn: (data) => ({ analyzed: false, data }),
 *   silent: true
 * });
 */
const createSafeAsyncWrapper = options => {
  const { modulePath = './qerrors', functionName = '', fallbackFn, silent = true, errorMessage } = options;
  return async function safeWrapper(...args) {
    try {
      const module = require(modulePath);
      if (module && functionName) {
        const fn = typeof module[functionName] === 'function' ? module[functionName] : null;
        if (fn) return await fn(...args);
      }
    } catch (error) {
      if (!silent) {
        const msg = errorMessage || `Failed to call ${functionName} from ${modulePath}`;
        console.warn(msg, error);
      }
    }
    if (fallbackFn) {
      try {
        return await fallbackFn(...args);
      } catch (fallbackError) {
        if (!silent) console.warn('Fallback function failed:', fallbackError);
      }
    }
  };
};

/**
 * Create Safe Logger
 * 
 * Purpose: Creates a safe error logger with fallback to console methods.
 * 
 * @param {string} functionName - Name of the logging function to use
 * @param {'error'|'warn'|'log'|'info'} [fallbackLevel='error'] - Console method to use as fallback
 * @returns {Function} Safe logging function
 * 
 * @example
 * const safeError = createSafeLogger('qerrors', 'error');
 * await safeError('Something went wrong', { context: 'UserService' });
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
 * Create Safe Operation
 * 
 * Purpose: Wraps any async function with try/catch protection and optional fallback value.
 * 
 * @param {Function} asyncFn - Async function to wrap
 * @param {*} [fallbackValue] - Value to return on error
 * @param {Function} [onError] - Optional error handler callback
 * @returns {Function} Wrapped function with error protection
 * 
 * @example
 * const safeFetch = createSafeOperation(
 *   (url) => fetch(url).then(r => r.json()),
 *   { error: true },
 *   (err, url) => console.error(`Failed to fetch ${url}:`, err)
 * );
 */
const createSafeOperation = (asyncFn, fallbackValue, onError) => async function safeOperation(...args) {
  try {
    return await asyncFn(...args);
  } catch (error) {
    onError && onError(error, ...args);
    return fallbackValue;
  }
};


  

module.exports = { safeRun, stringifyContext, verboseLog, deepClone, createTimer, safeErrorMessage, logError, logInfo, logWarn, attempt, executeWithQerrors, formatErrorMessage, createSafeAsyncWrapper, createSafeLogger, createSafeOperation, safeQerrors };