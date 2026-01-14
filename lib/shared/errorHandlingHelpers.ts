/**
 * Consolidated Error Handling Helpers
 * Provides standardized error handling patterns for async operations
 */

import { errorUtils } from '../errorTypes.js';

export interface ErrorHandlingConfig {
  errorMessage?: string;
  wrapErrors?: boolean;
  errorTransformer?: (error: any) => any;
  logErrors?: boolean;
}

export interface RetryConfig {
  retryCount: number;
  retryDelayMs: number;
  exponentialBackoff?: boolean;
  maxBackoffMultiplier?: number;
}

export const errorHandlingHelpers = {
  wrapAsyncOperation: async <T>(
    operation: () => Promise<T>,
    config: ErrorHandlingConfig = {}
  ): Promise<T> => {
    const { errorMessage = 'Operation failed', wrapErrors = true, errorTransformer } = config;
    
    try {
      return await operation();
    } catch (error) {
      if (errorTransformer) {
        throw errorTransformer(error);
      }
      
      if (wrapErrors) {
        throw error instanceof Error ? error : errorUtils.wrap(error, errorMessage);
      }
      
      throw error;
    }
  },

  wrapWithRetry: async <T>(
    operation: () => Promise<T>,
    retryConfig: RetryConfig,
    errorConfig: ErrorHandlingConfig = {}
  ): Promise<T> => {
    const { retryCount, retryDelayMs, exponentialBackoff = false, maxBackoffMultiplier = 4 } = retryConfig;
    let lastError: any;
    
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        return await errorHandlingHelpers.wrapAsyncOperation(operation, errorConfig);
      } catch (error) {
        lastError = error;
        
        if (attempt === retryCount) {
          throw lastError;
        }
        
        let delay = retryDelayMs;
        if (exponentialBackoff) {
          const multiplier = Math.min(maxBackoffMultiplier, Math.pow(2, attempt));
          delay = retryDelayMs * multiplier;
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  },

  createErrorHandler: (config: ErrorHandlingConfig = {}) => {
    return <T>(operation: () => Promise<T>, overrideConfig?: ErrorHandlingConfig): Promise<T> => {
      const finalConfig = { ...config, ...overrideConfig };
      return errorHandlingHelpers.wrapAsyncOperation(operation, finalConfig);
    };
  },

  createRetryHandler: (retryConfig: RetryConfig, errorConfig: ErrorHandlingConfig = {}) => {
    return <T>(operation: () => Promise<T>, overrideRetryConfig?: Partial<RetryConfig>): Promise<T> => {
      const finalRetryConfig = { ...retryConfig, ...overrideRetryConfig };
      return errorHandlingHelpers.wrapWithRetry(operation, finalRetryConfig, errorConfig);
    };
  },

  handleWithFallback: async <T>(
    operation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    config: ErrorHandlingConfig = {}
  ): Promise<T> => {
    try {
      return await errorHandlingHelpers.wrapAsyncOperation(operation, config);
    } catch (error) {
      if (config.logErrors) {
        console.warn(`Primary operation failed, using fallback: ${error instanceof Error ? error.message : String(error)}`);
      }
      return await errorHandlingHelpers.wrapAsyncOperation(fallbackOperation, config);
    }
  },

  withTimeout: async <T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage: string = 'Operation timed out'
  ): Promise<T> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });
    return Promise.race([operation(), timeoutPromise]);
  },

  debounce: <T>(operation: () => Promise<T>, delayMs: number) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (): Promise<T> => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      return new Promise<T>((resolve, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            resolve(await operation());
          } catch (error) {
            reject(error);
          }
        }, delayMs);
      });
    };
  },
};

export const errorHandlingPresets = {
  get apiOperation(): ErrorHandlingConfig {
    return { errorMessage: 'API operation failed', wrapErrors: true, logErrors: true };
  },
  get databaseOperation(): ErrorHandlingConfig {
    return { errorMessage: 'Database operation failed', wrapErrors: true, logErrors: true };
  },
  get externalService(): ErrorHandlingConfig {
    return { errorMessage: 'External service call failed', wrapErrors: true, logErrors: true };
  },
  get validation(): ErrorHandlingConfig {
    return { errorMessage: 'Validation failed', wrapErrors: false, logErrors: false };
  },
};

export const retryPresets = {
  get networkOperation(): RetryConfig {
    return { retryCount: 3, retryDelayMs: 1000, exponentialBackoff: true, maxBackoffMultiplier: 4 };
  },
  get databaseOperation(): RetryConfig {
    return { retryCount: 5, retryDelayMs: 500, exponentialBackoff: true, maxBackoffMultiplier: 8 };
  },
  get externalApi(): RetryConfig {
    return { retryCount: 2, retryDelayMs: 2000, exponentialBackoff: false };
  },
  get fileOperation(): RetryConfig {
    return { retryCount: 1, retryDelayMs: 100, exponentialBackoff: false };
  },
};

export const wrapAsyncOperation = errorHandlingHelpers.wrapAsyncOperation;
export const wrapWithRetry = errorHandlingHelpers.wrapWithRetry;
export const createErrorHandler = errorHandlingHelpers.createErrorHandler;
export const createRetryHandler = errorHandlingHelpers.createRetryHandler;
export const handleWithFallback = errorHandlingHelpers.handleWithFallback;
export const withTimeout = errorHandlingHelpers.withTimeout;
export const debounce = errorHandlingHelpers.debounce;
