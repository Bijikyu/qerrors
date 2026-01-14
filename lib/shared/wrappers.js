/**
 * Safe Async Wrapper Utilities
 *
 * Provides wrapper functions to safely execute async operations
 * with error handling, timing, and fallback mechanisms.
 * Prevents cascading failures in critical error handling paths.
 */

const { createUnifiedTimer } = require('./timers');
const { logError } = require('./errorLogger');
const qerrors = require('../qerrors');

/**
 * Creates a safe async wrapper function with error handling and timing
 * @param {Object} options - Wrapper options
 * @param {string} options.modulePath - Module path for error reporting
 * @param {string} options.functionName - Function name for error reporting
 * @param {Function} options.fallbackFn - Fallback function on error
 * @param {boolean} options.silent - Whether to suppress errors
 * @param {string} options.errorMessage - Custom error message
 * @param {Object} options.timer - Timer instance
 * @returns {Function} Safe async wrapper function
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

  return async function safeWrapper (...args) {
    const opName = `${modulePath}.${functionName}`;
    const timerInstance = timer || createUnifiedTimer(opName, false);

    try {
      const module = require(modulePath);
      if (module && functionName) {
        const fn = typeof module[functionName] === 'function' ? module[functionName] : null;
        if (fn) {
          const result = await fn(...args);
          await timerInstance.logPerformance(true, {
            function: functionName,
            args: args.length
          });
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
        if (!silent) {
          console.warn('Fallback function failed:', fallbackError);
        }
      }
    }
  };
};

const createSafeLogger = (functionName, fallbackLevel = 'error') => {
  const fallbackFn = (message, details) => console[fallbackLevel](message, details);

  return createSafeAsyncWrapper({
    modulePath: './qerrors',
    functionName,
    fallbackFn,
    errorMessage: `qerrors.${functionName} unavailable, using console.${fallbackLevel}`
  });
};

const createSafeOperation = (asyncFn, fallbackValue, onError) => {
  return async function safeOperation (...args) {
    const opName = asyncFn.name || 'anonymous';
    const timerInstance = createUnifiedTimer(opName, false);

    try {
      const result = await asyncFn(...args);
      await timerInstance.logPerformance(true, {
        args: args.length
      });
      return result;
    } catch (error) {
      await timerInstance.logPerformance(false, { error: error.message });

      if (onError) {
        onError(error, ...args);
      }

      return fallbackValue;
    }
  };
};

/**
 * Attempt function with result wrapper - safe operation pattern
 */
const attempt = async (fn) => {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (error) {
    try {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logError(errorObj, 'attempt', { operation: 'safe_attempt' });
    } catch (qerror) {
      console.error('Error logging failed in attempt', qerror);
    }
    return { ok: false, error };
  }
};

/**
 * Execute with qerrors and fallback error handling
 */
const executeWithQerrors = async (options) => {
  try {
    return await options.operation();
  } catch (error) {
    console.error(options.failureMessage, error);
    try {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logError(errorObj, 'executeWithQerrors', { operation: 'safe_execute' });
    } catch (qerror) {
      console.error('Error logging failed in executeWithQerrors', qerror);
    }
    throw error;
  }
};

module.exports = {
  createSafeAsyncWrapper,
  createSafeLogger,
  createSafeOperation,
  attempt,
  executeWithQerrors
};
