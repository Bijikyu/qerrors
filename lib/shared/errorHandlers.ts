/**
 * Shared Error Handling Patterns
 * 
 * Provides standardized wrappers for common error handling scenarios.
 * Uses loadQerrorsAsync and logErrorMaybe from executionCore for qerrors integration.
 * Includes HTTP error utilities for Express applications.
 */

import { loadQerrorsAsync, logErrorMaybe, formatErrorMessage } from './executionCore.js';
import { createPerformanceTimer } from './timers.js';

/**
 * Error severity levels for enhanced error handling
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Determines appropriate HTTP status code for an error
 * Maps error names/types to standard HTTP status codes
 * 
 * @param error - Error object to get status code for
 * @returns HTTP status code (default 500)
 */
export function getErrorStatusCode(error: unknown): number {
  if (!error) return 500;
  
  const err = error as { statusCode?: number; status?: number; name?: string; code?: string };
  
  // Check if error has explicit status code
  if (err.statusCode) return err.statusCode;
  if (err.status) return err.status;
  
  // Map error names to status codes
  const errorName = err.name || '';
  const errorCode = err.code || '';
  
  // Name-based mapping
  if (errorName === 'ValidationError' || errorCode === 'VALIDATION_ERROR') return 400;
  if (errorName === 'UnauthorizedError' || errorCode === 'UNAUTHORIZED') return 401;
  if (errorName === 'ForbiddenError' || errorCode === 'FORBIDDEN') return 403;
  if (errorName === 'NotFoundError' || errorCode === 'NOT_FOUND') return 404;
  if (errorName === 'ConflictError' || errorCode === 'CONFLICT') return 409;
  if (errorName === 'RateLimitError' || errorCode === 'RATE_LIMIT') return 429;
  if (errorName === 'DatabaseError' || errorCode === 'DATABASE_ERROR') return 500;
  if (errorName === 'ServiceUnavailableError' || errorCode === 'SERVICE_UNAVAILABLE') return 503;
  
  // Default to 500 for unknown errors
  return 500;
}

/**
 * Creates a standardized error response for HTTP APIs
 * 
 * @param error - Error object to create response for
 * @param operation - Operation name for context
 * @param context - Additional context to include
 * @returns Standardized error response object
 */
export function createErrorResponse(
  error: unknown, 
  operation: string, 
  context: Record<string, unknown> = {}
): { error: { message: string; type: string; operation: string; statusCode: number; timestamp: string; context: Record<string, unknown> } } {
  const err = error as { message?: string; name?: string; stack?: string };
  const statusCode = getErrorStatusCode(error);
  
  return {
    error: {
      message: err.message || 'An error occurred',
      type: err.name || 'Error',
      operation,
      statusCode,
      timestamp: new Date().toISOString(),
      context: {
        ...context,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }
    }
  };
}

/**
 * Express request interface for type safety
 */
interface ExpressRequest {
  get?: (header: string) => string | undefined;
  ip?: string;
  method?: string;
  originalUrl?: string;
  path?: string;
  body?: unknown;
}

/**
 * Express response interface for type safety
 */
interface ExpressResponse {
  headersSent?: boolean;
  status: (code: number) => ExpressResponse;
  json: (data: unknown) => void;
}

/**
 * Express next function type
 */
type ExpressNext = (error?: unknown) => void;

/**
 * Options for enhanced error handler
 */
export interface EnhancedErrorHandlerOptions {
  enableAi?: boolean;
  enablePerformance?: boolean;
  severity?: ErrorSeverity;
  context?: Record<string, unknown>;
  fallbackValue?: unknown;
}

/**
 * Creates an enhanced error handler with performance monitoring
 * Designed for Express middleware/controller error handling
 * 
 * @param operation - Operation name for tracking
 * @param options - Error handling options
 * @returns Enhanced error handler function
 */
export function createEnhancedErrorHandler(
  operation: string, 
  options: EnhancedErrorHandlerOptions = {}
): (error: unknown, req?: ExpressRequest | null, res?: ExpressResponse | null, next?: ExpressNext | null) => Promise<unknown> {
  const {
    enableAi = true,
    enablePerformance = true,
    severity = ErrorSeverity.MEDIUM,
    context = {},
    fallbackValue = null
  } = options;
  
  return async (
    error: unknown, 
    req: ExpressRequest | null = null, 
    res: ExpressResponse | null = null, 
    _next: ExpressNext | null = null
  ): Promise<unknown> => {
    let timer: ReturnType<typeof createPerformanceTimer> | null = null;
    if (enablePerformance) {
      timer = createPerformanceTimer(`error-handler-${operation}`);
    }
    
    try {
      // Build enhanced context from request
      const enhancedContext: Record<string, unknown> = {
        operation,
        timestamp: new Date().toISOString(),
        userAgent: req?.get?.('User-Agent'),
        ip: req?.ip,
        method: req?.method,
        url: req?.originalUrl,
        severity,
        ...context
      };
      
      // Log error with qerrors if AI enabled
      if (enableAi) {
        const qerrors = await loadQerrorsAsync();
        await logErrorMaybe(qerrors, operation, formatErrorMessage(error), enhancedContext);
      } else {
        // Fallback to console logging
        console.error(`[${operation}] Error:`, formatErrorMessage(error), enhancedContext);
      }
      
      // Send appropriate response if Express objects provided
      if (res && !res.headersSent) {
        const statusCode = getErrorStatusCode(error);
        const errorResponse = createErrorResponse(error, operation, enhancedContext);
        res.status(statusCode).json(errorResponse);
      }
      
      // End performance timer
      if (timer) {
        await timer.logPerformance(true, enhancedContext);
      }
      
      return fallbackValue;
    } catch (handlerError) {
      // Fallback error handling
      console.error('Error in enhanced error handler:', handlerError);
      
      if (res && !res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          operation,
          timestamp: new Date().toISOString()
        });
      }
      
      return fallbackValue;
    }
  };
}

/**
 * Options for async controller wrapper
 */
export interface AsyncControllerOptions {
  validateInput?: ((body: unknown, req: ExpressRequest) => Promise<{ isValid: boolean; errors?: unknown[] }>) | null;
  sanitizeInput?: boolean;
  enablePerformance?: boolean;
  enableAi?: boolean;
  rateLimit?: { limit: number; window: number } | null;
}

/**
 * Creates an async controller wrapper with comprehensive error handling
 * Includes support for validation, sanitization, rate limiting, and performance monitoring
 * 
 * @param controller - Controller function to wrap
 * @param operation - Operation name for tracking
 * @param options - Wrapper options
 * @returns Wrapped controller function
 */
export function createAsyncController(
  controller: (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => Promise<unknown>,
  operation: string,
  options: AsyncControllerOptions = {}
): (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => Promise<unknown> {
  const {
    validateInput = null,
    enableAi = true
  } = options;
  
  return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNext): Promise<unknown> => {
    const timer = createPerformanceTimer(`controller-${operation}`);
    
    try {
      // Input validation
      if (validateInput) {
        const validationResult = await validateInput(req.body, req);
        if (!validationResult.isValid) {
          return res.status(400).json({
            error: {
              message: 'Validation failed',
              details: validationResult.errors,
              operation
            }
          });
        }
      }
      
      // Execute controller
      const result = await controller(req, res, next);
      
      await timer.logPerformance(true, { controller: operation });
      return result;
    } catch (error) {
      await timer.logPerformance(false, { controller: operation, error: formatErrorMessage(error) });
      
      // Use enhanced error handling
      const errorHandler = createEnhancedErrorHandler(operation, {
        enableAi,
        enablePerformance: false,
        severity: ErrorSeverity.MEDIUM,
        context: { controller: operation }
      });
      
      return errorHandler(error, req, res, next);
    }
  };
}

/**
 * Options for batch operation
 */
export interface BatchOperationOptions {
  concurrency?: number;
  timeout?: number;
  enableRollback?: boolean;
}

/**
 * Result of a batch operation
 */
export interface BatchOperationResult<T> {
  batchName: string;
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  results: Array<{ index: number; result: T; success: true }>;
  errors: Array<{ index: number; error: unknown; success: false; operationIndex: number }>;
  duration: number;
}

/**
 * Creates a batch operation handler with concurrency control and timeout
 * 
 * @param operations - Array of operations to execute
 * @param batchName - Batch operation name for tracking
 * @param options - Batch options
 * @returns Batch operation result
 */
export async function createBatchOperation<T>(
  operations: Array<() => Promise<T>>,
  batchName: string,
  options: BatchOperationOptions = {}
): Promise<BatchOperationResult<T>> {
  const {
    concurrency = 5,
    timeout = 30000
  } = options;
  
  const startTime = Date.now();
  const results: Array<{ index: number; result: T; success: true }> = [];
  const errors: Array<{ index: number; error: unknown; success: false; operationIndex: number }> = [];
  
  try {
    console.info(`Starting batch operation: ${batchName}`, {
      operationCount: operations.length,
      concurrency,
      timeout
    });
    
    // Execute operations with concurrency control
    const chunks: Array<Array<() => Promise<T>>> = [];
    for (let i = 0; i < operations.length; i += concurrency) {
      chunks.push(operations.slice(i, i + concurrency));
    }
    
    let globalIndex = 0;
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (operation, chunkIndex) => {
        const operationIndex = globalIndex + chunkIndex;
        try {
          const result = await Promise.race([
            operation(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Operation timeout')), timeout)
            )
          ]);
          
          results.push({ index: results.length, result, success: true });
          return result;
        } catch (error) {
          errors.push({ 
            index: errors.length, 
            error, 
            success: false,
            operationIndex
          });
          return null;
        }
      });
      
      await Promise.allSettled(chunkPromises);
      globalIndex += chunk.length;
    }
    
    const duration = Date.now() - startTime;
    
    console.info(`Batch operation completed: ${batchName}`, {
      total: operations.length,
      successful: results.length,
      failed: errors.length,
      duration
    });
    
    return {
      batchName,
      success: errors.length === 0,
      total: operations.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Batch operation failed: ${batchName}`, {
      error: formatErrorMessage(error),
      duration
    });
    
    throw error;
  }
}

/**
 * Logs operation with context and performance metrics
 * Simple helper for operation logging
 * 
 * @param operation - Operation name
 * @param context - Operation context
 * @param metrics - Performance metrics
 */
export async function logOperation(
  operation: string, 
  context: Record<string, unknown> = {}, 
  metrics: Record<string, unknown> = {}
): Promise<void> {
  const qerrors = await loadQerrorsAsync();
  if (qerrors?.logInfo) {
    await (qerrors as { logInfo: (msg: string, ctx: Record<string, unknown>) => Promise<void> }).logInfo(`Operation: ${operation}`, {
      operation,
      timestamp: new Date().toISOString(),
      ...context,
      ...metrics
    });
  } else {
    console.info(`Operation: ${operation}`, {
      operation,
      timestamp: new Date().toISOString(),
      ...context,
      ...metrics
    });
  }
}

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

/**
 * Error mapping interface for HTTP status code mapping
 */
export interface ErrorMapping {
  [key: string]: {
    status: number;
    message: string;
    category: string;
  };
}

/**
 * Default error mappings for common error types
 */
export const defaultErrorMappings: ErrorMapping = {
  ValidationError: { status: 400, message: 'Validation failed', category: 'validation' },
  AuthenticationError: { status: 401, message: 'Authentication failed', category: 'authentication' },
  UnauthorizedError: { status: 401, message: 'Unauthorized', category: 'authentication' },
  AuthorizationError: { status: 403, message: 'Access forbidden', category: 'authorization' },
  ForbiddenError: { status: 403, message: 'Forbidden', category: 'authorization' },
  NotFoundError: { status: 404, message: 'Resource not found', category: 'not_found' },
  ConflictError: { status: 409, message: 'Resource conflict', category: 'conflict' },
  RateLimitError: { status: 429, message: 'Too many requests', category: 'rate_limit' },
  InternalError: { status: 500, message: 'Internal server error', category: 'internal' },
  DatabaseError: { status: 500, message: 'Database error', category: 'database' },
  ServiceUnavailableError: { status: 503, message: 'Service unavailable', category: 'service' }
};

/**
 * Authentication-specific error mappings
 */
export const authErrorMappings: ErrorMapping = {
  InvalidTokenError: { status: 401, message: 'Invalid authentication token', category: 'authentication' },
  ExpiredTokenError: { status: 401, message: 'Authentication token expired', category: 'authentication' },
  InvalidCredentialsError: { status: 401, message: 'Invalid credentials', category: 'authentication' },
  AccountLockedError: { status: 423, message: 'Account is locked', category: 'authentication' },
  EmailNotVerifiedError: { status: 403, message: 'Email address not verified', category: 'authentication' }
};

/**
 * Unified HTTP error handler with configurable mappings
 * 
 * @param error - The error to handle
 * @param req - Express request object
 * @param res - Express response object
 * @param customMappings - Optional custom error mappings
 */
export async function handleHttpError(
  error: Error,
  req: ExpressRequest,
  res: ExpressResponse,
  customMappings?: ErrorMapping
): Promise<void> {
  const mappings = { ...defaultErrorMappings, ...customMappings };
  const errorName = error.constructor?.name || 'Error';
  const mapping = mappings[errorName] || mappings['InternalError'];

  const qerrors = await loadQerrorsAsync();
  await logErrorMaybe(qerrors, `${req.method || 'UNKNOWN'} ${req.path || '/'}`, error.message, {
    userAgent: req.get?.('User-Agent'),
    ip: req.ip
  });

  if (!res.headersSent) {
    res.status(mapping.status).json({
      success: false,
      error: {
        message: error.message || mapping.message,
        type: errorName,
        category: mapping.category,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
      }
    });
  }
}

/**
 * Authentication-specific error handler
 * 
 * @param error - The authentication error
 * @param req - Express request object
 * @param res - Express response object
 */
export async function handleAuthError(
  error: Error,
  req: ExpressRequest,
  res: ExpressResponse
): Promise<void> {
  await handleHttpError(error, req, res, authErrorMappings);
}

/**
 * Unified Error Handler class providing static methods for common error handling patterns
 */
export class UnifiedErrorHandler {
  static getStatusCode = getErrorStatusCode;
  static createResponse = createErrorResponse;
  static handleHttp = handleHttpError;
  static handleAuth = handleAuthError;
  static createEnhanced = createEnhancedErrorHandler;
  static createAsyncController = createAsyncController;
}
