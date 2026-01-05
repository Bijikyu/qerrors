'use strict';

const { LRUCache } = require('lru-cache');

class BoundedLRUCache {
  constructor (maxSize = 1000, options = {}) {
    // Support both signatures:
    // - new BoundedLRUCache(100, { ttl: ... })
    // - new BoundedLRUCache({ max: 10, ttl: ... })
    const resolvedOptions = (maxSize && typeof maxSize === 'object')
      ? { ...maxSize }
      : { ...options, max: maxSize };

    this.cache = new LRUCache({
      updateAgeOnGet: true,
      allowStale: false,
      ...resolvedOptions
    });

    this.maxSize = resolvedOptions.max;
  }

  get (key) {
    return this.cache.get(key);
  }

  set (key, value) {
    this.cache.set(key, value);
  }

  has (key) {
    return this.cache.has(key);
  }

  delete (key) {
    return this.cache.delete(key);
  }

  clear () {
    this.cache.clear();
  }

  get size () {
    return this.cache.size;
  }

  keys () {
    return this.cache.keys();
  }

  values () {
    const values = [];
    for (const key of this.cache.keys()) {
      const value = this.cache.get(key);
      if (value !== undefined) {
        values.push(value);
      }
    }
    return values;
  }

  entries () {
    const entries = [];
    for (const key of this.cache.keys()) {
      const value = this.cache.get(key);
      if (value !== undefined) {
        entries.push([key, value]);
      }
    }
    return entries;
  }

  getStats () {
    return this.cache.calcStats
      ? this.cache.calcStats()
      : {
        itemCount: this.cache.itemCount,
        maxSize: this.maxSize
      };
  }

  dump () {
    return this.cache.dump ? this.cache.dump() : {};
  }

  load (dumpData) {
    if (this.cache.load) {
      this.cache.load(dumpData);
    }
  }
}

module.exports = BoundedLRUCache;
