/**
 * Simplified Circuit Breaker using opossum directly
 * 
 * Purpose: Production-ready circuit breaker pattern for external service resilience.
 * Uses opossum library directly without unnecessary wrapper complexity.
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

const CircuitBreaker = require('opossum');
const qerrors = require('./qerrors');

/**
 * Create Circuit Breaker Factory Function
 * 
 * Simplified factory that creates opossum circuit breaker with minimal wrapper
 * while maintaining the same API as the original implementation.
 * 
 * @param {Function} operation - The operation to protect
 * @param {string} serviceName - Name of the service for logging
 * @param {Object} options - Configuration options
 * @returns {Object} Circuit breaker with execute() and getState() methods
 * 
 * @example
 * const breaker = createCircuitBreaker(
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
function createCircuitBreaker(operation, serviceName, options = {}) {
  // Validate options
  if (!options || options.failureThreshold <= 0) {
    throw new Error('failureThreshold must be positive');
  }
  
  if (options.recoveryTimeoutMs <= 0) {
    throw new Error('recoveryTimeoutMs must be positive');
  }

  // Configure opossum options
  const opossumOptions = {
    timeout: options.timeoutMs || 10000,
    errorThreshold: options.failureThreshold,
    resetTimeout: options.recoveryTimeoutMs,
    rollingCountTimeout: options.monitoringPeriodMs || 60000,
    rollingCountBuckets: 10,
    cacheEnabled: false,
    enabled: true
  };

  // Create opossum circuit breaker
  const breaker = new CircuitBreaker(operation, opossumOptions);

  // Setup essential event listeners with minimal complexity
  breaker.on('open', () => {
    try {
      qerrors(null, 'circuitBreaker.open', {
        operation: 'circuit_breaker_state_transition',
        serviceName,
        fromState: 'CLOSED_OR_HALF_OPEN',
        toState: 'OPEN'
      });
    } catch (error) {
      // Don't let logging failures affect circuit breaker
      console.error('Circuit breaker open logging error:', error.message);
    }
    console.log(`[CircuitBreaker] ${serviceName}: transitioning to OPEN`);
  });

  breaker.on('halfOpen', () => {
    try {
      qerrors(null, 'circuitBreaker.halfOpen', {
        operation: 'circuit_breaker_state_transition',
        serviceName,
        fromState: 'OPEN',
        toState: 'HALF_OPEN'
      });
    } catch (error) {
      console.error('Circuit breaker half-open logging error:', error.message);
    }
    console.log(`[CircuitBreaker] ${serviceName}: transitioning to HALF_OPEN`);
  });

  breaker.on('close', () => {
    try {
      qerrors(null, 'circuitBreaker.close', {
        operation: 'circuit_breaker_state_transition',
        serviceName,
        fromState: 'OPEN_OR_HALF_OPEN',
        toState: 'CLOSED'
      });
    } catch (error) {
      console.error('Circuit breaker close logging error:', error.message);
    }
    console.log(`[CircuitBreaker] ${serviceName}: transitioning to CLOSED`);
  });

  // Return enhanced circuit breaker with simplified API
  return {
    /**
     * Execute the protected operation
     * @param {...any} args - Arguments to pass to the operation
     * @returns {Promise} Result of the operation
     */
    async execute(...args) {
      try {
        return await breaker.fire(...args);
      } catch (error) {
        // Enhanced error logging with qerrors
        try {
          qerrors(error, 'circuitBreaker.execute', {
            operation: 'circuit_breaker_execution',
            serviceName,
            circuitState: breaker.opened ? 'OPEN' : 'CLOSED',
            hasArgs: args.length > 0
          });
        } catch (qerror) {
          console.error('qerrors logging failed in circuit breaker execute:', qerror.message);
        }
        throw error;
      }
    },

    /**
     * Get current circuit breaker state
     * @returns {string} Current state ('OPEN', 'CLOSED', or 'HALF_OPEN')
     */
    getState() {
      if (breaker.opened) return 'OPEN';
      if (breaker.halfOpen) return 'HALF_OPEN';
      return 'CLOSED';
    },

    /**
     * Get circuit breaker statistics
     * @returns {Object} Statistics from opossum
     */
    getStats() {
      return breaker.stats;
    },

    /**
     * Reset circuit breaker to CLOSED state
     */
    reset() {
      breaker.close();
    },

    /**
     * Check if circuit breaker is currently open
     * @returns {boolean} True if circuit is open
     */
    isOpen() {
      return breaker.opened;
    },

    /**
     * Get health check information
     * @returns {Object} Health status
     */
    healthCheck() {
      return {
        state: this.getState(),
        isRequestAllowed: !breaker.opened,
        stats: breaker.stats,
        serviceName
      };
    },

    /**
     * Get the underlying opossum circuit breaker (for advanced usage)
     * @returns {CircuitBreaker} The opossum instance
     */
    getBreaker() {
      return breaker;
    }
  };
}

// Legacy CircuitBreakerWrapper class for backward compatibility
class CircuitBreakerWrapper {
  constructor(operation, serviceName, options) {
    // Create circuit breaker using factory function
    this._breaker = createCircuitBreaker(operation, serviceName, options);
    this.serviceName = serviceName;
    this.options = options;
  }

  async execute(...args) {
    return this._breaker.execute(...args);
  }

  getState() {
    return this._breaker.getState();
  }

  getStats() {
    return this._breaker.getStats();
  }

  reset() {
    this._breaker.reset();
  }

  isOpen() {
    return this._breaker.isOpen();
  }

  healthCheck() {
    return this._breaker.healthCheck();
  }
}

module.exports = {
  createCircuitBreaker,
  CircuitBreakerWrapper, // For backward compatibility
  CircuitBreaker // Re-export opossum for direct access
};