/**
 * Safe async wrappers for qerrors module
 */

// @ts-ignore - lodash doesn't have ESM exports
import _ from 'lodash';

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