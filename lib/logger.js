/**
 * Enhanced Winston logger configuration for qerrors module
 * 
 * This module provides a comprehensive logging infrastructure that supports structured
 * logging, multiple log levels, performance monitoring, security-aware sanitization,
 * and production-ready log management. It extends Winston with enhanced features
 * designed for error handling applications that require detailed audit trails.
 * 
 * Enhanced features:
 * - Security-aware message sanitization to prevent logging sensitive data
 * - Request correlation IDs for tracking user journeys across services
 * - Performance monitoring with memory usage tracking
 * - Structured JSON logging with consistent metadata
 * - Environment-specific configuration for development vs production
 * - Multi-transport approach ensures logs are captured in multiple formats/locations
 * - Custom printf format balances readability with structured data
 * - Stack trace inclusion aids debugging complex error scenarios
 */

const { createLogger, format, transports } = require('winston'); //import winston logging primitives
const path = require('path'); //path for building log file paths
const fs = require('fs'); //filesystem for logDir creation
const config = require('./config'); //load configuration for env defaults
const { sanitizeMessage, sanitizeContext } = require('./sanitization'); //import sanitization utilities
// DailyRotateFile loaded dynamically in buildLogger to ensure stub system works

/**
 * Log Levels Configuration with Enhanced Metadata
 * 
 * Purpose: Defines hierarchical log levels for filtering and routing messages
 * Each level has a numeric priority for comparison and filtering operations.
 * Higher numbers indicate higher priority/severity levels.
 * 
 * Level usage guidelines:
 * - DEBUG: Detailed debugging information for development
 * - INFO: General operational messages about system behavior
 * - WARN: Warning conditions that should be noted but don't stop operation
 * - ERROR: Error conditions that require attention
 * - FATAL: Critical errors that may cause system shutdown
 * - AUDIT: Security and compliance-related events requiring permanent retention
 */
const LOG_LEVELS = {
  DEBUG: { priority: 10, color: '\x1b[36m', name: 'DEBUG' }, // Cyan
  INFO:  { priority: 20, color: '\x1b[32m', name: 'INFO' },  // Green
  WARN:  { priority: 30, color: '\x1b[33m', name: 'WARN' },  // Yellow
  ERROR: { priority: 40, color: '\x1b[31m', name: 'ERROR' }, // Red
  FATAL: { priority: 50, color: '\x1b[35m', name: 'FATAL' }, // Magenta
  AUDIT: { priority: 60, color: '\x1b[34m', name: 'AUDIT' }  // Blue
};

const rotationOpts = { maxsize: Number(process.env.QERRORS_LOG_MAXSIZE) || 1024 * 1024, maxFiles: Number(process.env.QERRORS_LOG_MAXFILES) || 5, tailable: true }; //(use env config when rotating logs)
// maxDays is calculated dynamically in buildLogger to respect environment changes
const logDir = process.env.QERRORS_LOG_DIR || 'logs'; //directory to store log files
let disableFileLogs = !!process.env.QERRORS_DISABLE_FILE_LOGS; //track file log state //(respect env flag)



/**
 * Enhanced Log Entry Creation with Performance Monitoring
 * 
 * Purpose: Creates consistent, enriched log entries with comprehensive metadata
 * Includes request correlation, performance metrics, and environment context.
 */
const createEnhancedLogEntry = (level, message, context = {}, requestId = null) => {
    const levelConfig = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
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
    requestId && (entry.requestId = requestId);
    context && Object.keys(context).length > 0 && (entry.context = sanitizeContext(context, levelConfig.name));
    if (levelConfig.priority >= LOG_LEVELS.WARN.priority) {
        const memUsage = process.memoryUsage();
        entry.memory = {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024),
            rss: Math.round(memUsage.rss / 1024 / 1024)
        };
    }
    return entry;
};

const fileFormat = format.combine( //formatter for JSON file logs with timestamp and stack
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), //timestamp for chronological sorting
        format.errors({ stack: true }), //include stack traces in log object
        format.splat(), //enable printf style interpolation
        format.json() //output structured JSON for log processors
); //makes structured logs easy to parse

const consoleFormat = format.combine( //formatter for readable console output
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), //timestamp for readability
        format.errors({ stack: true }), //include stack
        format.splat(), //support sprintf like syntax
        format.printf(({ timestamp, level, message, stack }) => `${timestamp} ${level}: ${message}${stack ? '\n' + stack : ''}`) //custom printable string
); //keeps console output compact and readable
/**
 * Asynchronously initializes the logging directory structure
 * 
 * This function handles the complexity of directory creation in both development
 * and production environments. It uses async operations to avoid blocking the
 * main thread during filesystem operations.
 * 
 * Design rationale:
 * - Async/await prevents blocking during directory creation
 * - Recursive creation handles nested directory paths
 * - Error handling allows graceful degradation when filesystem access fails
 * - Separate function enables reusability
 */
const initLogDir = async () => {
  try { await fs.promises.mkdir(logDir, { recursive: true }); }
  catch (err) { console.error(`Failed to create log directory ${logDir}: ${err.message}`); disableFileLogs = true; }
};



/**
 * Winston logger instance with multi-format, multi-transport configuration
 *
 * Transport strategy:
 * 1. Error-only file for focused error analysis and alerting
 * 2. Combined file for comprehensive audit trail and debugging
 * 3. Console for immediate development feedback and debugging
 *
 * Format strategy uses dedicated configurations:
 * - File transports log JSON for ingestion by aggregation tools
 * - Console transport uses printf for readable development output
 * - Each includes timestamp, stack traces and splat interpolation
 */
async function buildLogger() { //(create logger after directory preparation complete)
        await initLogDir(); //(ensure directory exists before configuring file transports)
        const maxDays = Number(process.env.QERRORS_LOG_MAX_DAYS) || 0; //days to retain logs //(calculate dynamically to respect env changes)
        disableFileLogs = disableFileLogs || !!process.env.QERRORS_DISABLE_FILE_LOGS; //(preserve directory failure flag while applying env override)
        const DailyRotateFile = require('winston-daily-rotate-file'); //(load dynamically to ensure stub system works)
       const log = createLogger({ //(build configured winston logger instance with multi-transport setup)
        level: config.getEnv('QERRORS_LOG_LEVEL'), //(log level from env variable defaulting to 'info' for errors, warnings, and info messages)
        defaultMeta: { service: config.getEnv('QERRORS_SERVICE_NAME') }, //(default metadata added to all log entries, service identification helps in multi-service environments)
        transports: (() => { //(multi-transport configuration for comprehensive log coverage)
               const arr = []; //(start with empty transport array)
               if (!disableFileLogs) { //(add file transports when directory creation successful)
                        if (maxDays > 0) { //(use daily rotation when retention period configured)
                                arr.push(new DailyRotateFile({ filename: path.join(logDir, 'error-%DATE%.log'), level: 'error', datePattern: 'YYYY-MM-DD', maxFiles: `${maxDays}d`, maxSize: rotationOpts.maxsize, format: fileFormat })); //(error-only file with daily rotation for focused error analysis)
                                arr.push(new DailyRotateFile({ filename: path.join(logDir, 'combined-%DATE%.log'), datePattern: 'YYYY-MM-DD', maxFiles: `${maxDays}d`, maxSize: rotationOpts.maxsize, format: fileFormat })); //(combined log file with daily rotation for comprehensive audit trail)
                        } else {
                                const fileCap = rotationOpts.maxFiles > 0 ? rotationOpts.maxFiles : 30; //(fallback file count cap when time rotation disabled)
                                arr.push(new transports.File({ filename: path.join(logDir, 'error.log'), level: 'error', ...rotationOpts, maxFiles: fileCap, format: fileFormat })); //(size-based rotation for error files with count limit)
                                arr.push(new transports.File({ filename: path.join(logDir, 'combined.log'), ...rotationOpts, maxFiles: fileCap, format: fileFormat })); //(size-based rotation for combined files with count limit)
                        }
               }
               if (process.env.QERRORS_VERBOSE === 'true') { arr.push(new transports.Console({ format: consoleFormat })); } //(console transport only when verbose mode enabled)
               if (arr.length === 0) { arr.push(new transports.Console({ format: consoleFormat })); } //fallback console transport ensures logger always has output
               return arr; //(return configured transport array)
        })()
       });
       if (process.env.QERRORS_VERBOSE === 'true') { log.warn('QERRORS_VERBOSE=true can impact performance at scale'); } //warn when verbose may slow logging
       if (maxDays === 0 && !disableFileLogs) { log.warn('QERRORS_LOG_MAX_DAYS is 0; log files may grow without bound'); } //(warn about unlimited log retention)
       return log; //(return fully configured logger instance)
}

const logger = buildLogger(); //(create promise-based logger instance when module imported)

const logStart = async (name, data) => { const log = await logger; log.info(`${name} start ${JSON.stringify(data)}`); };
const logReturn = async (name, data) => { const log = await logger; log.info(`${name} return ${JSON.stringify(data)}`); };

/**
 * Enhanced Logging Functions with Security and Performance Monitoring
 * 
 * These functions provide enhanced logging capabilities with built-in sanitization,
 * request correlation, and performance monitoring while maintaining backward
 * compatibility with the existing Winston logger.
 */

/**
 * Enhanced debug logging with sanitization and context
 * 
 * @param {string} message - Log message
 * @param {Object} context - Additional context data
 * @param {string} requestId - Optional request correlation ID
 */
const logDebug = async (message, context = {}, requestId = null) => {
    const log = await logger;
    const entry = createEnhancedLogEntry('DEBUG', message, context, requestId);
    log.debug(entry);
};

/**
 * Enhanced info logging with sanitization and context
 * 
 * @param {string} message - Log message
 * @param {Object} context - Additional context data
 * @param {string} requestId - Optional request correlation ID
 */
const logInfo = async (message, context = {}, requestId = null) => {
    const log = await logger;
    const entry = createEnhancedLogEntry('INFO', message, context, requestId);
    log.info(entry);
};

/**
 * Enhanced warning logging with sanitization and performance monitoring
 * 
 * @param {string} message - Log message
 * @param {Object} context - Additional context data
 * @param {string} requestId - Optional request correlation ID
 */
const logWarn = async (message, context = {}, requestId = null) => {
    const log = await logger;
    const entry = createEnhancedLogEntry('WARN', message, context, requestId);
    log.warn(entry);
};

/**
 * Enhanced error logging with sanitization and performance monitoring
 * 
 * @param {string} message - Log message
 * @param {Object} context - Additional context data
 * @param {string} requestId - Optional request correlation ID
 */
const logError = async (message, context = {}, requestId = null) => {
    const log = await logger;
    const entry = createEnhancedLogEntry('ERROR', message, context, requestId);
    log.error(entry);
};

/**
 * Enhanced fatal logging with sanitization and performance monitoring
 * 
 * @param {string} message - Log message
 * @param {Object} context - Additional context data
 * @param {string} requestId - Optional request correlation ID
 */
const logFatal = async (message, context = {}, requestId = null) => {
    const log = await logger;
    const entry = createEnhancedLogEntry('FATAL', message, context, requestId);
    log.error(entry);
};

/**
 * Enhanced audit logging for compliance and security events
 * 
 * @param {string} message - Audit message
 * @param {Object} context - Additional context data
 * @param {string} requestId - Optional request correlation ID
 */
const logAudit = async (message, context = {}, requestId = null) => {
    const log = await logger;
    const entry = createEnhancedLogEntry('AUDIT', message, context, requestId);
    log.info(entry);
};

/**
 * Performance Timer Utility
 * 
 * Purpose: Provides easy performance monitoring for operations
 * Returns a function that can be called to log the elapsed time.
 */
const createPerformanceTimer = (operation, requestId = null) => {
    const startTime = process.hrtime.bigint(), startMemory = process.memoryUsage();
    return async function logPerformance(success = true, additionalContext = {}) {
        const endTime = process.hrtime.bigint(), endMemory = process.memoryUsage(), duration = Number(endTime - startTime) / 1000000;
        const context = {
            operation,
            duration_ms: Math.round(duration * 100) / 100,
            memory_delta: {
                heapUsed: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024),
                external: Math.round((endMemory.external - startMemory.external) / 1024)
            },
            success,
            ...additionalContext
        };
        const message = `${operation} completed in ${context.duration_ms}ms (${success ? 'success' : 'failure'})`;
        success ? await logInfo(message, context, requestId) : await logWarn(message, context, requestId);
        return context;
    };
};

module.exports = logger; //(export promise that resolves to winston logger instance for async initialization)
module.exports.logStart = logStart; //(export start logging helper for function entry tracking)
module.exports.logReturn = logReturn; //(export return logging helper for function exit tracking)

// Enhanced logging functions with security and performance monitoring
module.exports.logDebug = logDebug; //(export enhanced debug logging)
module.exports.logInfo = logInfo; //(export enhanced info logging)
module.exports.logWarn = logWarn; //(export enhanced warn logging)
module.exports.logError = logError; //(export enhanced error logging)
module.exports.logFatal = logFatal; //(export enhanced fatal logging)
module.exports.logAudit = logAudit; //(export enhanced audit logging)

// Utility functions for enhanced logging capabilities
module.exports.createPerformanceTimer = createPerformanceTimer; //(export performance timer utility)
module.exports.sanitizeMessage = sanitizeMessage; //(export message sanitization utility)
module.exports.sanitizeContext = sanitizeContext; //(export context sanitization utility)
module.exports.createEnhancedLogEntry = createEnhancedLogEntry; //(export enhanced log entry creator)
module.exports.LOG_LEVELS = LOG_LEVELS; //(export log level constants)

/**
 * Simple Winston Logger - Basic Configuration Pattern
 * 
 * Purpose: Provides a straightforward Winston logger configuration similar to the
 * requested pattern, offering developers a familiar simple logging interface
 * alongside the enhanced qerrors logging capabilities.
 */
const createSimpleWinstonLogger = () => createLogger({
    level: 'info',
    format: format.json(),
    transports: [new transports.Console({ format: format.simple() })]
});

// Simple Winston logger instance for basic logging needs
const simpleLogger = createSimpleWinstonLogger();

module.exports.simpleLogger = simpleLogger; //(export basic Winston logger instance)
module.exports.createSimpleWinstonLogger = createSimpleWinstonLogger; //(export simple logger factory)
