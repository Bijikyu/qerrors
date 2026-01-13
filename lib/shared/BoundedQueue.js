'use strict';

/**
 * Bounded Queue Implementation
 *
 * A memory-bounded queue that enforces both size and memory limits.
 * Automatically evicts oldest entries when limits are exceeded.
 * Uses Denque for efficient O(1) push/pop operations.
 */

const Denque = require('denque');

class BoundedQueue {
  /**
   * Creates a new bounded queue
   * @param {number} maxSize - Maximum number of items (default: 1000)
   * @param {number} maxMemoryMB - Maximum memory usage in MB (default: 10)
   */
  constructor (maxSize = 1000, maxMemoryMB = 10) {
    this.maxSize = maxSize;
    this.maxMemoryBytes = maxMemoryMB * 1024 * 1024;
    this.currentMemoryBytes = 0;
    this.evictions = 0;
    this.rejections = 0;
    this.queue = new Denque();
  }

  /**
   * Adds an item to the queue, evicting oldest if necessary
   * @param {*} item - Item to add
   * @returns {boolean} Always returns true
   */
  push (item) {
    const itemSize = this.estimateItemSize(item);

    // Check memory limit first and evict if necessary
    if (this.currentMemoryBytes + itemSize > this.maxMemoryBytes) {
      this.evictOldest(Math.ceil(this.queue.length * 0.3));
    }

    // Then check size limit and evict if necessary
    // Note: currentMemoryBytes is already updated by any memory eviction above
    if (this.queue.length >= this.maxSize) {
      this.evictOldest(1);
    }

    // Add the item and update memory
    this.queue.push(item);
    this.currentMemoryBytes += itemSize;
    return true;
  }

  /**
   * Evicts the oldest items from the queue
   * @param {number} count - Number of items to evict (default: 1)
   * @returns {number} Number of items actually evicted
   */
  evictOldest (count = 1) {
    let evicted = 0;
    for (let i = 0; i < count && this.queue.length > 0; i++) {
      const item = this.queue.shift();
      this.currentMemoryBytes -= this.estimateItemSize(item);
      evicted++;
    }
    this.evictions += evicted;
    return evicted;
  }

  /**
   * Checks if queue should reject new items due to being full
   * @returns {boolean} True if queue is at or near capacity
   */
  rejectIfFull () {
    if (this.queue.length >= this.maxSize ||
        this.currentMemoryBytes > this.maxMemoryBytes * 0.9) {
      this.rejections++;
      return true;
    }
    return false;
  }

  /**
   * Estimates memory size of an item
   * @param {*} item - Item to size
   * @returns {number} Estimated size in bytes
   */
  estimateItemSize (item) {
    return 256;
  }

  /**
   * Filters queue items using a predicate function
   * @param {Function} predicate - Filter function
   * @returns {number} Number of items removed
   */
  filter (predicate) {
    const initialLength = this.queue.length;
    const items = this.queue.toArray();
    const filtered = items.filter(predicate);
    this.queue = new Denque();
    this.currentMemoryBytes = 0;
    for (const item of filtered) {
      this.queue.push(item);
      this.currentMemoryBytes += this.estimateItemSize(item);
    }
    return initialLength - this.queue.length;
  }

  /**
   * Finds index of first item matching predicate
   * @param {Function} predicate - Match function
   * @returns {number} Index of matching item or -1
   */
  findIndex (predicate) {
    const items = this.queue.toArray();
    return items.findIndex(predicate);
  }

  get length () {
    return this.queue.length;
  }

  /**
   * Clears all items from the queue
   */
  clear () {
    this.queue.clear();
    this.currentMemoryBytes = 0;
  }

  /**
   * Returns queue statistics
   * @returns {Object} Queue performance metrics
   */
  getStats () {
    return {
      length: this.queue.length,
      maxSize: this.maxSize,
      currentMemoryBytes: this.currentMemoryBytes,
      maxMemoryBytes: this.maxMemoryBytes,
      evictions: this.evictions,
      rejections: this.rejections,
      memoryUtilization: this.currentMemoryBytes / this.maxMemoryBytes
    };
  }
}

module.exports = BoundedQueue;
