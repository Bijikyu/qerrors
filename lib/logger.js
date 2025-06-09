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
        try { await fs.promises.mkdir(logDir, { recursive: true }); } //create dir async once
        catch (err) { console.error(`Failed to create log directory ${logDir}: ${err.message}`); disableFileLogs = true; } //(record failure and disable files)
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
async function buildLogger() { //create logger after dir ready
        await initLogDir(); //ensure directory exists before transports
        const log = createLogger({
        // Log level from QERRORS_LOG_LEVEL environment variable
        // Defaults to 'info' allowing errors, warnings, and info messages
        level: config.getEnv('QERRORS_LOG_LEVEL'), //env configurable log level
	
	// Combined format pipeline processes logs through multiple transformations
	// Order matters: timestamp first, then error handling, then formatting
	format: format.combine(
		// Standardized timestamp format ensures consistent chronological sorting
		// Format chosen for readability and international compatibility
		format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		
		// Specialized handling for Error objects to capture stack traces
		// Critical for debugging as Error objects don't stringify stack traces by default
		format.errors({ stack: true }),
		
		// Enable printf-style string interpolation in log messages
		// Allows flexible message formatting: logger.info('User %s logged in', username)
		format.splat(),
		
		// JSON format for structured logging and compatibility with log aggregation
		// Essential for production environments using centralized logging
		format.json(),
		
		// Custom printf formatter for human-readable console output
		// Conditionally includes stack trace to avoid clutter in normal messages
		format.printf(({ timestamp, level, message, stack }) => {
			return `${timestamp} ${level}: ${message}${stack ? '\n' + stack : ''}`;
		})
	),
	
        // Default metadata added to all log entries
        // Service identification helps in multi-service environments
        defaultMeta: { service: config.getEnv('QERRORS_SERVICE_NAME') }, //(use env service name)
	
        // Multi-transport configuration for comprehensive log coverage
        transports: (() => {
               const arr = []; //start with no transports
               if (!disableFileLogs) { //add files when directory available
                        if (maxDays > 0) { //use daily rotate when retention set
                                arr.push(new DailyRotateFile({ filename: path.join(logDir, 'error-%DATE%.log'), level: 'error', datePattern: 'YYYY-MM-DD', maxFiles: `${maxDays}d`, maxSize: rotationOpts.maxsize }));
                                arr.push(new DailyRotateFile({ filename: path.join(logDir, 'combined-%DATE%.log'), datePattern: 'YYYY-MM-DD', maxFiles: `${maxDays}d`, maxSize: rotationOpts.maxsize }));
                        } else {
                                const fileCap = rotationOpts.maxFiles > 0 ? rotationOpts.maxFiles : 30; //fallback cap when days zero
                                arr.push(new transports.File({ filename: path.join(logDir, 'error.log'), level: 'error', ...rotationOpts, maxFiles: fileCap })); //limit rotated error files
                                arr.push(new transports.File({ filename: path.join(logDir, 'combined.log'), ...rotationOpts, maxFiles: fileCap })); //limit rotated combined files
                        }
               }
               if (process.env.QERRORS_VERBOSE === 'true') { arr.push(new transports.Console()); } //console only when verbose
               return arr; //provide configured transports
        })()
        });
        if (maxDays === 0 && !disableFileLogs) { log.warn('QERRORS_LOG_MAX_DAYS is 0; log files may grow without bound'); } //(warn about unlimited log retention)
        return log; //provide created logger
}

const logger = buildLogger(); //async logger promise

async function logStart(name, data) { const log = await logger; log.info(`${name} start ${JSON.stringify(data)}`); } //log start info //(use promise to invoke logger)
async function logReturn(name, data) { const log = await logger; log.info(`${name} return ${JSON.stringify(data)}`); } //log result info //(use promise to invoke logger)

module.exports = logger; //export promise for initialization
module.exports.logStart = logStart; //export start logger //(make available to env utils)
module.exports.logReturn = logReturn; //export return logger //(make available to env utils)
