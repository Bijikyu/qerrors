/**
 * Winston logger configuration for qerrors module
 * 
 * This module configures a comprehensive logging system using Winston that handles
 * both structured JSON logging and human-readable console output. The configuration
 * is designed to support both development and production environments.
 * 
 * Design rationale:
 * - Multi-transport approach ensures logs are captured in multiple formats/locations
 * - JSON format enables log aggregation and analysis tools
 * - Console output provides immediate feedback during development
 * - File separation (error vs combined) enables focused error analysis
 * - Custom printf format balances readability with structured data
 * - Stack trace inclusion aids debugging complex error scenarios
 */

const { createLogger, format, transports } = require('winston'); //import winston logging primitives
const path = require('path'); //path for building log file paths
const fs = require('fs'); //filesystem for logDir creation
const config = require('./config'); //load configuration for env defaults
const DailyRotateFile = require('winston-daily-rotate-file'); //import daily rotation transport //(enable time based rotation)

const rotationOpts = { maxsize: Number(process.env.QERRORS_LOG_MAXSIZE) || 1024 * 1024, maxFiles: Number(process.env.QERRORS_LOG_MAXFILES) || 5, tailable: true }; //(use env config when rotating logs)
const maxDays = Number(process.env.QERRORS_LOG_MAX_DAYS) || 0; //days to retain logs //(controls time rotation)
const logDir = process.env.QERRORS_LOG_DIR || 'logs'; //directory to store log files
let disableFileLogs = !!process.env.QERRORS_DISABLE_FILE_LOGS; //track file log state //(respect env flag)
async function initLogDir() { //prepare log directory asynchronously
        try { await fs.promises.mkdir(logDir, { recursive: true }); } //(create directory asynchronously with recursive option for nested paths)
        catch (err) { console.error(`Failed to create log directory ${logDir}: ${err.message}`); disableFileLogs = true; } //(record failure and disable file logging to prevent repeated errors)
}



/**
 * Winston logger instance with multi-format, multi-transport configuration
 *
 * Transport strategy:
 * 1. Error-only file for focused error analysis and alerting
 * 2. Combined file for comprehensive audit trail and debugging
 * 3. Console for immediate development feedback and debugging
 *
 * Format strategy combines multiple Winston formatters:
 * - Timestamp: Consistent chronological ordering across environments
 * - Errors: Proper stack trace handling for Error objects
 * - Splat: Support for printf-style string interpolation
 * - JSON: Structured data for log analysis tools
 * - Printf: Human-readable final format for console output
 */
async function buildLogger() { //(create logger after directory preparation complete)
        await initLogDir(); //(ensure directory exists before configuring file transports)
       const log = createLogger({ //(build configured winston logger instance with multi-transport setup)
        level: config.getEnv('QERRORS_LOG_LEVEL'), //(log level from env variable defaulting to 'info' for errors, warnings, and info messages)
        format: format.combine( //(combined format pipeline processes logs through multiple transformations, order matters for proper processing)
                format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), //(standardized timestamp format ensures consistent chronological sorting and international compatibility)
                format.errors({ stack: true }), //(specialized handling for Error objects to capture stack traces, critical since Error objects don't stringify stacks by default)
                format.splat(), //(enable printf-style string interpolation in log messages for flexible formatting like logger.info('User %s logged in', username))
                format.json(), //(JSON format for structured logging and compatibility with log aggregation tools, essential for production centralized logging)
                format.printf(({ timestamp, level, message, stack }) => {
                        return `${timestamp} ${level}: ${message}${stack ? '\n' + stack : ''}`;
                }) //(custom printf formatter for human-readable console output, conditionally includes stack trace to avoid clutter in normal messages)
        ),
        defaultMeta: { service: config.getEnv('QERRORS_SERVICE_NAME') }, //(default metadata added to all log entries, service identification helps in multi-service environments)
        transports: (() => { //(multi-transport configuration for comprehensive log coverage)
               const arr = []; //(start with empty transport array)
               if (!disableFileLogs) { //(add file transports when directory creation successful)
                        if (maxDays > 0) { //(use daily rotation when retention period configured)
                                arr.push(new DailyRotateFile({ filename: path.join(logDir, 'error-%DATE%.log'), level: 'error', datePattern: 'YYYY-MM-DD', maxFiles: `${maxDays}d`, maxSize: rotationOpts.maxsize })); //(error-only file with daily rotation for focused error analysis)
                                arr.push(new DailyRotateFile({ filename: path.join(logDir, 'combined-%DATE%.log'), datePattern: 'YYYY-MM-DD', maxFiles: `${maxDays}d`, maxSize: rotationOpts.maxsize })); //(combined log file with daily rotation for comprehensive audit trail)
                        } else {
                                const fileCap = rotationOpts.maxFiles > 0 ? rotationOpts.maxFiles : 30; //(fallback file count cap when time rotation disabled)
                                arr.push(new transports.File({ filename: path.join(logDir, 'error.log'), level: 'error', ...rotationOpts, maxFiles: fileCap })); //(size-based rotation for error files with count limit)
                                arr.push(new transports.File({ filename: path.join(logDir, 'combined.log'), ...rotationOpts, maxFiles: fileCap })); //(size-based rotation for combined files with count limit)
                        }
               }
               if (process.env.QERRORS_VERBOSE === 'true') { arr.push(new transports.Console()); } //(console transport only when verbose mode enabled)
               return arr; //(return configured transport array)
        })()
       });
       if (process.env.QERRORS_VERBOSE === 'true') { log.warn('QERRORS_VERBOSE=true can impact performance at scale'); } //warn when verbose may slow logging
       if (maxDays === 0 && !disableFileLogs) { log.warn('QERRORS_LOG_MAX_DAYS is 0; log files may grow without bound'); } //(warn about unlimited log retention)
       return log; //(return fully configured logger instance)
}

const logger = buildLogger(); //(create promise-based logger instance when module imported)

async function logStart(name, data) { const log = await logger; log.info(`${name} start ${JSON.stringify(data)}`); } //(log function start with data, uses promise to ensure logger ready)
async function logReturn(name, data) { const log = await logger; log.info(`${name} return ${JSON.stringify(data)}`); } //(log function return with result data, uses promise to invoke logger safely)

module.exports = logger; //(export promise that resolves to winston logger instance for async initialization)
module.exports.logStart = logStart; //(export start logging helper for function entry tracking)
module.exports.logReturn = logReturn; //(export return logging helper for function exit tracking)
