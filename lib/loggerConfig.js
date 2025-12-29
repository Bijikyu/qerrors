'use strict';

/**
 * Logger Configuration Module - Winston-based Logging Infrastructure
 * 
 * Purpose: Provides comprehensive logging configuration for the qerrors system
 * using Winston as the underlying logging framework. This module handles both
 * file and console logging with configurable rotation, formatting, and
 * transport management.
 * 
 * Design Rationale:
 * - Production-ready: Uses Winston, the industry standard for Node.js logging
 * - Flexible transport configuration: Supports file, console, and daily rotation
 * - Environment-aware: Adapts logging behavior based on environment variables
 * - Performance optimization: Configurable verbosity and file management
 * - Error resilience: Graceful fallback when file logging fails
 * - Security considerations: Proper log file permissions and directory management
 * 
 * Key Features:
 * - Daily log file rotation with configurable retention
 * - Structured JSON logging for file outputs
 * - Human-readable console logging with timestamps
 * - Automatic log directory creation with error handling
 * - Configurable log levels and service metadata
 * - Performance warnings for verbose logging
 * - Fallback to console-only logging when file logging fails
 */

// Import Winston components for logger creation and formatting
const { createLogger, format, transports } = require('winston');

// Import Node.js built-in modules for file system operations
const path = require('path');  // Path manipulation for log file locations
const fs = require('fs');      // File system operations for directory creation

// Import configuration utilities for environment variable access
const config = require('./config');

// Import local configuration variables for logging settings
const localVars = require('../config/localVars');
const { ROTATION_OPTS } = localVars;
const rotationOpts = ROTATION_OPTS;  // File rotation configuration

// Extract logging directory and file logging settings from configuration
const { LOG_DIR, DISABLE_FILE_LOGS } = localVars;
const logDir = LOG_DIR;  // Directory where log files will be stored
let disableFileLogs = DISABLE_FILE_LOGS || process.env.NODE_ENV === 'test';  // Disable file logs in test environment for better performance

/**
 * File logging format configuration
 * 
 * Purpose: Defines the structured format for log file entries. This format
 * is optimized for machine parsing and log analysis tools, providing consistent
 * JSON output with timestamps, error stack traces, and proper error handling.
 * 
 * Format Components:
 * - timestamp: ISO-formatted timestamp for log entry timing
 * - errors: Ensures error objects include stack traces in JSON output
 * - splat: Enables string interpolation for log messages
 * - json: Outputs logs as structured JSON for parsing and analysis
 * 
 * Rationale:
 * - Structured logging enables better log analysis and searching
 * - JSON format is compatible with log aggregation systems
 * - Stack traces in errors provide debugging information
 * - Timestamps enable chronological log analysis
 */
const fileFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),  // Consistent timestamp format
  format.errors({ stack: true }),                       // Include stack traces for errors
  format.splat(),                                       // Enable printf-style message formatting
  format.json()                                         // Output as structured JSON
);

/**
 * Console logging format configuration
 * 
 * Purpose: Defines the human-readable format for console log entries.
 * This format is optimized for developer readability during development
 * and debugging, providing clear, formatted output with proper spacing
 * and stack trace display.
 * 
 * Format Components:
 * - timestamp: ISO-formatted timestamp for log entry timing
 * - errors: Ensures error objects include stack traces in console output
 * - splat: Enables string interpolation for log messages
 * - printf: Custom formatting for human-readable console output
 * 
 * Rationale:
 * - Human-readable format aids in development and debugging
 * - Stack traces displayed separately for better readability
 * - Consistent timestamp format for chronological analysis
 * - Clean formatting prevents console clutter
 */
const consoleFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),  // Consistent timestamp format
  format.errors({ stack: true }),                       // Include stack traces for errors
  format.splat(),                                       // Enable printf-style message formatting
  format.printf(({ timestamp, level, message, stack }) => 
    `${timestamp} ${level}: ${message}${stack ? '\n' + stack : ''}`
  )  // Custom format: timestamp level: message [newline stack]
);

/**
 * Initialize log directory with error handling
 * 
 * Purpose: Creates the log directory if it doesn't exist, handling any
 * filesystem errors gracefully. This function ensures that the logging
 * system can operate even when directory creation fails by falling back
 * to console-only logging.
 * 
 * Design Rationale:
 * - Graceful degradation: Falls back to console logging if directory creation fails
 * - Error visibility: Logs directory creation errors to console for debugging
 * - Idempotent operation: Safe to call multiple times
 * - Async operation: Uses promises for non-blocking directory creation
 * 
 * Error Handling:
 * - If directory creation fails, disables file logging to prevent further errors
 * - Logs the specific error message to console for debugging
 * - Allows application to continue running with console-only logging
 */
const initLogDir = async () => {
  try {
    // Create log directory with recursive option to create parent directories as needed
    await fs.promises.mkdir(logDir, { recursive: true });
  } catch (err) {
    // Log the error and disable file logging to prevent further filesystem issues
    console.error(`Failed to create log directory ${logDir}: ${err.message}`);
    disableFileLogs = true;
  }
};

/**
 * Build and configure Winston logger with comprehensive transport setup
 * 
 * Purpose: Creates a fully configured Winston logger instance with appropriate
 * transports based on environment configuration. This function handles both
 * daily rotation and standard file logging, console output, and proper
 * error handling for all transport configurations.
 * 
 * Design Rationale:
 * - Environment-aware configuration: Adapts to different deployment scenarios
 * - Flexible transport management: Supports various logging backends
 * - Performance optimization: Configurable verbosity and file management
 * - Error resilience: Ensures logging works even when some transports fail
 * - Production-ready: Includes proper rotation, retention, and formatting
 * 
 * Transport Configuration Logic:
 * 1. Daily rotation: Used when QERRORS_LOG_MAX_DAYS > 0
 * 2. Standard file rotation: Used when daily rotation is disabled
 * 3. Console logging: Always available as fallback and for development
 * 4. Verbose mode: Controlled by QERRORS_VERBOSE environment variable
 * 
 * @returns {Object} Configured Winston logger instance
 */
async function buildLogger() {
  // Ensure log directory exists before setting up file transports
  await initLogDir();
  
  // Parse configuration values with proper fallbacks
  const maxDays = Number(localVars.QERRORS_LOG_MAX_DAYS) || 0;  // Daily rotation retention period
  disableFileLogs = disableFileLogs || !!localVars.QERRORS_DISABLE_FILE_LOGS;  // Override flag
  
  // Import daily rotation file transport (conditional import for performance)
  const DailyRotateFile = require('winston-daily-rotate-file');
  
  // Create the main logger instance with configuration
  const log = createLogger({
    level: config.getEnv('QERRORS_LOG_LEVEL'),  // Minimum log level to capture
    defaultMeta: { service: config.getEnv('QERRORS_SERVICE_NAME') },  // Service metadata for all logs
    
    // Configure transports based on environment settings
    transports: (() => {
      const transports = [];  // Array to hold all configured transports
      
      // Add file transports if file logging is enabled
      if (!disableFileLogs) {
        if (maxDays > 0) {
          // Daily rotation configuration - creates new files each day
          transports.push(new DailyRotateFile({
            filename: path.join(logDir, 'error-%DATE%.log'),  // Error-only log file
            level: 'error',                                   // Only capture error level and above
            datePattern: 'YYYY-MM-DD',                        // Daily rotation pattern
            maxFiles: `${maxDays}d`,                          // Retain files for specified days
            maxSize: rotationOpts.maxsize,                    // Maximum file size before rotation
            format: fileFormat                                // Use structured JSON format
          }));
          
          transports.push(new DailyRotateFile({
            filename: path.join(logDir, 'combined-%DATE%.log'),  // All-levels log file
            datePattern: 'YYYY-MM-DD',                           // Daily rotation pattern
            maxFiles: `${maxDays}d`,                             // Retain files for specified days
            maxSize: rotationOpts.maxsize,                       // Maximum file size before rotation
            format: fileFormat                                   // Use structured JSON format
          }));
        } else {
          // Standard file rotation configuration - rotates by size and file count
          const fileCap = rotationOpts.maxFiles > 0 ? rotationOpts.maxFiles : 30;  // Default to 30 files
          
          const FileTransport = require('winston').transports.File;
          
          transports.push(new FileTransport({
            filename: path.join(logDir, 'error.log'),  // Error-only log file
            level: 'error',                            // Only capture error level and above
            ...rotationOpts,                           // Apply rotation settings
            maxFiles: fileCap,                         // Override file count cap
            format: fileFormat                          // Use structured JSON format
          }));
          
          transports.push(new FileTransport({
            filename: path.join(logDir, 'combined.log'),  // All-levels log file
            ...rotationOpts,                              // Apply rotation settings
            maxFiles: fileCap,                            // Override file count cap
            format: fileFormat                            // Use structured JSON format
          }));
        }
      }
      
      // Add console transport if verbose logging is enabled
      if (localVars.QERRORS_VERBOSE !== 'false') {
        const ConsoleTransport = require('winston').transports.Console;
        transports.push(new ConsoleTransport({ format: consoleFormat }));
      }
      
      // Ensure at least one transport is available (console as ultimate fallback)
      if (transports.length === 0) {
        const ConsoleTransport = require('winston').transports.Console;
        transports.push(new ConsoleTransport({ format: consoleFormat }));
      }
      
      return transports;
    })()  // Immediately invoke the transport configuration function
  });
  
  // Performance and configuration warnings
  if (localVars.QERRORS_VERBOSE !== 'false') {
    log.warn('QERRORS_VERBOSE=true can impact performance at scale');
  }
  
  if (maxDays === 0 && !disableFileLogs) {
    log.warn('QERRORS_LOG_MAX_DAYS is 0; log files may grow without bound');
  }
  
  return log;
}

/**
 * Create simple Winston logger for basic logging needs
 * 
 * Purpose: Provides a lightweight logger configuration for scenarios
 * where full-featured logging is not required. This is useful for
 * simple scripts, testing, or minimal logging requirements.
 * 
 * Design Rationale:
 * - Minimal configuration: Simple setup for basic logging needs
 * - JSON output: Structured format for easy parsing
 * - Console-only: No file logging for simple use cases
 * - Info level: Appropriate default for general logging
 * 
 * @returns {Object} Simple Winston logger instance
 */
const createSimpleWinstonLogger = () => createLogger({
  level: 'info',                              // Default to info level logging
  format: format.json(),                      // Use JSON format for structured output
  transports: [new transports.Console({ format: format.simple() })]  // Simple console output
});

/**
 * Module exports - Logger configuration and utilities
 * 
 * This module provides the complete logging infrastructure for the qerrors
 * system, including both production-ready and simple logging configurations.
 * The exports are organized to provide both functional and configurational
 * access to the logging system.
 */
module.exports = {
  // Main logger creation functions
  buildLogger,                    // Create production-ready logger with full configuration
  createSimpleWinstonLogger,     // Create simple logger for basic needs
  
  // Configuration and setup utilities
  initLogDir,                    // Initialize log directory (exported for testing)
  
  // Configuration objects (exported for testing and customization)
  rotationOpts,                   // File rotation settings
  fileFormat,                    // File logging format configuration
  consoleFormat                  // Console logging format configuration
};