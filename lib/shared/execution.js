'use strict';

/**
 * Unified performance timer implementation
 */
const createUnifiedTimer = (operation, includeMemoryTracking = false, requestId = null) => {
  const startTime = process.hrtime.bigint();
  const startMemory = includeMemoryTracking ? process.memoryUsage() : null;
  
  return {
    elapsed: () => Number(process.hrtime.bigint() - startTime) / 1000000,
    
    elapsedFormatted: () => {
      const ms = Number(process.hrtime.bigint() - startTime) / 1000000;
      return ms < 1000 ? `${ms.toFixed(2)}ms` : 
             ms < 60000 ? `${(ms / 1000).toFixed(2)}s` : 
             `${(ms / 60000).toFixed(2)}m`;
    },
    
    // Performance logging method
    logPerformance: async (success = true, additionalContext = {}) => {
      const endTime = process.hrtime.bigint();
      const endMemory = includeMemoryTracking ? process.memoryUsage() : null;
      const duration = Number(endTime - startTime) / 1000000;
      
      const context = {
        operation,
        duration_ms: Math.round(duration * 100) / 100,
        success,
        ...additionalContext
      };
      
      if (includeMemoryTracking && startMemory && endMemory) {
        context.memory_delta = {
          heapUsed: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024),
          external: Math.round((endMemory.external - startMemory.external) / 1024)
        };
      }
      
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
    }
  };
};

// Backward compatibility aliases
const createTimer = () => createUnifiedTimer('operation', false);
const createPerformanceTimer = (operation, requestId = null) => createUnifiedTimer(operation, true, requestId);

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

/**
 * Create safe async wrapper with standardized error handling
 */
const createSafeAsyncWrapper = (options) => {
  const { 
    modulePath = './qerrors', 
    functionName = '', 
    fallbackFn, 
    silent = true, 
    errorMessage,
    timer = null
  } = options;
  
  return async function safeWrapper(...args) {
    const opName = `${modulePath}.${functionName}`;
    const timerInstance = timer || createUnifiedTimer(opName, false);
    
    try {
      const module = require(modulePath);
      if (module && functionName) {
        const fn = typeof module[functionName] === 'function' ? module[functionName] : null;
        if (fn) {
          const result = await fn(...args);
          await timerInstance.logPerformance(true, { function: functionName, args: args.length });
          return result;
        }
      }
    } catch (error) {
      await timerInstance.logPerformance(false, { error: error.message, function: functionName });
      
      if (!silent) {
        const msg = errorMessage || `Failed to call ${functionName} from ${modulePath}`;
        console.warn(msg, error);
      }
    }
    
    if (fallbackFn) {
      try {
        const fallbackResult = await fallbackFn(...args);
        return fallbackResult;
      } catch (fallbackError) {
        if (!silent) console.warn('Fallback function failed:', fallbackError);
      }
    }
  };
};

/**
 * Create safe logger wrapper with unified error handling
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
 * Create safe operation wrapper with integrated timing
 */
const createSafeOperation = (asyncFn, fallbackValue, onError) => {
  return async function safeOperation(...args) {
    const opName = asyncFn.name || 'anonymous';
    const timerInstance = createUnifiedTimer(opName, false);
    
    try {
      const result = await asyncFn(...args);
      await timerInstance.logPerformance(true, { args: args.length });
      return result;
    } catch (error) {
      await timerInstance.logPerformance(false, { error: error.message });
      onError && onError(error, ...args);
      return fallbackValue;
    }
  };
};

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
  // Timer functions
  createUnifiedTimer,
  createTimer,
  createPerformanceTimer,
  
  // Execution utilities
  safeRun,
  deepClone,
  attempt,
  executeWithErrorHandling,
  executeWithQerrors,
  formatErrorMessage,
  
  // Wrapper creators
  createSafeAsyncWrapper,
  createSafeLogger,
  createSafeOperation,
  
  // Safe logging functions
  safeLogError,
  safeLogInfo,
  safeLogWarn,
  safeLogDebug,
  
  // Error handling
  safeQerrors
};