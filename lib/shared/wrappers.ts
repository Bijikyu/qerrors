/**
 * Safe async wrappers for qerrors module
 */

// @ts-ignore - lodash doesn't have ESM exports
import _ from 'lodash';
import qerrors from '../qerrors.js';

/**
 * Wraps service operations with consistent error handling and logging.
 * Provides standardized try/catch pattern with qerrors integration.
 * Unlike createSafeOperation, this re-throws the error after logging.
 * 
 * @param operationName - Name of the operation for error context (e.g., 'uploads.uploadImageSvc')
 * @param operation - The async function to execute
 * @param errorContext - Additional context data to include in error logs
 * @returns Promise with the operation result or throws the error
 * 
 * @example
 * export async function uploadImageSvc(objectStorageService, file): Promise<string> {
 *   return await createServiceOperation(
 *     'uploads.uploadImageSvc',
 *     () => objectStorageService.uploadFileBuffer(file.buffer, file.originalname, file.mimetype),
 *     { filename: file.originalname, mimetype: file.mimetype }
 *   );
 * }
 */
export async function createServiceOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  errorContext: Record<string, any> = {}
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    qerrors(error as Error, operationName, errorContext);
    throw error;
  }
}

/**
 * Wraps database operations with consistent error handling and logging.
 * Provides standardized try/catch pattern specifically for database operations.
 * Unlike createSafeOperation, this re-throws the error after logging.
 * 
 * @param operationName - Name of the database operation for error context
 * @param operation - The async database function to execute
 * @param errorContext - Additional context data to include in error logs
 * @returns Promise with the operation result or throws the error
 * 
 * @example
 * export async function getJob(jobId: string): Promise<Job | undefined> {
 *   return await createDatabaseOperation(
 *     'jobs.getJobSvc',
 *     () => storage.getJob(jobId),
 *     { jobId }
 *   );
 * }
 */
export async function createDatabaseOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  errorContext: Record<string, any> = {}
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    qerrors(error as Error, operationName, errorContext);
    throw error;
  }
}

export const createSafeAsyncWrapper = (options: {
  modulePath?: string;
  functionName?: string;
  fallbackFn?: (...args: any[]) => any;
  silent?: boolean;
  errorMessage?: string;
}): any => {
  // Simple placeholder implementation
  return async (...args: any[]): Promise<any> => {
    try {
      return await options.fallbackFn?.(...args);
    } catch (error) {
      if (!options.silent) {
        console.error(`Error in ${options.functionName || 'operation'}:`, error);
      }
      return undefined;
    }
  };
};

export const createSafeLogger = (functionName: string, fallbackLevel: 'error' | 'warn' | 'log' | 'info' = 'error'): any => {
  return (message: string, details?: Record<string, any>): void => {
    const level = fallbackLevel.toUpperCase();
    switch (level) {
      case 'ERROR':
        console.error(`[${functionName}] ${message}`, details);
        break;
      case 'WARN':
        console.warn(`[${functionName}] ${message}`, details);
        break;
      case 'INFO':
        console.info(`[${functionName}] ${message}`, details);
        break;
      case 'LOG':
        console.log(`[${functionName}] ${message}`, details);
        break;
      default:
        console.log(`[${functionName}] ${message}`, details);
        break;
    }
  };
};

export const createSafeOperation = (
  asyncFn: (...args: any[]) => Promise<any>,
  fallbackValue?: any,
  onError?: (error: unknown, ...args: any[]) => void
): any => {
  return async (...args: any[]): Promise<any | undefined> => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      onError?.(error, ...args);
      return fallbackValue;
    }
  };
};

export const safeJsonParse = (text: string, fallback: any = null): any => {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};

import { safeJsonStringify as _safeJsonStringify } from './jsonHelpers.js';

export const safeJsonStringify = _safeJsonStringify;