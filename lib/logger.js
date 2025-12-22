'use strict';

/**
 * Logger module that builds and exports a configured Winston logger along with
 * convenience wrapper functions. The wrappers bind the shared logger instance
 * to the low‑level logging helpers so callers do not need to pass the logger
 * explicitly. This design centralises logger configuration while keeping the
 * public API ergonomic.
 *
 * Rationale:
 * - Exporting the logger directly mirrors typical Winston usage (`require(...).logger`).
 * - Providing bound helper functions avoids repetitive `logger` arguments throughout
 *   the codebase, reducing boilerplate and the chance of using a different logger
 *   instance accidentally.
 * - The additional exports (`createPerformanceTimer`, sanitisation utilities,
 *   constants, etc.) expose shared functionality without requiring consumers to
 *   know the internal file layout.
 */

// Import logger configuration utilities that create the Winston logger instance and a simple logger variant
const { buildLogger, createSimpleWinstonLogger } = require('./loggerConfig');

// Import low-level logging functions that work with any logger instance
const { 
  logStart,   // Function entry logging with performance tracking
  logReturn,  // Function exit logging with return value capture
  logDebug,   // Debug-level logging for development
  logInfo,    // Info-level logging for general information
  logWarn,    // Warning-level logging for potential issues
  logError,   // Error-level logging for error conditions
  logFatal,   // Fatal-level logging for critical failures
  logAudit    // Audit-level logging for security events
} = require('./loggerFunctions');

// Import shared utilities for re-export - provides access to common functionality
const { createEnhancedLogEntry } = require('./shared/logging');  // Enhanced log entry creation
const { LOG_LEVELS } = require('./shared/constants');              // Standardized log levels
const { sanitizeMessage, sanitizeContext } = require('./sanitization'); // Security sanitization

// Performance timer using shared utilities - for function execution timing
const { createPerformanceTimer } = require('./shared/logging');

// Initialise the shared Winston logger instances using configuration
// These are the core logger objects that all bound functions will use
const logger = buildLogger();                    // Main configured Winston logger
const simpleLogger = createSimpleWinstonLogger(); // Simplified logger for basic needs

/**
 * Create bound logging functions that automatically use the shared logger instance
 * 
 * These bound functions provide a clean API by pre-binding the logger parameter,
 * so callers don't need to pass the logger explicitly. This reduces boilerplate
 * and ensures consistent logger usage across the application.
 * 
 * Enhanced with non-blocking logging to prevent I/O operations from blocking request processing
 */
const boundLogStart = async (name, data) => {
  // Use setImmediate to move logging out of request processing path
  setImmediate(() => logStart(name, data, logger).catch(() => {}));
};

const boundLogReturn = async (name, data) => {
  setImmediate(() => logReturn(name, data, logger).catch(() => {}));
};

const boundLogDebug = async (message, context = {}, requestId = null) => {
  setImmediate(() => logDebug(message, context, requestId, logger).catch(() => {}));
};

const boundLogInfo = async (message, context = {}, requestId = null) => {
  setImmediate(() => logInfo(message, context, requestId, logger).catch(() => {}));
};

const boundLogWarn = async (message, context = {}, requestId = null) => {
  setImmediate(() => logWarn(message, context, requestId, logger).catch(() => {}));
};

const boundLogError = async (message, context = {}, requestId = null) => {
  setImmediate(() => logError(message, context, requestId, logger).catch(() => {}));
};

const boundLogFatal = async (message, context = {}, requestId = null) => {
  setImmediate(() => logFatal(message, context, requestId, logger).catch(() => {}));
};

const boundLogAudit = async (message, context = {}, requestId = null) => {
  setImmediate(() => logAudit(message, context, requestId, logger).catch(() => {}));
};

/**
 * Module exports - Comprehensive logging API with multiple access patterns
 * 
 * The export strategy provides:
 * - Default export: The main Winston logger instance for direct usage
 * - Bound functions: Pre-configured logging functions for convenience
 * - Utilities: Supporting functions and constants
 * - Re-exports: Shared utilities for easy access
 */

// Primary export - the main Winston logger instance for direct usage
module.exports = logger;

// Bound logging functions - pre-configured for convenience (no logger parameter needed)
module.exports.logStart = boundLogStart;      // Function entry logging
module.exports.logReturn = boundLogReturn;    // Function exit logging
module.exports.logDebug = boundLogDebug;      // Debug-level logging
module.exports.logInfo = boundLogInfo;        // Info-level logging
module.exports.logWarn = boundLogWarn;        // Warning-level logging
module.exports.logError = boundLogError;      // Error-level logging
module.exports.logFatal = boundLogFatal;      // Fatal-level logging
module.exports.logAudit = boundLogAudit;      // Audit-level logging

// Utility functions
module.exports.createPerformanceTimer = createPerformanceTimer;  // Performance timing
module.exports.sanitizeMessage = sanitizeMessage;                // Message sanitization
module.exports.sanitizeContext = sanitizeContext;                // Context sanitization
module.exports.createEnhancedLogEntry = createEnhancedLogEntry;  // Enhanced log creation

// Constants and additional loggers
module.exports.LOG_LEVELS = LOG_LEVELS;                          // Standardized log levels
module.exports.simpleLogger = simpleLogger;                      // Simple logger instance
module.exports.createSimpleWinstonLogger = createSimpleWinstonLogger; // Logger factory