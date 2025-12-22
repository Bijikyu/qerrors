'use strict';

/**
 * Logger Functions Module - Low-Level Logging Operations
 * 
 * This module provides the core logging functions that work with any logger instance.
 * These functions are designed to be the building blocks for higher-level logging APIs.
 * They handle the creation of enhanced log entries and delegation to the actual logger.
 * 
 * Design Rationale:
 * - Separation of concerns: These functions handle the "how" of logging, not the "where"
 * - Flexibility: Functions accept a logger parameter, making them usable with any logger instance
 * - Consistency: All functions use the same enhanced log entry creation process
 * - Sanitization: Automatic sanitization ensures no sensitive data leaks through logs
 * 
 * Usage Pattern:
 * - These functions are typically bound to a specific logger instance in higher-level modules
 * - Direct usage is rare but useful for testing or custom logger configurations
 */

// Import shared logging utilities for consistent log entry creation
const { createEnhancedLogEntry } = require('./shared/logging');
const { LOG_LEVELS } = require('./shared/constants');
const { sanitizeMessage, sanitizeContext } = require('./sanitization');

/**
 * Logs the start of a function execution with timing context
 * 
 * This function is designed to be called at the beginning of a function to mark
 * the start time for performance monitoring. The data parameter typically contains
 * the function arguments or relevant context for the operation.
 * 
 * @param {string} name - Function or operation name for identification
 * @param {Object} data - Context data or arguments passed to the function
 * @param {Promise<Object>} logger - Promise resolving to a logger instance
 * @returns {Promise<void>}
 */
const logStart = async (name, data, logger) => {
  // Resolve the logger promise (handles async logger initialization)
  const log = await logger;
  
  // Simple format for function entry - optimized for performance
  // JSON.stringify ensures objects are properly serialized
  log.info(`${name} start ${JSON.stringify(data)}`);
};

/**
 * Logs the return from a function execution with timing context
 * 
 * This function should be called when a function completes successfully.
 * It complements logStart to provide complete function execution timing.
 * The data parameter typically contains the return value or result.
 * 
 * @param {string} name - Function or operation name for identification
 * @param {Object} data - Return value or result data
 * @param {Promise<Object>} logger - Promise resolving to a logger instance
 * @returns {Promise<void>}
 */
const logReturn = async (name, data, logger) => {
  // Resolve the logger promise (handles async logger initialization)
  const log = await logger;
  
  // Simple format for function exit - optimized for performance
  log.info(`${name} return ${JSON.stringify(data)}`);
};

/**
 * Logs debug-level messages with enhanced context
 * 
 * Debug messages are typically used for detailed troubleshooting during development.
 * The enhanced log entry includes structured context, request IDs for tracing,
 * and automatic sanitization of sensitive data.
 * 
 * @param {string} message - Debug message to log
 * @param {Object} context - Additional context information (sanitized)
 * @param {string|null} requestId - Request identifier for tracing
 * @param {Promise<Object>} logger - Promise resolving to a logger instance
 * @returns {Promise<void>}
 */
const logDebug = async (message, context = {}, requestId = null, logger) => {
  const log = await logger;
  
  // Create structured log entry with automatic sanitization
  const entry = createEnhancedLogEntry('DEBUG', message, context, requestId);
  log.debug(entry);
};

/**
 * Logs info-level messages with enhanced context
 * 
 * Info messages provide general information about application operation.
 * They're suitable for production logging and include structured context
 * for analysis and monitoring.
 * 
 * @param {string} message - Info message to log
 * @param {Object} context - Additional context information (sanitized)
 * @param {string|null} requestId - Request identifier for tracing
 * @param {Promise<Object>} logger - Promise resolving to a logger instance
 * @returns {Promise<void>}
 */
const logInfo = async (message, context = {}, requestId = null, logger) => {
  const log = await logger;
  
  // Create structured log entry with automatic sanitization
  const entry = createEnhancedLogEntry('INFO', message, context, requestId);
  log.info(entry);
};

/**
 * Logs warning-level messages with enhanced context
 * 
 * Warning messages indicate potential issues that don't prevent the application
 * from functioning but may require attention. They're important for proactive
 * monitoring and issue detection.
 * 
 * @param {string} message - Warning message to log
 * @param {Object} context - Additional context information (sanitized)
 * @param {string|null} requestId - Request identifier for tracing
 * @param {Promise<Object>} logger - Promise resolving to a logger instance
 * @returns {Promise<void>}
 */
const logWarn = async (message, context = {}, requestId = null, logger) => {
  const log = await logger;
  
  // Create structured log entry with automatic sanitization
  const entry = createEnhancedLogEntry('WARN', message, context, requestId);
  log.warn(entry);
};

/**
 * Logs error-level messages with enhanced context
 * 
 * Error messages indicate failures that affect application functionality.
 * They include full context for debugging and are typically monitored
 * by alerting systems for immediate attention.
 * 
 * @param {string} message - Error message to log
 * @param {Object} context - Additional context information (sanitized)
 * @param {string|null} requestId - Request identifier for tracing
 * @param {Promise<Object>} logger - Promise resolving to a logger instance
 * @returns {Promise<void>}
 */
const logError = async (message, context = {}, requestId = null, logger) => {
  const log = await logger;
  
  // Create structured log entry with automatic sanitization
  const entry = createEnhancedLogEntry('ERROR', message, context, requestId);
  log.error(entry);
};

/**
 * Logs fatal-level messages with enhanced context
 * 
 * Fatal messages indicate critical failures that may require immediate
 * application restart or intervention. They're logged at the error level
 * but marked as fatal for filtering and alerting purposes.
 * 
 * @param {string} message - Fatal error message to log
 * @param {Object} context - Additional context information (sanitized)
 * @param {string|null} requestId - Request identifier for tracing
 * @param {Promise<Object>} logger - Promise resolving to a logger instance
 * @returns {Promise<void>}
 */
const logFatal = async (message, context = {}, requestId = null, logger) => {
  const log = await logger;
  
  // Create structured log entry with automatic sanitization
  // Note: Logged as error level since most log systems don't have fatal level
  const entry = createEnhancedLogEntry('FATAL', message, context, requestId);
  log.error(entry);
};

/**
 * Logs audit-level messages with enhanced context
 * 
 * Audit messages track security-relevant events and compliance-related
 * activities. They're logged at the info level but marked as audit for
 * specialized filtering and retention policies.
 * 
 * @param {string} message - Audit message to log
 * @param {Object} context - Additional context information (sanitized)
 * @param {string|null} requestId - Request identifier for tracing
 * @param {Promise<Object>} logger - Promise resolving to a logger instance
 * @returns {Promise<void>}
 */
const logAudit = async (message, context = {}, requestId = null, logger) => {
  const log = await logger;
  
  // Create structured log entry with automatic sanitization
  // Note: Logged as info level for compatibility with log systems
  const entry = createEnhancedLogEntry('AUDIT', message, context, requestId);
  log.info(entry);
};

/**
 * Module exports - Core logging functions
 * 
 * These functions provide the foundation for all logging operations in the system.
 * They're designed to be imported and bound to specific logger instances in higher-level
 * modules, creating a flexible and consistent logging architecture.
 * 
 * Export Strategy:
 * - Individual function exports for selective importing
 * - Consistent parameter pattern across all functions for predictability
 * - Async logger parameter supports initialization patterns
 */
module.exports = {
  logStart,    // Function entry logging for performance tracking
  logReturn,   // Function exit logging for completion tracking
  logDebug,    // Development and troubleshooting messages
  logInfo,     // General operational information
  logWarn,     // Potential issues requiring attention
  logError,    // Error conditions affecting functionality
  logFatal,    // Critical failures requiring immediate attention
  logAudit     // Security and compliance events
};