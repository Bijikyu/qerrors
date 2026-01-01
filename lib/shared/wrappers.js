/**
 * Safe Async Wrapper Utilities
 */
const { createUnifiedTimer } = require('./timers');

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
  return async function safeOperation(...args) {
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

module.exports = {
  createSafeAsyncWrapper,
  createSafeLogger,
  createSafeOperation
};