/**
 * External Service Circuit Breaker
 * 
 * Purpose: Production-ready circuit breaker pattern for external service resilience.
 * Protects applications from cascading failures when external services become unavailable or slow.
 * 
 * Features:
 * - Configurable failure thresholds
 * - Automatic state transitions (CLOSED -> OPEN -> HALF_OPEN)
 * - Timeout protection for operations
 * - Detailed metrics collection
 * - Automatic recovery attempts
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit tripped, requests fail fast
 * - HALF_OPEN: Testing if service recovered
 */

const CircuitState = { //(circuit breaker states)
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

/**
 * Circuit Breaker Class
 * 
 * @example
 * const breaker = new CircuitBreaker(
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
class CircuitBreaker {
  /**
   * @param {Function} operation - Async operation to protect
   * @param {string} serviceName - Name of the service for logging
   * @param {Object} options - Circuit breaker options
   * @param {number} options.failureThreshold - Number of failures before opening circuit
   * @param {number} options.recoveryTimeoutMs - Time before attempting recovery
   * @param {number} options.monitoringPeriodMs - Monitoring window for metrics
   * @param {number} [options.timeoutMs] - Optional timeout for operations
   */
  constructor(operation, serviceName, options) {
    if (!options || options.failureThreshold <= 0) {
      throw new Error('failureThreshold must be positive');
    }
    if (options.recoveryTimeoutMs <= 0) {
      throw new Error('recoveryTimeoutMs must be positive');
    }
    
    this.operation = operation; //(the protected operation)
    this.serviceName = serviceName; //(for logging)
    this.options = options; //(configuration)
    
    this.state = CircuitState.CLOSED; //(start closed)
    this.failureCount = 0;
    this.lastFailureTime = 0;
    
    this.metrics = { //(service metrics)
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastFailureTime: null
    };
  }

  /**
   * Execute operation with circuit breaker protection
   * @param {...any} args - Arguments to pass to the operation
   * @returns {Promise<any>} Operation result
   * @throws {Error} If circuit is open or operation fails
   */
  async execute(...args) { //execute with circuit breaker protection
    const startTime = Date.now();
    this.metrics.totalRequests++;
    
    try {
      if (this.state === CircuitState.OPEN) { //(check if circuit is open)
        if (this._shouldAttemptReset()) {
          this.state = CircuitState.HALF_OPEN;
          console.log(`[CircuitBreaker] ${this.serviceName}: transitioning to HALF_OPEN`);
        } else {
          throw new Error(`Circuit breaker is OPEN for ${this.serviceName}`);
        }
      }
      
      const result = await this._executeWithTimeout(...args); //(execute with optional timeout)
      
      this._recordSuccess(startTime); //(record success metrics)
      return result;
    } catch (error) {
      this._recordFailure(startTime, error); //(record failure metrics)
      throw error;
    }
  }

  /**
   * Execute operation with timeout protection
   * @private
   */
  async _executeWithTimeout(...args) { //execute with timeout wrapper
    if (!this.options.timeoutMs) {
      return this.operation(...args); //(no timeout, direct execution)
    }
    
    return Promise.race([
      this.operation(...args),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timeout after ${this.options.timeoutMs}ms`)), this.options.timeoutMs)
      )
    ]);
  }

  /**
   * Record successful operation
   * @private
   */
  _recordSuccess(startTime) { //record success metrics
    const responseTime = Date.now() - startTime;
    this.metrics.successfulRequests++;
    
    this.metrics.averageResponseTime = //(running average)
      (this.metrics.averageResponseTime * (this.metrics.successfulRequests - 1) + responseTime) / 
      this.metrics.successfulRequests;
    
    if (this.state === CircuitState.HALF_OPEN) { //(close circuit on success in half-open)
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      console.log(`[CircuitBreaker] ${this.serviceName}: transitioning to CLOSED`);
    }
  }

  /**
   * Record failed operation
   * @private
   */
  _recordFailure(startTime, error) { //record failure metrics
    this.metrics.failedRequests++;
    this.metrics.lastFailureTime = startTime;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    try { //(attempt to log with qerrors, but don't fail if unavailable)
      const utils = require('./utils');
      utils.logError(error, `CircuitBreaker-${this.serviceName}`, {
        state: this.state,
        failureCount: this.failureCount,
        responseTime: Date.now() - startTime
      });
    } catch { //(silent fallback)
    }
    
    if (this.failureCount >= this.options.failureThreshold && this.state === CircuitState.CLOSED) {
      this.state = CircuitState.OPEN; //(open circuit on threshold)
      console.warn(`[CircuitBreaker] ${this.serviceName}: transitioning to OPEN after ${this.failureCount} failures`);
    }
    
    if (this.state === CircuitState.HALF_OPEN) { //(re-open on half-open failure)
      this.state = CircuitState.OPEN;
      console.warn(`[CircuitBreaker] ${this.serviceName}: returning to OPEN after half-open failure`);
    }
  }

  /**
   * Check if circuit should attempt reset
   * @private
   */
  _shouldAttemptReset() { //check recovery timeout
    return Date.now() - this.lastFailureTime > this.options.recoveryTimeoutMs;
  }

  /**
   * Get current circuit state
   * @returns {string} Current state (CLOSED, OPEN, or HALF_OPEN)
   */
  getState() { //get current state
    return this.state;
  }

  /**
   * Get service metrics
   * @returns {Object} Copy of current metrics
   */
  getMetrics() { //get metrics copy
    return { ...this.metrics };
  }

  /**
   * Get success rate (0-1)
   * @returns {number} Success rate
   */
  getSuccessRate() { //calculate success rate
    return this.metrics.totalRequests > 0 
      ? this.metrics.successfulRequests / this.metrics.totalRequests 
      : 1;
  }

  /**
   * Get failure rate (0-1)
   * @returns {number} Failure rate
   */
  getFailureRate() { //calculate failure rate
    return this.metrics.totalRequests > 0 
      ? this.metrics.failedRequests / this.metrics.totalRequests 
      : 0;
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset() { //manual reset
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    console.log(`[CircuitBreaker] ${this.serviceName}: manually reset to CLOSED`);
  }

  /**
   * Force circuit open (useful for maintenance)
   */
  forceOpen() { //manual open
    this.state = CircuitState.OPEN;
    this.lastFailureTime = Date.now();
    console.log(`[CircuitBreaker] ${this.serviceName}: manually forced to OPEN`);
  }
}

/**
 * Create a circuit breaker with common defaults
 * @param {Function} operation - Async operation to protect
 * @param {string} serviceName - Name of the service
 * @param {Object} [overrides] - Override default options
 * @returns {CircuitBreaker} Configured circuit breaker
 */
function createCircuitBreaker(operation, serviceName, overrides = {}) { //factory with defaults
  const defaults = {
    failureThreshold: 5,
    recoveryTimeoutMs: 30000,
    monitoringPeriodMs: 60000,
    timeoutMs: 10000
  };
  
  return new CircuitBreaker(operation, serviceName, { ...defaults, ...overrides });
}

module.exports = {
  CircuitBreaker, //(main class)
  CircuitState, //(state enum)
  createCircuitBreaker //(factory with defaults)
};
