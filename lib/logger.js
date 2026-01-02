'use strict';

// Import core logger configuration
const { buildLogger, createSimpleWinstonLogger } = require('./loggerConfig');
const { 
  logStart, 
  logReturn, 
  logDebug, 
  logInfo, 
  logWarn, 
  logError, 
  logFatal, 
  logAudit 
} = require('./loggerFunctions');

// Import shared utilities using the new unified import system
const { commonImports } = require('./shared/imports');
const { createEnhancedLogEntry, LOG_LEVELS, createPerformanceTimer } = commonImports.logging();
const { sanitizeMessage, sanitizeContext } = require('./sanitization');

// Import unified data structures
const { BufferFactory } = require('./shared/dataStructures');

// Initialize loggers
const logger = buildLogger();
const simpleLogger = createSimpleWinstonLogger();

// Use unified circular buffer for log queue
const logQueue = BufferFactory.createLogBuffer(500);
const MAX_LOG_QUEUE_SIZE = 500;

// Queue processing state
let logProcessing = false;
let processingScheduled = false;

/**
 * Process queued log functions in batches
 * Implements the original logic but with the unified circular buffer
 */
const processLogQueue = async () => {
  if (logProcessing || logQueue.isEmpty()) {
    processingScheduled = false;
    return;
  }

  logProcessing = true;
  const startTime = Date.now();

  try {
    const batchSize = Math.min(25, logQueue.length);
    const batch = logQueue.splice(batchSize);
    const PARALLEL_BATCH_SIZE = 5;

    // Process batch in parallel chunks
    for (let i = 0; i < batch.length; i += PARALLEL_BATCH_SIZE) {
      const parallelBatch = batch.slice(i, i + PARALLEL_BATCH_SIZE);
      
      await Promise.allSettled(
        parallelBatch.map(logFn => {
          try {
            return logFn();
          } catch (err) {
            console.error('Log processing error:', err.message);
          }
        })
      );
    }

    // Continue processing if more items in queue
    if (logQueue.length > 0) {
      processingScheduled = true;
      setImmediate(processLogQueue);
    } else {
      processingScheduled = false;
    }

  } finally {
    logProcessing = false;
    const processingTime = Date.now() - startTime;
    
    if (processingTime > 100) {
      console.warn(`Log queue processing took ${processingTime}ms - consider reducing log volume`);
    }
  }
};

/**
 * Creates a queued version of a log function
 * @param {Function} logFunction - The log function to queue
 * @returns {Function} Queued log function
 */
const queueLogFunction = (logFunction) => async (...args) => {
  // Add to queue using the unified circular buffer
  logQueue.push(() => logFunction(...args));
  
  // Start processing if not already running
  if (!processingScheduled && !logProcessing) {
    processingScheduled = true;
    setImmediate(processLogQueue);
  }
};

// Create queued versions of all log functions
const boundLogStart = queueLogFunction((name, data) => 
  logStart(name, data, logger).catch(() => {})
);

const boundLogReturn = queueLogFunction((name, data) => 
  logReturn(name, data, logger).catch(() => {})
);

const boundLogDebug = queueLogFunction((message, context, requestId) => 
  logDebug(message, context, requestId, logger).catch(() => {})
);

const boundLogInfo = queueLogFunction((message, context, requestId) => 
  logInfo(message, context, requestId, logger).catch(() => {})
);

const boundLogWarn = queueLogFunction((message, context, requestId) => 
  logWarn(message, context, requestId, logger).catch(() => {})
);

const boundLogError = queueLogFunction((message, context, requestId) => 
  logError(message, context, requestId, logger).catch(() => {})
);

const boundLogFatal = queueLogFunction((message, context, requestId) => 
  logFatal(message, context, requestId, logger).catch(() => {})
);

const boundLogAudit = queueLogFunction((message, context, requestId) => 
  logAudit(message, context, requestId, logger).catch(() => {})
);

// Export the main logger instance
module.exports = logger;

// Export bound (queued) log functions
module.exports.logStart = boundLogStart;
module.exports.logReturn = boundLogReturn;
module.exports.logDebug = boundLogDebug;
module.exports.logInfo = boundLogInfo;
module.exports.logWarn = boundLogWarn;
module.exports.logError = boundLogError;
module.exports.logFatal = boundLogFatal;
module.exports.logAudit = boundLogAudit;

// Export utility functions
module.exports.createPerformanceTimer = createPerformanceTimer;
module.exports.sanitizeMessage = sanitizeMessage;
module.exports.sanitizeContext = sanitizeContext;
module.exports.createEnhancedLogEntry = createEnhancedLogEntry;
module.exports.LOG_LEVELS = LOG_LEVELS;

// Export simple logger
module.exports.simpleLogger = simpleLogger;
module.exports.createSimpleWinstonLogger = createSimpleWinstonLogger;

// Export queue status for monitoring
module.exports.getLogQueueStats = () => logQueue.getStats();
module.exports.getLogQueueMetrics = () => logQueue.getMetrics();