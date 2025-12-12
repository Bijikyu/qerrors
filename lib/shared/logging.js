'use strict';

const { sanitizeMessage, sanitizeContext } = require('../sanitization');

/**
 * Create enhanced log entry with standardized format
 */
const createEnhancedLogEntry = (level, message, context = {}, requestId = null) => {
  const LOG_LEVELS = {
    DEBUG: { priority: 10, color: '\x1b[36m', name: 'DEBUG' },
    INFO: { priority: 20, color: '\x1b[32m', name: 'INFO' },
    WARN: { priority: 30, color: '\x1b[33m', name: 'WARN' },
    ERROR: { priority: 40, color: '\x1b[31m', name: 'ERROR' },
    FATAL: { priority: 50, color: '\x1b[35m', name: 'FATAL' },
    AUDIT: { priority: 60, color: '\x1b[34m', name: 'AUDIT' }
  };

  const levelConfig = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
  const config = require('../config');
  
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

  if (requestId) {
    entry.requestId = requestId;
  }

  if (context && Object.keys(context).length > 0) {
    entry.context = sanitizeContext(context, levelConfig.name);
  }

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

/**
 * Stringify context with circular reference handling
 */
const stringifyContext = ctx => {
  try {
    if (typeof ctx === 'string') return ctx;
    if (typeof ctx === 'object' && ctx !== null) {
      const seen = new Set();
      return JSON.stringify(ctx, (_, value) => {
        if (typeof value === 'object' && value !== null) {
          if (value === ctx) return '[Circular *1]';
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      });
    }
    return String(ctx);
  } catch (err) {
    return 'unknown context';
  }
};

/**
 * Get safe error message from error object
 */
const safeErrorMessage = (error, fallback = 'Unknown error') => {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String(error.message || '').trim();
    if (msg) return msg;
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  return fallback;
};

/**
 * Verbose logging utility
 */
const verboseLog = msg => process.env.QERRORS_VERBOSE !== 'false' && console.log(msg);

/**
 * Create performance timer for operation monitoring
 */
const createPerformanceTimer = (operation, requestId = null) => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();
  
  return async function logPerformance(success = true, additionalContext = {}) {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    const duration = Number(endTime - startTime) / 1000000;
    
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
    
    try {
      const logger = require('../logger');
      if (success) {
        await logger.logInfo(message, context, requestId);
      } else {
        await logger.logWarn(message, context, requestId);
      }
    } catch (err) {
      // Fallback to console if logger fails
      console[success ? 'log' : 'warn'](message, context);
    }
    
    return context;
  };
};

/**
 * Safe logging with fallback to console
 */
const safeLogError = async (error, context = {}, metadata = {}) => {
  try {
    const qerrors = require('../qerrors');
    if (typeof qerrors?.qerrors === 'function') {
      await qerrors.qerrors(error, context, metadata);
      return;
    }
    if (typeof qerrors === 'function') {
      await qerrors(error, context, metadata);
      return;
    }
  } catch {}
  
  try {
    const logger = require('../logger');
    if (typeof logger?.logError === 'function') {
      await logger.logError(safeErrorMessage(error), { context, ...metadata });
      return;
    }
  } catch {}
  
  // Final fallback to console
  console.error(`[${context}] ${safeErrorMessage(error)}`, metadata);
};

const safeLogInfo = async (message, metadata = {}) => {
  try {
    const logger = require('../logger');
    if (typeof logger?.logInfo === 'function') {
      await logger.logInfo(message, metadata);
      return;
    }
  } catch {}
  
  console.log(message, metadata);
};

const safeLogWarn = async (message, metadata = {}) => {
  try {
    const logger = require('../logger');
    if (typeof logger?.logWarn === 'function') {
      await logger.logWarn(message, metadata);
      return;
    }
  } catch {}
  
  console.warn(message, metadata);
};

const safeLogDebug = async (message, metadata = {}) => {
  try {
    const logger = require('../logger');
    if (typeof logger?.logDebug === 'function') {
      await logger.logDebug(message, metadata);
      return;
    }
  } catch {}
  
  if (process.env.QERRORS_VERBOSE !== 'false') {
    console.debug(message, metadata);
  }
};

module.exports = {
  createEnhancedLogEntry,
  stringifyContext,
  safeErrorMessage,
  verboseLog,
  createPerformanceTimer,
  safeLogError,
  safeLogInfo,
  safeLogWarn,
  safeLogDebug
};