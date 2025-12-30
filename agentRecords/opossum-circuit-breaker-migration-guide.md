# Opossum Circuit Breaker Migration Guide

## Overview

This guide provides step-by-step instructions for migrating from the custom `CircuitBreakerWrapper` implementation to the battle-tested `opossum` npm module, which is already used internally but wrapped with additional complexity.

## Migration Benefits

- **Production Proven**: Used by major enterprises with 1.6M+ downloads/month
- **Battle-Tested**: Extensive real-world usage and edge case handling
- **Better Performance**: Optimized state management and event handling
- **Active Maintenance**: Updated 6 months ago with active issue resolution
- **Apache 2.0 License**: Permissive licensing for enterprise use
- **Zero Dependencies**: No external dependencies that could introduce vulnerabilities
- **Standard API**: Consistent with circuit breaker pattern specifications

## Current Custom Implementation Issues

The current `CircuitBreakerWrapper` in `lib/circuitBreaker.js` has several problems:
- Already imports and uses `opossum` internally
- Adds unnecessary wrapper complexity
- Duplicates functionality already provided by opossum
- Increases bundle size without benefits
- Maintains state that opossum already manages

## Migration Steps

### Step 1: Simplify Direct opossum Usage

**Current Implementation (Unnecessary Wrapper):**
```javascript
// lib/circuitBreaker.js - REMOVE THIS
const CircuitBreaker = require('opossum');
const qerrors = require('./qerrors');

class CircuitBreakerWrapper {
  constructor(operation, serviceName, options) {
    // ... 600+ lines of wrapper code around opossum
    this.breaker = new CircuitBreaker(operation, opossumOptions);
  }
  
  async execute(...args) {
    try {
      return this.breaker.fire(...args);
    } catch (error) {
      qerrors(error, 'circuitBreaker.execute', { ... });
      throw error;
    }
  }
  
  // ... hundreds more lines of duplicate functionality
}
```

**Simplified Implementation:**
```javascript
// lib/circuitBreaker.js - REPLACE WITH THIS
const CircuitBreaker = require('opossum');
const qerrors = require('./qerrors');

function createCircuitBreaker(operation, serviceName, options = {}) {
  const defaults = {
    timeout: 10000,
    errorThreshold: 5,
    resetTimeout: 30000,
    rollingCountTimeout: 60000,
    rollingCountBuckets: 10,
    cacheEnabled: false,
    enabled: true
  };

  const circuitBreaker = new CircuitBreaker(operation, { ...defaults, ...options });
  
  // Add minimal logging wrapper
  const wrappedExecute = async (...args) => {
    try {
      return await circuitBreaker.fire(...args);
    } catch (error) {
      // Keep existing error logging for compatibility
      qerrors(error, 'circuitBreaker.execute', {
        operation: 'circuit_breaker_execution',
        serviceName,
        circuitState: circuitBreaker.opened ? 'OPEN' : 'CLOSED'
      }).catch(() => {}); // Don't let logging fail
      
      throw error;
    }
  };

  // Return enhanced circuit breaker with logging
  return {
    execute: wrappedExecute,
    getState: () => circuitBreaker.opened ? 'OPEN' : 
                  circuitBreaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
    getStats: () => circuitBreaker.stats,
    reset: () => circuitBreaker.close(),
    isOpen: () => circuitBreaker.opened,
    healthCheck: () => ({
      state: getState(),
      isRequestAllowed: !circuitBreaker.opened,
      stats: circuitBreaker.stats
    })
  };
}

module.exports = {
  createCircuitBreaker,
  // Re-export for direct access if needed
  CircuitBreaker
};
```

### Step 2: Update Usage Sites

**Before (Custom Wrapper):**
```javascript
const { CircuitBreakerWrapper } = require('./circuitBreaker');
const breaker = new CircuitBreakerWrapper(
  fetchUserData,
  'UserAPI',
  { failureThreshold: 5, recoveryTimeoutMs: 30000 }
);

try {
  const result = await breaker.execute(userId, options);
} catch (error) {
  if (breaker.getState() === 'OPEN') {
    // Handle circuit open
  }
}
```

**After (Direct opossum):**
```javascript
const { createCircuitBreaker } = require('./circuitBreaker');
const breaker = createCircuitBreaker(
  fetchUserData,
  'UserAPI',
  { failureThreshold: 5, resetTimeout: 30000 }
);

try {
  const result = await breaker.execute(userId, options);
} catch (error) {
  if (breaker.getState() === 'OPEN') {
    // Handle circuit open - same API
  }
}
```

### Step 3: Event Handling Migration

**Custom Event Handling (Remove):**
```javascript
// Remove this complex event setup from wrapper
this.breaker.on('open', () => {
  // ... complex logging and error handling
});
```

**Simplified Event Handling:**
```javascript
const circuitBreaker = new CircuitBreaker(operation, options);

// Keep minimal essential event handling
circuitBreaker.on('open', () => {
  console.log(`[CircuitBreaker] ${serviceName}: transitioning to OPEN`);
});

circuitBreaker.on('halfOpen', () => {
  console.log(`[CircuitBreaker] ${serviceName}: transitioning to HALF_OPEN`);
});

circuitBreaker.on('close', () => {
  console.log(`[CircuitBreaker] ${serviceName}: transitioning to CLOSED`);
});
```

### Step 4: Configuration Mapping

| Custom Option | opossum Equivalent | Notes |
|---------------|-------------------|-------|
| `failureThreshold` | `errorThreshold` | ✅ Direct mapping |
| `recoveryTimeoutMs` | `resetTimeout` | ✅ Direct mapping |
| `timeoutMs` | `timeout` | ✅ Direct mapping |
| `monitoringPeriodMs` | `rollingCountTimeout` | ✅ Direct mapping |
| N/A | `rollingCountBuckets` | opossum default: 10 |
| N/A | `cacheEnabled` | opossum default: false |

### Step 5: Factory Function Simplification

**Before:**
```javascript
// Complex factory with many options processing steps
function createCircuitBreaker(operation, serviceName, overrides = {}) {
  // 50+ lines of option processing
  return new CircuitBreakerWrapper(operation, serviceName, options);
}
```

**After:**
```javascript
// Simplified factory with direct mapping
function createCircuitBreaker(operation, serviceName, overrides = {}) {
  const defaults = {
    timeout: 10000,
    errorThreshold: 5,
    resetTimeout: 30000
  };
  
  return {
    breaker: new CircuitBreaker(operation, { ...defaults, ...overrides }),
    serviceName,
    execute: async (...args) => { /* minimal wrapper */ }
  };
}
```

### Step 6: Testing Migration

```javascript
const { createCircuitBreaker } = require('./circuitBreaker');

// Test 1: Basic functionality
const breaker = createCircuitBreaker(
  async () => 'success',
  'TestService',
  { errorThreshold: 3, timeout: 1000 }
);

// Test 2: Circuit opening
let failureCount = 0;
const failingOperation = async () => {
  if (failureCount++ < 5) {
    throw new Error('Simulated failure');
  }
  return 'success';
};

// Test 3: State transitions
console.log('Initial state:', breaker.getState());
for (let i = 0; i < 5; i++) {
  try {
    await breaker.execute();
  } catch (e) {
    // Expected failures
  }
  console.log(`After failure ${i + 1}:`, breaker.getState());
}

// Test 4: Recovery
setTimeout(async () => {
  try {
    const result = await breaker.execute();
    console.log('Recovery success:', result);
  } catch (e) {
    console.log('Recovery failed:', e);
  }
}, 35000); // After resetTimeout

// Test 5: Statistics
console.log('Final stats:', breaker.getStats());
```

### Step 7: Performance Comparison

```javascript
const { performance } = require('perf_hooks');

function benchmarkImplementation(createBreaker, iterations = 10000) {
  const operation = async () => 'test-result';
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    const breaker = createBreaker(operation, 'BenchmarkService');
    await breaker.execute();
  }
  
  const end = performance.now();
  return end - start;
}

// Compare implementations
async function compareImplementations() {
  const customTime = await benchmarkImplementation((op, name) => {
    const { CircuitBreakerWrapper } = require('./circuitBreaker-legacy');
    return new CircuitBreakerWrapper(op, name);
  });
  
  const opossumTime = await benchmarkImplementation((op, name) => {
    const { createCircuitBreaker } = require('./circuitBreaker');
    return createCircuitBreaker(op, name);
  });
  
  console.log(`Custom: ${customTime.toFixed(2)}ms`);
  console.log(`Opossum: ${opossumTime.toFixed(2)}ms`);
  console.log(`Performance improvement: ${((customTime - opossumTime) / customTime * 100).toFixed(1)}%`);
}

compareImplementations();
```

### Step 8: Gradual Migration Strategy

```javascript
// Feature flag for controlled rollout
const USE_OPOSSUM_DIRECT = process.env.USE_OPOSSUM_DIRECT === 'true';

function createCircuitBreaker(operation, serviceName, options = {}) {
  if (USE_OPOSSUM_DIRECT) {
    // New implementation using direct opossum
    const CircuitBreaker = require('opossum');
    const circuitBreaker = new CircuitBreaker(operation, options);
    
    return {
      execute: async (...args) => circuitBreaker.fire(...args),
      getState: () => circuitBreaker.opened ? 'OPEN' : 'CLOSED',
      getStats: () => circuitBreaker.stats,
      reset: () => circuitBreaker.close()
    };
  } else {
    // Fallback to current implementation
    const { CircuitBreakerWrapper } = require('./circuitBreaker-legacy');
    return new CircuitBreakerWrapper(operation, serviceName, options);
  }
}
```

## Files to Update

### Primary Files:
1. **`lib/circuitBreaker.js`** - Replace entire implementation (reduce from 606 to ~100 lines)
2. **`lib/connectionPool.js`** - Update circuit breaker usage
3. **`lib/aiModelManager.js`** - Update circuit breaker integration
4. **`lib/qerrorsHttpClient.js`** - Update circuit breaker references

### Implementation Changes:

**Complete lib/circuitBreaker.js replacement:**
```javascript
'use strict';

const CircuitBreaker = require('opossum');
const qerrors = require('./qerrors');

function createCircuitBreaker(operation, serviceName, options = {}) {
  const defaults = {
    timeout: 10000,
    errorThreshold: 5,
    resetTimeout: 30000,
    rollingCountTimeout: 60000,
    rollingCountBuckets: 10,
    cacheEnabled: false,
    enabled: true
  };

  const circuitBreaker = new CircuitBreaker(operation, { ...defaults, ...options });
  
  // Essential logging for compatibility
  circuitBreaker.on('open', () => {
    console.log(`[CircuitBreaker] ${serviceName}: transitioning to OPEN`);
  });
  
  circuitBreaker.on('halfOpen', () => {
    console.log(`[CircuitBreaker] ${serviceName}: transitioning to HALF_OPEN`);
  });
  
  circuitBreaker.on('close', () => {
    console.log(`[CircuitBreaker] ${serviceName}: transitioning to CLOSED`);
  });

  return {
    execute: async (...args) => {
      try {
        return await circuitBreaker.fire(...args);
      } catch (error) {
        qerrors(error, 'circuitBreaker.execute', {
          operation: 'circuit_breaker_execution',
          serviceName,
          circuitState: circuitBreaker.opened ? 'OPEN' : 'CLOSED'
        }).catch(() => {});
        throw error;
      }
    },
    getState: () => {
      if (circuitBreaker.opened) return 'OPEN';
      if (circuitBreaker.halfOpen) return 'HALF_OPEN';
      return 'CLOSED';
    },
    getStats: () => circuitBreaker.stats,
    reset: () => circuitBreaker.close(),
    isOpen: () => circuitBreaker.opened,
    healthCheck: () => ({
      state: circuitBreaker.opened ? 'OPEN' : 'CLOSED',
      isRequestAllowed: !circuitBreaker.opened,
      stats: circuitBreaker.stats
    })
  };
}

module.exports = {
  createCircuitBreaker,
  CircuitBreaker
};
```

## Validation Checklist

- [ ] Remove CircuitBreakerWrapper class completely
- [ ] Replace with direct opossum usage
- [ ] Update createCircuitBreaker factory function
- [ ] Maintain existing event logging behavior
- [ ] Update state mapping (OPEN/CLOSED/HALF_OPEN)
- [ ] Test all circuit breaker transitions
- [ ] Verify error handling behavior
- [ ] Run performance benchmarks
- [ ] Update dependent modules
- [ ] Feature flag for gradual rollout

## Rollback Plan

If issues arise during migration:

```javascript
// Emergency fallback to custom implementation
const USE_LEGACY_BREAKER = process.env.USE_LEGACY_BREAKER === 'true';

if (USE_LEGACY_BREAKER) {
  // Load legacy implementation
  module.exports = require('./circuitBreaker-legacy');
}
```

## Monitoring and Metrics

```javascript
// Add migration monitoring
const migrationMetrics = {
  operations: 0,
  failures: 0,
  stateTransitions: { open: 0, close: 0, halfOpen: 0 }
};

const monitoredBreaker = new Proxy(circuitBreaker, {
  get(target, prop) {
    if (prop === 'execute') {
      return async (...args) => {
        migrationMetrics.operations++;
        try {
          const result = await target.execute(...args);
          return result;
        } catch (error) {
          migrationMetrics.failures++;
          throw error;
        }
      };
    }
    // Monitor other methods as needed
    return target[prop];
  }
});
```

## Migration Timeline

- **Phase 1** (Days 1-2): Replace lib/circuitBreaker.js implementation
- **Phase 2** (Days 3-4): Update dependent modules
- **Phase 3** (Days 5-6): Testing and validation
- **Phase 4** (Days 7-8): Performance benchmarking
- **Phase 5** (Days 9-10): Gradual rollout with monitoring

## Support and Documentation

- **Opossum Documentation**: https://github.com/nodeshift/opossum
- **API Reference**: https://nodeshift.github.io/opossum/
- **GitHub Issues**: https://github.com/nodeshift/opossum/issues
- **Community**: Active community with regular releases

This migration eliminates ~500 lines of unnecessary wrapper code while maintaining full functionality and improving performance through direct usage of the battle-tested opossum library.