/**
 * Error Logger Utility
 *
 * Purpose: Provides centralized error logging with qerrors fallback to console
 * to eliminate duplicated error handling patterns across multiple files.
 *
 * Design Rationale:
 * - Single point of error logging configuration
 * - Graceful fallback when qerrors module is unavailable
 * - Consistent error context and metadata handling
 * - Prevents infinite recursion in error logging
 * - Provides both synchronous and async logging capabilities
 */

let qerrorsLogger = null;
let qerrorsLoadAttempted = false;

/**
 * Attempt to load qerrors module safely
 *
 * @returns {Object|null} qerrors module or null if unavailable
 */
function loadQerrors () {
  if (qerrorsLoadAttempted) {
    return qerrorsLogger;
  }

  qerrorsLoadAttempted = true;

  try {
    qerrorsLogger = require('./qerrors');
    return qerrorsLogger;
  } catch (error) {
    // qerrors not available, will use console fallback
    qerrorsLogger = null;
    return null;
  }
}

/**
 * Log error with qerrors or fallback to console
 *
 * @param {Error} error - Error to log
 * @param {string} location - Location identifier for the error
 * @param {Object} context - Additional context information
 * @param {Object} [options={}] - Additional options
 * @returns {boolean} True if logged successfully
 */
function logError (error, location, context = {}, options = {}) {
  const { severity = 'error', fallback = true } = options;

  // Try to use qerrors if available
  const qerrors = loadQerrors();
  if (qerrors) {
    try {
      qerrors(error, location, context);
      return true;
    } catch (qerrorsError) {
      // qerrors failed to log, fall back to console
      if (fallback) {
        console.error(`Failed to log qerrors: ${qerrorsError?.message || qerrorsError}`);
        console.error(`[${severity.toUpperCase()}] ${location}:`, error?.message || error);
        if (context && Object.keys(context).length > 0) {
          console.error('Context:', context);
        }
      }
      return false;
    }
  } else {
    // qerrors not available, use console fallback
    if (fallback) {
      console.error(`[${severity.toUpperCase()}] ${location}:`, error?.message || error);
      if (context && Object.keys(context).length > 0) {
        console.error('Context:', context);
      }
    }
    return false;
  }
}

/**
 * Log error as warning with qerrors or fallback to console
 *
 * @param {Error} error - Error to log as warning
 * @param {string} location - Location identifier for the warning
 * @param {Object} context - Additional context information
 * @returns {boolean} True if logged successfully
 */
function logWarning (error, location, context = {}) {
  return logError(error, location, context, { severity: 'warning' });
}

/**
 * Log error as info with qerrors or fallback to console
 *
 * @param {Error} error - Error to log as info
 * @param {string} location - Location identifier for the info
 * @param {Object} context - Additional context information
 * @returns {boolean} True if logged successfully
 */
function logInfo (error, location, context = {}) {
  return logError(error, location, context, { severity: 'info' });
}

/**
 * Create a safe logger function that uses qerrors with console fallback
 *
 * @param {string} defaultLocation - Default location for error messages
 * @param {string} [severity='error'] - Default severity level
 * @returns {Function} Safe logger function
 */
function createSafeLogger (defaultLocation, severity = 'error') {
  return (error, location = defaultLocation, context = {}) => {
    return logError(error, location, context, { severity });
  };
}

/**
 * Log multiple errors efficiently (batch processing)
 *
 * @param {Array} errors - Array of {error, location, context} objects
 * @param {Object} [options={}] - Batch options
 * @returns {number} Number of errors successfully logged
 */
function logErrors (errors, options = {}) {
  const { severity = 'error' } = options;
  let successCount = 0;

  for (const { error, location, context } of errors) {
    if (logError(error, location, context, { severity })) {
      successCount++;
    }
  }

  return successCount;
}

/**
 * Check if qerrors is available
 *
 * @returns {boolean} True if qerrors is available
 */
function isQerrorsAvailable () {
  return loadQerrors() !== null;
}

/**
 * Get qerrors module status
 *
 * @returns {Object} Status information about qerrors availability
 */
function getLoggerStatus () {
  const qerrors = loadQerrors();
  return {
    qerrorsAvailable: qerrors !== null,
    loadAttempted: qerrorsLoadAttempted,
    fallbackMode: qerrors === null
  };
}

/**
 * Reset qerrors cache (useful for testing)
 */
function resetCache () {
  qerrorsLogger = null;
  qerrorsLoadAttempted = false;
}

module.exports = {
  logError,
  logWarning,
  logInfo,
  createSafeLogger,
  logErrors,
  isQerrorsAvailable,
  getLoggerStatus,
  resetCache,
  // Legacy compatibility
  loadQerrors
};
