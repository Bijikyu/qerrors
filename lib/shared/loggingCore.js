'use strict';

const { sanitizeMessage, sanitizeContext } = require('../sanitization');

/**
 * Create enhanced log entry with standardized format
 */
const createEnhancedLogEntry = (level, message, context = {}, requestId = null) => {
  const { LOG_LEVELS } = require('./constants');
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

module.exports = {
  createEnhancedLogEntry,
  stringifyContext,
  safeErrorMessage,
  verboseLog
};