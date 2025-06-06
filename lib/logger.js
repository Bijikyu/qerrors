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
 * - Daily file rotation manages size and uses async writes
 * - Custom printf format balances readability with structured data
 * - Stack trace inclusion aids debugging complex error scenarios
 */

const { createLogger, format, transports } = require('winston'); //import winston logging primitives
const DailyRotateFile = require('winston-daily-rotate-file'); //import rotating file transport for async writes

/**
 * Winston logger instance with multi-format, multi-transport configuration
 * 
 * Transport strategy:
 * 1. Error-only file rotated daily for focused error analysis and alerting
 * 2. Combined file rotated daily for comprehensive audit trail and debugging
 * 3. Console for immediate development feedback and debugging
 * 
 * Format strategy combines multiple Winston formatters:
 * - Timestamp: Consistent chronological ordering across environments
 * - Errors: Proper stack trace handling for Error objects
 * - Splat: Support for printf-style string interpolation
 * - JSON: Structured data for log analysis tools
 * - Printf: Human-readable final format for console output
 */
const logger = createLogger({
	// Info level captures errors, warnings, and informational messages
	// This provides comprehensive logging without debug noise in production
	level: 'info',
	
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
	defaultMeta: { service: 'user-service' },
	
	// Multi-transport configuration for comprehensive log coverage
        transports: [
                // Error-only transport rotates daily to limit file size
                new DailyRotateFile({ filename: 'error-%DATE%.log', level: 'error', datePattern: 'YYYY-MM-DD', zippedArchive: true, maxSize: '20m', maxFiles: '14d' }), //(daily rotated error logs)

                // Combined transport also rotates daily for async writes
                new DailyRotateFile({ filename: 'combined-%DATE%.log', datePattern: 'YYYY-MM-DD', zippedArchive: true, maxSize: '20m', maxFiles: '14d' }), //(daily rotated combined logs)
		
		// Console transport for immediate feedback during development
		// Also useful for containerized deployments where logs go to stdout
		new transports.Console()
	]
});

// Export configured logger instance
// This provides a consistent logging interface across the entire qerrors module
module.exports = logger;
