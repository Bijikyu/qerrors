'use strict';

const { createUnifiedTimer } = require('./timers');

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
 * Execute operation with integrated error handling and logging
 */
const executeWithErrorHandling = async (options) => {
  const { 
    opName, 
    operation, 
    context = {}, 
    failureMessage, 
    errorCode, 
    errorType, 
    logMessage, 
    rethrow = true, 
    fallbackValue,
    timer = null
  } = options;
  
  const timerInstance = timer || createUnifiedTimer(opName, false);
  
  try {
    const result = await operation();
    
    // Log successful operation
    if (logMessage) {
      await timerInstance.logPerformance(true, { success: true, ...context });
    }
    
    return result;
  } catch (error) {
    const errorContext = { opName, errorCode, errorType, ...context };
    
    // Log failed operation
    await timerInstance.logPerformance(false, { error: error.message, ...errorContext });
    
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
 * Legacy executeWithQerrors for backward compatibility
 */
const executeWithQerrors = async (options) => {
  return executeWithErrorHandling(options);
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

module.exports = {
  safeRun,
  deepClone,
  attempt,
  executeWithErrorHandling,
  executeWithQerrors,
  formatErrorMessage
};