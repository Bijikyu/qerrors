## @qerrors/circuit-breaker
**Purpose:** Circuit breaker implementation with configurable thresholds and comprehensive state management.

**Explanation:**  
This module provides a circuit breaker wrapper around the opossum library with enhanced error handling, state transition logging, and failure tracking. It prevents cascade failures by automatically opening circuits when failure thresholds are exceeded, provides configurable recovery timeouts, and integrates with application logging systems. The circuit breaker is broadly applicable to any application that makes external API calls, database queries, or other operations that could fail and should be isolated to prevent system-wide issues.

```js
const CircuitBreaker = require('opossum');
const qerrors = require('./qerrors');

// Import unified error handling to reduce duplicate error patterns
const { logError } = require('./shared/errorWrapper');

/**
 * Create a circuit breaker wrapper around an operation with configurable options
 *
 * @param {Function} operation - The async function to protect with circuit breaker
 * @param {string} serviceName - Name of the service being protected (for logging)
 * @param {Object} options - Circuit breaker configuration options
 * @returns {Object} Object containing execute function and circuit breaker instance
 */
function createCircuitBreaker(operation, serviceName, options = {}) {
  // Validate configuration parameters
  if (!options || options.failureThreshold <= 0) {
    throw new Error('failureThreshold must be positive');
  }
  if (options.recoveryTimeoutMs <= 0) {
    throw new Error('recoveryTimeoutMs must be positive');
  }

  // Configure opossum circuit breaker options
  const opossumOptions = {
    timeout: options.timeoutMs || 10000,
    errorThreshold: options.failureThreshold,
    resetTimeout: options.recoveryTimeoutMs,
    rollingCountTimeout: options.monitoringPeriodMs || 60000,
    rollingCountBuckets: 10,
    cacheEnabled: false,
    enabled: true
  };

  // Create circuit breaker instance
  const breaker = new CircuitBreaker(operation, opossumOptions);

  // Set up event listeners for state transitions
  breaker.on('open', () => {
    try {
      qerrors(null, 'circuitBreaker.open', {
        operation: 'circuit_breaker_state_transition',
        serviceName,
        fromState: 'CLOSED_OR_HALF_OPEN',
        toState: 'OPEN'
      });
    } catch (error) {
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

  // Set up failure event listener
  breaker.on('failure', (result, error) => {
    try {
      qerrors(error, 'circuitBreaker.failure', {
        operation: 'circuit_breaker_failure',
        serviceName,
        hasResult: !!result,
        errorMessage: error?.message
      });
    } catch (qerror) {
      console.error('qerrors logging failed in circuit breaker failure:', qerror.message);
    }
  });

  // Return object with execute method and reference to circuit breaker
  return {
    async execute(...args) {
      try {
        return await breaker.fire(...args);
      } catch (error) {
        try {
          qerrors(error, 'circuitBreaker.execute', {
            operation: 'circuit_breaker_execute',
            serviceName
          });
        } catch (qerror) {
          console.error('qerrors logging failed in circuit breaker execute:', qerror.message);
        }
        throw error;
      }
    }
  }
};
}

module.exports = {
  createCircuitBreaker
};
```