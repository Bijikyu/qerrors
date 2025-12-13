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
    const { safeErrorMessage } = require('./logging');
    await safeLogWithFallback('error', safeErrorMessage(error), console.error, { context, ...metadata });
  } catch {
    const { safeErrorMessage } = require('./logging');
    console.error(`[${context}] ${safeErrorMessage(error)}`, metadata);
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
    const qerrors = require('../qerrors');
    const fn = typeof qerrors?.qerrors === 'function' ? qerrors.qerrors : null;
    if (fn) {
      await fn(error, context, extra);
      return;
    }
  } catch {}
  
  try {
    const { safeErrorMessage } = require('./logging');
    console.error(`[${context}]`, safeErrorMessage(error), extra);
  } catch {}
};

module.exports = {
  safeLogError,
  safeLogInfo,
  safeLogWarn,
  safeLogDebug,
  safeQerrors
};