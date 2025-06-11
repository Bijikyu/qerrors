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
// maxDays is calculated dynamically in buildLogger to respect environment changes
const logDir = process.env.QERRORS_LOG_DIR || 'logs'; //directory to store log files
let disableFileLogs = !!process.env.QERRORS_DISABLE_FILE_LOGS; //track file log state //(respect env flag)

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
 * - Separate function enables testing and reusability
 */
async function initLogDir() { //prepare log directory asynchronously ensuring proper filesystem structure
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
 * Format strategy uses dedicated configurations:
 * - File transports log JSON for ingestion by aggregation tools
 * - Console transport uses printf for readable development output
 * - Each includes timestamp, stack traces and splat interpolation
 */
async function buildLogger() { //(create logger after directory preparation complete)
        await initLogDir(); //(ensure directory exists before configuring file transports)
        const maxDays = Number(process.env.QERRORS_LOG_MAX_DAYS) || 0; //days to retain logs //(calculate dynamically to respect env changes)
        disableFileLogs = !!process.env.QERRORS_DISABLE_FILE_LOGS; //(refresh file log state to respect env changes)
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
