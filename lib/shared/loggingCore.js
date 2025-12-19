'use strict';

const { createEnhancedLogEntry } = require('./errorContext');
const localVars = require('../../config/localVars');
const { LOG_LEVELS } = localVars;

/**
 * Create enhanced log entry with standardized format
 */
const createLogEntry = (level, message, context = {}, requestId = null) => {
  const entry = createEnhancedLogEntry(level, message, context, requestId);

  // Add memory usage for warning and higher level logs
  const levelConfig = LOG_LEVELS[level.toUpperCase()];
  
  if (levelConfig && levelConfig.priority >= LOG_LEVELS.WARN.priority) {
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
const verboseLog = msg => localVars.QERRORS_VERBOSE !== 'false' && console.log(msg);

module.exports = {
  createLogEntry,
  stringifyContext,
  safeErrorMessage,
  verboseLog
};