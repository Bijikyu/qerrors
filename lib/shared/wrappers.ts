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
  return (message: string, details?: Record<string, any>): Promise<void> => {
    const level = fallbackLevel.toUpperCase();
    console[level](`[${functionName}] ${message}`, details);
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

export const safeJsonStringify = (value: any, fallback: string = '{}'): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
};