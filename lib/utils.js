'use strict';

// Re-export shared utilities for backward compatibility
const { 
  createEnhancedLogEntry,
  stringifyContext,
  safeErrorMessage,
  verboseLog
} = require('./shared/logging');

const {
  createUnifiedTimer,
  createTimer,
  createPerformanceTimer,
  safeRun,
  deepClone,
  attempt,
  executeWithErrorHandling,
  executeWithQerrors,
  formatErrorMessage,
  createSafeAsyncWrapper,
  createSafeLogger,
  createSafeOperation,
  safeQerrors,
  safeLogError,
  safeLogInfo,
  safeLogWarn,
  safeLogDebug
} = require('./shared/execution');

// Legacy logging functions - now deprecated but maintained for compatibility
const logError = (error, context, metadata) => {
  const { safeLogError } = require('./shared/execution');
  return safeLogError(error, context, metadata);
};

const logInfo = (message, metadata) => {
  const { safeLogInfo } = require('./shared/execution');
  return safeLogInfo(message, metadata);
};

const logWarn = (message, metadata) => {
  const { safeLogWarn } = require('./shared/execution');
  return safeLogWarn(message, metadata);
};

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