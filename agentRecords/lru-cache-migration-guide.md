# lru-cache Migration Guide

## Overview

This guide provides step-by-step instructions for replacing the custom `BoundedLRUCache` implementation with the well-maintained `lru-cache` npm module.

## Migration Benefits

- **Performance**: Optimized LRU eviction algorithms with O(1) operations
- **Reliability**: Battle-tested in production environments with 992M+ downloads/month
- **Maintenance**: Actively maintained by Isaac Z. Schlueter (npm creator)
- **Security**: Zero known CVEs, zero dependencies
- **TypeScript**: Excellent built-in TypeScript support
- **Memory Management**: Better memory efficiency and garbage collection behavior

## Current Custom Implementation

```javascript
// Current: lib/shared/BoundedLRUCache.js
class BoundedLRUCache {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    if (this.cache.has(key)) {
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return undefined;
  }

  set(key, value) {
    // ... custom LRU implementation
  }
}
```

## Migration Steps

### Step 1: Install lru-cache

```bash
npm install lru-cache
```

### Step 2: Replace BoundedLRUCache Usage

**Before (Custom):**
```javascript
const { BoundedLRUCache } = require('./shared/BoundedLRUCache');
const cache = new BoundedLRUCache(1000);
```

**After (lru-cache):**
```javascript
const LRUCache = require('lru-cache');
const cache = new LRUCache({ 
  max: 1000,
  updateAgeOnGet: true,  // Maintains LRU order on access
  ttl: 1000 * 60 * 60,  // Optional: 1 hour TTL
  allowStale: false     // Don't return stale values
});
```

### Step 3: API Mapping

| Custom Method | lru-cache Equivalent | Notes |
|---------------|----------------------|---------|
| `cache.get(key)` | `cache.get(key)` | ✅ Direct replacement |
| `cache.set(key, value)` | `cache.set(key, value)` | ✅ Direct replacement |
| `cache.has(key)` | `cache.has(key)` | ✅ Direct replacement |
| `cache.delete(key)` | `cache.delete(key)` | ✅ Direct replacement |
| `cache.clear()` | `cache.reset()` | ✅ Use reset() instead of clear() |
| `cache.size()` | `cache.itemCount` | ✅ Use itemCount property |

### Step 4: Enhanced Configuration Options

```javascript
const cache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 60,        // 1 hour TTL
  updateAgeOnGet: true,          // LRU behavior on access
  allowStale: false,             // Never return stale values
  dispose: (value, key) => {      // Cleanup callback
    console.log(`Evicted: ${key}`);
  },
  noDisposeOnSet: true,           // Don't call dispose on set
  maxSize: 500,                   // Alternative to max (legacy)
  length: (value, key) => 1,      // Size calculation function
  stale: false,                    // Check if value is stale
});
```

### Step 5: Memory Usage Optimization

**Custom Implementation Issues:**
```javascript
// Current manual memory tracking
this.currentMemoryBytes += itemSize;
this.currentMemoryBytes -= this.estimateItemSize(item);
```

**lru-cache Benefits:**
```javascript
// Automatic memory management
const cache = new LRUCache({ 
  max: 1000,
  length: (value, key) => {
    // lru-cache handles size calculation efficiently
    return calculateMemoryUsage(value, key);
  }
});
```

### Step 6: Error Handling

**Before:**
```javascript
try {
  const value = cache.get(key);
  return value;
} catch (error) {
  console.error('Cache error:', error);
  return undefined;
}
```

**After:**
```javascript
// lru-cache is more resilient and rarely throws
const value = cache.get(key);
// Built-in error handling for most edge cases
```

### Step 7: Testing Migration

```javascript
// Test compatibility
const testCases = [
  { key: 'test1', value: 'value1' },
  { key: 'test2', value: { complex: 'object' } },
  { key: 'test3', value: [1, 2, 3] }
];

testCases.forEach(({ key, value }) => {
  // Set
  cache.set(key, value);
  
  // Get
  const retrieved = cache.get(key);
  console.assert(retrieved === value, `Mismatch for ${key}`);
  
  // Has
  console.assert(cache.has(key), `Has check failed for ${key}`);
  
  // Delete
  cache.delete(key);
  console.assert(!cache.has(key), `Delete failed for ${key}`);
});
```

### Step 8: Performance Validation

```javascript
const { performance } = require('perf_hooks');

function benchmarkCache(cacheClass, iterations = 100000) {
  const cache = new cacheClass(10000);
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    cache.set(`key${i}`, `value${i}`);
    cache.get(`key${i % 1000}`);
  }
  
  const end = performance.now();
  console.log(`${cacheClass.name}: ${(end - start).toFixed(2)}ms`);
}

// Compare performance
benchmarkCache(BoundedLRUCache);
benchmarkCache(LRUCache);
```

### Step 9: Gradual Rollout Strategy

```javascript
// Feature flag for gradual migration
const USE_LRU_CACHE = process.env.USE_LRU_CACHE === 'true';

const createCache = () => {
  if (USE_LRU_CACHE) {
    const LRUCache = require('lru-cache');
    return new LRUCache({ max: 1000 });
  } else {
    const { BoundedLRUCache } = require('./shared/BoundedLRUCache');
    return new BoundedLRUCache(1000);
  }
};

const cache = createCache();
```

## Files to Update

### High Priority Files:
1. **`lib/shared/BoundedLRUCache.js`** - Replace implementation
2. **`lib/shared/`** - Update imports in other shared modules
3. **`lib/memoryManagement.js`** - Update cache usage
4. **`lib/enhancedRateLimiter.js`** - Update cache references

### Implementation Changes:

**Replace in lib/shared/BoundedLRUCache.js:**
```javascript
// Replace entire file content with:
const LRUCache = require('lru-cache');

class BoundedLRUCache {
  constructor(maxSize = 1000, options = {}) {
    this.cache = new LRUCache({ 
      max: maxSize,
      updateAgeOnGet: true,
      allowStale: false,
      ...options
    });
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value) {
    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.reset();
  }

  size() {
    return this.cache.itemCount;
  }

  keys() {
    return this.cache.keys();
  }

  values() {
    return this.cache.values();
  }

  entries() {
    return Object.entries(this.cache.dump());
  }
}

module.exports = BoundedLRUCache;
```

## Validation Checklist

- [ ] Install `lru-cache` package
- [ ] Replace BoundedLRUCache implementation
- [ ] Update all import statements
- [ ] Update method calls (clear() → reset())
- [ ] Update property access (size → itemCount)
- [ ] Add TTL configuration if needed
- [ ] Run compatibility tests
- [ ] Performance benchmark comparison
- [ ] Memory usage validation
- [ ] Error handling verification
- [ ] Gradual rollout with feature flags

## Rollback Plan

If issues arise during migration:

```javascript
// Emergency fallback
const USE_LEGACY_CACHE = process.env.USE_LEGACY_CACHE === 'true';

if (USE_LEGACY_CACHE) {
  // Fall back to custom implementation
  const { BoundedLRUCache } = require('./shared/BoundedLRUCache');
  cache = new BoundedLRUCache(maxSize);
}
```

## Monitoring and Metrics

```javascript
// Add migration monitoring
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0
};

const monitoredCache = new Proxy(cache, {
  get(target, prop) {
    if (prop === 'get') {
      return function(key) {
        const result = target.get(key);
        if (result !== undefined) {
          cacheStats.hits++;
        } else {
          cacheStats.misses++;
        }
        return result;
      };
    }
    // Monitor other methods...
    return target[prop];
  }
});
```

## Migration Timeline

- **Phase 1** (Days 1-2): Install and implement lru-cache
- **Phase 2** (Days 3-4): Update all dependent files
- **Phase 3** (Days 5-6): Testing and validation
- **Phase 4** (Days 7-8): Performance benchmarking
- **Phase 5** (Days 9-10): Gradual rollout with monitoring

## Support and Documentation

- **lru-cache Documentation**: https://www.npmjs.com/package/lru-cache
- **GitHub Repository**: https://github.com/isaacs/node-lru-cache
- **Issues Tracker**: https://github.com/isaacs/node-lru-cache/issues

This migration provides immediate performance and reliability benefits with minimal code changes while maintaining backward compatibility through the wrapper pattern.