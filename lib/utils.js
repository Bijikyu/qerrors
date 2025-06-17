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
      console.log('stringifyContext is running with string'); //(debug output for development)
      return ctx;
    }
    if (typeof ctx === 'object' && ctx !== null) {
      console.log('stringifyContext is running with object'); //(debug output for development)
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
    console.log('stringifyContext is running with other type'); //(debug output for development)
    return String(ctx);
  } catch (err) {
    console.log('stringifyContext is returning unknown context'); //(debug output for development)
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
  if (process.env.QERRORS_VERBOSE === 'true') { console.log(msg); } //(respect verbose flag)
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

module.exports = { //(export utility functions for use across qerrors module)
  safeRun, //(safe function execution wrapper)
  stringifyContext, //(safe context stringification)
  verboseLog, //(conditional verbose logging)
  parseIntWithMin, //(integer parsing with validation)
  generateUniqueId, //(unique identifier generation)
  deepClone, //(deep object cloning)
  createTimer, //(performance timing utilities)
  safeArrayOperation //(safe array operations)
};