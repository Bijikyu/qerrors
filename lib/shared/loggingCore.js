'use strict';

const { createEnhancedLogEntry } = require('./errorContext');
const localVars = require('../../config/localVars');
const { LOG_LEVELS } = localVars;

const createLogEntry=(level,message,context={},requestId=null)=>{const entry=createEnhancedLogEntry(level,message,context,requestId);const levelConfig=LOG_LEVELS[level.toUpperCase()];if(levelConfig&&levelConfig.priority>=LOG_LEVELS.WARN.priority){const memUsage=process.memoryUsage();entry.memory={heapUsed:Math.round(memUsage.heapUsed/1048576),heapTotal:Math.round(memUsage.heapTotal/1048576),external:Math.round(memUsage.external/1048576),rss:Math.round(memUsage.rss/1048576)};}return entry;};

/**
 * Stringify context with comprehensive circular reference handling and error safety
 * 
 * Purpose: Safely converts context objects to JSON strings with proper circular reference
 * detection and error handling. This prevents JSON.stringify errors from breaking
 * the logging system when complex objects with circular references are logged.
 * 
 * Design Rationale:
 * - Circular reference detection: Prevents JSON.stringify errors from circular object references
 * - Error safety: Catches and handles serialization errors gracefully
 * - Type flexibility: Handles strings, objects, and other data types appropriately
 * - Memory efficiency: Uses Set for efficient circular reference tracking
 * - Fallback behavior: Returns meaningful fallback text when serialization fails
 * 
 * @param {*} ctx - Context object or value to stringify
 * @returns {string} JSON string representation or fallback text
 * 
 * Example:
 * stringifyContext({ user: 'john', data: { nested: true } })
 * // Returns: '{"user":"john","data":{"nested":true}}'
 * 
 * stringifyContext('simple string')
 * // Returns: 'simple string'
 * 
 * stringifyContext({ circular: null })
 * // If circular references itself, returns: '{"circular":"[Circular]"}'
 */
const stringifyContext = ctx => {
  try {
    // Handle primitive types directly
    if (typeof ctx === 'string') return ctx;
    
    // Handle objects with circular reference detection
    if (typeof ctx === 'object' && ctx !== null) {
      const seen = new Set(); // Track objects we've seen to detect circular references
      
      return JSON.stringify(ctx, (_, value) => {
        // Only process object types for circular reference detection
        if (typeof value === 'object' && value !== null) {
          // Direct self-reference (most common circular pattern)
          if (value === ctx) return '[Circular *1]';
          
          // Previously seen object (indirect circular reference)
          if (seen.has(value)) return '[Circular]';
          
          // Mark this object as seen for future reference checking
          seen.add(value);
        }
        return value;
      });
    }
    
    // Handle all other types (numbers, booleans, null, undefined, etc.)
    return String(ctx);
  } catch (err) {
    // Fallback for any serialization errors
    return 'unknown context';
  }
};

/**
 * Extract safe error message from various error object types with comprehensive fallback
 * 
 * Purpose: Safely extracts meaningful error messages from different error object types
 * including native Error objects, custom error classes, and string values. This function
 * ensures that logging always has a meaningful error message to display, even when
 * error objects are malformed or missing expected properties.
 * 
 * Design Rationale:
 * - Type flexibility: Handles Error objects, custom error classes, and string errors
 * - Property safety: Checks for message property existence before accessing
 * - String validation: Ensures extracted messages are not empty or whitespace-only
 * - Fallback support: Provides meaningful default when error extraction fails
 * - Trimming: Removes leading/trailing whitespace for clean log output
 * 
 * @param {Error|string|*} error - Error object or error message to extract message from
 * @param {string} [fallback='Unknown error'] - Default message when extraction fails
 * @returns {string} Safe error message for logging
 * 
 * Example:
 * safeErrorMessage(new Error('Database connection failed'))
 * // Returns: 'Database connection failed'
 * 
 * safeErrorMessage('Simple error message')
 * // Returns: 'Simple error message'
 * 
 * safeErrorMessage({ message: '' })
 * // Returns: 'Unknown error'
 * 
 * safeErrorMessage(null)
 * // Returns: 'Unknown error'
 */
const safeErrorMessage = (error, fallback = 'Unknown error') => {
  // Handle Error objects and custom error classes with message property
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String(error.message || '').trim();
    if (msg) return msg; // Return non-empty message
  }
  
  // Handle string error messages
  if (typeof error === 'string' && error.trim()) {
    return error.trim(); // Return trimmed string message
  }
  
  // Fallback for all other cases (null, undefined, objects without message, etc.)
  return fallback;
};

/**
 * Verbose logging utility with environment-based conditional output
 * 
 * Purpose: Provides conditional console logging based on the QERRORS_VERBOSE environment
 * variable. This allows developers to control verbose debug output without modifying
 * code, enabling different logging levels for development and production environments.
 * 
 * Design Rationale:
 * - Environment control: Uses QERRORS_VERBOSE environment variable for configuration
 * - Performance optimization: Short-circuits evaluation when verbose logging is disabled
 * - Production safety: Defaults to enabled for development, can be disabled in production
 * - Simple interface: Single function call for conditional verbose output
 * - String safety: Assumes input is already formatted for console output
 * 
 * Environment Behavior:
 * - QERRORS_VERBOSE='false' or undefined: Logging is enabled (default behavior)
 * - QERRORS_VERBOSE='false': Logging is disabled
 * - All other values: Logging is enabled
 * 
 * @param {string} msg - Message to log to console (assumed to be pre-formatted)
 * 
 * Example:
 * verboseLog('Debug: Processing user request');
 * // Only logs if QERRORS_VERBOSE is not set to 'false'
 */
const verboseLog = msg => localVars.QERRORS_VERBOSE !== 'false' && console.log(msg);

module.exports = {
  createLogEntry,
  stringifyContext,
  safeErrorMessage,
  verboseLog
};