/**
 * Standardized Async Operation Patterns
 * 
 * Unified async operation interfaces with consistent timing,
 * error handling, logging, and monitoring contracts.
 *
 * This module defines contracts and utilities that standardize how asynchronous
 * operations are executed throughout the library. By providing a common set of
 * interfaces, we ensure that timing, error handling, logging, and metrics are
 * applied consistently, making the behavior predictable and easier to maintain.
 * The detailed comments throughout the file explain the rationale behind each
 * component, such as why a circuit breaker is integrated or how retry logic is
 * configurable. These explanations help future developers understand the design
 * decisions without having to infer intent from the code alone.
 */

const { StandardOperationExecutor } = require('./contracts');
const { UnifiedErrorHandler } = require('./errorContracts');
const { createUnifiedTimer } = require('./execution');
const localVars = require('../../config/localVars');
const { LOG_LEVELS } = localVars;
const { safeLogError, safeLogInfo, safeLogDebug, safeLogWarn } = require('./logging');

/**
 * Standard async operation configuration
 */
const { DEFAULT_ASYNC_CONFIG } = localVars;

/**
 * Circuit breaker state
 */
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.timeoutMs = options.timeoutMs || 60000;
    this.failureCount = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttemptTime = null;
    this.lastFailureTime = null;
  }

  async execute(operation, options = {}) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(`Circuit breaker OPEN for ${this.name}`);
      } else {
        this.state = 'HALF_OPEN';
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.timeoutMs;
    }
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }
}

/**
 * Retry mechanism with enhanced configuration options
 * 
 * Supports exponential backoff, jitter, max delay caps, and custom
 * retryable error filtering. Compatible with both the legacy API
 * (retryAttempts, retryDelayMs, etc.) and the new preset-style API
 * (maxAttempts, baseDelay, etc.) for flexibility.
 */
class RetryHandler {
  /**
   * Execute operation with retry logic
   * 
   * Features:
   * - Exponential backoff with configurable multiplier
   * - Optional jitter to prevent thundering herd
   * - Maximum delay cap to prevent excessive waits
   * - Custom retryable error filtering
   * - Retry callback for logging/metrics
   * 
   * @param {Function} operation - Operation to execute
   * @param {Object} options - Retry options
   * @param {number} [options.retryAttempts] - Number of retry attempts (legacy)
   * @param {number} [options.maxAttempts] - Number of max attempts (preset style)
   * @param {number} [options.retryDelayMs] - Base delay in ms (legacy)
   * @param {number} [options.baseDelay] - Base delay in ms (preset style)
   * @param {number} [options.retryBackoffMultiplier] - Backoff multiplier (legacy)
   * @param {number} [options.backoffFactor] - Backoff multiplier (preset style)
   * @param {number} [options.retryMaxDelayMs] - Maximum delay cap (legacy)
   * @param {number} [options.maxDelay] - Maximum delay cap (preset style)
   * @param {boolean} [options.jitter] - Whether to add randomness to delay
   * @param {Function} [options.retryableErrors] - Function to determine if error is retryable
   * @param {Function} [options.onRetry] - Callback invoked before each retry
   * @returns {Promise<*>} Operation result
   */
  static async executeWithRetry(operation, options = {}) {
    const {
      retryAttempts = options.maxAttempts ?? DEFAULT_ASYNC_CONFIG.retryAttempts,
      retryDelayMs = options.baseDelay ?? DEFAULT_ASYNC_CONFIG.retryDelayMs,
      retryBackoffMultiplier = options.backoffFactor ?? DEFAULT_ASYNC_CONFIG.retryBackoffMultiplier,
      retryMaxDelayMs = options.maxDelay ?? DEFAULT_ASYNC_CONFIG.retryMaxDelayMs,
      jitter = DEFAULT_ASYNC_CONFIG.retryJitter,
      retryableErrors = null,
      onRetry = null
    } = options;

    let lastError = null;
    let delay = retryDelayMs;

    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < retryAttempts) {
          if (retryableErrors && typeof retryableErrors === 'function') {
            if (!retryableErrors(error)) {
              throw error;
            }
          }
          
          if (onRetry) {
            await onRetry(error, attempt + 1, retryAttempts + 1);
          }
          
          let waitTime = delay;
          if (jitter) {
            const jitterAmount = Math.random() * delay * 0.5;
            waitTime = delay + jitterAmount;
          }
          
          if (retryMaxDelayMs && waitTime > retryMaxDelayMs) {
            waitTime = retryMaxDelayMs;
          }
          
          await this.delay(waitTime);
          delay *= retryBackoffMultiplier;
        }
      }
    }

    throw lastError;
  }

  /**
   * Execute with a preset configuration
   * @param {Function} operation - Operation to execute
   * @param {string} presetName - Name of the preset (network, database, externalAPI, etc.)
   * @param {Object} overrides - Optional overrides for the preset
   * @returns {Promise<*>} Operation result
   */
  static async executeWithPreset(operation, presetName, overrides = {}) {
    const { RetryConfigPresets } = require('../../config/localVars');
    const preset = RetryConfigPresets[presetName];
    if (!preset) {
      throw new Error(`Unknown retry preset: ${presetName}`);
    }
    return this.executeWithRetry(operation, { ...preset, ...overrides });
  }

  /**
   * Delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Decorator that applies retry behavior to class methods
 * 
 * Usage (TypeScript/Babel):
 * @withRetry({ maxAttempts: 3, baseDelay: 1000, jitter: true })
 * async fetchData() { ... }
 * 
 * @param {Object} config - Retry configuration options
 * @returns {Function} Method decorator
 */
const withRetry = (config = {}) => {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;
    descriptor.value = async function(...args) {
      return RetryHandler.executeWithRetry(() => originalMethod.apply(this, args), config);
    };
    return descriptor;
  };
};

/**
 * Functional retry wrapper for non-decorator usage
 * 
 * Usage:
 * const result = await retryOperation(() => fetchData(), { maxAttempts: 3 });
 * 
 * @param {Function} operation - Async operation to retry
 * @param {Object} config - Retry configuration
 * @returns {Promise<*>} Operation result
 */
const retryOperation = async (operation, config = {}) => {
  return RetryHandler.executeWithRetry(operation, config);
};

/**
 * Standardized async operation executor
 */
class StandardAsyncExecutor {
  constructor(name, config = {}) {
    this.name = name;
    this.config = { ...DEFAULT_ASYNC_CONFIG, ...config };
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalDuration: 0,
      averageDuration: 0,
      timeouts: 0,
      retries: 0
    };
    this.circuitBreaker = new CircuitBreaker(name, {
      failureThreshold: this.config.circuitBreakerThreshold,
      timeoutMs: this.config.circuitBreakerTimeoutMs
    });
  }

  /**
   * Execute async operation with full standardization
   * @param {Function} operation - Operation to execute
   * @param {Object} options - Operation options
   * @returns {Promise<StandardResponse>} Standardized response
   */
  async execute(operation, options = {}) {
    const mergedOptions = {
      operationName: this.name,
      enableTiming: this.config.enableTiming,
      enableLogging: this.config.enableLogging,
      enableMetrics: this.config.enableMetrics,
      timeout: this.config.timeoutMs,
      ...options
    };

    // Apply circuit breaker
    const wrappedOperation = () => this.circuitBreaker.execute(operation, mergedOptions);
    
    // Apply retry if enabled
    const operationWithRetry = this.config.retryAttempts > 0 
      ? () => RetryHandler.executeWithRetry(wrappedOperation, {
          retryAttempts: this.config.retryAttempts,
          retryDelayMs: this.config.retryDelayMs,
          retryBackoffMultiplier: this.config.retryBackoffMultiplier,
          onRetry: async (error, attempt, maxAttempts) => {
            this.metrics.retries++;
            if (mergedOptions.enableLogging) {
              safeLogWarn(`Retry attempt ${attempt}/${maxAttempts} for ${this.name}`, {
                operationName: this.name,
                attempt,
                error: error.message,
                requestId: mergedOptions.requestId
              });
            }
          }
        })
      : wrappedOperation;

    // Execute with standard contract
    return StandardOperationExecutor.execute(operationWithRetry, mergedOptions);
  }

  /**
   * Execute operation with timeout
   * @param {Function} operation - Operation to execute
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {Object} options - Additional options
   * @returns {Promise<StandardResponse>} Standardized response
   */
  async executeWithTimeout(operation, timeoutMs, options = {}) {
    return this.execute(operation, {
      ...options,
      timeout: timeoutMs
    });
  }

  /**
   * Execute operation with retry
   * @param {Function} operation - Operation to execute
   * @param {number} attempts - Number of retry attempts
   * @param {Object} options - Additional options
   * @returns {Promise<StandardResponse>} Standardized response
   */
  async executeWithRetry(operation, attempts, options = {}) {
    return this.execute(operation, {
      ...options,
      retryAttempts: attempts
    });
  }

  /**
   * Get executor metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      circuitBreaker: this.circuitBreaker.getState(),
      successRate: this.metrics.totalOperations > 0 
        ? (this.metrics.successfulOperations / this.metrics.totalOperations) * 100 
        : 0
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalDuration: 0,
      averageDuration: 0,
      timeouts: 0,
      retries: 0
    };
  }
}

/**
 * Async operation factory
 */
class AsyncOperationFactory {
  static executors = new Map();

  /**
   * Get or create async executor
   * @param {string} name - Executor name
   * @param {Object} config - Configuration
   * @returns {StandardAsyncExecutor} Executor instance
   */
  static getExecutor(name, config = {}) {
    if (!this.executors.has(name)) {
      this.executors.set(name, new StandardAsyncExecutor(name, config));
    }
    return this.executors.get(name);
  }

  /**
   * Create standardized async operation
   * @param {Function} operation - Operation function
   * @param {Object} options - Operation options
   * @returns {Function} Standardized async operation
   */
  static createOperation(operation, options = {}) {
    const {
      name = 'unnamed_operation',
      config = {},
      ...operationOptions
    } = options;

    const executor = this.getExecutor(name, config);
    
    return async (runtimeOptions = {}) => {
      return executor.execute(operation, {
        ...operationOptions,
        ...runtimeOptions
      });
    };
  }

  /**
   * Create batch async operation
   * @param {Array<Function>} operations - Array of operations
   * @param {Object} options - Batch options
   * @returns {Function} Batch operation function
   */
  static createBatchOperation(operations, options = {}) {
    const {
      name = 'batch_operation',
      concurrency = 'parallel',
      failFast = true,
      ...operationOptions
    } = options;

    const executor = this.getExecutor(name);

    return async (runtimeOptions = {}) => {
      const batchOperation = async () => {
        switch (concurrency) {
          case 'parallel':
            return await this.executeParallel(operations, failFast);
          case 'sequential':
            return await this.executeSequential(operations);
          case 'limited':
            return await this.executeLimited(operations, operationOptions.limit || 3, failFast);
          default:
            return await this.executeParallel(operations, failFast);
        }
      };

      return executor.execute(batchOperation, {
        ...operationOptions,
        ...runtimeOptions
      });
    };
  }

  /**
   * Execute operations in parallel
   * @param {Array<Function>} operations - Operations to execute
   * @param {boolean} failFast - Whether to fail on first error
   * @returns {Promise<Array>} Results array
   */
  static async executeParallel(operations, failFast = true) {
    if (failFast) {
      return Promise.all(operations.map(op => op()));
    } else {
      return Promise.allSettled(operations.map(op => op()));
    }
  }

  /**
   * Execute operations sequentially
   * @param {Array<Function>} operations - Operations to execute
   * @returns {Promise<Array>} Results array
   */
  static async executeSequential(operations) {
    const results = [];
    for (const operation of operations) {
      results.push(await operation());
    }
    return results;
  }

  /**
   * Execute operations with limited concurrency
   * @param {Array<Function>} operations - Operations to execute
   * @param {number} limit - Concurrency limit
   * @param {boolean} failFast - Whether to fail on first error
   * @returns {Promise<Array>} Results array
   */
  static async executeLimited(operations, limit = 3, failFast = true) {
    const results = [];
    let currentIndex = 0;
    
    for (let i = 0; i < operations.length; i += limit) {
      const batch = operations.slice(i, i + limit);
      const batchPromises = batch.map(async (operation) => {
        const result = await operation();
        return { index: i + batch.indexOf(operation), result };
      });
      
      let batchResults;
      if (failFast) {
        batchResults = await Promise.all(batchPromises);
      } else {
        batchResults = await Promise.allSettled(batchPromises);
      }
      
      // Maintain original order
      if (failFast) {
        for (const { index, result } of batchResults) {
          results[index] = result;
        }
      } else {
        for (let j = 0; j < batchResults.length; j++) {
          const settled = batchResults[j];
          const index = i + j;
          if (settled.status === 'fulfilled') {
            results[index] = settled.value.result;
          } else {
            results[index] = settled.reason;
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Get all executor metrics
   * @returns {Object} All metrics
   */
  static getAllMetrics() {
    const metrics = {};
    for (const [name, executor] of this.executors) {
      metrics[name] = executor.getMetrics();
    }
    return metrics;
  }

  /**
   * Reset all metrics
   */
  static resetAllMetrics() {
    for (const executor of this.executors.values()) {
      executor.resetMetrics();
    }
  }
}

/**
 * Express middleware for async route handling
 */
function asyncHandlerMiddleware(options = {}) {
  return (req, res, next) => {
    const { operationName = 'express_route', config = {} } = options;
    
    // Add async execution helpers to request
    req.asyncExecute = (operation, operationOptions = {}) => {
      const executor = AsyncOperationFactory.getExecutor(operationName, config);
      return executor.execute(operation, {
        requestId: req.id || req.headers['x-request-id'],
        context: {
          method: req.method,
          url: req.url,
          userAgent: req.headers['user-agent']
        },
        ...operationOptions
      });
    };
    
    next();
  };
}

module.exports = {
  StandardAsyncExecutor,
  AsyncOperationFactory,
  CircuitBreaker,
  RetryHandler,
  asyncHandlerMiddleware,
  DEFAULT_ASYNC_CONFIG,
  withRetry,
  retryOperation
};