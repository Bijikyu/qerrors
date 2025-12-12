'use strict';

// Re-export shared utilities for backward compatibility
const { 
  createEnhancedLogEntry,
  stringifyContext,
  safeErrorMessage,
  verboseLog,
  createPerformanceTimer,
  safeLogError,
  safeLogInfo,
  safeLogWarn,
  safeLogDebug
} = require('./shared/logging');

const {
  safeRun,
  deepClone,
  createTimer,
  attempt,
  executeWithQerrors,
  formatErrorMessage,
  createSafeAsyncWrapper,
  createSafeLogger,
  createSafeOperation,
  safeQerrors
} = require('./shared/safeWrappers');

// Legacy exports for backward compatibility
const logError = safeLogError;
const logInfo = safeLogInfo;
const logWarn = safeLogWarn;

module.exports = {
  // Logging utilities
  createEnhancedLogEntry,
  stringifyContext,
  safeErrorMessage,
  verboseLog,
  createPerformanceTimer,
  safeLogError,
  safeLogInfo,
  safeLogWarn,
  safeLogDebug,
  
  // Safe execution utilities
  safeRun,
  deepClone,
  createTimer,
  attempt,
  executeWithQerrors,
  formatErrorMessage,
  createSafeAsyncWrapper,
  createSafeLogger,
  createSafeOperation,
  safeQerrors,
  
  // Legacy exports
  logError,
  logInfo,
  logWarn
};