'use strict';

const localVars = require('../config/localVars');
const { 
  ErrorTypes, 
  ErrorSeverity, 
  ERROR_STATUS_MAP, 
  ERROR_SEVERITY_MAP 
} = localVars;

class ServiceError extends Error {
  constructor(message, type, context = {}, cause = null) {
    super(message);
    this.name = 'ServiceError';
    this.type = type;
    this.context = context;
    this.cause = cause;
    this.statusCode = ERROR_STATUS_MAP[type] || 500;
    this.severity = ERROR_SEVERITY_MAP[type] || ErrorSeverity.MEDIUM;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace && Error.captureStackTrace(this, ServiceError);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      context: this.context,
      statusCode: this.statusCode,
      severity: this.severity,
      timestamp: this.timestamp,
      cause: this.cause ? {
        message: this.cause.message,
        stack: this.cause.stack
      } : null
    };
  }
}

const errorUtils = {
  validation: (field, value) => {
    const message = value === undefined || value === null || value === ''
      ? `${field} is required`
      : `Invalid ${field}: ${typeof value} ${value}`;
    return new ServiceError(message, ErrorTypes.VALIDATION, { field, value });
  },

  authentication: serviceName => new ServiceError(
    `${serviceName} authentication failed`,
    ErrorTypes.AUTHENTICATION,
    { serviceName }
  ),

  authorization: action => new ServiceError(
    `Insufficient permissions to ${action}`,
    ErrorTypes.AUTHORIZATION,
    { action }
  ),

  externalApi: (serviceName, originalError) => new ServiceError(
    `${serviceName} API error: ${originalError.message}`,
    ErrorTypes.NETWORK,
    { serviceName },
    originalError
  ),

  internal: (message, context = {}) => new ServiceError(
    message,
    ErrorTypes.SYSTEM,
    context
  ),

  wrap: (error, defaultMessage) => {
    if (error instanceof ServiceError) return error;
    if (error instanceof Error) {
      return new ServiceError(error.message, ErrorTypes.SYSTEM, undefined, error);
    }
    return new ServiceError(defaultMessage, ErrorTypes.SYSTEM, { originalError: error });
  },

  asyncHandler: async (operation, errorMessage) => {
    try {
      return await operation();
    } catch (error) {
      throw errorUtils.wrap(error, errorMessage);
    }
  }
};

const safeUtils = {
  execute: async operation => {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      return { success: false, error };
    }
  },

  validate: (value, validator, field) => {
    try {
      const isValid = validator(value);
      if (isValid) {
        return { success: true, data: value };
      }
      return { 
        success: false, 
        error: errorUtils.validation(field, value) 
      };
    } catch (error) {
      return { success: false, error };
    }
  }
};

const createTypedError = (message, type, code = null, context = {}) => {
  const error = new ServiceError(message, type, context);
  if (code) error.code = code;
  return error;
};

const createStandardError = (code, message, type, context = {}) => {
  return createTypedError(message, type, code, context);
};

const ErrorFactory = {
  validation: (message, field = null) => createTypedError(
    message,
    ErrorTypes.VALIDATION,
    'VALIDATION_ERROR',
    field ? { field } : {}
  ),

  authentication: (message = 'Authentication failed') => createTypedError(
    message,
    ErrorTypes.AUTHENTICATION,
    'AUTHENTICATION_ERROR'
  ),

  authorization: (message = 'Insufficient permissions') => createTypedError(
    message,
    ErrorTypes.AUTHORIZATION,
    'AUTHORIZATION_ERROR'
  ),

  notFound: (resource = 'Resource') => createTypedError(
    `${resource} not found`,
    ErrorTypes.NOT_FOUND,
    'NOT_FOUND_ERROR',
    { resource }
  ),

  rateLimit: (message = 'Rate limit exceeded') => createTypedError(
    message,
    ErrorTypes.RATE_LIMIT,
    'RATE_LIMIT_ERROR'
  ),

  network: (message, service = null, context = {}) => createTypedError(
    message,
    ErrorTypes.NETWORK,
    'NETWORK_ERROR',
    { service, ...context }
  ),

  database: (message, operation = null) => createTypedError(
    message,
    ErrorTypes.DATABASE,
    'DATABASE_ERROR',
    { operation }
  ),

  system: (message, context = {}) => createTypedError(
    message,
    ErrorTypes.SYSTEM,
    'SYSTEM_ERROR',
    context
  ),

  configuration: (message, field = null) => createTypedError(
    message,
    ErrorTypes.CONFIGURATION,
    'CONFIGURATION_ERROR',
    { field }
  )
};

const handleSimpleError = (error, context = {}) => {
  if (!(error instanceof ServiceError)) {
    error = errorUtils.wrap(error, 'An unexpected error occurred');
  }
  
  return {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message,
      type: error.type,
      severity: error.severity,
      context: { ...error.context, ...context },
      timestamp: error.timestamp
    }
  };
};

// Express error middleware
const errorMiddleware = (err, req, res, next) => {
  const errorResponse = handleSimpleError(err, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json(errorResponse);
};

module.exports = {
  ServiceError,
  errorUtils,
  safeUtils,
  createTypedError,
  createStandardError,
  ErrorTypes,
  ErrorSeverity,
  ErrorFactory,
  handleSimpleError,
  errorMiddleware,
  ERROR_STATUS_MAP,
  ERROR_SEVERITY_MAP
};