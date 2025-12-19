'use strict';

/**
 * Generic safe logging helper with fallback pattern
 */
const safeLogWithFallback = async (level, message, fallbackFn, metadata = {}) => {
  try {
    const logger = require('../logger');
    const logMethod = `log${level.charAt(0).toUpperCase() + level.slice(1)}`;
    if (typeof logger?.[logMethod] === 'function') {
      await logger[logMethod](message, metadata);
      return;
    }
  } catch {}
  
  // Fallback to console
  try {
    fallbackFn(message, metadata);
  } catch (fallbackErr) {
    console.error('Fallback logging error:', fallbackErr);
  }
};

/**
 * Safe logging with fallback to console
 */
const safeLogError = async (error, context = {}, metadata = {}) => {
  try {
    const { safeErrorMessage } = require('./logging');
    await safeLogWithFallback('error', safeErrorMessage(error), console.error, { context, ...metadata });
  } catch {
    const { safeErrorMessage } = require('./logging');
    const errorMsg = safeErrorMessage(error);
    const fullMessage = `[${context}] ${errorMsg}`;
    if (metadata && Object.keys(metadata).length > 0) {
      console.error(fullMessage, metadata);
    } else {
      console.error(fullMessage);
    }
  }
};

const safeLogInfo = async (message, metadata = {}) => {
  await safeLogWithFallback('info', message, console.log, metadata);
};

const safeLogWarn = async (message, metadata = {}) => {
  await safeLogWithFallback('warn', message, console.warn, metadata);
};

const safeLogDebug = async (message, metadata = {}) => {
  try {
    const logger = require('../logger');
    const logMethod = `logDebug`;
    if (typeof logger?.[logMethod] === 'function') {
      await logger[logMethod](message, metadata);
      return;
    }
  } catch {}
  
  // Direct fallback for debug to avoid JSON.stringify issues
  const { verboseLog } = require('./logging');
  if (Object.keys(metadata).length > 0) {
    verboseLog(`${message} ${JSON.stringify(metadata)}`);
  } else {
    verboseLog(message);
  }
};

/**
 * Enhanced qerrors wrapper with better error handling
 */
const safeQerrors = async (error, context, extra = {}) => {
  try {
    const { safeErrorMessage } = require('./logging');
    const errorMsg = safeErrorMessage(error);
    const fullMessage = `[${context}] ${errorMsg}`;
    if (extra && Object.keys(extra).length > 0) {
      console.error(fullMessage, extra);
    } else {
      console.error(fullMessage);
    }
  } catch {
    // Ultimate fallback
    console.error(`[${context}]`, error, extra);
  }
};

module.exports = {
  safeLogError,
  safeLogInfo,
  safeLogWarn,
  safeLogDebug,
  safeQerrors
};