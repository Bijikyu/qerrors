## Security
### @qerrors/safe-string
**Purpose:** Comprehensive input sanitization and XSS prevention utilities.
**Explanation:**  
This module provides essential security utilities for preventing injection attacks, log poisoning, and XSS vulnerabilities. It includes context-aware sanitization for different output contexts (logging, HTML, templates) with fail-safe defaults. The utilities handle various data types and implement defense-in-depth principles, making it valuable for any application that processes user input or generates output.

Key problems solved:
- Log injection attacks via newline character removal
- XSS prevention through HTML escaping
- Buffer overflow prevention via string length limits
- Template injection attacks through safe variable substitution
- Error message sanitization to prevent information disclosure

```javascript
// Exact current implementation copied from the codebase
const escapeHtml = require('escape-html');

function safeString (str, maxLength = 200) {
  if (typeof str !== 'string') {
    str = String(str || '');
  }
  return str.replace(/[\r\n]/g, '').substring(0, maxLength);
}

function sanitizeErrorMessage (error) {
  const message = error && typeof error === 'object' ? error.message : error;
  return safeString(message, 200);
}

function sanitizeContextForLog (context) {
  if (typeof context === 'string') {
    return safeString(context, 200);
  }
  if (typeof context === 'object' && context !== null) {
    try {
      const json = JSON.stringify(context);
      return safeString(json, 500);
    } catch {
      return '[Object]';
    }
  }
  return safeString(String(context), 200);
}

function sanitizeForHtml (value) {
  return escapeHtml(String(value || ''));
}

function safeLogTemplate (template, values) {
  let result = template;
  Object.keys(values).forEach(key => {
    const value = safeString(values[key]);
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  });
  return result;
}

module.exports = {
  safeString,
  sanitizeErrorMessage,
  sanitizeContextForLog,
  sanitizeForHtml,
  safeLogTemplate
};
```

### @qerrors/safe-wrappers
**Purpose:** Defensive programming utilities for safe async operation execution.
**Explanation:**  
This module provides essential defensive programming patterns for executing async operations safely with comprehensive error handling, performance tracking, and fallback mechanisms. It implements the Result pattern for error-safe execution and includes timing integration, making it valuable for any application that needs robust error handling without crashing.

Key problems solved:
- Prevents application crashes from async operation failures
- Provides consistent error handling patterns across codebases
- Integrates performance monitoring with operation execution
- Implements Result pattern for explicit error handling
- Offers fallback mechanisms for graceful degradation

```javascript
// Exact current implementation copied from the codebase
const { createUnifiedTimer } = require('./timers');
const { logError } = require('./errorLogger');

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
```