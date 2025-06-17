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

module.exports = { //(export error handling utilities for use across qerrors module)
    ErrorTypes, //(error classification constants)
    ErrorSeverity, //(severity level constants)
    ERROR_STATUS_MAP, //(type to HTTP status mapping)
    ERROR_SEVERITY_MAP, //(type to severity mapping)
    getRequestId, //(request ID extraction utility)
    createStandardError, //(standardized error object factory)
    sendErrorResponse, //(consistent response utility)
    createTypedError //(typed error factory function)
};