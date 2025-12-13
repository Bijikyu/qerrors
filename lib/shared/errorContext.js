'use strict';

/**
 * Error context utilities for creating standardized error contexts
 */

/**
 * Create error context with standard fields
 * @param {Object} baseContext - Base context object
 * @param {string} severity - Error severity level
 * @param {Object} req - Request object (optional)
 * @param {Function} getRequestId - Function to get request ID (optional)
 * @returns {Object} Standardized error context
 */
function createErrorContext(baseContext, severity, req = null, getRequestId = null) {
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
 * Create enhanced log entry with standardized format
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Log context
 * @param {string} requestId - Request ID (optional)
 * @returns {Object} Enhanced log entry
 */
function createEnhancedLogEntry(level, message, context = {}, requestId = null) {
  const { LOG_LEVELS } = require('./constants');
  const levelConfig = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
  const config = require('../config');
  const { sanitizeMessage, sanitizeContext } = require('../sanitization');
  
  const entry = {
    timestamp: new Date().toISOString(),
    level: levelConfig.name,
    message: sanitizeMessage(message, levelConfig.name),
    service: config.getEnv('QERRORS_SERVICE_NAME'),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid,
    hostname: require('os').hostname()
  };

  if (requestId) {
    entry.requestId = requestId;
  }

  if (context && Object.keys(context).length > 0) {
    entry.context = sanitizeContext(context, levelConfig.name);
  }

  return entry;
}

module.exports = {
  createErrorContext,
  createEnhancedLogEntry
};