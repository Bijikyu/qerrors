'use strict';

// Import specialized modules
const { createUnifiedTimer, createTimer, createPerformanceTimer } = require('./timers');
const { 
  safeRun, 
  deepClone, 
  attempt, 
  executeWithErrorHandling, 
  executeWithQerrors, 
  formatErrorMessage 
} = require('./executionCore');
const { 
  createSafeAsyncWrapper, 
  createSafeLogger, 
  createSafeOperation 
} = require('./wrappers');
const { 
  safeLogError, 
  safeLogInfo, 
  safeLogWarn, 
  safeLogDebug, 
  safeQerrors 
} = require('./safeLogging');

module.exports = {
  // Timer functions
  createUnifiedTimer,
  createTimer,
  createPerformanceTimer,
  
  // Execution utilities
  safeRun,
  deepClone,
  attempt,
  executeWithErrorHandling,
  executeWithQerrors,
  formatErrorMessage,
  
  // Wrapper creators
  createSafeAsyncWrapper,
  createSafeLogger,
  createSafeOperation,
  
  // Safe logging functions
  safeLogError,
  safeLogInfo,
  safeLogWarn,
  safeLogDebug,
  
  // Error handling
  safeQerrors
};