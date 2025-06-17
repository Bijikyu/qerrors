
'use strict'; //enforce strict parsing and error handling across module

/**
 * Main entry point for the qerrors package - an intelligent error handling middleware
 * that combines traditional error logging with AI-powered error analysis.
 * 
 * This module exports both the core qerrors function and the underlying logger,
 * providing flexibility for different use cases while maintaining a clean API.
 * 
 * Design rationale:
 * - Separates concerns by keeping qerrors logic and logging logic in separate modules
 * - Provides both individual exports and a default export for different import patterns
 * - Maintains backward compatibility through multiple export strategies
 * - Uses strict mode to catch common JavaScript pitfalls early
 */

const qerrors = require('./lib/qerrors'); //load primary error handler implementation
const logger = require('./lib/logger'); //load configured winston logger used by qerrors
const errorTypes = require('./lib/errorTypes'); //load error classification and handling utilities

/**
 * Error logger middleware that logs errors and provides AI-powered suggestions.
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 * @param {Object} [req] - Express request object (optional)
 * @param {Object} [res] - Express response object (optional)
 * @param {Function} [next] - Express next function (optional)
 * @returns {Promise<void>}
 */

module.exports = { //(primary export object allows destructuring imports like { qerrors, logger, errorTypes } providing clear explicit imports while keeping related functionality grouped)
  qerrors, //(main error handling function users interact with)
  logger, //(winston logger instance for consistent logging, exposes same configured logger qerrors uses internally)
  errorTypes, //(error classification and handling utilities for standardized error management)
  logErrorWithSeverity: qerrors.logErrorWithSeverity, //(severity-based logging function for enhanced error categorization)
  handleControllerError: qerrors.handleControllerError, //(standardized controller error handler with automatic response formatting)
  withErrorHandling: qerrors.withErrorHandling, //(async operation wrapper with integrated error handling)
  createTypedError: errorTypes.createTypedError, //(typed error factory for consistent error classification)
  createStandardError: errorTypes.createStandardError, //(standardized error object factory)
  ErrorTypes: errorTypes.ErrorTypes, //(error type constants for classification)
  ErrorSeverity: errorTypes.ErrorSeverity, //(severity level constants for monitoring)
  ErrorFactory: errorTypes.ErrorFactory, //(convenient error creation utilities for common scenarios)
  errorMiddleware: errorTypes.errorMiddleware, //(Express global error handling middleware)
  handleSimpleError: errorTypes.handleSimpleError, //(simplified error response handler for basic scenarios)

  // Enhanced logging utilities with security and performance monitoring
  logDebug: logger.logDebug, //(enhanced debug logging with sanitization)
  logInfo: logger.logInfo, //(enhanced info logging with sanitization)
  logWarn: logger.logWarn, //(enhanced warn logging with performance monitoring)
  logError: logger.logError, //(enhanced error logging with performance monitoring)
  logFatal: logger.logFatal, //(enhanced fatal logging with performance monitoring)
  logAudit: logger.logAudit, //(enhanced audit logging for compliance)
  createPerformanceTimer: logger.createPerformanceTimer, //(performance timer utility for operation monitoring)
  sanitizeMessage: logger.sanitizeMessage, //(message sanitization utility for security)
  sanitizeContext: logger.sanitizeContext, //(context sanitization utility for security)
  createEnhancedLogEntry: logger.createEnhancedLogEntry, //(enhanced log entry creator with metadata)
  LOG_LEVELS: logger.LOG_LEVELS //(log level constants with priorities and colors)
};

module.exports.default = qerrors; //(default export for backward compatibility allowing both 'const qerrors = require("qerrors")' and destructuring patterns, dual strategy accommodates different developer preferences)
