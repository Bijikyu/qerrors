'use strict';

/**
 * Logger module that builds and exports a configured Winston logger along with
 * convenience wrapper functions. The wrappers bind the shared logger instance
 * to the low‑level logging helpers so callers do not need to pass the logger
 * explicitly. This design centralises logger configuration while keeping the
 * public API ergonomic.
 *
 * Rationale:
 * - Exporting the logger directly mirrors typical Winston usage (`require(...).logger`).
 * - Providing bound helper functions avoids repetitive `logger` arguments throughout
 *   the codebase, reducing boilerplate and the chance of using a different logger
 *   instance accidentally.
 * - The additional exports (`createPerformanceTimer`, sanitisation utilities,
 *   constants, etc.) expose shared functionality without requiring consumers to
 *   know the internal file layout.
 */

// Import logger configuration utilities that create the Winston logger instance and a simple logger variant
const { buildLogger, createSimpleWinstonLogger } = require('./loggerConfig');

// Import low-level logging functions that work with any logger instance
const { 
  logStart,   // Function entry logging with performance tracking
  logReturn,  // Function exit logging with return value capture
  logDebug,   // Debug-level logging for development
  logInfo,    // Info-level logging for general information
  logWarn,    // Warning-level logging for potential issues
  logError,   // Error-level logging for error conditions
  logFatal,   // Fatal-level logging for critical failures
  logAudit    // Audit-level logging for security events
} = require('./loggerFunctions');

// Import shared utilities for re-export - provides access to common functionality
const { createEnhancedLogEntry } = require('./shared/logging');  // Enhanced log entry creation
const { LOG_LEVELS } = require('./shared/constants');              // Standardized log levels
const { sanitizeMessage, sanitizeContext } = require('./sanitization'); // Security sanitization

// Performance timer using shared utilities - for function execution timing
const { createPerformanceTimer } = require('./shared/logging');

// Initialise the shared Winston logger instances using configuration
// These are the core logger objects that all bound functions will use
const logger = buildLogger();                    // Main configured Winston logger
const simpleLogger = createSimpleWinstonLogger(); // Simplified logger for basic needs

/**
 * Create bound logging functions that automatically use the shared logger instance
 * 
 * These bound functions provide a clean API by pre-binding the logger parameter,
 * so callers don't need to pass the logger explicitly. This reduces boilerplate
 * and ensures consistent logger usage across the application.
 * 
 * Enhanced with non-blocking logging and memory management to prevent I/O operations
 * from blocking request processing and causing memory leaks
 */

// Circular buffer for memory-efficient log queue using denque
class CircularLogBuffer {
  constructor(size = 1000) {
    const Denque = require('denque');
    this.maxSize = size;
    this.buffer = new Denque();
  }

  push(item) {
    // Remove oldest item if at capacity
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }
    this.buffer.push(item);
  }

  splice(start, deleteCount) {
    const result = [];
    for (let i = 0; i < deleteCount && this.buffer.length > 0; i++) {
      result.push(this.buffer.shift());
    }
    return result;
  }

  get length() {
    return this.buffer.length;
  }

  isEmpty() {
    return this.buffer.length === 0;
  }
}

const logQueue = new CircularLogBuffer(500); // Reduced size for memory efficiency
const MAX_LOG_QUEUE_SIZE = 500;
let logProcessing = false;
let processingScheduled = false;

/**
 * Process log queue in background with memory management
 */
const processLogQueue = async () => {
  if (logProcessing || logQueue.length === 0) {
    processingScheduled = false;
    return;
  }
  
  logProcessing = true;
  const startTime = Date.now();
  
  try {
    // Reduced batch size for faster processing
    const batchSize = Math.min(25, logQueue.length);
    const batch = logQueue.splice(0, batchSize);
    
    // Balanced processing - smaller parallel batches
    const PARALLEL_BATCH_SIZE = 5;
    for (let i = 0; i < batch.length; i += PARALLEL_BATCH_SIZE) {
      const parallelBatch = batch.slice(i, i + PARALLEL_BATCH_SIZE);
      await Promise.allSettled(parallelBatch.map(logFn => {
        try {
          return logFn();
        } catch (err) {
          // Silently fail to prevent log errors from causing issues
          console.error('Log processing error:', err.message);
        }
      }));
    }
    
    // Continue processing if more logs exist
    if (logQueue.length > 0) {
      processingScheduled = true;
      setImmediate(processLogQueue);
    } else {
      processingScheduled = false;
    }
  } finally {
    logProcessing = false;
    
    // Prevent excessive processing time
    const processingTime = Date.now() - startTime;
    if (processingTime > 100) { // 100ms limit
      console.warn(`Log queue processing took ${processingTime}ms - consider reducing log volume`);
    }
  }
};

/**
 * Queue log function for non-blocking processing with overflow protection
 */
const queueLogFunction = (logFunction) => {
  return async (...args) => {
    // Queue the log function for background processing (circular buffer handles overflow)
    logQueue.push(() => logFunction(...args));
    
    // Start background processing if not already scheduled
    if (!processingScheduled && !logProcessing) {
      processingScheduled = true;
      setImmediate(processLogQueue);
    }
  };
};

const boundLogStart = queueLogFunction((name, data) => logStart(name, data, logger).catch(() => {}));
const boundLogReturn = queueLogFunction((name, data) => logReturn(name, data, logger).catch(() => {}));
const boundLogDebug = queueLogFunction((message, context, requestId) => logDebug(message, context, requestId, logger).catch(() => {}));
const boundLogInfo = queueLogFunction((message, context, requestId) => logInfo(message, context, requestId, logger).catch(() => {}));
const boundLogWarn = queueLogFunction((message, context, requestId) => logWarn(message, context, requestId, logger).catch(() => {}));
const boundLogError = queueLogFunction((message, context, requestId) => logError(message, context, requestId, logger).catch(() => {}));
const boundLogFatal = queueLogFunction((message, context, requestId) => logFatal(message, context, requestId, logger).catch(() => {}));
const boundLogAudit = queueLogFunction((message, context, requestId) => logAudit(message, context, requestId, logger).catch(() => {}));

/**
 * Module exports - Comprehensive logging API with multiple access patterns
 * 
 * The export strategy provides:
 * - Default export: The main Winston logger instance for direct usage
 * - Bound functions: Pre-configured logging functions for convenience
 * - Utilities: Supporting functions and constants
 * - Re-exports: Shared utilities for easy access
 */

// Primary export - the main Winston logger instance for direct usage
module.exports = logger;

// Bound logging functions - pre-configured for convenience (no logger parameter needed)
module.exports.logStart = boundLogStart;      // Function entry logging
module.exports.logReturn = boundLogReturn;    // Function exit logging
module.exports.logDebug = boundLogDebug;      // Debug-level logging
module.exports.logInfo = boundLogInfo;        // Info-level logging
module.exports.logWarn = boundLogWarn;        // Warning-level logging
module.exports.logError = boundLogError;      // Error-level logging
module.exports.logFatal = boundLogFatal;      // Fatal-level logging
module.exports.logAudit = boundLogAudit;      // Audit-level logging

// Utility functions
module.exports.createPerformanceTimer = createPerformanceTimer;  // Performance timing
module.exports.sanitizeMessage = sanitizeMessage;                // Message sanitization
module.exports.sanitizeContext = sanitizeContext;                // Context sanitization
module.exports.createEnhancedLogEntry = createEnhancedLogEntry;  // Enhanced log creation

// Constants and additional loggers
module.exports.LOG_LEVELS = LOG_LEVELS;                          // Standardized log levels
module.exports.simpleLogger = simpleLogger;                      // Simple logger instance
module.exports.createSimpleWinstonLogger = createSimpleWinstonLogger; // Logger factory