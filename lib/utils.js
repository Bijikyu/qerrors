'use strict';

/**
 * Unified Utilities Module - Centralized Re-exports
 * 
 * Purpose: Provides a single entry point for all utility functions while maintaining
 * backward compatibility with existing imports. This module acts as a facade that
 * re-exports utilities from their specialized modules in the shared directory.
 * 
 * Design Rationale:
 * - Centralizes utility imports to reduce dependency complexity
 * - Maintains backward compatibility for existing code
 * - Provides clear categorization of utility types
 * - Enables easier refactoring and module reorganization
 * 
 * Usage Patterns:
 * - Import all utilities: const utils = require('./utils')
 * - Import specific utilities: const { safeLogError, createTimer } = require('./utils')
 * - Legacy imports continue to work without modification
 */

// Re-export shared utilities for backward compatibility
const { 
  createEnhancedLogEntry,
  stringifyContext,
  safeErrorMessage,
  verboseLog
} = require('./shared/logging');

/**
 * Re-export execution and timing utilities from shared/execution module
 * 
 * These utilities provide safe execution patterns, performance timing, and error handling
 * mechanisms that are used throughout the application. Each utility is designed with
 * defensive programming principles to ensure the application remains stable even
 * when individual operations fail.
 */
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

/**
 * Legacy logging functions - deprecated but maintained for backward compatibility
 * 
 * Rationale: These functions provide a simplified interface to the safe logging
 * utilities. While deprecated, they are maintained to ensure existing code continues
 * to work without modification. New code should use the safeLog* functions directly.
 * 
 * @deprecated Use safeLogError, safeLogInfo, safeLogWarn from shared/execution instead
 */
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