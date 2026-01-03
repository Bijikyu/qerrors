'use strict';

/**
 * Generic safe logging helper with comprehensive fallback pattern
 *
 * Purpose: Provides a robust logging mechanism that attempts to use the application's
 * configured logger first, then gracefully falls back to console logging if the
 * logger is unavailable or fails. This ensures that log messages are never lost
 * due to logging system failures.
 *
 * Design Rationale:
 * - Error isolation: Prevents logging errors from affecting application flow
 * - Graceful degradation: Falls back to console when main logger fails
 * - Method resolution: Dynamically constructs logger method names for flexibility
 * - Metadata preservation: Maintains context information across all logging paths
 * - Silent failures: Catches and ignores logging errors to prevent application disruption
 *
 * @param {string} level - Log level (error, warn, info, debug, etc.)
 * @param {string} message - Message to log
 * @param {Function} fallbackFn - Console function to use as fallback (console.log, console.error, etc.)
 * @param {Object} [metadata={}] - Additional metadata to include with the log message
 * @returns {Promise<void>} Promise that resolves when logging is complete (or fails silently)
 */
const safeLogWithFallback = async (level, message, fallbackFn, metadata = {}) => {
  try {
    // Attempt to use the application's configured logger
    const logger = require('../logger');

    // Dynamically construct the method name (e.g., 'error' -> 'logError')
    const logMethod = `log${level.charAt(0).toUpperCase() + level.slice(1)}`;

    // Verify that the method exists and is callable before attempting to use it
    if (typeof logger?.[logMethod] === 'function') {
      await logger[logMethod](message, metadata);
      return; // Success - exit early, no fallback needed
    }
  } catch {
    // Silently ignore any errors from the main logger and proceed to fallback
    // This prevents logging failures from affecting application functionality
  }

  // Fallback to console logging if main logger fails or is unavailable
  try {
    fallbackFn(message, metadata);
  } catch (fallbackErr) {
    // Ultimate fallback: if even console logging fails, log the error to console.error
    // This is a last resort to ensure some visibility into logging failures
    console.error('Fallback logging error:', fallbackErr);
  }
};

/**
 * Safe error logging with context and metadata support
 *
 * Purpose: Provides specialized error logging that safely extracts error messages,
 * includes contextual information, and maintains metadata across all logging paths.
 * This function is designed to handle error objects safely and provide meaningful
 * log output even when the logging system is compromised.
 *
 * Design Rationale:
 * - Error safety: Uses safeErrorMessage to handle various error object types
 * - Context preservation: Includes function context for debugging and tracing
 * - Metadata support: Maintains additional debugging information
 * - Double fallback: Falls back to direct console logging if safeLogWithFallback fails
 * - Message formatting: Provides consistent message format with context brackets
 *
 * @param {Error|string} error - Error object or error message to log
 * @param {Object} [context={}] - Context information (function name, operation, etc.)
 * @param {Object} [metadata={}] - Additional metadata for debugging
 * @returns {Promise<void>} Promise that resolves when logging is complete
 */
const safeLogError = async (error, context = {}, metadata = {}) => {
  try {
    // Use the safe logging helper with error-specific configuration
    const { safeErrorMessage } = require('./logging');
    await safeLogWithFallback('error', safeErrorMessage(error), console.error, { context, ...metadata });
  } catch {
    // Double fallback: if the safe logging helper fails, log directly to console
    // This ensures error messages are never lost due to logging system failures
    const { safeErrorMessage } = require('./logging');
    const errorMsg = safeErrorMessage(error);
    const fullMessage = `[${context}] ${errorMsg}`;

    // Include metadata if available, otherwise log just the message
    if (metadata && Object.keys(metadata).length > 0) {
      console.error(fullMessage, metadata);
    } else {
      console.error(fullMessage);
    }
  }
};

/**
 * Safe info logging with metadata support
 *
 * Purpose: Provides safe informational logging that uses the application's
 * configured logger when available, with console.log as fallback. This is
 * suitable for general application information, status updates, and
 * non-critical operational messages.
 *
 * @param {string} message - Informational message to log
 * @param {Object} [metadata={}] - Additional metadata for context
 * @returns {Promise<void>} Promise that resolves when logging is complete
 */
const safeLogInfo = async (message, metadata = {}) => {
  await safeLogWithFallback('info', message, console.log, metadata);
};

/**
 * Safe warning logging with metadata support
 *
 * Purpose: Provides safe warning logging that uses the application's
 * configured logger when available, with console.warn as fallback. This is
 * suitable for potential issues, deprecated feature usage, and conditions
 * that should be monitored but don't represent critical failures.
 *
 * @param {string} message - Warning message to log
 * @param {Object} [metadata={}] - Additional metadata for context
 * @returns {Promise<void>} Promise that resolves when logging is complete
 */
const safeLogWarn = async (message, metadata = {}) => {
  await safeLogWithFallback('warn', message, console.warn, metadata);
};

/**
 * Safe debug logging with specialized fallback handling
 *
 * Purpose: Provides safe debug logging that attempts to use the application's
 * configured logger first, but falls back to verboseLog for debug messages.
 * This specialized fallback avoids potential JSON.stringify issues that can
 * occur with complex metadata objects in debug scenarios.
 *
 * Design Rationale:
 * - Debug optimization: Uses verboseLog fallback to avoid JSON serialization issues
 * - Metadata handling: Safely handles complex metadata objects in debug output
 * - Performance: Avoids expensive JSON operations for debug-level logging
 * - Error safety: Catches and ignores all logging errors to prevent application disruption
 *
 * @param {string} message - Debug message to log
 * @param {Object} [metadata={}] - Additional metadata for debugging
 * @returns {Promise<void>} Promise that resolves when logging is complete
 */
const safeLogDebug = async (message, metadata = {}) => {
  try {
    // Attempt to use the application's configured logger
    const logger = require('../logger');
    const logMethod = 'logDebug';

    // Verify that the debug method exists and is callable
    if (typeof logger?.[logMethod] === 'function') {
      await logger[logMethod](message, metadata);
      return; // Success - exit early
    }
  } catch {
    // Silently ignore logger errors and proceed to fallback
  }

  // Direct fallback for debug to avoid JSON.stringify issues with complex objects
  // verboseLog is used instead of console.log to maintain consistent debug formatting
  const { verboseLog } = require('./logging');
  if (Object.keys(metadata).length > 0) {
    // Include metadata as JSON string if available
    verboseLog(`${message} ${JSON.stringify(metadata)}`);
  } else {
    // Simple message-only debug output
    verboseLog(message);
  }
};

/**
 * Enhanced qerrors wrapper with comprehensive error handling
 *
 * Purpose: Provides a safe wrapper for the qerrors error handling system that
 * ensures error messages are always logged, even when the main qerrors system
 * or logging utilities are unavailable. This serves as the ultimate fallback
 * for error reporting in the application.
 *
 * Design Rationale:
 * - Ultimate reliability: Ensures errors are always logged, even when all other systems fail
 * - Context preservation: Maintains function context for debugging and tracing
 * - Message safety: Uses safeErrorMessage to handle various error object types
 * - Extra data support: Handles additional context information for comprehensive debugging
 * - Triple fallback: Falls back to raw console.error if even safeErrorMessage fails
 *
 * @param {Error|string} error - Error object or error message to log
 * @param {string} context - Context information (function name, operation, etc.)
 * @param {Object} [extra={}] - Additional context data for debugging
 * @returns {Promise<void>} Promise that resolves when logging is complete
 */
const safeQerrors = async (error, context, extra = {}) => {
  try {
    // Use safe error message extraction to handle various error object types
    const { safeErrorMessage } = require('./logging');
    const errorMsg = safeErrorMessage(error);
    const fullMessage = `[${context}] ${errorMsg}`;

    // Include extra context data if available
    if (extra && Object.keys(extra).length > 0) {
      console.error(fullMessage, extra);
    } else {
      console.error(fullMessage);
    }
  } catch {
    // Ultimate fallback: if even safeErrorMessage fails, log raw data
    // This ensures some error information is always preserved
    console.error(`[${context}]`, error, extra);
  }
};

module.exports = {
  safeLogError,
  safeLogInfo,
  safeLogWarn,
  safeLogDebug,
  safeQerrors
};
