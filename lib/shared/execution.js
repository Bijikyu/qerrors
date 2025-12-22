'use strict';

/**
 * Unified Execution Module
 * 
 * Purpose: Centralized export module that provides comprehensive
 * execution utilities including timing, error handling, safe
 * wrappers, and logging functions. This module serves as the
 * main interface for all operation execution needs.
 * 
 * Design Philosophy:
 * - Single source of truth for execution utilities
 * - Comprehensive error handling and safety mechanisms
 * - Performance monitoring built into all operations
 * - Consistent interfaces and patterns
 * - Backward compatibility with existing code
 * 
 * Utility Categories Exported:
 * - Timer functions: High-precision timing with memory tracking
 * - Execution utilities: Safe operation execution with error handling
 * - Wrapper creators: Defensive programming patterns
 * - Safe logging: Error-resistant logging with fallbacks
 */

// Import specialized modules from respective sub-modules
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

/**
 * Module exports for unified execution interface
 * 
 * Purpose: Provides comprehensive access to all execution utilities
 * through a single import point. This module consolidates
 * functionality from multiple specialized sub-modules.
 * 
 * Export Categories:
 * - Timer functions: High-resolution timing with memory tracking
 * - Execution utilities: Safe operation execution and error handling
 * - Wrapper creators: Defensive programming patterns and safety
 * - Safe logging: Error-resistant logging with multiple fallbacks
 * - Error handling: Specialized error processing and reporting
 * 
 * Usage Pattern:
 * - Import from this module for comprehensive execution needs
 * - Provides consistent interfaces across all utilities
 * - Maintains backward compatibility with existing imports
 */
module.exports = {
  // High-precision timer functions with memory tracking
  createUnifiedTimer,
  createTimer,
  createPerformanceTimer,
  
  // Core execution utilities with integrated error handling
  safeRun,
  deepClone,
  attempt,
  executeWithErrorHandling,
  executeWithQerrors,
  formatErrorMessage,
  
  // Safe wrapper creators for defensive programming
  createSafeAsyncWrapper,
  createSafeLogger,
  createSafeOperation,
  
  // Safe logging functions with fallback mechanisms
  safeLogError,
  safeLogInfo,
  safeLogWarn,
  safeLogDebug,
  
  // Specialized error handling utilities
  safeQerrors
};