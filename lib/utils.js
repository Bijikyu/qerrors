'use strict';
/**
 * Unified Utilities Module - Centralized Re-exports
 */
const{createEnhancedLogEntry,stringifyContext,safeErrorMessage,verboseLog}=require('./shared/logging'),{createUnifiedTimer,createTimer,createPerformanceTimer,safeRun,deepClone,attempt,executeWithErrorHandling,executeWithQerrors,formatErrorMessage,createSafeAsyncWrapper,createSafeLogger,createSafeOperation,safeQerrors,safeLogError,safeLogInfo,safeLogWarn,safeLogDebug}=require('./shared/execution');
const logError=(error,context,metadata)=>{const{safeLogError}=require('./shared/execution');return safeLogError(error,context,metadata);},legacyLogInfo=(message,metadata)=>{const{safeLogInfo}=require('./shared/execution');return safeLogInfo(message,metadata);},legacyLogWarn=(message,metadata)=>{const{safeLogWarn}=require('./shared/execution');return safeLogWarn(message,metadata);};
module.exports={createEnhancedLogEntry,stringifyContext,safeErrorMessage,verboseLog,createPerformanceTimer,safeLogError,safeLogInfo,safeLogWarn,safeLogDebug,safeRun,deepClone,createTimer,attempt,executeWithQerrors,formatErrorMessage,createSafeAsyncWrapper,createSafeLogger,createSafeOperation,safeQerrors,logError,logInfo:legacyLogInfo,logWarn:legacyLogWarn};

const logWarn = (message, metadata) => {
  const { safeLogWarn } = require('./shared/execution');
  return safeLogWarn(message, metadata);
};

/**
 * Module exports organized by functional category
 * 
 * This export structure provides clear categorization of utilities while maintaining
 * all existing import patterns. The categorization helps developers understand the
 * purpose and relationships between different utility functions.
 * 
 * Categories:
 * - Logging utilities: Message formatting, context handling, and safe logging
 * - Safe execution utilities: Error handling, performance timing, and operation wrapping
 * - Legacy exports: Deprecated functions maintained for compatibility
 */
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