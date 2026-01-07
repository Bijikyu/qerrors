## Error Handling
### @qerrors/execution-core
**Purpose:** Safe synchronous and asynchronous execution utilities with comprehensive error handling.
**Explanation:**  
This module provides fundamental execution utilities for safe function execution with error isolation, deep cloning capabilities, and Result pattern implementation. It includes both synchronous and asynchronous execution patterns with integrated error handling and performance tracking, making it essential for any application that needs robust error handling without crashing.

Key problems solved:
- Prevents synchronous function errors from crashing applications
- Provides safe deep object cloning with fallback mechanisms
- Implements Result pattern for explicit error handling
- Offers comprehensive async operation execution with timing and logging
- Includes error message formatting with context preservation

```javascript
// Exact current implementation copied from the codebase
const { createUnifiedTimer } = require('./timers');

const safeRun = (name, fn, fallback, info) => {
  try {
    return fn();
  } catch (err) {
    console.error(`${name} failed`, info);
    return fallback;
  }
};

const deepClone = (obj) => {
  try {
    const { cloneDeep } = require('lodash');
    return cloneDeep(obj);
  } catch (error) {
    console.warn('lodash not available, using shallow copy:', error.message);
    return Array.isArray(obj) ? [...obj] : typeof obj === 'object' && obj !== null ? { ...obj } : obj;
  }
};

const attempt = async (fn) => {
  try {
    const value = await Promise.resolve().then(fn);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error };
  }
};

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
    logMessage && (await timerInstance.logPerformance(true, { success: true, ...context }));
    return result;
  } catch (error) {
    const errorContext = { opName, errorCode, errorType, ...context };
    await timerInstance.logPerformance(false, { error: error.message, ...errorContext });
    if (rethrow) {
      error instanceof Error && (error.message = `${failureMessage}: ${error.message}`);
      throw error;
    }
    return fallbackValue;
  }
};

const executeWithQerrors = async (options) => executeWithErrorHandling(options);

const formatErrorMessage = (error, context) => {
  try {
    const { safeErrorMessage } = require('./logging');
    const message = safeErrorMessage(error, 'Unknown error');
    return context ? `[${context}] ${message}` : message;
  } catch (loggingError) {
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
```

### @qerrors/operation-contracts
**Purpose:** Standardized operation interfaces with comprehensive validation and execution.
**Explanation:**  
This module provides standardized contracts and validation for async operations, ensuring consistent behavior across all operation types. It includes comprehensive validation, performance monitoring, error handling, and callback management with a unified execution flow. This is valuable for any application that needs consistent operation execution patterns with built-in monitoring and error handling.

Key problems solved:
- Ensures consistent operation interfaces across codebases
- Provides comprehensive input validation before execution
- Integrates performance monitoring with operation execution
- Standardizes error handling and response formats
- Implements complete operation lifecycle tracking with callbacks

```javascript
// Exact current implementation copied from the codebase
const { LOG_LEVELS } = require('./constants');
const { createUnifiedTimer } = require('./execution');
const { safeLogError, safeLogInfo } = require('./logging');

class OperationContractValidator {
  static validateOperationOptions (options = {}) {
    const errors = [];
    const warnings = [];

    if (!options.operationName || typeof options.operationName !== 'string') {
      errors.push('operationName is required and must be a string');
    }

    if (options.context && typeof options.context !== 'object') {
      errors.push('context must be an object');
    }

    if (options.onSuccess && typeof options.onSuccess !== 'function') {
      errors.push('onSuccess must be a function');
    }

    if (options.onError && typeof options.onError !== 'function') {
      errors.push('onError must be a function');
    }

    if (options.onComplete && typeof options.onComplete !== 'function') {
      errors.push('onComplete must be a function');
    }

    if (options.timeout && (typeof options.timeout !== 'number' || options.timeout <= 0)) {
      errors.push('timeout must be a positive number');
    }

    if (!options.requestId && options.enableLogging !== false) {
      warnings.push('requestId not provided - operation tracking may be incomplete');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      normalizedOptions: this.normalizeOperationOptions(options)
    };
  }

  static normalizeOperationOptions (options = {}) {
    return {
      operationName: options.operationName || 'unnamed_operation',
      requestId: options.requestId || null,
      context: options.context || {},
      enableTiming: options.enableTiming !== false,
      enableLogging: options.enableLogging !== false,
      logLevel: options.logLevel || LOG_LEVELS.INFO,
      timeout: options.timeout || null,
      onSuccess: options.onSuccess || null,
      onError: options.onError || null,
      onComplete: options.onComplete || null,
      metrics: options.metrics || {},
      rethrowErrors: options.rethrowErrors !== false
    };
  }

  static validateErrorOptions (options = {}) {
    const errors = [];

    if (!options.error || !(options.error instanceof Error)) {
      errors.push('error is required and must be an Error instance');
    }

    if (!options.operationName || typeof options.operationName !== 'string') {
      errors.push('operationName is required and must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalizedOptions: this.normalizeErrorOptions(options)
    };
  }

  static normalizeErrorOptions (options = {}) {
    return {
      error: options.error,
      operationName: options.operationName || 'unknown_operation',
      requestId: options.requestId || null,
      context: options.context || {},
      severity: options.severity || LOG_LEVELS.ERROR,
      shouldLog: options.shouldLog !== false,
      shouldRethrow: options.shouldRethrow !== false,
      customHandler: options.customHandler || null,
      response: options.response || null
    };
  }
}

class StandardOperationExecutor {
  static async execute (operation, options = {}) {
    const validation = OperationContractValidator.validateOperationOptions(options);

    if (!validation.isValid) {
      const error = new Error(`Invalid operation options: ${validation.errors.join(', ')}`);
      return this.createErrorResponse(error, validation.normalizedOptions);
    }

    const normalizedOptions = validation.normalizedOptions;
    let timer = null;
    let result = null;

    try {
      if (normalizedOptions.enableTiming) {
        timer = createUnifiedTimer(normalizedOptions.operationName);
      }

      if (normalizedOptions.enableLogging) {
        safeLogInfo(`Starting operation: ${normalizedOptions.operationName}`, {
          requestId: normalizedOptions.requestId,
          operationName: normalizedOptions.operationName,
          context: normalizedOptions.context
        });
      }

      if (normalizedOptions.timeout) {
        result = await this.executeWithTimeout(operation, normalizedOptions.timeout);
      } else {
        result = await operation();
      }

      const response = this.createSuccessResponse(result, normalizedOptions, timer);

      if (normalizedOptions.onSuccess) {
        try {
          await normalizedOptions.onSuccess(response);
        } catch (callbackError) {
          safeLogError('Success callback failed', {
            operationName: normalizedOptions.operationName,
            requestId: normalizedOptions.requestId,
            error: callbackError.message
          });
        }
      }

      if (normalizedOptions.enableLogging) {
        safeLogInfo(`Completed operation: ${normalizedOptions.operationName}`, {
          requestId: normalizedOptions.requestId,
          operationName: normalizedOptions.operationName,
          duration: response.duration,
          success: true
        });
      }

      return response;
    } catch (error) {
      const errorResponse = await this.handleOperationError(error, normalizedOptions, timer);

      if (normalizedOptions.onError) {
        try {
          await normalizedOptions.onError(errorResponse);
        } catch (callbackError) {
          safeLogError('Error callback failed', {
            operationName: normalizedOptions.operationName,
            requestId: normalizedOptions.requestId,
            error: callbackError.message
          });
        }
      }

      return errorResponse;
    } finally {
      if (normalizedOptions.onComplete) {
        try {
          await normalizedOptions.onComplete();
        } catch (callbackError) {
          safeLogError('Completion callback failed', {
            operationName: normalizedOptions.operationName,
            requestId: normalizedOptions.requestId,
            error: callbackError.message
          });
        }
      }
    }
  }

  static async executeWithTimeout (operation, timeout) {
    return Promise.race([
      operation(),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
      )
    ]);
  }

  static createSuccessResponse (result, options, timer = null) {
    return {
      success: true,
      data: result,
      error: null,
      metadata: {
        operationName: options.operationName,
        timestamp: new Date().toISOString(),
        ...options.metrics
      },
      requestId: options.requestId,
      duration: timer ? timer.getDuration() : null,
      context: options.context
    };
  }

  static createErrorResponse (error, options, timer = null) {
    const normalizedOptions = options && typeof options === 'object' ? options : {};
    return {
      success: false,
      data: null,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      },
      metadata: {
        operationName: normalizedOptions.operationName || 'unknown_operation',
        timestamp: new Date().toISOString(),
        ...(normalizedOptions.metrics || {})
      },
      requestId: normalizedOptions.requestId || null,
      duration: timer ? timer.getDuration() : null,
      context: normalizedOptions.context || {}
    };
  }

  static async handleOperationError (error, options, timer = null) {
    if (options.enableLogging) {
      safeLogError(`Operation failed: ${options.operationName}`, {
        requestId: options.requestId,
        operationName: options.operationName,
        error: error.message,
        duration: timer ? timer.getDuration() : null
      });
    }

    const response = this.createErrorResponse(error, options, timer);

    if (options.rethrowErrors) {
      throw error;
    }

    return response;
  }
}

module.exports = {
  StandardOperationExecutor,
  OperationContractValidator,
  StandardOperationOptions: {},
  StandardErrorOptions: {},
  StandardResponse: {},
  StandardLogEntry: {}
};
```