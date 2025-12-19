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
   * Setup opossum event listeners for logging and monitoring
   * @private
   */
  _setupEventListeners() {
    this.breaker.on('open', () => console.log(`[CircuitBreaker] ${this.serviceName}: transitioning to OPEN`));
    this.breaker.on('halfOpen', () => console.log(`[CircuitBreaker] ${this.serviceName}: transitioning to HALF_OPEN`));
    this.breaker.on('close', () => console.log(`[CircuitBreaker] ${this.serviceName}: transitioning to CLOSED`));
    this.breaker.on('failure', (result, error) => {
      try {
        const utils = require('./utils');
        utils.logError(error, `CircuitBreaker-${this.serviceName}`, { state: this.getState(), result });
      } catch {
        // Ignore logging errors
      }
    });
    this.breaker.on('success', (result) => {
      // Success handling - currently empty
    });
    this.breaker.on('timeout', () => console.warn(`[CircuitBreaker] ${this.serviceName}: operation timeout`));
  }

  /**
   * Initialize metrics tracking
   * @private
   */
  _initializeMetrics(){this.metrics={totalRequests:0,successfulRequests:0,failedRequests:0,averageResponseTime:0,lastFailureTime:null};this.breaker.on('fire',()=>this.metrics.totalRequests++);this.breaker.on('success',()=>{this.metrics.successfulRequests++;this._updateAverageResponseTime();});this.breaker.on('failure',()=>{this.metrics.failedRequests++;this.metrics.lastFailureTime=Date.now();this._updateAverageResponseTime();});}

  /**
   * Update average response time
   * @private
   */
  _updateAverageResponseTime(){const stats=this.breaker.stats;if(stats.total>0)this.metrics.averageResponseTime=(this.metrics.averageResponseTime*(this.metrics.totalRequests-1)+100)/this.metrics.totalRequests;}

  /**
   * Execute operation with circuit breaker protection
   * @param {...any} args - Arguments to pass to the operation
   * @returns {Promise<any>} Operation result
   * @throws {Error} If circuit is open or operation fails
   */
async execute(...args){return this.breaker.fire(...args);}getState(){if(this.breaker.opened)return'OPEN';else if(this.breaker.halfOpen)return'HALF_OPEN';else return'CLOSED';}

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
   * Get service metrics
   * @returns {Object} Copy of current metrics
   */
  getMetrics(){const opossumStats=this.breaker.stats;return{...this.metrics,opossumStats:{total:opossumStats.total,successful:opossumStats.successful,failed:opossumStats.failed,timeouts:opossumStats.timeouts,circuitOpen:opossumStats.circuitOpen,averageResponseTime:opossumStats.averageResponseTime}};}

  /**
   * Get success rate (0-1)
   * @returns {number} Success rate
   */
getSuccessRate(){const stats=this.breaker.stats;return stats.total>0?stats.successful/stats.total:1;}getFailureRate(){const stats=this.breaker.stats;return stats.total>0?stats.failed/stats.total:0;}

  /**
   * Get failure rate (0-1)
   * @returns {number} Failure rate
   */
  getFailureRate() {
    const stats = this.breaker.stats;
    return stats.total > 0 ? stats.failed / stats.total : 0;
  }

  /**
   * Reset circuit breaker to closed state
   */
reset(){this.breaker.close();console.log(`[CircuitBreaker] ${this.serviceName}: manually reset to CLOSED`);}forceOpen(){this.breaker.open();console.log(`[CircuitBreaker] ${this.serviceName}: manually forced to OPEN`);}isRequestAllowed(){return!this.breaker.opened;}

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
   * Get detailed circuit breaker statistics
   * @returns {Object} Comprehensive statistics
   */
getStats(){return this.breaker.stats;}isOpen(){return this.breaker.opened;}healthCheck(){return{state:this.getState(),isRequestAllowed:this.isRequestAllowed(),isOpen:this.isOpen(),stats:this.getStats(),metrics:this.getMetrics()};}

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
 * Create a circuit breaker with common defaults
 * @param {Function} operation - Async operation to protect
 * @param {string} serviceName - Name of the service
 * @param {Object} [overrides] - Override default options
 * @returns {CircuitBreakerWrapper} Configured circuit breaker
 */
function createCircuitBreaker(operation,serviceName,overrides={}){const defaults={failureThreshold:5,recoveryTimeoutMs:30000,monitoringPeriodMs:60000,timeoutMs:10000};return new CircuitBreakerWrapper(operation,serviceName,{...defaults,...overrides});}

const localVars = require('../config/localVars');
const { CircuitState } = localVars;

module.exports={CircuitBreakerWrapper,CircuitState,createCircuitBreaker};