/**
 * External Service Circuit Breaker using Opossum
 * 
 * Purpose: Production-ready circuit breaker pattern for external service resilience.
 * Uses opossum library for battle-tested circuit breaker functionality while maintaining
 * the same API as the original custom implementation.
 * 
 * Features:
 * - Configurable failure thresholds
 * - Automatic state transitions (CLOSED -> OPEN -> HALF_OPEN)
 * - Timeout protection for operations
 * - Detailed metrics collection
 * - Automatic recovery attempts
 * - Event emission for monitoring
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit tripped, requests fail fast
 * - HALF_OPEN: Checking if service recovered
 */

const CircuitBreaker=require('opossum');

/**
 * Circuit Breaker Class - Wrapper around opossum
 * 
 * Maintains the same API as the original custom implementation while leveraging
 * opossum's battle-tested circuit breaker functionality.
 * 
 * @example
 * const breaker = new CircuitBreakerWrapper(
 *   () => fetch('https://api.example.com/data'),
 *   'ExampleAPI',
 *   { failureThreshold: 5, recoveryTimeoutMs: 30000, monitoringPeriodMs: 60000 }
 * );
 * 
 * try {
 *   const result = await breaker.execute();
 * } catch (err) {
 *   if (breaker.getState() === 'OPEN') {
 *     // Service is unavailable, use fallback
 *   }
 * }
 */
class CircuitBreakerWrapper {
  constructor(operation, serviceName, options) {
    if (!options || options.failureThreshold <= 0) {
      throw new Error('failureThreshold must be positive');
    }
    if (options.recoveryTimeoutMs <= 0) {
      throw new Error('recoveryTimeoutMs must be positive');
    }
    
    this.operation = operation;
    this.serviceName = serviceName;
    this.options = options;
    
    const opossumOptions = {
      timeout: options.timeoutMs || 10000,
      errorThreshold: options.failureThreshold,
      resetTimeout: options.recoveryTimeoutMs,
      rollingCountTimeout: options.monitoringPeriodMs || 60000,
      rollingCountBuckets: 10,
      cacheEnabled: false,
      enabled: true
    };
    
    this.breaker = new CircuitBreaker(operation, opossumOptions);
    this._setupEventListeners();
    this._initializeMetrics();
  }

/**
 * Setup opossum event listeners for logging and monitoring with non-blocking I/O
 * @private
 */
_setupEventListeners() {
  this.breaker.on('open', () => {
    setImmediate(() => console.log(`[CircuitBreaker] ${this.serviceName}: transitioning to OPEN`));
  });
  this.breaker.on('halfOpen', () => {
    setImmediate(() => console.log(`[CircuitBreaker] ${this.serviceName}: transitioning to HALF_OPEN`));
  });
  this.breaker.on('close', () => {
    setImmediate(() => console.log(`[CircuitBreaker] ${this.serviceName}: transitioning to CLOSED`));
  });
  this.breaker.on('failure', (result, error) => {
    setImmediate(() => {
      try {
        const utils = require('./utils');
        utils.logError(error, `CircuitBreaker-${this.serviceName}`, { state: this.getState(), result });
      } catch {
        // Ignore logging errors
      }
    });
  });
  this.breaker.on('success', (result) => {
    setImmediate(() => {
      // Track success metrics for adaptive circuit breaking
      this._trackSuccess(result);
    });
  });
  this.breaker.on('timeout', () => {
    setImmediate(() => console.warn(`[CircuitBreaker] ${this.serviceName}: operation timeout`));
  });
}

/**
 * Initialize metrics tracking for circuit breaker monitoring
 * 
 * This method sets up comprehensive metrics collection to track circuit
 * breaker performance, including request counts, success/failure rates,
 * response times, and failure timestamps. These metrics are essential
 * for monitoring service health and making informed decisions about
 * circuit breaker configuration.
 * 
 * @private
 */
_initializeMetrics() {
  // Initialize metrics object with default values
  this.metrics = {
    totalRequests: 0,           // Total number of requests attempted
    successfulRequests: 0,     // Number of successful requests
    failedRequests: 0,          // Number of failed requests
    averageResponseTime: 0,    // Calculated average response time
    lastFailureTime: null       // Timestamp of last failure (ms since epoch)
  };
  
  // Set up event listeners to track metrics
  this.breaker.on('fire', () => {
    // Increment total requests for every operation attempt
    this.metrics.totalRequests++;
  });
  
  this.breaker.on('success', () => {
    // Track successful requests and update response time metrics
    this.metrics.successfulRequests++;
    this._updateAverageResponseTime();
  });
  
  this.breaker.on('failure', () => {
    // Track failed requests and record failure timestamp
    this.metrics.failedRequests++;
    this.metrics.lastFailureTime = Date.now();
    this._updateAverageResponseTime();
  });
}

/**
 * Update average response time calculation with actual timing
 * 
 * This method calculates and updates the average response time for
 * all requests processed through the circuit breaker. It uses a
 * running average algorithm that updates the average with each
 * new request to provide real-time performance metrics.
 * 
 * Enhanced to track actual response times for adaptive circuit breaking
 * 
 * @private
 */
_updateAverageResponseTime() {
  const stats = this.breaker.stats;
  
  if (stats.total > 0) {
    // Use actual average response time from opossum stats
    this.metrics.averageResponseTime = stats.averageResponseTime || 0;
  }
}

/**
 * Track success metrics for adaptive circuit breaking
 * 
 * This method tracks successful operations and can be used for
 * adaptive circuit breaking logic that adjusts thresholds based
 * on observed performance patterns.
 * 
 * @private
 */
_trackSuccess(result) {
  // Track success patterns for adaptive adjustments
  const now = Date.now();
  if (!this.metrics.lastSuccessTime) {
    this.metrics.lastSuccessTime = now;
  }
  
  // Could implement adaptive logic here, such as:
  // - Adjusting failure thresholds based on success patterns
  // - Modifying timeout values based on response times
  // - Dynamic recovery timeout adjustments
}

/**
 * Execute the protected operation with circuit breaker safety
 * 
 * This method executes the wrapped operation through the circuit breaker,
 * which will either allow the request to proceed or fail fast depending
 * on the current circuit state. All operation failures and timeouts are
 * automatically tracked and used to determine circuit state transitions.
 * 
 * @param {...any} args - Arguments to pass to the protected operation
 * @returns {Promise<any>} Promise that resolves with operation result
 * @throws {Error} If circuit is open (CircuitBreakerError) or operation fails
 * 
 * Example:
 * try {
 *   const result = await breaker.execute(userId, options);
 *   console.log('Operation succeeded:', result);
 * } catch (error) {
 *   if (breaker.getState() === 'OPEN') {
 *     console.log('Service unavailable, using fallback');
 *     return fallbackData;
 *   }
 *   throw error; // Re-throw other errors
 * }
 */
async execute(...args) {
  return this.breaker.fire(...args);
}

  /**
   * Get current circuit state
   * @returns {string} Current state (CLOSED, OPEN, or HALF_OPEN)
   */
  getState() {
    // Map opossum opened property to our expected states
    if (this.breaker.opened) {
      return 'OPEN';
    } else if (this.breaker.halfOpen) {
      return 'HALF_OPEN';
    } else {
      return 'CLOSED';
    }
  }

/**
 * Get comprehensive service metrics including custom and opossum stats
 * 
 * This method returns a complete view of circuit breaker performance metrics,
 * combining both the custom metrics tracked by this wrapper and the native
 * opossum statistics. This provides a comprehensive view for monitoring,
 * alerting, and performance analysis.
 * 
 * @returns {Object} Complete metrics object with custom and opossum statistics
 * @returns {number} returns.totalRequests - Total requests attempted
 * @returns {number} returns.successfulRequests - Successful request count
 * @returns {number} returns.failedRequests - Failed request count
 * @returns {number} returns.averageResponseTime - Average response time (ms)
 * @returns {number|null} returns.lastFailureTime - Timestamp of last failure
 * @returns {Object} returns.opossumStats - Native opossum statistics
 * 
 * Example:
 * const metrics = breaker.getMetrics();
 * console.log(`Success rate: ${metrics.successfulRequests}/${metrics.totalRequests}`);
 * console.log(`Average response time: ${metrics.averageResponseTime}ms`);
 */
getMetrics() {
  const opossumStats = this.breaker.stats;
  
  return {
    // Custom metrics tracked by this wrapper
    ...this.metrics,
    
    // Native opossum statistics for additional insights
    opossumStats: {
      total: opossumStats.total,
      successful: opossumStats.successful,
      failed: opossumStats.failed,
      timeouts: opossumStats.timeouts,
      circuitOpen: opossumStats.circuitOpen,
      averageResponseTime: opossumStats.averageResponseTime
    }
  };
}

/**
 * Calculate success rate as a decimal between 0 and 1
 * 
 * This method returns the ratio of successful requests to total requests.
 * A success rate of 1.0 indicates 100% success, while 0.0 indicates 0% success.
 * When no requests have been made, it returns 1.0 to indicate perfect success
 * by default (no failures yet).
 * 
 * @returns {number} Success rate as decimal (0.0 to 1.0)
 * 
 * Example:
 * const successRate = breaker.getSuccessRate();
 * if (successRate < 0.95) {
 *   console.warn('Service success rate below 95%:', successRate);
 * }
 */
getSuccessRate() {
  const stats = this.breaker.stats;
  return stats.total > 0 ? stats.successful / stats.total : 1;
}

  /**
   * Get failure rate (0-1)
   * @returns {number} Failure rate
   */
  getFailureRate() {
    const stats = this.breaker.stats;
    return stats.total > 0 ? stats.failed / stats.total : 0;
  }

/**
 * Manually reset the circuit breaker to closed state
 * 
 * This method allows manual intervention to reset the circuit breaker
 * back to its normal operating state. This is useful for recovery
 * procedures, testing, or when you know the underlying service
 * has been restored and want to immediately resume normal operations.
 * 
 * Usage:
 * - After manual service recovery
 * - During testing procedures
 * - When automated recovery is too slow
 * 
 * Example:
 * if (service.isHealthy()) {
 *   breaker.reset(); // Immediately resume operations
 * }
 */
reset() {
  this.breaker.close();
  console.log(`[CircuitBreaker] ${this.serviceName}: manually reset to CLOSED`);
}

  /**
   * Force circuit open (useful for maintenance)
   */
  forceOpen() {
    this.breaker.open();
    console.log(`[CircuitBreaker] ${this.serviceName}: manually forced to OPEN`);
  }

  /**
   * Check if the circuit is currently allowing requests
   * @returns {boolean} True if requests are allowed
   */
  isRequestAllowed() {
    return !this.breaker.opened;
  }

/**
 * Get detailed circuit breaker statistics from opossum
 * 
 * This method returns the native statistics object from the underlying
 * opossum circuit breaker. These statistics provide detailed insights
 * into circuit breaker behavior and are useful for advanced monitoring
 * and analysis.
 * 
 * @returns {Object} Native opossum statistics object
 * 
 * Example:
 * const stats = breaker.getStats();
 * console.log('Circuit breaker health:', {
 *   total: stats.total,
 *   successful: stats.successful,
 *   failed: stats.failed,
 *   successRate: stats.successful / stats.total
 * });
 */
getStats() {
  return this.breaker.stats;
}

  /**
   * Check if circuit is open
   * @returns {boolean} True if circuit is open
   */
  isOpen() {
    return this.breaker.opened;
  }

  /**
   * Get health status
   * @returns {Object} Health information
   */
  healthCheck() {
    return {
      state: this.getState(),
      isRequestAllowed: this.isRequestAllowed(),
      isOpen: this.isOpen(),
      stats: this.getStats(),
      metrics: this.getMetrics()
    };
  }
}

/**
 * Factory function to create circuit breaker with sensible defaults
 * 
 * This function provides a convenient way to create circuit breakers
 * with production-ready default configurations while allowing
 * customization through overrides. The defaults are chosen to work
 * well for most external service integrations.
 * 
 * Default Configuration:
 * - failureThreshold: 5 - Open circuit after 5 consecutive failures
 * - recoveryTimeoutMs: 30000 - Wait 30 seconds before attempting recovery
 * - monitoringPeriodMs: 60000 - Monitor failures over 60-second windows
 * - timeoutMs: 10000 - Fail operations after 10 seconds
 * 
 * @param {Function} operation - Async operation function to protect
 * @param {string} serviceName - Descriptive name for the protected service
 * @param {Object} [overrides={}] - Configuration options to override defaults
 * @param {number} [overrides.failureThreshold] - Number of failures before opening
 * @param {number} [overrides.recoveryTimeoutMs] - Milliseconds to wait before recovery
 * @param {number} [overrides.monitoringPeriodMs] - Time window for failure counting
 * @param {number} [overrides.timeoutMs] - Operation timeout in milliseconds
 * @returns {CircuitBreakerWrapper} Configured circuit breaker instance
 * 
 * Example:
 * // Create with defaults
 * const apiBreaker = createCircuitBreaker(
 *   fetchUserData,
 *   'UserAPI'
 * );
 * 
 * // Create with custom configuration
 * const dbBreaker = createCircuitBreaker(
 *   queryDatabase,
 *   'Database',
 *   {
 *     failureThreshold: 3,        // More sensitive to failures
 *     recoveryTimeoutMs: 60000,  // Longer recovery time
 *     timeoutMs: 5000            // Shorter timeout
 *   }
 * );
 */
function createCircuitBreaker(operation, serviceName, overrides = {}) {
  // Production-ready default configuration
  const defaults = {
    failureThreshold: 5,        // Open after 5 consecutive failures
    recoveryTimeoutMs: 30000,   // Wait 30 seconds before recovery attempts
    monitoringPeriodMs: 60000,  // Monitor over 1-minute windows
    timeoutMs: 10000            // 10-second operation timeout
  };
  
  // Merge defaults with provided overrides
  const options = { ...defaults, ...overrides };
  
  return new CircuitBreakerWrapper(operation, serviceName, options);
}

const localVars = require('../config/localVars');
const { CircuitState } = localVars;

module.exports={CircuitBreakerWrapper,CircuitState,createCircuitBreaker};