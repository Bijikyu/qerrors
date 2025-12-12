/**
 * Error classification and standardized handling utilities for qerrors
 * 
 * This module provides standardized error handling patterns extending the core qerrors
 * functionality with structured error classification, severity mapping, and Express-specific
 * response utilities. It implements error handling best practices including:
 * 
 * 1. Standardized error response format for API consistency
 * 2. Error classification for appropriate handling strategies
 * 3. Context-aware logging for debugging and monitoring
 * 4. Request ID tracking for error correlation
 * 5. Severity-based error routing and alerting
 * 
 * Design rationale:
 * - Extends existing qerrors functionality rather than replacing it
 * - Provides consistent error classification across applications
 * - Enables appropriate HTTP status code mapping
 * - Supports severity-based monitoring and alerting
 * - Maintains backward compatibility with existing qerrors usage
 */

'use strict'; //(enable strict mode for error types module)

const crypto = require('crypto'); //node crypto for request ID generation
const { randomUUID } = require('crypto'); //import UUID generator for request tracking

/**
 * Error type classification for appropriate handling strategies
 * 
 * Design rationale: Different error types require different handling approaches.
 * This classification enables appropriate response codes, user messages,
 * logging levels, and recovery strategies.
 */
const ErrorTypes = {
    VALIDATION: 'validation',           // User input errors (400)
    AUTHENTICATION: 'authentication',   // Auth failures (401)
    AUTHORIZATION: 'authorization',     // Permission errors (403)
    NOT_FOUND: 'not_found',            // Resource not found (404)
    RATE_LIMIT: 'rate_limit',          // Rate limiting (429)
    NETWORK: 'network',                // External service errors (502/503)
    DATABASE: 'database',              // Database errors (500)
    SYSTEM: 'system',                  // Internal system errors (500)
    CONFIGURATION: 'configuration'      // Config/setup errors (500)
};

/**
 * Error severity levels for logging and alerting
 * 
 * Design rationale: Different error severities require different response strategies.
 * This classification enables appropriate logging, alerting, and escalation.
 */
const ErrorSeverity = {
    LOW: 'low',           // Expected errors, user mistakes
    MEDIUM: 'medium',     // Operational issues, recoverable
    HIGH: 'high',         // Service degradation, requires attention
    CRITICAL: 'critical'  // Service disruption, immediate response needed
};

/**
 * Maps error types to appropriate HTTP status codes
 * 
 * Design rationale: Consistent HTTP status code mapping ensures proper client
 * behavior and follows REST API conventions.
 */
const ERROR_STATUS_MAP = {
    [ErrorTypes.VALIDATION]: 400,
    [ErrorTypes.AUTHENTICATION]: 401,
    [ErrorTypes.AUTHORIZATION]: 403,
    [ErrorTypes.NOT_FOUND]: 404,
    [ErrorTypes.RATE_LIMIT]: 429,
    [ErrorTypes.NETWORK]: 502,
    [ErrorTypes.DATABASE]: 500,
    [ErrorTypes.SYSTEM]: 500,
    [ErrorTypes.CONFIGURATION]: 500
};

/**
 * Maps error types to severity levels for monitoring
 * 
 * Design rationale: Automatic severity classification enables appropriate
 * alerting and escalation without manual intervention.
 */
const ERROR_SEVERITY_MAP = {
    [ErrorTypes.VALIDATION]: ErrorSeverity.LOW,
    [ErrorTypes.AUTHENTICATION]: ErrorSeverity.LOW,
    [ErrorTypes.AUTHORIZATION]: ErrorSeverity.MEDIUM,
    [ErrorTypes.NOT_FOUND]: ErrorSeverity.LOW,
    [ErrorTypes.RATE_LIMIT]: ErrorSeverity.MEDIUM,
    [ErrorTypes.NETWORK]: ErrorSeverity.MEDIUM,
    [ErrorTypes.DATABASE]: ErrorSeverity.HIGH,
    [ErrorTypes.SYSTEM]: ErrorSeverity.HIGH,
    [ErrorTypes.CONFIGURATION]: ErrorSeverity.CRITICAL
};

/**
 * ServiceError Class
 * 
 * Purpose: Enhanced error class with type classification, context, and cause chaining.
 * Provides structured error information for consistent handling across applications.
 * 
 * @example
 * throw new ServiceError('Invalid user input', ErrorTypes.VALIDATION, { field: 'email' });
 */
class ServiceError extends Error {
    /**
     * @param {string} message - Error message
     * @param {string} type - Error type from ErrorTypes
     * @param {Object} [context] - Additional context for debugging
     * @param {Error} [cause] - Original error that caused this error
     */
    constructor(message, type, context = {}, cause = null) {
        super(message);
        this.name = 'ServiceError'; //(identify as ServiceError)
        this.type = type; //(error classification)
        this.context = context; //(debugging context)
        this.cause = cause; //(error chain for root cause)
        this.statusCode = ERROR_STATUS_MAP[type] || 500; //(HTTP status)
        this.severity = ERROR_SEVERITY_MAP[type] || ErrorSeverity.MEDIUM; //(severity level)
        this.timestamp = new Date().toISOString(); //(when error occurred)
        
        if (Error.captureStackTrace) { //(capture stack trace excluding constructor)
            Error.captureStackTrace(this, ServiceError);
        }
    }
    
    /**
     * Convert to JSON for logging/serialization
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            context: this.context,
            statusCode: this.statusCode,
            severity: this.severity,
            timestamp: this.timestamp,
            cause: this.cause ? { message: this.cause.message, stack: this.cause.stack } : null
        };
    }
}

/**
 * Error Utilities
 * 
 * Purpose: Common error handling utilities for creating, wrapping, and handling errors consistently.
 * Provides factory methods for specific error types and utilities for error transformation.
 */
const errorUtils = {
    /**
     * Creates a validation error with field context
     * @param {string} field - Field that failed validation
     * @param {*} [value] - The invalid value
     * @returns {ServiceError}
     */
    validation: (field, value) => {
        const message = value === undefined || value === null || value === ''
            ? `${field} is required`
            : `Invalid ${field}: ${typeof value} ${value}`;
        return new ServiceError(message, ErrorTypes.VALIDATION, { field, value });
    },

    /**
     * Creates an authentication error
     * @param {string} serviceName - Service that failed authentication
     * @returns {ServiceError}
     */
    authentication: (serviceName) => {
        return new ServiceError(
            `${serviceName} authentication failed`,
            ErrorTypes.AUTHENTICATION,
            { serviceName }
        );
    },

    /**
     * Creates an authorization error
     * @param {string} action - Action that was not permitted
     * @returns {ServiceError}
     */
    authorization: (action) => {
        return new ServiceError(
            `Insufficient permissions to ${action}`,
            ErrorTypes.AUTHORIZATION,
            { action }
        );
    },

    /**
     * Creates an external API error with original error chaining
     * @param {string} serviceName - External service name
     * @param {Error} originalError - The original error
     * @returns {ServiceError}
     */
    externalApi: (serviceName, originalError) => {
        return new ServiceError(
            `${serviceName} API error: ${originalError.message}`,
            ErrorTypes.NETWORK,
            { serviceName },
            originalError
        );
    },

    /**
     * Creates an internal service error
     * @param {string} message - Error message
     * @param {Object} [context] - Additional context
     * @returns {ServiceError}
     */
    internal: (message, context = {}) => {
        return new ServiceError(message, ErrorTypes.SYSTEM, context);
    },

    /**
     * Wraps an unknown error in a ServiceError
     * @param {unknown} error - The error to wrap
     * @param {string} defaultMessage - Default message if error is not an Error
     * @returns {ServiceError}
     */
    wrap: (error, defaultMessage) => {
        if (error instanceof ServiceError) {
            return error; //(already a ServiceError)
        }
        
        if (error instanceof Error) {
            return new ServiceError(error.message, ErrorTypes.SYSTEM, undefined, error);
        }
        
        return new ServiceError(defaultMessage, ErrorTypes.SYSTEM, { originalError: error });
    },

    /**
     * Handles async errors consistently, wrapping in ServiceError
     * @param {() => Promise<T>} operation - Async operation
     * @param {string} errorMessage - Message for wrapped errors
     * @returns {Promise<T>}
     */
    asyncHandler: async (operation, errorMessage) => {
        try {
            return await operation();
        } catch (error) {
            throw errorUtils.wrap(error, errorMessage);
        }
    }
};

/**
 * Safe Execution Utilities
 * 
 * Purpose: Result-type pattern for error-safe operations.
 * Returns success/failure objects instead of throwing exceptions.
 */
const safeUtils = {
    /**
     * Safely execute an async operation and return Result
     * @param {() => Promise<T>} operation - Async operation to execute
     * @returns {Promise<{success: true, data: T} | {success: false, error: ServiceError}>}
     * 
     * @example
     * const result = await safeUtils.execute(() => api.getUser(id));
     * if (result.success) {
     *   console.log(result.data);
     * } else {
     *   console.error(result.error.message);
     * }
     */
    execute: async (operation) => {
        try {
            const data = await operation();
            return { success: true, data };
        } catch (error) {
            const serviceError = error instanceof ServiceError 
                ? error 
                : errorUtils.wrap(error, 'Operation failed');
            return { success: false, error: serviceError };
        }
    },

    /**
     * Safely validate input and return Result
     * @param {unknown} value - Value to validate
     * @param {(v: unknown) => T} validator - Validator function
     * @param {string} field - Field name for error messages
     * @returns {{success: true, data: T} | {success: false, error: ServiceError}}
     */
    validate: (value, validator, field) => {
        try {
            const data = validator(value);
            return { success: true, data };
        } catch (error) {
            const serviceError = errorUtils.wrap(error, `Validation failed for ${field}`);
            return { success: false, error: serviceError };
        }
    }
};

/**
 * Extracts or generates request ID for error correlation
 * 
 * Design rationale: Request tracking enables correlation of errors across
 * distributed systems and helps with debugging user-specific issues.
 * 
 * @param {Object} req - Express request object (optional)
 * @returns {string} Request ID for correlation
 */
const getRequestId = req => {
    if (req && req.headers) {
        return req.headers['x-request-id'] || 
               req.headers['x-correlation-id'] || 
               req.headers['request-id'] ||
               randomUUID();
    }
    return randomUUID();
};

/**
 * Creates a standardized error object with consistent format
 * 
 * Design rationale: Standardized error format ensures consistent API responses
 * and enables proper error handling on the client side. Includes all
 * necessary information for debugging and user feedback.
 * 
 * @param {string} code - Error code for programmatic handling
 * @param {string} message - Human-readable error message
 * @param {string} type - Error type from ErrorTypes enum
 * @param {Object} context - Additional context for debugging
 * @returns {Object} Standardized error object
 */
const createStandardError = (code, message, type, context = {}) => ({
    code,
    message,
    type,
    timestamp: new Date().toISOString(),
    requestId: context.requestId || getRequestId(context.req),
    context: {
        ...context,
        req: undefined,
        res: undefined
    }
});

/**
 * Sends standardized JSON error response
 * 
 * Design rationale: Centralized response logic ensures consistent API
 * behavior and reduces code duplication across controllers.
 * 
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {Object} errorObject - Standardized error object
 */
const sendErrorResponse = (res, statusCode, errorObject) => {
    if (res && !res.headersSent) {
        res.status(statusCode).json({ error: errorObject });
    }
};

/**
 * Creates a typed error with classification and context
 * 
 * Design rationale: Factory function for creating errors with proper
 * classification, enabling consistent handling across the application.
 * 
 * @param {string} message - Error message
 * @param {string} type - Error type from ErrorTypes
 * @param {string} code - Error code for identification
 * @param {Object} context - Additional context
 * @returns {Error} Enhanced error object with type information
 */
const createTypedError = (message, type, code = 'GENERIC_ERROR', context = {}) => {
    const error = new Error(message);
    error.type = type;
    error.code = code;
    error.context = context;
    error.statusCode = ERROR_STATUS_MAP[type] || 500;
    error.severity = ERROR_SEVERITY_MAP[type] || ErrorSeverity.MEDIUM;
    return error;
};

/**
 * Factory for creating specific error types with predefined configurations
 * 
 * Design rationale: Provides convenient error creation functions for common
 * error scenarios, ensuring consistent error codes and messages across the
 * application while reducing boilerplate code.
 */
const ErrorFactory = {
    /**
     * Creates validation error for user input issues
     * 
     * @param {string} message - Validation error message
     * @param {string} field - Optional field name that failed validation
     * @param {Object} context - Additional context for debugging
     * @returns {Object} Standardized validation error object
     */
    validation(message, field = null, context = {}) { //create validation error with field context
        return createStandardError(
            'VALIDATION_ERROR', //consistent validation error code
            message, //user-provided validation message
            ErrorTypes.VALIDATION, //validation error type
            { ...context, field } //include field context for debugging
        );
    },

    /**
     * Creates authentication error for login/auth issues
     * 
     * @param {string} message - Auth error message
     * @param {Object} context - Additional context for debugging
     * @returns {Object} Standardized authentication error object
     */
    authentication(message = 'Authentication required', context = {}) { //create auth error with default message
        return createStandardError(
            'AUTHENTICATION_ERROR', //consistent auth error code
            message, //auth failure message
            ErrorTypes.AUTHENTICATION, //authentication error type
            context //debugging context
        );
    },

    /**
     * Creates authorization error for permission issues
     * 
     * @param {string} message - Authorization error message
     * @param {Object} context - Additional context for debugging
     * @returns {Object} Standardized authorization error object
     */
    authorization(message = 'Insufficient permissions', context = {}) { //create authz error with default message
        return createStandardError(
            'AUTHORIZATION_ERROR', //consistent authz error code
            message, //permission failure message
            ErrorTypes.AUTHORIZATION, //authorization error type
            context //debugging context
        );
    },

    /**
     * Creates not found error for missing resources
     * 
     * @param {string} resource - Name of the missing resource
     * @param {Object} context - Additional context for debugging
     * @returns {Object} Standardized not found error object
     */
    notFound(resource, context = {}) { //create not found error with resource context
        return createStandardError(
            'NOT_FOUND', //consistent not found error code
            `${resource} not found`, //resource-specific not found message
            ErrorTypes.NOT_FOUND, //not found error type
            context //debugging context
        );
    },

    /**
     * Creates rate limit error for quota violations
     * 
     * @param {string} message - Rate limit error message
     * @param {Object} context - Additional context for debugging
     * @returns {Object} Standardized rate limit error object
     */
    rateLimit(message = 'Rate limit exceeded', context = {}) { //create rate limit error with default message
        return createStandardError(
            'RATE_LIMIT_EXCEEDED', //consistent rate limit error code
            message, //rate limit violation message
            ErrorTypes.RATE_LIMIT, //rate limit error type
            context //debugging context
        );
    },

    /**
     * Creates network error for external service issues
     * 
     * @param {string} message - Network error message
     * @param {string} service - Optional name of the external service
     * @param {Object} context - Additional context for debugging
     * @returns {Object} Standardized network error object
     */
    network(message, service = null, context = {}) { //create network error with service context
        return createStandardError(
            'NETWORK_ERROR', //consistent network error code
            message, //network failure message
            ErrorTypes.NETWORK, //network error type
            { ...context, service } //include service context for debugging
        );
    },

    /**
     * Creates database error for data persistence issues
     * 
     * @param {string} message - Database error message
     * @param {string} operation - Optional database operation that failed
     * @param {Object} context - Additional context for debugging
     * @returns {Object} Standardized database error object
     */
    database(message, operation = null, context = {}) { //create database error with operation context
        return createStandardError(
            'DATABASE_ERROR', //consistent database error code
            message, //database failure message
            ErrorTypes.DATABASE, //database error type
            { ...context, operation } //include operation context for debugging
        );
    },

    /**
     * Creates system error for internal issues
     * 
     * @param {string} message - System error message
     * @param {string} component - Optional system component that failed
     * @param {Object} context - Additional context for debugging
     * @returns {Object} Standardized system error object
     */
    system(message, component = null, context = {}) { //create system error with component context
        return createStandardError(
            'SYSTEM_ERROR', //consistent system error code
            message, //system failure message
            ErrorTypes.SYSTEM, //system error type
            { ...context, component } //include component context for debugging
        );
    },

    /**
     * Converts unknown error to standardized Error object
     * 
     * Design rationale: Provides consistent error handling for unknown types
     * (strings, objects, undefined) by normalizing them into proper Error instances
     * with appropriate status codes for proper HTTP response handling.
     * 
     * @param {unknown} error - Any error value (Error, string, object, etc.)
     * @param {Object} [meta] - Optional metadata to attach
     * @returns {Error} Normalized Error object with status code
     */
    from(error, meta = {}) { //convert unknown error to standardized Error
        if (error instanceof Error) {
            if (meta && Object.keys(meta).length > 0) {
                error.meta = meta; //(attach metadata if provided)
            }
            return error;
        }
        
        const err = new Error(String(error)); //(convert to string)
        err.status = 500; //(default to internal server error)
        err.meta = meta; //(attach metadata)
        return err;
    }
};

/**
 * Express middleware for global error handling with improved error safety
 * 
 * Design rationale: Catches any unhandled errors in the Express middleware chain
 * and ensures they are properly logged and responded to with consistent format.
 * This provides a safety net for the entire application while avoiding circular dependencies.
 * Includes meta-error handling to prevent complete system failure.
 * 
 * @param {Error} error - Error object from Express middleware chain
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorMiddleware = (error, req, res, next) => {
    try {
        const context = {
            req,
            url: req.url,
            method: req.method,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        };
        const errorType = error.type || ErrorTypes.SYSTEM;
        const statusCode = ERROR_STATUS_MAP[errorType];
        const errorResponse = createStandardError(
            error.code || 'INTERNAL_ERROR',
            error.message || 'An internal error occurred',
            errorType,
            context
        );
        if (!res.headersSent) {
            sendErrorResponse(res, statusCode, errorResponse);
        }
    } catch (metaError) {
        console.error('Meta-error in errorMiddleware:', metaError.message);
        if (!res.headersSent) {
            try {
                res.status(500).json({ 
                    error: { 
                        code: 'SYSTEM_ERROR',
                        message: 'An internal error occurred',
                        timestamp: new Date().toISOString()
                    }
                });
            } catch (finalError) {
                console.error('Final error in errorMiddleware:', finalError.message);
                !res.headersSent && res.status(500).end();
            }
        }
    }
};

/**
 * Simplified error handler for basic error responses
 * 
 * Design rationale: Provides a lightweight alternative to the full handleControllerError
 * for cases where simple error responses are needed without the full classification system.
 * This matches the pattern shown in legacy code while maintaining qerrors integration.
 * 
 * @param {Object} res - Express response object
 * @param {Error} error - The error object that occurred
 * @param {string} message - Human-readable error message for the client
 * @param {Object} req - Optional Express request object for additional context
 */
const handleSimpleError = (res, error, message, req) => {
    try {
        const qerrors = require('./qerrors');
        if (req) {
            qerrors(error, message, req);
        } else {
            qerrors(error, message);
        }
        if (!res.headersSent) {
            const errorResponse = createStandardError(
                'INTERNAL_ERROR',
                message,
                ErrorTypes.SYSTEM,
                {}
            );
            sendErrorResponse(res, 500, errorResponse);
        }
    } catch (metaError) {
        console.error('Meta-error in handleSimpleError:', metaError.message);
        if (!res.headersSent) {
            try {
                res.status(500).json({ error: message });
            } catch (finalError) {
                console.error('Final error in handleSimpleError:', finalError.message);
                res.status(500).end();
            }
        }
    }
};

module.exports = { ErrorTypes, ErrorSeverity, ERROR_STATUS_MAP, ERROR_SEVERITY_MAP, getRequestId, createStandardError, sendErrorResponse, createTypedError, ErrorFactory, errorMiddleware, handleSimpleError, ServiceError, errorUtils, safeUtils };