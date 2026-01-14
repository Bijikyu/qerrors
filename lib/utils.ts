/**
 * Utility Functions Module - TypeScript Implementation
 * 
 * Purpose: Provides a centralized collection of utility functions for logging,
 * error handling, performance timing, and safe execution patterns. This module
 * serves as the TypeScript equivalent of the JavaScript utils module with
 * enhanced type safety and modern syntax.
 * 
 * Design Rationale:
 * - Type safety: Comprehensive TypeScript types for all utilities
 * - Modular imports: Imports from specialized shared modules
 * - Backward compatibility: Maintains legacy function interfaces
 * - Performance optimization: Efficient execution patterns
 * - Error resilience: Safe execution with comprehensive error handling
 * 
 * Categories of Utilities:
 * - Safe execution: Functions for protected operation execution
 * - Performance timing: Utilities for operation timing and monitoring
 * - Error handling: Tools for consistent error processing
 * - Legacy support: Deprecated functions maintained for compatibility
 */

// Import from specialized shared modules for modular architecture
import {
  createUnifiedTimer,
  safeRun,
  deepClone,
  attempt,
  executeWithQerrors,
  executeWithErrorHandling,
  formatErrorMessage,
  rethrowWithMessage,
  loadQerrorsAsync,
  logErrorMaybe,
  createServiceExecutor,
  createServiceCall,
  createBatchServiceExecutor,
  type QerrorsModule,
  type BatchOperationResult,
  type ExecuteWithQerrorsCoreOptions,
  type ExecuteWithQerrorsHooks,
  type AttemptResult
} from './shared/executionCore.js';
import qerrors from '../lib/qerrors.js';

/**
 * Legacy logging functions - deprecated but maintained for backward compatibility
 * 
 * Purpose: These functions provide simplified logging interfaces that were
 * used in earlier versions of the application. While deprecated, they are
 * maintained to ensure existing code continues to work without modification.
 * 
 * @deprecated Use the safe logging utilities from shared modules instead
 */

/**
 * Legacy error logging function
 * 
 * Purpose: Provides basic error logging with context and metadata support.
 * This function directly uses console.error for immediate output.
 * 
 * @param error - Error object or message to log
 * @param context - Optional context string for error categorization
 * @param metadata - Additional metadata object for error details
 */
const logError = async (error: unknown, context?: string, metadata?: Record<string, unknown>) => {
  try {
    console.error('Error:', error, context, metadata);
    
    // Use qerrors for sophisticated error reporting
    const errorObj = error instanceof Error ? error : new Error(String(error));
    await qerrors(errorObj, 'utils.logError', {
      context,
      metadata,
      timestamp: new Date().toISOString()
    });
  } catch (qerror) {
    // Fallback logging if qerrors fails
    console.error('qerrors logging failed in logError', qerror);
    console.error('Original error:', error, context, metadata);
  }
};

/**
 * Legacy info logging function
 * 
 * Purpose: Provides basic info logging with metadata support.
 * This function directly uses console.info for immediate output.
 * 
 * @param message - Information message to log
 * @param metadata - Additional metadata object for message details
 */
const logInfo = async (message: string, metadata?: Record<string, unknown>) => {
  try {
    console.info('Info:', message, metadata);
  } catch (error) {
    // Use qerrors for sophisticated error reporting
    try {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      await qerrors(errorObj, 'utils.logInfo', {
        message,
        metadata,
        timestamp: new Date().toISOString()
      });
    } catch (qerror) {
      // Fallback logging if qerrors fails
      console.error('qerrors logging failed in logInfo', qerror);
      console.error('Original error:', error);
    }
  }
};

/**
 * Legacy warning logging function
 * 
 * Purpose: Provides basic warning logging with metadata support.
 * This function directly uses console.warn for immediate output.
 * 
 * @param message - Warning message to log
 * @param metadata - Additional metadata object for warning details
 */
const logWarn = async (message: string, metadata?: Record<string, unknown>) => {
  try {
    console.warn('Warning:', message, metadata);
  } catch (error) {
    // Use qerrors for sophisticated error reporting
    try {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      await qerrors(errorObj, 'utils.logWarn', {
        message,
        metadata,
        timestamp: new Date().toISOString()
      });
    } catch (qerror) {
      // Fallback logging if qerrors fails
      console.error('qerrors logging failed in logWarn', qerror);
      console.error('Original error:', error);
    }
  }
};

/**
 * Create timer utility function
 * 
 * Purpose: Provides a simplified interface for creating performance timers
 * with default operation name. This is a convenience wrapper around the
 * more comprehensive createUnifiedTimer function.
 * 
 * @returns Timer instance for performance measurement
 */
const createTimer = () => createUnifiedTimer('operation');

/**
 * Module exports - Organized by functional category
 * 
 * This export structure provides clear categorization of utilities while
 * maintaining all existing import patterns. The categorization helps
 * developers understand the purpose and relationships between different
 * utility functions.
 * 
 * Export Categories:
 * - Safe execution utilities: Functions for protected operation execution
 * - Legacy exports: Deprecated functions maintained for compatibility
 * 
 * Type Safety:
 * - All exports maintain full TypeScript type information
 * - Generic functions preserve type parameters
 * - Function signatures include comprehensive type annotations
 */
export {
  // Safe execution utilities
  safeRun,
  deepClone,
  createTimer,
  attempt,
  executeWithQerrors,
  executeWithErrorHandling,
  formatErrorMessage,
  rethrowWithMessage,
  
  // Async qerrors loading utilities
  loadQerrorsAsync,
  logErrorMaybe,
  
  // Service executor utilities
  createServiceExecutor,
  createServiceCall,
  createBatchServiceExecutor,
  
  // Legacy exports
  logError,
  logInfo,
  logWarn
};

// Type exports
export type { 
  QerrorsModule, 
  BatchOperationResult,
  ExecuteWithQerrorsCoreOptions,
  ExecuteWithQerrorsHooks,
  AttemptResult
};