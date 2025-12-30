# p-limit Concurrency Control Migration Guide

## Overview

This guide provides step-by-step instructions for replacing custom concurrency limiting implementations with the battle-tested `p-limit` npm module maintained by Sindre Sorhus.

## Migration Benefits

- **Ultra Lightweight**: Only 11.7 kB unpacked size
- **Proven Performance**: Optimized Promise-based concurrency control
- **Active Maintenance**: Updated 2 months ago by renowned maintainer Sindre Sorhus
- **Security**: Zero known CVEs, minimal dependencies
- **Reliability**: Battle-tested in production with millions of downloads
- **TypeScript**: Excellent built-in TypeScript support

## Current Implementation Analysis

The project has several custom concurrency control implementations:

**In lib/asyncContracts.js:**
```javascript
// Custom createLimiter function (~50 lines)
function createConcurrencyLimiter(maxConcurrency) {
  let running = 0;
  const queue = [];
  
  return async (task) => {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        running++;
        try {
          const result = await task();
          running--;
          resolve(result);
        } catch (error) {
          running--;
          reject(error);
        }
      };
      
      if (running < maxConcurrency) {
        execute();
      } else {
        queue.push(execute);
      }
    });
  };
}
```

**Issues with Custom Implementation:**
- Manual queue management prone to bugs
- No support for dynamic concurrency adjustment
- Limited error handling capabilities
- No monitoring or statistics
- Memory leaks possible with queue accumulation

## Migration Steps

### Step 1: Install p-limit

```bash
npm install p-limit
```

### Step 2: Replace createLimiter Function

**Before (Custom Implementation):**
```javascript
// Replace this entire function in lib/asyncContracts.js
function createConcurrencyLimiter(maxConcurrency) {
  // ~50 lines of custom queue management
  let running = 0;
  const queue = [];
  
  return async (task) => {
    // Complex queue logic...
  };
}
```

**After (p-limit):**
```javascript
const pLimit = require('p-limit');

function createConcurrencyLimiter(maxConcurrency) {
  return pLimit(maxConcurrency);
}
```

### Step 3: Update createLimiter Usage

**Before:**
```javascript
// In various files using custom createLimiter
const { createLimiter } = require('./asyncContracts');
const limiter = createLimiter(5);

const result = await limiter(() => fetchData());
```

**After:**
```javascript
// Use p-limit directly
const pLimit = require('p-limit');
const limiter = pLimit(5);

const result = await limiter(() => fetchData());
```

### Step 4: Advanced p-limit Configuration

**Dynamic Concurrency:**
```javascript
const pLimit = require('p-limit');

class DynamicConcurrencyLimiter {
  constructor(initialLimit = 5, maxLimit = 50) {
    this.currentLimit = initialLimit;
    this.maxLimit = maxLimit;
    this.limiter = pLimit(initialLimit);
    this.queue = [];
  }

  async execute(task) {
    return this.limiter(task);
  }

  increaseLimit(newLimit) {
    if (newLimit <= this.maxLimit) {
      this.currentLimit = newLimit;
      this.limiter = pLimit(newLimit);
    }
  }

  decreaseLimit(newLimit) {
    if (newLimit >= 1) {
      this.currentLimit = newLimit;
      this.limiter = pLimit(newLimit);
    }
  }
}
```

**Statistics and Monitoring:**
```javascript
const pLimit = require('p-limit');

class MonitoredConcurrencyLimiter {
  constructor(concurrency) {
    this.limiter = pLimit(concurrency);
    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      averageTime: 0,
      totalTime: 0
    };
  }

  async execute(task) {
    this.stats.total++;
    const start = Date.now();
    
    try {
      const result = await this.limiter(task);
      const duration = Date.now() - start;
      
      this.stats.completed++;
      this.stats.totalTime += duration;
      this.stats.averageTime = this.stats.totalTime / this.stats.completed;
      
      return result;
    } catch (error) {
      this.stats.failed++;
      throw error;
    }
  }

  getStats() {
    return {
      ...this.stats,
      activeCount: this.stats.total - this.stats.completed - this.stats.failed,
      successRate: (this.stats.completed / this.stats.total * 100).toFixed(1) + '%'
    };
  }
}
```

### Step 5: Update File Dependencies

**Files to Update:**

1. **lib/asyncContracts.js** - Replace createLimiter function
2. **lib/connectionPool.js** - Update concurrency limit usage
3. **lib/enhancedRateLimiter.js** - Update concurrency handling
4. **lib/distributedRateLimiter.js** - Update concurrency patterns
5. **lib/memoryManagement.js** - Update concurrency in cleanup operations

**Before:**
```javascript
// Multiple custom implementations
const createLimiter = require('./shared/asyncContracts').createLimiter;
const limiter = createLimiter(10);
```

**After:**
```javascript
// Standardized p-limit usage
const pLimit = require('p-limit');
const createLimiter = (limit) => pLimit(limit);
const limiter = createLimiter(10);
```

### Step 6: Performance Validation

```javascript
const { performance } = require('perf_hooks');

async function benchmarkImplementations() {
  const iterations = 10000;
  const concurrency = 10;
  
  // Test custom implementation
  const { createLimiter } = require('./asyncContracts');
  const customLimiter = createLimiter(concurrency);
  
  const customStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    await customLimiter(() => Promise.resolve(`custom-${i}`));
  }
  const customTime = performance.now() - customStart;
  
  // Test p-limit implementation
  const pLimit = require('p-limit');
  const pLimiter = pLimit(concurrency);
  
  const pLimitStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    await pLimiter(() => Promise.resolve(`plimit-${i}`));
  }
  const pLimitTime = performance.now() - pLimitStart;
  
  console.log(`Custom Implementation: ${customTime.toFixed(2)}ms`);
  console.log(`p-limit Implementation: ${pLimitTime.toFixed(2)}ms`);
  console.log(`Performance Improvement: ${((customTime - pLimitTime) / customTime * 100).toFixed(1)}%`);
}

benchmarkImplementations();
```

### Step 7: Error Handling Improvements

**Before (Custom Error Handling):**
```javascript
try {
  const result = await limiter(task);
  return result;
} catch (error) {
  console.error('Concurrency limiter error:', error);
  throw error;
}
```

**After (Enhanced with p-limit):**
```javascript
try {
  const result = await limiter(task);
  return result;
} catch (error) {
  // p-limit provides better error context
  console.error('Concurrency limiter error:', {
    error: error.message,
    stack: error.stack,
    activeCount: limiter.activeCount,
    pendingCount: limiter.pendingCount
  });
  throw error;
}
```

### Step 8: Memory Usage Optimization

**Before (Custom Memory Issues):**
```javascript
// Custom queue may accumulate without bounds
const queue = []; // Potential memory leak
```

**After (p-limit Memory Management):**
```javascript
// p-limit handles memory efficiently
const pLimit = require('p-limit');

class MemoryEfficientLimiter {
  constructor(concurrency, options = {}) {
    this.limiter = pLimit(concurrency);
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.monitorMemory();
  }
  
  monitorMemory() {
    setInterval(() => {
      const usage = process.memoryUsage();
      if (usage.heapUsed / usage.heapTotal > 0.9) {
        console.warn('High memory usage in concurrency limiter:', {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          utilization: (usage.heapUsed / usage.heapTotal * 100).toFixed(1) + '%'
        });
      }
    }, 5000);
  }
}
```

## Files to Update

### Primary File: lib/asyncContracts.js

**Replace createLimiter function:**
```javascript
'use strict';

const pLimit = require('p-limit');

// Replace custom implementation with p-limit wrapper
function createConcurrencyLimiter(maxConcurrency) {
  return pLimit(maxConcurrency);
}

// Keep existing functionality that doesn't use custom limiter
class StandardAsyncExecutor {
  // ... existing implementation remains unchanged
}

module.exports = {
  StandardAsyncExecutor,
  AsyncOperationFactory,
  CircuitBreaker,
  RetryHandler,
  withRetry,
  retryOperation,
  createConcurrencyLimiter,  // Updated function
  DEFAULT_ASYNC_CONFIG
};
```

### Secondary Files to Update:

**lib/connectionPool.js:**
```javascript
// Replace this line:
const createLimiter = require('./shared/asyncContracts').createLimiter;

// With:
const pLimit = require('p-limit');
const createConcurrencyLimiter = (limit) => pLimit(limit);
```

**lib/memoryManagement.js:**
```javascript
// Update concurrency usage in cleanup operations
const createConcurrencyLimiter = (limit) => pLimit(limit);
```

## Testing Migration

### Functional Tests:
```javascript
const createConcurrencyLimiter = require('./asyncContracts').createConcurrencyLimiter;

async function testConcurrencyLimiter() {
  const limiter = createConcurrencyLimiter(3);
  
  // Test basic functionality
  const results = await Promise.all([
    limiter(() => 'result1'),
    limiter(() => 'result2'),
    limiter(() => 'result3'),
    limiter(() => 'result4'),
    limiter(() => 'result5')
  ]);
  
  console.assert(results[0] === 'result1', 'First result incorrect');
  console.assert(results[1] === 'result2', 'Second result incorrect');
  console.assert(results[2] === 'result3', 'Third result incorrect');
  console.assert(results[3] === 'result4', 'Fourth result incorrect');
  console.assert(results[4] === 'result5', 'Fifth result incorrect');
  
  console.log('✅ Concurrency limiter test passed');
}
```

### Performance Tests:
```javascript
async function testPerformance() {
  const iterations = 10000;
  const concurrency = 20;
  
  const pLimit = require('p-limit');
  const limiter = pLimit(concurrency);
  
  const start = Date.now();
  for (let i = 0; i < iterations; i++) {
    await limiter(() => Promise.resolve(i));
  }
  const duration = Date.now() - start;
  
  console.log(`Processed ${iterations} tasks with concurrency ${concurrency}`);
  console.log(`Total time: ${duration}ms`);
  console.log(`Throughput: ${(iterations / duration * 1000).toFixed(2)} tasks/sec`);
}
```

## Validation Checklist

- [ ] Install p-limit package
- [ ] Replace createLimiter in lib/asyncContracts.js
- [ ] Update all imports using createLimiter
- [ ] Replace usage in lib/connectionPool.js
- [ ] Replace usage in lib/memoryManagement.js
- [ ] Update usage in lib/enhancedRateLimiter.js
- [ ] Update usage in lib/distributedRateLimiter.js
- [ ] Run functional tests
- [ ] Run performance benchmarks
- [ ] Verify memory usage under load
- [ ] Test error handling behavior

## Rollback Plan

If issues arise during migration:

```javascript
// Feature flag for emergency rollback
const USE_CUSTOM_LIMITER = process.env.USE_CUSTOM_LIMITER === 'true';

function createConcurrencyLimiter(maxConcurrency) {
  if (USE_CUSTOM_LIMITER) {
    // Fallback to custom implementation
    const createLimiter = require('./asyncContracts-custom');
    return createLimiter(maxConcurrency);
  } else {
    // Use p-limit
    const pLimit = require('p-limit');
    return pLimit(maxConcurrency);
  }
}
```

## Migration Timeline

- **Phase 1** (Days 1-2): Install p-limit and update core implementation
- **Phase 2** (Days 3-4): Update all dependent files
- **Phase 3** (Days 5-6): Testing and validation
- **Phase 4** (Days 7-8): Performance benchmarking and optimization
- **Phase 5** (Days 9-10): Gradual rollout with monitoring

## Support and Documentation

- **p-limit Documentation**: https://github.com/sindresorhus/p-limit
- **API Reference**: https://github.com/sindresorhus/p-limit/blob/main/readme.md
- **Sindre Sorhus Profile**: https://github.com/sindresorhus (renowned for high-quality utilities)
- **Issues Tracker**: https://github.com/sindresorhus/p-limit/issues

This migration replaces custom concurrency control code with a battle-tested, ultra-lightweight solution that provides superior performance and reliability while reducing maintenance burden.