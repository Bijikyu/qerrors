'use strict';

// Import shared utilities using the new unified import system
const { commonImports, importGroups } = require('./shared/imports');
const logging = commonImports.logging();
const execution = commonImports.execution();
const fullSuite = importGroups.errorHandling();

// Legacy compatibility exports
const logError = (error, context, metadata) => logging.safeLogError(error, context, metadata);
const legacyLogInfo = (message, metadata) => logging.safeLogInfo(message, metadata);
const legacyLogWarn = (message, metadata) => logging.safeLogWarn(message, metadata);

// Export all utilities with backward compatibility
module.exports = {
  // Logging utilities
  createEnhancedLogEntry: logging.createEnhancedLogEntry,
  stringifyContext: logging.stringifyContext,
  safeErrorMessage: logging.safeErrorMessage || (() => {}),
  verboseLog: logging.verboseLog,
  createPerformanceTimer: logging.createPerformanceTimer,
  safeLogError: logging.safeLogError,
  safeLogInfo: logging.safeLogInfo,
  safeLogWarn: logging.safeLogWarn,
  safeLogDebug: logging.safeLogDebug,
  
  // Execution utilities
  safeRun: execution.safeRun,
  deepClone: execution.deepClone,
  createTimer: execution.createTimer,
  attempt: execution.attempt,
  executeWithQerrors: execution.executeWithQerrors,
  formatErrorMessage: execution.formatErrorMessage || (() => {}),
  createSafeAsyncWrapper: execution.createSafeAsyncWrapper || (() => {}),
  createSafeLogger: execution.createSafeLogger || (() => {}),
  createSafeOperation: execution.createSafeOperation || (() => {}),
  safeQerrors: execution.safeQerrors || (() => {}),
  
  // Legacy exports
  logError,
  logInfo: legacyLogInfo,
  logWarn: legacyLogWarn
};