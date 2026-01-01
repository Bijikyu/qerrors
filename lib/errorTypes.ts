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
  CONFIGURATION: 'configuration'
};

export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

export const createTypedError = (message: string, type: string, code: string) => {
  const error = new Error(message) as any;
  error.type = type, error.code = code;
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
  configuration: (message: string) => createTypedError(message, ErrorTypes.CONFIGURATION, 'CONFIG_ERROR')
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

  constructor(message: string, type: string, context: Record<string, any> = {}) {
    super(message);
    this.name = 'ServiceError';
    this.type = type;
    this.context = context;
    this.statusCode = 500;
    this.severity = 'medium';
    this.timestamp = new Date().toISOString();
  }
}

export const errorUtils = {
  validation: (_field: string) => new ServiceError('Validation failed', 'validation'),
  authentication: (service: string) => new ServiceError(`Authentication failed for ${service}`, 'authentication'),
  authorization: (action: string) => new ServiceError(`Authorization failed for ${action}`, 'authorization'),
  externalApi: (service: string, _error: Error) => new ServiceError(`External API ${service} failed`, 'network'),
  internal: (message: string) => new ServiceError(message, 'system'),
  wrap: (_error: unknown, message: string) => new ServiceError(message, 'system')
};

export const safeUtils = {
  execute: async <T>(operation: () => Promise<T>) => {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      try {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        await qerrors(errorObj, 'errorTypes.safeUtils.execute', {
          operation: 'safe_execution',
          timestamp: new Date().toISOString()
        });
      } catch (qerror) {
        console.error('qerrors logging failed in safeUtils execute', qerror);
      }
      
      return { success: false, error };
    }
  },
  validate: <T>(value: unknown, validator: (v: unknown) => T, _field: string) => {
    try {
      const result = validator(value);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

export const safeErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) return error.message;
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
        timestamp: new Date().toISOString()
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
        timestamp: new Date().toISOString()
      });
    } catch (qerror) {
      console.error('qerrors logging failed in executeWithQerrors', qerror);
    }
    
    throw error;
  }
};

export const formatErrorMessage = (error: unknown, context: string): string => {
  if (error instanceof Error) {
    return `${context}: ${error.message}`;
  }
  return `${context}: ${String(error)}`;
};