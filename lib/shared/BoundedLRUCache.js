'use strict';

/**
 * Bounded LRU Cache Implementation
 *
 * A memory-bounded Least Recently Used cache that wraps lru-cache.
 * Provides a consistent interface for caching with automatic
 * size limiting and configurable options.
 */

const { LRUCache } = require('lru-cache');

class BoundedLRUCache {
  /**
   * Creates a bounded LRU cache
   * @param {number|Object} maxSize - Maximum size or options object
   * @param {Object} options - Additional cache options
   */
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

  /**
   * Gets value by key
   * @param {*} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get (key) {
    return this.cache.get(key);
  }

  /**
   * Sets value by key
   * @param {*} key - Cache key
   * @param {*} value - Value to cache
   */
  set (key, value) {
    this.cache.set(key, value);
  }

  /**
   * Checks if key exists in cache
   * @param {*} key - Cache key
   * @returns {boolean} True if key exists
   */
  has (key) {
    return this.cache.has(key);
  }

  /**
   * Deletes key from cache
   * @param {*} key - Cache key
   * @returns {boolean} True if key was deleted
   */
  delete (key) {
    return this.cache.delete(key);
  }

  /**
   * Clears all entries from cache
   */
  clear () {
    this.cache.clear();
  }

  get size () {
    return this.cache.size;
  }

  /**
   * Gets all cache keys
   * @returns {Array} Array of keys
   */
  keys () {
    return this.cache.keys();
  }

  /**
   * Gets all cache values
   * @returns {Array} Array of values
   */
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

  /**
   * Gets all cache entries as key-value pairs
   * @returns {Array} Array of [key, value] pairs
   */
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

  /**
   * Gets cache statistics
   * @returns {Object} Cache stats including item count and max size
   */
  getStats () {
    return this.cache.calcStats
      ? this.cache.calcStats()
      : {
        itemCount: this.cache.itemCount,
        maxSize: this.maxSize
      };
  }

  /**
   * Dumps cache contents for persistence
   * @returns {Object} Cache dump data
   */
  dump () {
    return this.cache.dump ? this.cache.dump() : {};
  }

  /**
   * Loads cache contents from dump data
   * @param {Object} dumpData - Cache dump data to load
   */
  load (dumpData) {
    if (this.cache.load) {
      this.cache.load(dumpData);
    }
  }
}

module.exports = BoundedLRUCache;
