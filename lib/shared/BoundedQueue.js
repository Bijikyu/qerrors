'use strict';

/**
 * Bounded Queue with LRU eviction for memory-efficient connection waiting
 */

class BoundedQueue {
  constructor(maxSize = 1000, maxMemoryMB = 10) {
    this.queue = [];
    this.maxSize = maxSize;
    this.maxMemoryBytes = maxMemoryMB * 1024 * 1024;
    this.currentMemoryBytes = 0;
    this.evictions = 0;
    this.rejections = 0;
  }

  push(item) {
    // Calculate item memory size (rough estimation)
    const itemSize = this.estimateItemSize(item);
    
    // Check memory limits
    if (this.currentMemoryBytes + itemSize > this.maxMemoryBytes) {
      // Force eviction to make space
      this.evictOldest(Math.ceil(this.queue.length * 0.3)); // Evict 30%
    }
    
    // Check size limits
    if (this.queue.length >= this.maxSize) {
      this.evictOldest(1);
    }
    
    // Add item
    this.queue.push(item);
    this.currentMemoryBytes += itemSize;
    
    return true;
  }

  shift() {
    if (this.queue.length === 0) {
      return undefined;
    }
    
    const item = this.queue.shift();
    this.currentMemoryBytes -= this.estimateItemSize(item);
    
    return item;
  }

  evictOldest(count = 1) {
    let evicted = 0;
    for (let i = 0; i < count && this.queue.length > 0; i++) {
      const item = this.queue.shift();
      this.currentMemoryBytes -= this.estimateItemSize(item);
      evicted++;
    }
    this.evictions += evicted;
    return evicted;
  }

  rejectIfFull() {
    if (this.queue.length >= this.maxSize || 
        this.currentMemoryBytes > this.maxMemoryBytes * 0.9) {
      this.rejections++;
      return true;
    }
    return false;
  }

  estimateItemSize(item) {
    // Rough estimation: base object size + timestamp + timeout references
    return 256; // Base size in bytes for queue entry objects
  }

  filter(predicate) {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(predicate);
    
    // Recalculate memory usage
    this.currentMemoryBytes = this.queue.reduce((total, item) => {
      return total + this.estimateItemSize(item);
    }, 0);
    
    return initialLength - this.queue.length;
  }

  findIndex(predicate) {
    return this.queue.findIndex(predicate);
  }

  get length() {
    return this.queue.length;
  }

  clear() {
    this.queue = [];
    this.currentMemoryBytes = 0;
  }

  getStats() {
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