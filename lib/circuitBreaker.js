/**
 * Circuit Breaker Module - Fault Tolerance and Resilience Management
 * 
 * Purpose: Provides circuit breaker functionality for external service calls,
 * preventing cascade failures and enabling graceful degradation when services
 * become unavailable. This module wraps the opossum circuit breaker library
 * with qerrors integration for comprehensive error tracking and monitoring.
 * 
 * Design Rationale:
 * - Fault tolerance: Prevents cascade failures by stopping calls to failing services
 * - Automatic recovery: Gradually resumes service calls when health is restored
 * - Monitoring integration: Tracks all circuit breaker events through qerrors
 * - Configurable thresholds: Allows tuning for different service characteristics
 * - Graceful degradation: Provides clear error states when services are unavailable
 * 
 * Key Features:
 * - Configurable failure thresholds and recovery timeouts
 * - State transition monitoring (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)
 * - Integration with qerrors for comprehensive error tracking
 * - Safe error handling that never propagates circuit breaker errors
 * - Performance monitoring and metrics collection
 * - Support for async operations with proper error propagation
 */

// Import required dependencies
const CircuitBreaker = require('opossum');
const qerrors = require('./qerrors');

// Import unified error handling to reduce duplicate error patterns
const { logError } = require('./shared/errorWrapper');

/**
 * Create a configured circuit breaker for fault-tolerant operations
 * 
 * This function creates a circuit breaker instance that wraps an operation
 * (typically an external service call) with fault tolerance capabilities.
 * The circuit breaker monitors failure rates and automatically opens to
 * prevent cascade failures when the service becomes unavailable.
 * 
 * Circuit Breaker States:
 * - CLOSED: Normal operation, all calls pass through to the service
 * - OPEN: Service is considered failed, all calls fail immediately
 * - HALF_OPEN: Testing service recovery, limited calls allowed
 * 
 * @param {Function} operation - The async operation to protect (e.g., API call)
 * @param {string} serviceName - Human-readable name for the service (used in logs)
 * @param {Object} options - Configuration options for the circuit breaker
 * @param {number} [options.failureThreshold=5] - Number of failures before opening
 * @param {number} [options.recoveryTimeoutMs=60000] - Time to wait before trying recovery (ms)
 * @param {number} [options.timeoutMs=10000] - Operation timeout before considering failed (ms)
 * @param {number} [options.monitoringPeriodMs=60000] - Time window for failure rate calculation (ms)
 * @returns {Object} Circuit breaker wrapper with execute method
 * @throws {Error} If configuration options are invalid
 * 
 * Example:
 * // Create circuit breaker for external API
 * const apiBreaker = createCircuitBreaker(
 *   async (data) => fetchExternalAPI(data),
 *   'ExternalAPI',
 *   {
 *     failureThreshold: 5,
 *     recoveryTimeoutMs: 30000,
 *     timeoutMs: 5000
 *   }
 * );
 * 
 * // Use the protected operation
 * try {
 *   const result = await apiBreaker.execute(requestData);
 *   console.log('API call succeeded:', result);
 * } catch (error) {
 *   console.error('API call failed or circuit is open:', error.message);
 * }
 */
function createCircuitBreaker(operation, serviceName, options = {}) {
  // Validate configuration options
  if (!options || options.failureThreshold <= 0) {
    throw new Error('failureThreshold must be positive');
  }
  if (options.recoveryTimeoutMs <= 0) {
    throw new Error('recoveryTimeoutMs must be positive');
  }

  // Configure opossum circuit breaker options
  const opossumOptions = {
    timeout: options.timeoutMs || 10000,                    // Operation timeout
    errorThreshold: options.failureThreshold,               // Failure rate threshold
    resetTimeout: options.recoveryTimeoutMs,                // Recovery wait time
    rollingCountTimeout: options.monitoringPeriodMs || 60000, // Monitoring window
    rollingCountBuckets: 10,                                 // Statistical buckets
    cacheEnabled: false,                                    // Disable caching
    enabled: true                                           // Enable circuit breaker
  };

  // Create the circuit breaker instance
  const breaker = new CircuitBreaker(operation, opossumOptions);

  // Set up event handlers for state transitions and failures
  // All events are logged through qerrors for comprehensive monitoring

  /**
   * Handle circuit breaker opening (service considered failed)
   * 
   * This event fires when the failure threshold is exceeded and the circuit
   * breaker transitions to the OPEN state, preventing further calls to the
   * failing service.
   */
  breaker.on('open', () => {
    try {
      // Log state transition through qerrors for monitoring
      qerrors(null, 'circuitBreaker.open', {
        operation: 'circuit_breaker_state_transition',
        serviceName,
        fromState: 'CLOSED_OR_HALF_OPEN',
        toState: 'OPEN'
      });
    } catch (error) {
      console.error('Circuit breaker open logging error:', error.message);
    }
    
    // Console log for immediate visibility during development
    console.log(`[CircuitBreaker] ${serviceName}: transitioning to OPEN`);
  });

  /**
   * Handle circuit breaker half-open (testing service recovery)
   * 
   * This event fires when the recovery timeout expires and the circuit
   * breaker transitions to HALF_OPEN state to test if the service has
   * recovered. Limited calls are allowed in this state.
   */
  breaker.on('halfOpen', () => {
    try {
      // Log state transition through qerrors for monitoring
      qerrors(null, 'circuitBreaker.halfOpen', {
        operation: 'circuit_breaker_state_transition',
        serviceName,
        fromState: 'OPEN',
        toState: 'HALF_OPEN'
      });
    } catch (error) {
      console.error('Circuit breaker half-open logging error:', error.message);
    }
    
    // Console log for immediate visibility during development
    console.log(`[CircuitBreaker] ${serviceName}: transitioning to HALF_OPEN`);
  });

  /**
   * Handle circuit breaker closing (service recovered)
   * 
   * This event fires when the circuit breaker determines that the service
   * has recovered and transitions back to the CLOSED state, allowing normal
   * operation to resume.
   */
  breaker.on('close', () => {
    try {
      // Log state transition through qerrors for monitoring
      qerrors(null, 'circuitBreaker.close', {
        operation: 'circuit_breaker_state_transition',
        serviceName,
        fromState: 'OPEN_OR_HALF_OPEN',
        toState: 'CLOSED'
      });
    } catch (error) {
      console.error('Circuit breaker close logging error:', error.message);
    }
    
    // Console log for immediate visibility during development
    console.log(`[CircuitBreaker] ${serviceName}: transitioning to CLOSED`);
  });

  /**
   * Handle operation failures (individual call failures)
   * 
   * This event fires each time an individual operation fails, contributing
   * to the failure rate calculation that may trigger circuit opening.
   */
  breaker.on('failure', (result, error) => {
    try {
      // Log individual failures through qerrors for monitoring
      qerrors(error, 'circuitBreaker.failure', {
        operation: 'circuit_breaker_failure',
        serviceName,
        hasResult: !!result,
        errorMessage: error?.message
      });
    } catch (qerror) {
      // Ensure qerrors logging failures don't break the circuit breaker
      console.error('qerrors logging failed in circuit breaker failure:', qerror.message);
    }
  });

  /**
   * Return the circuit breaker wrapper interface
   * 
   * This provides a clean interface for executing operations through the
   * circuit breaker while hiding the underlying opossum implementation.
   */
  return {
    /**
     * Execute the protected operation through the circuit breaker
     * 
     * This method executes the wrapped operation with circuit breaker
     * protection. If the circuit is open, it will fail immediately.
     * If the circuit is closed or half-open, it will attempt the operation
     * and track the result for failure rate calculation.
     * 
     * @param {...*} args - Arguments to pass to the wrapped operation
     * @returns {Promise<*>} Result of the operation if successful
     * @throws {Error} If operation fails or circuit is open
     */
    async execute(...args) {
      try {
        // Execute the operation through the circuit breaker
        return await breaker.fire(...args);
      } catch (error) {
        try {
          // Log execution failures through qerrors for monitoring
          qerrors(error, 'circuitBreaker.execute', {
            operation: 'circuit_breaker_execution',
            serviceName,
            circuitState: breaker.state,
            hasArgs: args.length > 0
          });
        } catch (qerror) {
          // Ensure qerrors logging failures don't break error propagation
          console.error('qerrors logging failed in circuit breaker execute:', qerror.message);
        }
        
        // Re-throw the error for proper error handling by callers
        throw error;
      }
    },

    /**
     * Get current circuit breaker state for monitoring
     * 
     * @returns {string} Current state ('CLOSED', 'OPEN', or 'HALF_OPEN')
     */
    getState() {
      return breaker.state;
    },

    /**
     * Get circuit breaker statistics for monitoring
     * 
     * @returns {Object} Statistics including failure rate, fire count, etc.
     */
    getStats() {
      return breaker.stats;
    },

    /**
     * Force the circuit breaker into a specific state (for testing)
     * 
     * @param {string} state - State to force ('open', 'close', 'halfOpen')
     */
    forceState(state) {
      if (state === 'open') {
        breaker.open();
      } else if (state === 'close') {
        breaker.close();
      } else if (state === 'halfOpen') {
        breaker.halfOpen();
      } else {
        throw new Error(`Invalid state: ${state}. Must be 'open', 'close', or 'halfOpen'`);
      }
    }
  };
}

// Export the circuit breaker factory function
module.exports = {
  createCircuitBreaker
};