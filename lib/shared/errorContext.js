'use strict';

/**
 * Error Context Utilities Module
 *
 * Purpose: Provides standardized error context creation for consistent
 * error reporting and debugging across the qerrors module. This module
 * ensures that all error contexts contain essential fields for tracking,
 * correlation, and analysis.
 *
 * Design Goals:
 * - Consistency: All error contexts follow same structure
 * - Correlation: Request tracking across distributed systems
 * - Debugging: Rich context information for troubleshooting
 * - Extensibility: Easy to add additional context fields
 * - Compatibility: Works with various request frameworks
 */

/**
 * Create standardized error context with essential fields
 *
 * Purpose: Creates comprehensive error context that includes
 * timestamp, severity, request correlation, and any additional
 * context provided by the caller. This ensures all error reports
 * contain consistent tracking information.
 *
 * Context Fields:
 * - Inherits all fields from baseContext
 * - Adds standardized timestamp for correlation
 * - Includes severity level for routing/prioritization
 * - Extracts request ID when available
 * - Maintains backward compatibility with existing patterns
 *
 * Request ID Resolution Logic:
 * 1. Use existing requestId from baseContext if present
 * 2. Extract from request object using getRequestId function if provided
 * 3. Fall back to no request ID if neither available
 *
 * @param {Object} baseContext - Base context object with additional error information
 * @param {string} severity - Error severity level (error, warn, info, debug)
 * @param {Object} req - Express/HTTP request object (optional)
 * @param {Function} getRequestId - Function to extract request ID from request (optional)
 * @returns {Object} Standardized error context with all essential fields
 */
function createErrorContext (baseContext, severity, req = null, getRequestId = null) {
  const context = {
    ...baseContext,
    severity,
    timestamp: new Date().toISOString()
  };

  if (baseContext.requestId) {
    context.requestId = baseContext.requestId;
  } else if (getRequestId && req) {
    context.requestId = getRequestId(req);
  }

  return context;
}

/**
 * Create enhanced log entry with comprehensive metadata
 *
 * Purpose: Creates rich log entries with system information,
 * correlation IDs, and sanitized content. This function
 * provides complete context for log analysis and debugging.
 *
 * Log Entry Structure:
 * - timestamp: ISO timestamp for precise ordering
 * - level: Normalized log level name
 * - message: Sanitized log message content
 * - service: Service name for multi-service environments
 * - version: Application version for deployment tracking
 * - environment: Deployment environment (dev/staging/prod)
 * - pid: Process ID for multi-instance debugging
 * - hostname: Host identification for distributed systems
 * - requestId: Request correlation ID when available
 * - context: Additional context data (sanitized)
 *
 * Security Measures:
 * - Message sanitization to prevent log injection
 * - Context sanitization to remove sensitive data
 * - Safe fallbacks for missing configuration
 * - Protection against circular references
 *
 * @param {string} level - Log level (error, warn, info, debug)
 * @param {string} message - Log message content
 * @param {Object} context - Additional context data for the log entry
 * @param {string} requestId - Request correlation identifier (optional)
 * @returns {Object} Enhanced log entry with comprehensive metadata
 */
function createEnhancedLogEntry (level, message, context = {}, requestId = null) {
  const localVars = require('../../config/localVars');
  const { LOG_LEVELS } = localVars;
  const config = require('../config');
  const { sanitizeMessage, sanitizeContext } = require('../sanitization');

  const levelConfig = LOG_LEVELS[level.toUpperCase()];
  const entry = {
    timestamp: new Date().toISOString(),
    level: levelConfig ? levelConfig.name : level,
    message: sanitizeMessage(message, levelConfig ? levelConfig.name : level),
    service: config.getEnv('QERRORS_SERVICE_NAME'),
    version: process.env.npm_package_version || '1.0.0',
    environment: localVars.NODE_ENV || 'development',
    pid: process.pid,
    hostname: require('os').hostname()
  };

  // Add request correlation ID when available
  if (requestId) {
    entry.requestId = requestId;
  }

  // Add sanitized context data when provided
  if (context && Object.keys(context).length > 0) {
    entry.context = sanitizeContext(context, levelConfig ? levelConfig.name : level);
  }

  return entry;
}

/**
 * Module exports for error context utilities
 *
 * Purpose: Provides standardized error context creation and
 * enhanced log entry generation for consistent error reporting
 * and debugging across the qerrors module.
 */
module.exports = {
  createErrorContext,
  createEnhancedLogEntry
};
