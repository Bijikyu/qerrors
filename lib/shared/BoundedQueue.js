'use strict';

const Denque = require('denque');

class BoundedQueue {
  constructor (maxSize = 1000, maxMemoryMB = 10) {
    this.maxSize = maxSize;
    this.maxMemoryBytes = maxMemoryMB * 1024 * 1024;
    this.currentMemoryBytes = 0;
    this.evictions = 0;
    this.rejections = 0;
    this.queue = new Denque();
  }

  push (item) {
    const itemSize = this.estimateItemSize(item);
    if (this.currentMemoryBytes + itemSize > this.maxMemoryBytes) {
      this.evictOldest(Math.ceil(this.queue.length * 0.3));
    }
    if (this.queue.length >= this.maxSize) {
      this.evictOldest(1);
    }
    this.queue.push(item);
    this.currentMemoryBytes += itemSize;
    return true;
  }

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

  rejectIfFull () {
    if (this.queue.length >= this.maxSize ||
        this.currentMemoryBytes > this.maxMemoryBytes * 0.9) {
      this.rejections++;
      return true;
    }
    return false;
  }

  estimateItemSize (item) {
    return 256;
  }

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

  findIndex (predicate) {
    const items = this.queue.toArray();
    return items.findIndex(predicate);
  }

  get length () {
    return this.queue.length;
  }

  clear () {
    this.queue.clear();
    this.currentMemoryBytes = 0;
  }

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
