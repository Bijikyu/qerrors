'use strict';

const { LRUCache } = require('lru-cache');

class BoundedLRUCache {
  constructor(maxSize = 1000, options = {}) {
    this.cache = new LRUCache({ 
      max: maxSize,
      updateAgeOnGet: true,
      allowStale: false,
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

  getStats() {
    return this.cache.calcStats ? this.cache.calcStats() : {
      itemCount: this.cache.itemCount,
      maxSize: this.maxSize
    };
  }

  dump() {
    return this.cache.dump ? this.cache.dump() : {};
  }

  load(dumpData) {
    if (this.cache.load) {
      this.cache.load(dumpData);
    }
  }
}

module.exports = BoundedLRUCache;