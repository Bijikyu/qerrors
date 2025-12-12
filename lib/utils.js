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
function safeRun(name, fn, fallback, info) { //utility wrapper for try/catch operations
  try { 
    return fn(); 
  } catch (err) { 
    console.error(`${name} failed`, info); 
    return fallback; 
  }
}

/**
 * Safe Context Stringification
 * 
 * Purpose: Safely converts context objects to strings without throwing on circular references
 * Handles various data types and provides consistent output for logging and debugging.
 */
function stringifyContext(ctx) { //safely stringify context without errors
  try {
    if (typeof ctx === 'string') {
      return ctx;
    }
    if (typeof ctx === 'object' && ctx !== null) {
      return JSON.stringify(ctx, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (value === ctx) return '[Circular *1]'; //(handle self-reference)
          const seen = new Set();
          if (seen.has(value)) return '[Circular]'; //(handle other circular references)
          seen.add(value);
        }
        return value;
      });
    }
    return String(ctx);
  } catch (err) {
    return 'unknown context'; //(fallback for any stringify failures)
  }
}

/**
 * Conditional Verbose Logging
 * 
 * Purpose: Provides conditional console output for debugging without logger dependencies
 * Respects environment configuration for verbose output control.
 */
function verboseLog(msg) { //conditional console output helper for debugging without logger dependency
  if (process.env.QERRORS_VERBOSE !== 'false') { console.log(msg); } //(print by default, suppress only when explicitly set to false)
}

/**
 * Environment Variable Parsing with Validation
 * 
 * Purpose: Safely parses integer environment variables with bounds checking
 * Provides consistent default handling across the module.
 */
function parseIntWithMin(envVar, defaultValue, minValue = 1) { //parse integer env var with minimum enforcement
  const parsed = parseInt(envVar, 10);
  const value = Number.isNaN(parsed) ? defaultValue : parsed;
  return value >= minValue ? value : minValue;
}

/**
 * Unique Identifier Generation
 * 
 * Purpose: Generates unique identifiers for request correlation and error tracking
 * Uses crypto for strong randomness when available, falls back to timestamp-based IDs.
 */
function generateUniqueId(prefix = '') { //generate unique identifier for tracking
  try {
    const crypto = require('crypto');
    return prefix + crypto.randomUUID();
  } catch (err) {
    // Fallback for environments without crypto.randomUUID
    return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

/**
 * Deep Object Cloning
 * 
 * Purpose: Creates deep copies of objects to prevent mutation issues
 * Handles circular references and various data types safely.
 */
function deepClone(obj) { //create deep copy of object without mutation risks
  if (obj === null || typeof obj !== 'object') {
    return obj; //return primitives as-is
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()); //handle Date objects
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)); //recursively clone array items
  }
  
  const cloned = {};
  Object.keys(obj).forEach(key => {
    cloned[key] = deepClone(obj[key]); //recursively clone object properties
  });
  
  return cloned;
}

/**
 * Performance Timing Utilities
 * 
 * Purpose: Provides high-resolution timing for performance monitoring
 * Uses process.hrtime.bigint() for nanosecond precision when available.
 */
function createTimer() { //create high-resolution timer for performance monitoring
  const startTime = process.hrtime.bigint();
  
  return {
    elapsed() { //get elapsed time in milliseconds
      const endTime = process.hrtime.bigint();
      return Number(endTime - startTime) / 1000000; //convert nanoseconds to milliseconds
    },
    
    elapsedFormatted() { //get formatted elapsed time string
      const ms = this.elapsed();
      if (ms < 1000) {
        return `${ms.toFixed(2)}ms`;
      } else if (ms < 60000) {
        return `${(ms / 1000).toFixed(2)}s`;
      } else {
        return `${(ms / 60000).toFixed(2)}m`;
      }
    }
  };
}

/**
 * Array Processing Utilities
 * 
 * Purpose: Provides safe array operations with null/undefined handling
 */
function safeArrayOperation(arr, operation, defaultValue = []) { //safely perform array operations
  if (!Array.isArray(arr)) {
    return defaultValue; //return default for non-arrays
  }
  
  try {
    return operation(arr);
  } catch (err) {
    verboseLog(`Array operation failed: ${err.message}`);
    return defaultValue;
  }
}

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
function safeErrorMessage(error, fallback) { //safely extract error message from unknown error types
  if (error && typeof error === 'object' && 'message' in error) { //(check for Error-like objects)
    const msg = String(error.message || '').trim(); //(extract and trim message)
    if (msg) return msg; //(return if non-empty)
  }
  if (typeof error === 'string' && error.trim()) { //(handle string errors)
    return error.trim();
  }
  return fallback; //(return fallback for null, undefined, or empty messages)
}

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
function logError(error, context, metadata = {}) { //unified structured error logger that never throws
  try {
    const qerrors = require('./qerrors'); //(lazy load to avoid circular deps)
    
    if (typeof qerrors?.qerrors === 'function') { //(handle named export pattern)
      qerrors.qerrors(error, context, metadata);
      return;
    }
    
    if (typeof qerrors === 'function') { //(handle default export pattern)
      qerrors(error, context, metadata);
      return;
    }
    
    const logger = require('./logger'); //(fallback to logger if qerrors unavailable)
    if (typeof logger?.logError === 'function') {
      logger.logError(safeErrorMessage(error, 'Unknown error'), { context, ...metadata });
    }
  } catch { //(never throw from logging path)
    //(silently fail - logging should never crash the app)
  }
}

/**
 * Safe Structured Info Logger
 * 
 * Purpose: Unified structured info logging that never throws.
 * 
 * @param {string} message - The message to log
 * @param {Object} [metadata] - Additional metadata
 * @returns {void}
 */
function logInfo(message, metadata = {}) { //unified structured info logger that never throws
  try {
    const logger = require('./logger');
    if (typeof logger?.logInfo === 'function') {
      logger.logInfo(message, metadata);
    }
  } catch { //(never throw from logging path)
  }
}

/**
 * Safe Structured Warning Logger
 * 
 * Purpose: Unified structured warning logging that never throws.
 * 
 * @param {string} message - The message to log
 * @param {Object} [metadata] - Additional metadata
 * @returns {void}
 */
function logWarn(message, metadata = {}) { //unified structured warning logger that never throws
  try {
    const logger = require('./logger');
    if (typeof logger?.logWarn === 'function') {
      logger.logWarn(message, metadata);
    }
  } catch { //(never throw from logging path)
  }
}

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
async function attempt(fn) { //safely attempt operation returning Result object
  try {
    const value = await Promise.resolve().then(fn); //(handle sync and async functions)
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error };
  }
}

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
async function executeWithQerrors(options) { //wrap async operations with qerrors error handling
  const {
    opName,
    operation,
    context = {},
    failureMessage,
    errorCode,
    errorType,
    logMessage,
    rethrow = true,
    fallbackValue
  } = options;

  try {
    return await operation();
  } catch (error) {
    const errorContext = { opName, errorCode, errorType, ...context };
    
    logError(error, logMessage || failureMessage, errorContext); //(use safe logger)

    if (rethrow) {
      if (error instanceof Error) {
        error.message = `${failureMessage}: ${error.message}`; //(enhance error message)
      }
      throw error;
    }

    return fallbackValue;
  }
}

/**
 * Format Error Message
 * 
 * Purpose: Standardized error message formatting for consistent logging.
 * 
 * @param {unknown} error - The error to format
 * @param {string} context - Context where error occurred
 * @returns {string}
 */
function formatErrorMessage(error, context) { //format error for logging
  const message = safeErrorMessage(error, 'Unknown error');
  return context ? `[${context}] ${message}` : message;
}

module.exports = { //(export utility functions for use across qerrors module)
  safeRun, //(safe function execution wrapper)
  stringifyContext, //(safe context stringification)
  verboseLog, //(conditional verbose logging)
  parseIntWithMin, //(integer parsing with validation)
  generateUniqueId, //(unique identifier generation)
  deepClone, //(deep object cloning)
  createTimer, //(performance timing utilities)
  safeArrayOperation, //(safe array operations)
  safeErrorMessage, //(safe error message extraction)
  logError, //(unified structured error logger that never throws)
  logInfo, //(unified structured info logger that never throws)
  logWarn, //(unified structured warning logger that never throws)
  attempt, //(Result-type pattern for safe operation execution)
  executeWithQerrors, //(async operation wrapper with error handling)
  formatErrorMessage //(standardized error message formatting)
};