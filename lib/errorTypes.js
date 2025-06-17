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
 * Extracts or generates request ID for error correlation
 * 
 * Design rationale: Request tracking enables correlation of errors across
 * distributed systems and helps with debugging user-specific issues.
 * 
 * @param {Object} req - Express request object (optional)
 * @returns {string} Request ID for correlation
 */
function getRequestId(req) { //extract or generate request identifier for tracking
    if (req && req.headers) { //extract from headers when available
        return req.headers['x-request-id'] || 
               req.headers['x-correlation-id'] || 
               req.headers['request-id'] ||
               randomUUID(); //generate when header missing
    }
    return randomUUID(); //generate when no request object
}

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
function createStandardError(code, message, type, context = {}) { //build standard error object with consistent format
    return {
        code, //error code for programmatic handling
        message, //human readable error description
        type, //classification from ErrorTypes enum
        timestamp: new Date().toISOString(), //ISO timestamp for chronological analysis
        requestId: context.requestId || getRequestId(context.req), //correlation identifier
        context: { //additional debugging information
            ...context,
            req: undefined, //remove req object to prevent circular references in JSON
            res: undefined  //remove res object to prevent circular references in JSON
        }
    };
}

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
function sendErrorResponse(res, statusCode, errorObject) { //send consistent JSON error response
    if (res && !res.headersSent) { //prevent double response errors
        res.status(statusCode).json({ error: errorObject }); //structured error response format
    }
}

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
function createTypedError(message, type, code = 'GENERIC_ERROR', context = {}) { //create error with type classification
    const error = new Error(message); //base error object
    error.type = type; //attach error type for handling logic
    error.code = code; //attach error code for programmatic identification
    error.context = context; //attach context for debugging
    error.statusCode = ERROR_STATUS_MAP[type] || 500; //determine HTTP status from type
    error.severity = ERROR_SEVERITY_MAP[type] || ErrorSeverity.MEDIUM; //determine severity from type
    return error; //return enhanced error object
}

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
function errorMiddleware(error, req, res, next) { //global Express error middleware with enhanced safety
    try {
        const context = { //build request context for debugging
            req, //include request object for qerrors analysis
            url: req.url, //capture request URL
            method: req.method, //capture HTTP method
            ip: req.ip, //capture client IP for tracking
            userAgent: req.headers['user-agent'] //capture user agent for debugging
        };

        const errorType = error.type || ErrorTypes.SYSTEM; //default to system error when type missing
        const severity = ERROR_SEVERITY_MAP[errorType]; //determine severity from error type
        const statusCode = ERROR_STATUS_MAP[errorType]; //determine HTTP status from error type

        // Create standardized error response object
        const errorResponse = createStandardError(
            error.code || 'INTERNAL_ERROR', //error code for programmatic handling
            error.message || 'An internal error occurred', //error message for display
            errorType, //error classification
            context //debugging context
        );

        // Only send response if headers haven't been sent already
        // This prevents "Cannot set headers after they are sent" errors
        if (!res.headersSent) {
            sendErrorResponse(res, statusCode, errorResponse);
        }

    } catch (metaError) {
        // Handle meta-errors (errors in error handling itself)
        // This provides a fallback to prevent complete system failure
        console.error('Meta-error in errorMiddleware:', metaError.message); //log meta-error for debugging
        
        if (!res.headersSent) {
            // Send minimal error response as last resort
            try {
                res.status(500).json({ 
                    error: { 
                        code: 'SYSTEM_ERROR',
                        message: 'An internal error occurred',
                        timestamp: new Date().toISOString()
                    }
                });
            } catch (finalError) {
                // Ultimate fallback - just end the response
                console.error('Final error in errorMiddleware:', finalError.message);
                if (!res.headersSent) {
                    res.status(500).end();
                }
            }
        }
    }
}

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
function handleSimpleError(res, error, message, req) { //simplified error response handler
    try {
        // Log error through qerrors with appropriate context
        const qerrors = require('./qerrors'); //load qerrors for logging
        if (req) {
            qerrors(error, message, req); //log error with full request context for better debugging
        } else {
            qerrors(error, message); //log error without request context for background operations
        }
        
        // Only send response if headers haven't been sent already
        // This prevents "Cannot set headers after they are sent" errors
        if (!res.headersSent) {
            const errorResponse = createStandardError(
                'INTERNAL_ERROR', //error code for programmatic handling
                message, //user-provided error message
                ErrorTypes.SYSTEM, //default to system error type
                {} //empty context for simple errors
            );
            sendErrorResponse(res, 500, errorResponse);
        }
    } catch (metaError) {
        // Handle meta-errors (errors in error handling itself)
        // This provides a fallback to prevent complete system failure
        console.error('Meta-error in handleSimpleError:', metaError.message); //log meta-error for debugging
        if (!res.headersSent) {
            try {
                res.status(500).json({ error: message }); //minimal fallback response
            } catch (finalError) {
                console.error('Final error in handleSimpleError:', finalError.message);
                res.status(500).end(); //ultimate fallback
            }
        }
    }
}

module.exports = { //(export error handling utilities for use across qerrors module)
    ErrorTypes, //(error classification constants)
    ErrorSeverity, //(severity level constants)
    ERROR_STATUS_MAP, //(type to HTTP status mapping)
    ERROR_SEVERITY_MAP, //(type to severity mapping)
    getRequestId, //(request ID extraction utility)
    createStandardError, //(standardized error object factory)
    sendErrorResponse, //(consistent response utility)
    createTypedError, //(typed error factory function)
    ErrorFactory, //(convenient error creation utilities)
    errorMiddleware, //(Express global error handling middleware)
    handleSimpleError //(simplified error response handler)
};