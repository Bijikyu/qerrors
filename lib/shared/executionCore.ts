/**
 * Core execution utilities for safe operation handling
 */

import { createUnifiedTimer as createTimerInternal } from './timers.js';
// @ts-ignore - lodash doesn't have ESM exports
import _ from 'lodash/index.js';

// Re-export for backward compatibility
export { createUnifiedTimer, createPerformanceTimer } from './timers.js';

/**
 * Safe execution wrapper with fallback
 * @param name - Operation name for logging
 * @param fn - Function to execute
 * @param fallback - Fallback value on error
 * @param info - Additional info for logging
 * @returns Function result or fallback
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
    console.error(`${name} failed`, info);
    return fallback;
  }
};

/**
 * Deep clone utility using lodash
 * @param obj - Object to clone
 * @returns Deep cloned object
 */
export const deepClone = <T>(obj: T): T => {
  return _.cloneDeep(obj);
};

/**
 * Attempt operation and return result object
 * @param fn - Function to attempt
 * @returns Result object with success status
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
 * @param context - Additional context
 * @returns Formatted error message
 */
export const formatErrorMessage = (error: unknown, context: string): string => {
  if (error instanceof Error) {
    return `${context}: ${error.message}`;
  }
  return `${context}: ${String(error)}`;
};