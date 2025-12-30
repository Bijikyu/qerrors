'use strict';

/**
 * Bounded LRU Cache Wrapper using lru-cache npm module v10.4.3
 * 
 * Provides migration from custom implementation to battle-tested
 * lru-cache module with maintained API compatibility.
 */

const { LRUCache } = require('lru-cache');

class BoundedLRUCache {
  constructor(maxSize = 1000, options = {}) {
    this.cache = new LRUCache({ 
      max: maxSize,
      updateAgeOnGet: true,  // Maintain LRU behavior on access
      allowStale: false,     // Don't return stale values
      ...options
    });
    this.maxSize = maxSize;
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
    return this.cache.size || this.cache.itemCount;
  }

  keys() {
    return this.cache.keys();
  }

  values() {
    const values = [];
    for (const key of this.cache.keys()) {
      const value = this.cache.get(key);
      if (value !== undefined) {
        values.push(value);
      }
    }
    return values;
  }

  entries() {
    const entries = [];
    for (const key of this.cache.keys()) {
      const value = this.cache.get(key);
      if (value !== undefined) {
        entries.push([key, value]);
      }
    }
    return entries;
  }

  // Additional lru-cache specific methods
  getStats() {
    return this.cache.calcStats ? this.cache.calcStats() : {
      itemCount: this.cache.itemCount,
      maxSize: this.maxSize
    };
  }

  // Method to dump all cache contents
  dump() {
    return this.cache.dump ? this.cache.dump() : {};
  }

  // Method to load cache from dump
  load(dumpData) {
    if (this.cache.load) {
      this.cache.load(dumpData);
    }
  }
}

module.exports = BoundedLRUCache;