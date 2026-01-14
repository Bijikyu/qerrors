/**
 * Core Execution Utilities Module - Safe Operation Handling with Performance Tracking
 * 
 * Purpose: Provides fundamental execution utilities for safe operation handling,
 * performance monitoring, and error resilience throughout the qerrors system.
 * This module serves as the foundation for reliable execution patterns and
 * provides essential utilities for timing, cloning, and error-safe operations.
 * 
 * Design Principles:
 * - Error Safety: All operations include comprehensive error handling
 * - Performance Awareness: Built-in timing and performance tracking capabilities
 * - Type Safety: TypeScript interfaces for reliable operation patterns
 * - Functional Style: Pure functions and immutable operations where possible
 * - Backward Compatibility: Maintains existing API while adding enhanced functionality
 * 
 * Key Features:
 * - Safe execution wrappers with fallback mechanisms
 * - Performance timing utilities with memory tracking
 * - Deep cloning utilities for object immutability
 * - Async operation result handling with structured responses
 * - Error context preservation for debugging
 */

import { createUnifiedTimer as createTimerInternal } from './timers.js';
// @ts-ignore - lodash doesn't have ESM exports
import _ from 'lodash/index.js';
import qerrors from '../../lib/qerrors.js';

// Re-export for backward compatibility
export { createUnifiedTimer, createPerformanceTimer } from './timers.js';

/**
 * Safe execution wrapper with comprehensive error handling and fallback
 * 
 * Purpose: Executes a function with complete error safety, providing a fallback
 * value when the operation fails. This utility is essential for operations that
 * must never break the application flow, even when encountering unexpected errors.
 * 
 * Error Handling Strategy:
 * - Catches all exceptions and prevents propagation
 * - Logs detailed error information with operation context
 * - Returns a safe fallback value to maintain application stability
 * - Preserves error context for debugging and monitoring
 * 
 * Use Cases:
 * - Configuration parsing that must not break application startup
 * - Optional feature initialization with graceful degradation
 * - Data processing operations where partial success is acceptable
 * - External service integration with fallback behavior
 * 
 * @template T - Return type of the function and fallback
 * @param {string} name - Descriptive operation name for error logging and debugging
 * @param {() => T} fn - Function to execute safely - any errors will be caught
 * @param {T} fallback - Safe fallback value returned when the function fails
 * @param {Record<string, any>} [info] - Additional context information for error logging
 * @returns {T} Function result if successful, or fallback value if error occurs
 */
export const safeRun = <T>(
  name: string, 
  fn: () => T, 
  fallback: T, 
  info?: Record<string, any>
): T => {
  try {
    return fn();
  } catch (err) {
    // Log detailed error information with operation context
    // This helps with debugging while maintaining application stability
    console.error(`${name} failed`, info);
    return fallback;
  }
};

/**
 * Deep clone utility using lodash for complete object immutability
 * 
 * Purpose: Creates a deep clone of any object using lodash's proven
 * cloneDeep implementation. This utility is essential for creating
 * immutable copies of objects, preventing unintended mutations and
 * ensuring data integrity throughout the application.
 * 
 * Performance Considerations:
 * - Uses lodash's optimized cloneDeep algorithm for maximum performance
 * - Handles all JavaScript types including dates, regex, and circular references
 * - Memory efficient with proper garbage collection patterns
 * - Suitable for both small and large object cloning operations
 * 
 * Use Cases:
 * - Creating immutable state copies for functional programming patterns
 * - Preventing mutation of shared configuration objects
 * - Deep copying error contexts for logging without side effects
 * - Cloning complex data structures for testing and debugging
 * 
 * @template T - Type of object being cloned
 * @param {T} obj - Object to create deep clone of
 * @returns {T} Complete deep clone with no shared references to original
 */
export const deepClone = <T>(obj: T): T => {
  return _.cloneDeep(obj);
};

/**
 * Async operation attempt with structured result handling
 * 
 * Purpose: Executes an async function and returns a structured result object
 * that clearly indicates success or failure. This pattern enables clean
 * error handling without try/catch blocks and provides a consistent interface
 * for async operations that may fail.
 * 
 * Result Pattern Benefits:
 * - Explicit success/failure indication through boolean ok field
 * - Type-safe value access only when operation succeeds
 * - Structured error information for debugging and logging
 * - Enables functional error handling patterns without exceptions
 * - Consistent interface across all async operations
 * 
 * Error Handling Philosophy:
 * - Catches all exceptions and prevents unhandled promise rejections
 * - Preserves original error information for debugging
 * - Returns structured result that can be safely destructured
 * - Enables pattern matching for different error scenarios
 * 
 * @template T - Return type of the async function
 * @param {() => T | Promise<T>} fn - Async function to attempt execution
 * @returns {Promise<{ok: true, value: T} | {ok: false, error: any}>} Structured result with success status
 */
export const attempt = async <T>(fn: () => T | Promise<T>): Promise<{
  ok: true;
  value: T;
} | {
  ok: false;
  error: unknown;
}> => {
  try {
    const value = await Promise.resolve().then(fn);
    return { ok: true, value };
  } catch (error) {
    // Log error with qerrors for sophisticated analysis
    try {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      await qerrors(errorObj, 'executionCore.attempt', {
        functionType: typeof fn,
        timestamp: new Date().toISOString()
      });
    } catch (qerror) {
      // Fallback logging if qerrors fails
      console.error('qerrors logging failed in attempt', qerror);
    }
    return { ok: false, error };
  }
};

/**
 * Execute operation with integrated error handling and logging
 */
export const executeWithErrorHandling = async <T>(options: {
  opName: string;
  operation: () => T | Promise<T>;
  context?: Record<string, any>;
  failureMessage?: string;
  errorCode?: string;
  errorType?: string;
  logMessage?: string;
  rethrow?: boolean;
  fallbackValue?: T;
}): Promise<T> => {
  const { 
    opName, 
    operation, 
    context = {}, 
    failureMessage, 
    errorCode, 
    errorType, 
    logMessage, 
    rethrow = true, 
    fallbackValue
  } = options;
  
  const timer = createTimerInternal(opName, true);
  
  try {
    const result = await Promise.resolve().then(operation);
    await timer.logPerformance(true, context);
    return result;
  } catch (error) {
    const errorContext = {
      ...context,
      operation: opName,
      errorCode,
      errorType,
      timestamp: new Date().toISOString()
    };
    
    // Use qerrors for sophisticated error reporting
    try {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      await qerrors(errorObj, `executionCore.${opName}`, errorContext);
    } catch (qerror) {
      // Fallback logging if qerrors fails
      console.error(`qerrors logging failed for ${opName}`, qerror);
    }
    
    if (logMessage || failureMessage) {
      const message = logMessage || failureMessage || `${opName} failed`;
      try {
        const logger = await import('../logger.js');
        await (logger as any).logError(message, { ...errorContext, error });
      } catch (logErr) {
        console.error(message, errorContext, error);
      }
    }
    
    if (rethrow) {
      throw error;
    }
    
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }
    
    throw error;
  }
};

/**
 * Execute operation with qerrors integration
 */
export const executeWithQerrors = async <T>(options: {
  opName: string;
  operation: () => T | Promise<T>;
  context?: Record<string, any>;
  failureMessage: string;
  errorCode?: string;
  errorType?: string;
  logMessage?: string;
  rethrow?: boolean;
  fallbackValue?: T;
}): Promise<T> => {
  return executeWithErrorHandling(options);
};

/**
 * Format error message safely
 * @param error - Error to format
 * @param context - Optional additional context
 * @returns Formatted error message
 */
export const formatErrorMessage = (error: unknown, context?: string): string => {
  let message: string;
  
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    try {
      message = JSON.stringify(error);
    } catch {
      message = 'Unknown error';
    }
  }
  
  return context ? `${context}: ${message}` : message;
};

/**
 * Rethrow an error with a prefixed message
 * Useful for adding context when propagating errors up the call stack
 * 
 * @param prefix - Context prefix to add to the error message
 * @param error - The original error to rethrow
 * @throws Error with formatted message: "{prefix}: {original message}"
 */
export function rethrowWithMessage(prefix: string, error: unknown): never {
  const message = formatErrorMessage(error);
  throw new Error(`${prefix}: ${message}`);
}

/**
 * QerrorsModule type for lazy loading - represents the loaded qerrors module
 */
export interface QerrorsModule {
  default?: (error: Error, location: string, context?: Record<string, unknown>) => Promise<unknown>;
  logError?: (message: string, context?: Record<string, unknown>) => Promise<void>;
  [key: string]: unknown;
}

let qerrorsModulePromise: Promise<QerrorsModule | null> | null = null;

/**
 * Lazy load qerrors module with promise caching
 * 
 * Purpose: Provides async lazy loading of qerrors module with single-promise
 * caching pattern to prevent multiple concurrent loads and provide consistent
 * access to the module throughout the application.
 * 
 * @returns Promise resolving to qerrors module or null if unavailable
 */
export const loadQerrorsAsync = async (): Promise<QerrorsModule | null> => {
  if (!qerrorsModulePromise) {
    qerrorsModulePromise = import('../qerrors.js')
      .then(mod => mod as QerrorsModule)
      .catch(() => null);
  }
  return qerrorsModulePromise;
};

/**
 * Log error with optional qerrors module and fallback to console
 * 
 * Purpose: Provides a flexible error logging function that works whether
 * qerrors is loaded or not, with graceful fallback to console logging.
 * 
 * @param q - QerrorsModule or null
 * @param operation - Operation name for context
 * @param message - Error message to log
 * @param context - Additional context information
 */
export const logErrorMaybe = async (
  q: QerrorsModule | null,
  operation: string,
  message: string,
  context: Record<string, unknown>
): Promise<void> => {
  if (q?.default) {
    try {
      const error = new Error(message);
      await q.default(error, operation, context);
    } catch {
      console.error(`[${operation}] ${message}`, context);
    }
  } else if (q?.logError) {
    await q.logError(message, context);
  } else {
    console.error(`[${operation}] ${context.errorMessage || message}`, context);
  }
};

/**
 * Creates a service-specific executor with standardized naming and error handling
 * Reduces boilerplate in service functions by binding a service name prefix
 * 
 * @param serviceName - The name of the service (used as prefix for operation names)
 * @returns An executor function bound to the service name
 * 
 * @example
 * const userServiceExecutor = createServiceExecutor('UserService');
 * const user = await userServiceExecutor({
 *   operationName: 'getById',
 *   operation: () => db.users.findById(id),
 *   failureMessage: 'Failed to fetch user'
 * });
 */
export const createServiceExecutor = (serviceName: string) => {
  return async <T>({
    operationName,
    operation,
    context = {},
    failureMessage,
    errorCode,
    logMessage
  }: {
    operationName: string;
    operation: () => Promise<T>;
    context?: Record<string, unknown>;
    failureMessage: string;
    errorCode?: string;
    logMessage?: string;
  }): Promise<T> => {
    return executeWithQerrors<T>({
      opName: `${serviceName}.${operationName}`,
      operation,
      context,
      failureMessage,
      errorCode: errorCode || `${serviceName.toUpperCase()}_${operationName.toUpperCase()}`,
      logMessage: logMessage || `${serviceName} error in ${operationName}`
    });
  };
};

/**
 * Creates a standardized service call pattern for common operations
 * One-shot utility for simple service calls without creating an executor
 * 
 * @param serviceName - The name of the service
 * @param operationName - The name of the operation
 * @param operation - The async operation to execute
 * @param options - Optional configuration
 * @returns Promise resolving to the operation result
 */
export const createServiceCall = <T>(
  serviceName: string,
  operationName: string,
  operation: () => Promise<T>,
  options: {
    context?: Record<string, unknown>;
    failureMessage?: string;
    errorCode?: string;
  } = {}
): Promise<T> => {
  return executeWithQerrors<T>({
    opName: `${serviceName}.${operationName}`,
    operation,
    context: options.context || {},
    failureMessage: options.failureMessage || `${serviceName} ${operationName} failed`,
    errorCode: options.errorCode || `${serviceName.toUpperCase()}_${operationName.toUpperCase()}`,
    logMessage: `${serviceName} error in ${operationName}`
  });
};

/**
 * Batch operation result type
 */
export interface BatchOperationResult<T> {
  name: string;
  success: boolean;
  result: T | null;
  error: unknown | null;
}

/**
 * Creates a batch service executor for multiple related operations
 * Executes all operations in parallel using Promise.allSettled
 * 
 * @param serviceName - The name of the service
 * @returns A batch executor function
 * 
 * @example
 * const batchExecutor = createBatchServiceExecutor('DataService');
 * const results = await batchExecutor([
 *   { name: 'fetchUsers', operation: () => fetchUsers() },
 *   { name: 'fetchPosts', operation: () => fetchPosts() }
 * ]);
 */
export const createBatchServiceExecutor = (serviceName: string) => {
  return async <T>(
    operations: Array<{
      name: string;
      operation: () => Promise<T>;
      failureMessage?: string;
    }>
  ): Promise<BatchOperationResult<T>[]> => {
    const results = await Promise.allSettled(
      operations.map(({ name, operation, failureMessage }) =>
        createServiceCall(serviceName, name, operation, { 
          failureMessage: failureMessage || `${serviceName} ${name} failed` 
        })
      )
    );

    return results.map((result, index) => ({
      name: operations[index].name,
      success: result.status === 'fulfilled',
      result: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null
    }));
  };
};