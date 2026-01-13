'use strict';

/**
 * Bounded Set Implementation
 *
 * A memory-bounded set that automatically evicts oldest entries
 * when size limit is exceeded. Uses QuickLRU for efficient operations.
 */

const QuickLRU = require('quick-lru');

class BoundedSet {
  /**
   * Creates a new bounded set
   * @param {number} maxSize - Maximum number of items
   */
  constructor (maxSize) {
    this.cache = new QuickLRU(maxSize);
  }

  /**
   * Adds an item to the set
   * @param {*} item - Item to add
   */
  add (item) {
    this.cache.set(item, true);
  }

  /**
   * Checks if item exists in set
   * @param {*} item - Item to check
   * @returns {boolean} True if item exists
   */
  has (item) {
    return this.cache.has(item);
  }

  /**
   * Removes an item from the set
   * @param {*} item - Item to remove
   * @returns {boolean} True if item was removed
   */
  delete (item) {
    return this.cache.delete(item);
  }

  /**
   * Gets the oldest item in the set
   * @returns {*} Oldest item or undefined
   */
  getOldestItem () {
    const keys = this.cache.keys();
    if (keys.length === 0) {
      return undefined;
    }
    const oldestKey = keys[0];
    return this.cache.get(oldestKey);
  }

  /**
   * Clears all items from the set
   */
  clear () {
    this.cache.clear();
  }

  get size () {
    return this.cache.size;
  }

  /**
   * Returns iterator over set values
   * @returns {Iterator} Set values iterator
   */
  values () {
    return this.cache.values();
  }

  /**
   * Converts set to array
   * @returns {Array} Array of set values
   */
  toArray () {
    return this.cache.values();
  }
}

module.exports = BoundedSet;
