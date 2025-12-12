'use strict';

const { safeLogError } = require('./logging');

/**
 * Safe execution wrapper with fallback
 */
const safeRun = (name, fn, fallback, info) => {
  try {
    return fn();
  } catch (err) {
    console.error(`${name} failed`, info);
    return fallback;
  }
};

/**
 * Deep clone utility using lodash
 */
const deepClone = (obj) => {
  const { cloneDeep } = require('lodash');
  return cloneDeep(obj);
};

/**
 * Create high-resolution timer
 */
const createTimer = () => {
  const startTime = process.hrtime.bigint();
  
  return {
    elapsed: () => Number(process.hrtime.bigint() - startTime) / 1000000,
    elapsedFormatted: () => {
      const ms = this.elapsed();
      return ms < 1000 ? `${ms.toFixed(2)}ms` : 
             ms < 60000 ? `${(ms / 1000).toFixed(2)}s` : 
             `${(ms / 60000).toFixed(2)}m`;
    }
  };
};

/**
 * Attempt operation and return result object
 */
const attempt = async (fn) => {
  try {
    const value = await Promise.resolve().then(fn);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error };
  }
};

/**
 * Execute operation with qerrors integration
 */
const executeWithQerrors = async (options) => {
  const { 
    opName, 
    operation, 
    context = {}, 
    failureMessage, 
    errorCode, 
    errorType, 
    logMessage, 
    rethrow = true, 
    fallbackValue 
  } = options;
  
  try {
    return await operation();
  } catch (error) {
    const errorContext = { opName, errorCode, errorType, ...context };
    await safeLogError(error, logMessage || failureMessage, errorContext);
    
    if (rethrow) {
      if (error instanceof Error) {
        error.message = `${failureMessage}: ${error.message}`;
      }
      throw error;
    }
    
    return fallbackValue;
  }
};

/**
 * Format error message with context
 */
const formatErrorMessage = (error, context) => {
  try {
    const { safeErrorMessage } = require('./logging');
    const message = safeErrorMessage(error, 'Unknown error');
    return context ? `[${context}] ${message}` : message;
  } catch {
    // Fallback if logging module unavailable
    const message = error instanceof Error ? error.message : String(error);
    return context ? `[${context}] ${message}` : message;
  }
};

/**
 * Create safe async wrapper for external module calls
 */
const createSafeAsyncWrapper = (options) => {
  const { 
    modulePath = './qerrors', 
    functionName = '', 
    fallbackFn, 
    silent = true, 
    errorMessage 
  } = options;
  
  return async function safeWrapper(...args) {
    try {
      const module = require(modulePath);
      if (module && functionName) {
        const fn = typeof module[functionName] === 'function' ? module[functionName] : null;
        if (fn) return await fn(...args);
      }
    } catch (error) {
      if (!silent) {
        const msg = errorMessage || `Failed to call ${functionName} from ${modulePath}`;
        console.warn(msg, error);
      }
    }
    
    if (fallbackFn) {
      try {
        return await fallbackFn(...args);
      } catch (fallbackError) {
        if (!silent) console.warn('Fallback function failed:', fallbackError);
      }
    }
  };
};

/**
 * Create safe logger wrapper
 */
const createSafeLogger = (functionName, fallbackLevel = 'error') => {
  const fallbackFn = (message, details) => console[fallbackLevel](message, details);
  
  return createSafeAsyncWrapper({
    modulePath: './qerrors',
    functionName,
    fallbackFn,
    errorMessage: `qerrors.${functionName} unavailable, using console.${fallbackLevel}`
  });
};

/**
 * Create safe operation wrapper with error handling
 */
const createSafeOperation = (asyncFn, fallbackValue, onError) => {
  return async function safeOperation(...args) {
    try {
      return await asyncFn(...args);
    } catch (error) {
      onError && onError(error, ...args);
      return fallbackValue;
    }
  };
};

/**
 * Safe qerrors wrapper
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
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${context}]`, message, extra);
  } catch {}
};

module.exports = {
  safeRun,
  deepClone,
  createTimer,
  attempt,
  executeWithQerrors,
  formatErrorMessage,
  createSafeAsyncWrapper,
  createSafeLogger,
  createSafeOperation,
  safeQerrors
};