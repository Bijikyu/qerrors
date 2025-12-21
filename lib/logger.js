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
// Import logger configuration utilities that create the Winston logger instance and a simple logger variant
const { buildLogger, createSimpleWinstonLogger } = require('./loggerConfig');
const { 
  logStart, 
  logReturn, 
  logDebug, 
  logInfo, 
  logWarn, 
  logError, 
  logFatal, 
  logAudit 
} = require('./loggerFunctions');

// Import shared utilities for re-export
const { createEnhancedLogEntry } = require('./shared/logging');
const { LOG_LEVELS } = require('./shared/constants');
const { sanitizeMessage, sanitizeContext } = require('./sanitization');

// Performance timer using shared utilities
const { createPerformanceTimer } = require('./shared/logging');

// Initialise the shared Winston logger instance using the configuration defined in loggerConfig
const logger = buildLogger();
const simpleLogger = createSimpleWinstonLogger();

// Create bound logging functions that automatically use the logger
const boundLogStart = async (name, data) => logStart(name, data, logger);
const boundLogReturn = async (name, data) => logReturn(name, data, logger);
const boundLogDebug = async (message, context = {}, requestId = null) => logDebug(message, context, requestId, logger);
const boundLogInfo = async (message, context = {}, requestId = null) => logInfo(message, context, requestId, logger);
const boundLogWarn = async (message, context = {}, requestId = null) => logWarn(message, context, requestId, logger);
const boundLogError = async (message, context = {}, requestId = null) => logError(message, context, requestId, logger);
const boundLogFatal = async (message, context = {}, requestId = null) => logFatal(message, context, requestId, logger);
const boundLogAudit = async (message, context = {}, requestId = null) => logAudit(message, context, requestId, logger);

module.exports = logger;
module.exports.logStart = boundLogStart;
module.exports.logReturn = boundLogReturn;
module.exports.logDebug = boundLogDebug;
module.exports.logInfo = boundLogInfo;
module.exports.logWarn = boundLogWarn;
module.exports.logError = boundLogError;
module.exports.logFatal = boundLogFatal;
module.exports.logAudit = boundLogAudit;
module.exports.createPerformanceTimer = createPerformanceTimer;
module.exports.sanitizeMessage = sanitizeMessage;
module.exports.sanitizeContext = sanitizeContext;
module.exports.createEnhancedLogEntry = createEnhancedLogEntry;
module.exports.LOG_LEVELS = LOG_LEVELS;
module.exports.simpleLogger = simpleLogger;
module.exports.createSimpleWinstonLogger = createSimpleWinstonLogger;