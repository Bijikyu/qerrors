import qerrors from '../lib/qerrors.js';

export const ErrorTypes = {
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  NOT_FOUND: 'not_found',
  RATE_LIMIT: 'rate_limit',
  NETWORK: 'network',
  DATABASE: 'database',
  SYSTEM: 'system',
  CONFIGURATION: 'configuration',
  INTERNAL: 'internal',
  EXTERNAL_API: 'external_api',
};

export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const createTypedError = (message: string, type: string, code: string) => {
  const error = new Error(message) as any;
  error.type = type;
  error.code = code;
  return error;
};

export const createStandardError = createTypedError;

export const ErrorFactory = {
  validation: (message: string) => createTypedError(message, ErrorTypes.VALIDATION, 'VALIDATION_ERROR'),
  authentication: (message: string) => createTypedError(message, ErrorTypes.AUTHENTICATION, 'AUTH_ERROR'),
  authorization: (message: string) => createTypedError(message, ErrorTypes.AUTHORIZATION, 'AUTH_ERROR'),
  notFound: (message: string) => createTypedError(message, ErrorTypes.NOT_FOUND, 'NOT_FOUND'),
  rateLimit: (message: string) => createTypedError(message, ErrorTypes.RATE_LIMIT, 'RATE_LIMIT'),
  network: (message: string) => createTypedError(message, ErrorTypes.NETWORK, 'NETWORK_ERROR'),
  database: (message: string) => createTypedError(message, ErrorTypes.DATABASE, 'DATABASE_ERROR'),
  system: (message: string) => createTypedError(message, ErrorTypes.SYSTEM, 'SYSTEM_ERROR'),
  configuration: (message: string) => createTypedError(message, ErrorTypes.CONFIGURATION, 'CONFIG_ERROR'),
};

export const errorMiddleware = (err: Error, _req: any, res: any, _next: Function) => {
  console.error('Error middleware:', err);
  res.status(500).json({ error: 'Internal server error' });
};

export const handleSimpleError = (error: Error) => {
  console.error('Simple error:', error);
};

export class ServiceError extends Error {
  type: string;
  context: Record<string, any>;
  statusCode: number;
  severity: string;
  timestamp: string;
  originalError?: Error | undefined;

  constructor(message: string, type: string, context: Record<string, any> = {}, originalError?: Error) {
    super(message);
    this.name = 'ServiceError';
    this.type = type;
    this.context = context;
    this.statusCode = 500;
    this.severity = 'medium';
    this.timestamp = new Date().toISOString();
    this.originalError = originalError;
  }
}

export const errorUtils = {
  validation: (field: string, value?: any): ServiceError => {
    const normalizedField = typeof field === 'string' ? field.toLowerCase() : '';
    const isPromptField = normalizedField.includes('prompt');
    const isEmptySentinel = value === 'empty string';
    const isMissing = value === undefined || value === null || value === '' || isEmptySentinel;
    const isBlankString = typeof value === 'string' && value.trim().length === 0;

    if (isPromptField && (isMissing || isBlankString)) {
      return new ServiceError('Prompt is required', ErrorTypes.VALIDATION, { field, value });
    }

    const message = isMissing || isBlankString
      ? `${field} is required`
      : `Invalid ${field}: ${typeof value} ${value}`;
    return new ServiceError(message, ErrorTypes.VALIDATION, { field, value });
  },

  authentication: (service: string): ServiceError =>
    new ServiceError(`${service} authentication failed`, ErrorTypes.AUTHENTICATION, { service }),

  authorization: (action: string): ServiceError =>
    new ServiceError(`Insufficient permissions to ${action}`, ErrorTypes.AUTHORIZATION, { action }),

  externalApi: (service: string, originalError: Error): ServiceError =>
    new ServiceError(
      `${service} API error: ${originalError.message}`,
      ErrorTypes.EXTERNAL_API,
      { service },
      originalError
    ),

  internal: (message: string, context?: any): ServiceError =>
    new ServiceError(message, ErrorTypes.INTERNAL, context),

  wrap: (error: unknown, defaultMessage: string): ServiceError => {
    if (error instanceof ServiceError) {
      return error;
    }
    if (error instanceof Error) {
      return new ServiceError(error.message, ErrorTypes.INTERNAL, undefined, error);
    }
    return new ServiceError(defaultMessage, ErrorTypes.INTERNAL, { originalError: error });
  },

  asyncHandler: async <T>(operation: () => Promise<T>, errorMessage: string): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      throw errorUtils.wrap(error, errorMessage);
    }
  },
};

export type Result<T, E = ServiceError> = {
  success: true;
  data: T;
} | {
  success: false;
  error: E;
};

export const safeUtils = {
  execute: async <T>(operation: () => Promise<T>): Promise<Result<T>> => {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      try {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        await qerrors(errorObj, 'errorTypes.safeUtils.execute', {
          operation: 'safe_execution',
          timestamp: new Date().toISOString(),
        });
      } catch (qerror) {
        console.error('qerrors logging failed in safeUtils execute', qerror);
      }
      const serviceError = error instanceof ServiceError
        ? error
        : errorUtils.wrap(error, 'Operation failed');
      return { success: false, error: serviceError };
    }
  },

  validate: <T>(value: unknown, validator: (v: unknown) => T, field: string): Result<T> => {
    try {
      const result = validator(value);
      return { success: true, data: result };
    } catch (error) {
      const serviceError = errorUtils.wrap(error, `Validation failed for ${field}`);
      return { success: false, error: serviceError };
    }
  },
};

export const safeErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'message' in (error as any)) {
    const msg = String((error as any).message || '').trim();
    if (msg) return msg;
  }
  return fallback;
};

export const safeLogError = (error: unknown, context: string, metadata?: Record<string, unknown>) => {
  console.error(`[${context}] Error:`, safeErrorMessage(error, 'Unknown error'), metadata);
};

export const safeLogInfo = (message: string, metadata?: Record<string, unknown>) => {
  console.info(`[INFO] ${message}`, metadata);
};

export const attempt = async <T>(fn: () => T | Promise<T>) => {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (error) {
    try {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      await qerrors(errorObj, 'errorTypes.attempt', {
        operation: 'attempt_execution',
        timestamp: new Date().toISOString(),
      });
    } catch (qerror) {
      console.error('qerrors logging failed in attempt', qerror);
    }
    return { ok: false, error };
  }
};

export const executeWithQerrors = async <T>(options: {
  opName: string;
  operation: () => T | Promise<T>;
  context?: Record<string, any>;
  failureMessage: string;
}) => {
  try {
    return await options.operation();
  } catch (error) {
    console.error(options.failureMessage, error);
    try {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      await qerrors(errorObj, `errorTypes.executeWithQerrors.${options.opName}`, {
        operation: options.opName,
        context: options.context,
        failureMessage: options.failureMessage,
        timestamp: new Date().toISOString(),
      });
    } catch (qerror) {
      console.error('qerrors logging failed in executeWithQerrors', qerror);
    }
    throw error;
  }
};

export const formatErrorMessage = (error: unknown, context: string): string =>
  error instanceof Error ? `${context}: ${error.message}` : `${context}: ${String(error)}`;

export function ensureError<T extends { error?: string }>(result: T, message: string): T {
  if (!result.error) {
    result.error = message;
  }
  return result;
}

/**
 * Express request interface for type safety
 */
interface ExpressRequest {
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  method?: string;
  url?: string;
  [key: string]: unknown;
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
 * Standardized error response object
 */
interface ErrorResponseObject {
  statusCode: number;
  response: {
    error: string;
    details?: unknown;
    timestamp: string;
  };
}

/**
 * Validates required request parameters
 * @param req - Express request object
 * @param requiredFields - Array of required field names
 * @param location - Where to check fields ('params', 'body', 'query')
 * @returns Validation error response or null if valid
 */
export const validateRequiredFields = (
  req: ExpressRequest,
  requiredFields: string[],
  location: 'params' | 'body' | 'query' = 'body'
): ErrorResponseObject | null => {
  const source = req[location] as Record<string, unknown> | undefined;
  if (!source) {
    return {
      statusCode: 400,
      response: {
        error: `Request ${location} is missing`,
        details: { required: requiredFields },
        timestamp: new Date().toISOString()
      }
    };
  }
  
  const missingFields = requiredFields.filter(field => 
    source[field] === undefined || source[field] === null || source[field] === ''
  );

  if (missingFields.length > 0) {
    return {
      statusCode: 400,
      response: {
        error: 'Missing required fields',
        details: { required: requiredFields, missing: missingFields },
        timestamp: new Date().toISOString()
      }
    };
  }

  return null;
};

/**
 * Handles resource not found scenarios consistently
 * @param resourceType - Type of resource (e.g., 'email template', 'user')
 * @param identifier - Optional identifier for the resource
 * @returns Not found error response
 */
export const handleResourceNotFound = (
  resourceType: string,
  identifier?: string | number
): ErrorResponseObject => {
  const capitalizedType = resourceType.charAt(0).toUpperCase() + resourceType.slice(1);
  const message = identifier 
    ? `${capitalizedType} with id '${identifier}' not found`
    : `${capitalizedType} not found`;

  return {
    statusCode: 404,
    response: {
      error: message,
      timestamp: new Date().toISOString()
    }
  };
};

/**
 * Handles validation errors consistently
 * @param message - Validation error message
 * @param details - Additional validation details
 * @returns Validation error response
 */
export const handleValidationError = (
  message: string,
  details?: unknown
): ErrorResponseObject => {
  return {
    statusCode: 400,
    response: {
      error: message,
      details,
      timestamp: new Date().toISOString()
    }
  };
};

/**
 * Standard error handler for controllers
 * @param error - Error object
 * @param operation - Operation being performed
 * @param options - Error handling options
 * @returns Error response object
 */
export const handleControllerError = async (
  error: unknown,
  operation: string,
  options: { userMessage?: string; statusCode?: number } = {}
): Promise<ErrorResponseObject> => {
  const {
    userMessage = `Failed to ${operation}`,
    statusCode = 500
  } = options;

  // Log the error
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`[${operation}] Controller error:`, errorMessage);

  // Try qerrors logging
  try {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    await qerrors(errorObj, `controller.${operation}`, {
      operation,
      timestamp: new Date().toISOString()
    });
  } catch (qerror) {
    console.error('qerrors logging failed in handleControllerError', qerror);
  }

  return {
    statusCode,
    response: {
      error: userMessage,
      details: errorMessage,
      timestamp: new Date().toISOString()
    }
  };
};

/**
 * Creates a standardized error-wrapped controller function
 * @param controllerFn - Controller function to wrap
 * @param operation - Operation description for error messages
 * @returns Wrapped controller function with error handling
 */
export const createErrorHandledController = (
  controllerFn: (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => Promise<void> | void,
  operation: string
): ((req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => Promise<void>) => {
  return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNext): Promise<void> => {
    try {
      await controllerFn(req, res, next);
    } catch (error) {
      // Log and handle the error
      const errorResponse = await handleControllerError(error, operation);
      
      if (!res.headersSent) {
        res.status(errorResponse.statusCode).json(errorResponse.response);
      }
    }
  };
};
