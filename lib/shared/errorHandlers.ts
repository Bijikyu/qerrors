/**
 * Shared Error Handling Patterns
 * 
 * Provides standardized wrappers for common error handling scenarios.
 * Uses loadQerrorsAsync and logErrorMaybe from executionCore for qerrors integration.
 */

import { loadQerrorsAsync, logErrorMaybe, formatErrorMessage } from './executionCore.js';

/**
 * Standardized error handler for initialization failures
 */
export async function handleInitializationError(
  error: unknown,
  operation: string,
  errorType: string,
  context: string,
  fallback: string
): Promise<void> {
  const qerrors = await loadQerrorsAsync();
  await logErrorMaybe(qerrors, operation, `Initialization error: ${context}`, {
    operation,
    errorType,
    context,
    fallback,
    error: formatErrorMessage(error)
  });
}

/**
 * Standardized error handler for middleware failures
 */
export async function handleMiddlewareError(
  error: unknown,
  operation: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  const qerrors = await loadQerrorsAsync();
  await logErrorMaybe(qerrors, operation, `Middleware error: ${operation}`, {
    operation,
    errorType: 'middleware-failure',
    ...context,
    error: formatErrorMessage(error)
  });
}

/**
 * Standardized error handler for service failures
 */
export async function handleServiceError(
  error: unknown,
  serviceName: string,
  operation: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  const qerrors = await loadQerrorsAsync();
  await logErrorMaybe(qerrors, `${serviceName}-${operation}`, `Service error: ${serviceName} ${operation}`, {
    operation,
    errorType: 'service-failure',
    serviceName,
    ...context,
    error: formatErrorMessage(error)
  });
}

/**
 * Handler for database operation failures
 */
export async function handleDatabaseError(
  error: unknown,
  operation: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  await handleServiceError(error, 'database', operation, context);
}

/**
 * Handler for external service failures
 */
export async function handleExternalServiceError(
  error: unknown,
  serviceName: string,
  operation: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  await handleServiceError(error, serviceName, operation, context);
}

/**
 * Safe async function wrapper with standardized error handling
 * Returns null on error
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorContext: {
    operation: string;
    errorType: string;
    context: string;
    fallback?: string;
  }
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    await handleInitializationError(
      error,
      errorContext.operation,
      errorContext.errorType,
      errorContext.context,
      errorContext.fallback || 'Operation failed'
    );
    return null;
  }
}

/**
 * Safe function wrapper for async operations with fallback value
 */
export async function withErrorHandlingFallback<T>(
  operation: () => Promise<T>,
  fallbackValue: T,
  errorContext: {
    operation: string;
    errorType: string;
    context: string;
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    await handleInitializationError(
      error,
      errorContext.operation,
      errorContext.errorType,
      errorContext.context,
      'Using fallback value'
    );
    return fallbackValue;
  }
}

/**
 * Creates a standardized middleware error handler
 */
export function createMiddlewareErrorHandler(middlewareName: string) {
  return async function handleError(
    error: unknown,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    await handleMiddlewareError(error, `${middlewareName}-error`, {
      middleware: middlewareName,
      ...context
    });
  };
}

/**
 * Wrapper for Express middleware functions with standardized error handling
 */
export function withMiddlewareErrorHandling<
  Req extends { path?: string; method?: string; get?: (header: string) => string | undefined },
  Res,
  Next extends (error?: unknown) => void
>(
  middlewareName: string,
  middlewareFn: (req: Req, res: Res, next: Next) => Promise<void> | void
): (req: Req, res: Res, next: Next) => Promise<void> {
  const errorHandler = createMiddlewareErrorHandler(middlewareName);
  
  return async function wrappedMiddleware(req: Req, res: Res, next: Next): Promise<void> {
    try {
      await middlewareFn(req, res, next);
    } catch (error) {
      await errorHandler(error, {
        path: req.path,
        method: req.method,
        userAgent: req.get?.('User-Agent') || 'unknown'
      });
      next(error);
    }
  };
}

/**
 * Console logging with consistent format when qerrors is unavailable
 */
export function consoleErrorFallback(
  operation: string,
  message: string,
  context?: Record<string, unknown>
): void {
  console.error(`[FALLBACK] ${operation}:`, message, context || {});
}

export function consoleWarnFallback(
  operation: string,
  message: string,
  context?: Record<string, unknown>
): void {
  console.warn(`[FALLBACK] ${operation}:`, message, context || {});
}

export function consoleInfoFallback(
  operation: string,
  message: string,
  context?: Record<string, unknown>
): void {
  console.info(`[FALLBACK] ${operation}:`, message, context || {});
}

/**
 * Parse JSON body from request, handling string bodies
 */
export function parseJsonBody<T = unknown>(body: unknown): T {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body as T;
    }
  }
  return body as T;
}

/**
 * Check if content type is JSON
 */
export function isJsonContentType(contentType: string | undefined): boolean {
  return typeof contentType === 'string' && contentType.includes('application/json');
}

/**
 * Create async error handler with qerrors fallback
 */
export function createAsyncErrorHandler<T extends unknown[], R>(
  errorHandler: (...args: T) => Promise<R>
): (...args: T) => Promise<R | { error: string }> {
  return async (...args: T): Promise<R | { error: string }> => {
    try {
      return await errorHandler(...args);
    } catch (error) {
      const qerrors = await loadQerrorsAsync();
      await logErrorMaybe(qerrors, 'async-error-handler-fallback', 'Error handler failed', { 
        error: formatErrorMessage(error) 
      });
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };
}

/**
 * Create sync error handler with qerrors fallback
 */
export function createSyncErrorHandler<T extends unknown[], R>(
  errorHandler: (...args: T) => R
): (...args: T) => Promise<R | { error: string }> {
  return async (...args: T): Promise<R | { error: string }> => {
    try {
      return errorHandler(...args);
    } catch (error) {
      const qerrors = await loadQerrorsAsync();
      await logErrorMaybe(qerrors, 'sync-error-handler-fallback', 'Error handler failed', { 
        error: formatErrorMessage(error) 
      });
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };
}
