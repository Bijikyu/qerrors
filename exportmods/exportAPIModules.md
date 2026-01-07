## @qerrors/retry-strategy
**Purpose:** Comprehensive retry logic with configurable backoff algorithms, jitter implementation, and circuit breaker integration.

**Explanation:**  
This module provides unified retry strategy implementation with configurable backoff algorithms (exponential, linear, fixed, adaptive), built-in jitter to prevent thundering herd problems, provider-specific retry header handling, circuit breaker integration for resilience, and comprehensive logging and monitoring. It standardizes retry behavior across all modules and handles various failure scenarios intelligently. The retry strategy is broadly applicable to any application that makes external API calls, database queries, or other operations that may fail transiently and benefit from automatic retry with exponential backoff.

```js
/**
 * Unified Retry Strategy Implementation
 *
 * Purpose: Provides comprehensive retry logic with configurable backoff algorithms,
 * jitter implementation, circuit breaker integration, and provider-specific retry
 * header handling. This utility standardizes retry behavior across all modules.
 *
 * Design Rationale:
 * - Configurable backoff algorithms (exponential, linear, fixed)
 * - Standardized retry condition evaluation
 * - Built-in jitter to prevent thundering herd problems
 * - Provider-specific retry header handling
 * - Circuit breaker integration for resilience
 * - Comprehensive logging and monitoring
 *
 * Backoff Algorithms:
 * - EXPONENTIAL: base * 2^attempt with jitter
 * - LINEAR: base * attempt with jitter
 * - FIXED: constant delay with jitter
 * - ADAPTIVE: provider-guided based on retry-after headers
 */

const { safeLogInfo, safeLogWarn, safeLogError } = require('./safeLogging');

/**
 * Retry strategy configuration constants
 */
const RETRY_DEFAULTS = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 60000, // 1 minute
  jitterFactor: 0.1, // 10% jitter
  backoffAlgorithm: 'EXPONENTIAL',
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000 // 1 minute
};

/**
 * Supported backoff algorithms
 */
const BACKOFF_ALGORITHMS = {
  EXPONENTIAL: 'EXPONENTIAL',
  LINEAR: 'LINEAR',
  FIXED: 'FIXED',
  ADAPTIVE: 'ADAPTIVE'
};

/**
 * Retry Strategy Class
 *
 * Implements configurable retry logic with multiple backoff algorithms,
 * jitter, and circuit breaker integration.
 */
class RetryStrategy {
  constructor (options = {}) {
    this.config = { ...RETRY_DEFAULTS, ...options };
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.circuitBreakerOpen = false;
    this.circuitBreakerOpenTime = null;
  }

  /**
   * Calculate delay for next retry attempt
   *
   * @param {number} attempt - Current attempt number (0-based)
   * @param {Object} context - Retry context with provider-specific info
   * @returns {number} Delay in milliseconds
   */
  calculateDelay (attempt, context = {}) {
    // Check circuit breaker state
    if (this.isCircuitBreakerOpen()) {
      return this.config.circuitBreakerTimeout;
    }

    // Handle provider-specific retry headers first (highest priority)
    const providerDelay = this.getProviderSpecifiedDelay(context);
    if (providerDelay > 0) {
      return Math.min(providerDelay, this.config.maxDelay);
    }

    // Calculate base delay based on algorithm
    let baseDelay;
    switch (this.config.backoffAlgorithm) {
    case BACKOFF_ALGORITHMS.LINEAR:
      baseDelay = this.config.baseDelay * (attempt + 1);
      break;

    case BACKOFF_ALGORITHMS.FIXED:
      baseDelay = this.config.baseDelay;
      break;

    case BACKOFF_ALGORITHMS.ADAPTIVE:
      // Start with exponential, but adapt based on success/failure patterns
      baseDelay = this.config.baseDelay * Math.pow(2, attempt);
      if (this.failureCount > 3) {
        baseDelay *= 1.5; // Increase delay for repeated failures
      }
      break;

    case BACKOFF_ALGORITHMS.EXPONENTIAL:
    default:
      baseDelay = this.config.baseDelay * Math.pow(2, attempt);
      break;
    }

    // Add jitter to prevent thundering herd
    const jitter = baseDelay * this.config.jitterFactor * Math.random();
    const totalDelay = baseDelay + jitter;

    // Apply maximum delay cap
    return Math.min(totalDelay, this.config.maxDelay);
  }

  /**
   * Extract provider-specified delay from retry headers
   *
   * @param {Object} context - Retry context with HTTP response info
   * @returns {number} Provider-specified delay in milliseconds, or 0 if none
   */
  getProviderSpecifiedDelay (context) {
    const response = context.response;
    if (!response || !response.headers) {
      return 0;
    }

    // Priority 1: Check for custom retry-after-ms header (OpenAI style)
    const retryAfterMs = response.headers['retry-after-ms'];
    if (retryAfterMs) {
      const ms = Number(retryAfterMs);
      if (!Number.isNaN(ms) && ms > 0) {
        safeLogInfo('Using provider-specified retry-after-ms delay', { delay: ms });
        return ms;
      }
    }

    // Priority 2: Check for standard HTTP retry-after header
    const retryAfter = response.headers['retry-after'];
    if (retryAfter) {
      // Handle numeric retry-after (seconds)
      const secs = Number(retryAfter);
      if (!Number.isNaN(secs)) {
        const delayMs = secs * 1000;
        safeLogInfo('Using standard retry-after delay', { delay: delayMs });
        return delayMs;
      }

      // Handle HTTP-date format retry-after
      const date = Date.parse(retryAfter);
      if (!Number.isNaN(date)) {
        const delayMs = date - Date.now();
        if (delayMs > 0) {
          safeLogInfo('Using HTTP-date retry-after delay', { delay: delayMs });
          return delayMs;
        } else {
          // Date is in the past, ignore it
          safeLogInfo('Ignoring past retry-after date', {
            retryAfterDate: new Date(date),
            now: new Date(),
            delayMs
          });
        }
      }
    }

    // Priority 3: Check for rate limit reset time header
    const resetTime = response.headers['x-rate-limit-reset'];
    if (resetTime) {
      const resetTimestamp = Number(resetTime);
      if (!Number.isNaN(resetTimestamp)) {
        const delayMs = (resetTimestamp * 1000) - Date.now();
        if (delayMs > 0) {
          const clampedDelay = Math.min(delayMs, this.config.maxDelay);
          safeLogInfo('Using rate limit reset time delay', {
            delay: clampedDelay,
            originalDelay: delayMs,
            resetTimestamp
          });
          return clampedDelay;
        } else {
          // Reset time is in the past, ignore it
          safeLogInfo('Ignoring past rate limit reset time', {
            resetTime: new Date(resetTimestamp * 1000),
            now: new Date(),
            delayMs
          });
        }
      }
    }

    return 0;
  }

  /**
   * Check if circuit breaker is currently open
   *
   * @returns {boolean} True if circuit breaker is open
   */
  isCircuitBreakerOpen () {
    if (!this.config.enableCircuitBreaker) {
      return false;
    }

    if (!this.circuitBreakerOpen) {
      return false;
    }

    // Check if circuit breaker timeout has elapsed
    const timeSinceOpen = Date.now() - this.circuitBreakerOpenTime;
    if (timeSinceOpen >= this.config.circuitBreakerTimeout) {
      this.circuitBreakerOpen = false;
      this.circuitBreakerOpenTime = null;
      this.failureCount = 0;
      safeLogInfo('Circuit breaker reset after timeout', {
        timeout: this.config.circuitBreakerTimeout,
        timeSinceOpen
      });
      return false;
    }

    return true;
  }

  /**
   * Record a failure and potentially open circuit breaker
   *
   * @param {Error} error - The error that occurred
   * @param {Object} context - Context information
   */
  recordFailure (error, context = {}) {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // Check if we should open the circuit breaker
    if (this.config.enableCircuitBreaker &&
        this.failureCount >= this.config.circuitBreakerThreshold &&
        !this.circuitBreakerOpen) {
      this.circuitBreakerOpen = true;
      this.circuitBreakerOpenTime = Date.now();

      safeLogWarn('Circuit breaker opened due to repeated failures', {
        failureCount: this.failureCount,
        threshold: this.config.circuitBreakerThreshold,
        lastError: error.message,
        context
      });
    }
  }

  /**
   * Record a success and reset failure count
   */
  recordSuccess () {
    if (this.failureCount > 0) {
      safeLogInfo('Retry success recorded, resetting failure count', {
        previousFailures: this.failureCount
      });
    }

    this.failureCount = 0;
    this.lastFailureTime = null;
  }

  /**
   * Check if a retry should be attempted based on error and attempt count
   *
   * @param {Error} error - The error that occurred
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {boolean} True if retry should be attempted
   */
  shouldRetry (error, attempt) {
    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      safeLogWarn('Circuit breaker is open, skipping retry', {
        attempt,
        failureCount: this.failureCount
      });
      return false;
    }

    // Check max retries
    if (attempt >= this.config.maxRetries) {
      safeLogInfo('Max retries exceeded, giving up', {
        attempt,
        maxRetries: this.config.maxRetries
      });
      return false;
    }

    // Check if error is retryable
    return this.isRetryableError(error);
  }

  /**
   * Determine if an error is suitable for retry
   *
   * @param {Error} error - The error to evaluate
   * @returns {boolean} True if error is retryable
   */
  isRetryableError (error) {
    // Guard against null/undefined errors
    if (!error) {
      return false;
    }

    // Network errors are typically retryable
    if (error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ENETUNREACH' ||
        error.code === 'EAI_AGAIN') {
      return true;
    }

    // HTTP status codes that should be retried
    if (error && error.response) {
      const status = error.response.status;

      // Retry on 5xx server errors (except 501 Not Implemented)
      if (status >= 500 && status !== 501) {
        return true;
      }

      // Retry on 429 Too Many Requests and 503 Service Unavailable
      if (status === 429 || status === 503) {
        return true;
      }

      // Retry on 408 Request Timeout
      if (status === 408) {
        return true;
      }
    }

    // Do not retry on client errors (4xx except those specified above)
    return false;
  }

  /**
   * Execute an operation with retry logic
   *
   * @param {Function} operation - Async function to execute
   * @param {Object} context - Operation context for logging
   * @returns {Promise} Operation result
   */
  async execute (operation, context = {}) {
    let lastError;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await operation();

        // Record success on first successful attempt
        if (attempt > 0) {
          this.recordSuccess();
          safeLogInfo('Operation succeeded after retry', {
            attempt,
            totalAttempts: attempt + 1,
            context
          });
        }

        return result;
      } catch (error) {
        lastError = error;

        // Record failure
        this.recordFailure(error, { ...context, attempt });

        // Check if we should retry
        if (!this.shouldRetry(error, attempt)) {
          break;
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempt, {
          response: error.response,
          error
        });

        safeLogWarn('Operation failed, retrying after delay', {
          attempt,
          nextAttempt: attempt + 1,
          maxRetries: this.config.maxRetries,
          delay,
          errorMessage: error.message,
          errorCode: error.code,
          httpStatus: error.response?.status
        });

        // Wait before retry
        await this.sleep(delay);
      }
    }

    // All retries exhausted, throw last error
    safeLogError('Operation failed after all retries', {
      totalAttempts: this.config.maxRetries + 1,
      finalError: lastError.message,
      context
    });

    throw lastError;
  }

  /**
   * Sleep for specified milliseconds
   *
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current retry statistics
   *
   * @returns {Object} Current retry statistics
   */
  getStats () {
    return {
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      circuitBreakerOpen: this.circuitBreakerOpen,
      circuitBreakerOpenTime: this.circuitBreakerOpenTime,
      config: this.config
    };
  }

  /**
   * Reset the retry strategy (clear failure count and circuit breaker)
   */
  reset () {
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.circuitBreakerOpen = false;
    this.circuitBreakerOpenTime = null;

    safeLogInfo('Retry strategy reset');
  }
}

/**
 * Convenience function to create a retry strategy
 *
 * @param {Object} options - Configuration options
 * @returns {RetryStrategy} Configured retry strategy instance
 */
function createRetryStrategy (options = {}) {
  return new RetryStrategy(options);
}

/**
 * Convenience function to execute an operation with default retry strategy
 *
 * @param {Function} operation - Async function to execute
 * @param {Object} options - Retry configuration options
 * @param {Object} context - Operation context
 * @returns {Promise} Operation result
 */
async function executeWithRetry (operation, options = {}, context = {}) {
  const strategy = createRetryStrategy(options);
  return strategy.execute(operation, context);
}

module.exports = {
  RetryStrategy,
  createRetryStrategy,
  executeWithRetry,
  RETRY_DEFAULTS,
  BACKOFF_ALGORITHMS
};
```