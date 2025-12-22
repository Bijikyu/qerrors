/**
 * Scalable Memory Management Utilities
 * 
 * Provides memory-efficient data structures and algorithms
 * for high-load scenarios with bounded memory usage.
 */

/**
 * Memory-bounded circular buffer for scalability
 */
class CircularBuffer {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.buffer = new Array(maxSize);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  push(item) {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.maxSize;
    
    if (this.count < this.maxSize) {
      this.count++;
    } else {
      this.head = (this.head + 1) % this.maxSize; // Overwrite oldest
    }
  }

  shift() {
    if (this.count === 0) return undefined;
    
    const item = this.buffer[this.head];
    this.head = (this.head + 1) % this.maxSize;
    this.count--;
    return item;
  }

  size() {
    return this.count;
  }

  isEmpty() {
    return this.count === 0;
  }

  isFull() {
    return this.count === this.maxSize;
  }

  toArray() {
    const result = [];
    for (let i = 0; i < this.count; i++) {
      const index = (this.head + i) % this.maxSize;
      result.push(this.buffer[index]);
    }
    return result;
  }

  clear() {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }
}

/**
 * Memory-pool for object reuse (reduces GC pressure)
 */
class ObjectPool {
  constructor(createFn, resetFn, maxSize = 1000) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
    this.pool = [];
    this.created = 0;
    this.reused = 0;
  }

  acquire() {
    if (this.pool.length > 0) {
      this.reused++;
      const obj = this.pool.pop();
      this.resetFn(obj);
      return obj;
    }
    
    this.created++;
    if (this.created > this.maxSize) {
      console.warn(`ObjectPool exceeded max size: ${this.created} > ${this.maxSize}`);
    }
    return this.createFn();
  }

  release(obj) {
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }

  getStats() {
    return {
      poolSize: this.pool.length,
      created: this.created,
      reused: this.reused,
      reuseRate: this.reused / (this.created + this.reused)
    };
  }

  clear() {
    this.pool.length = 0;
  }
}

/**
 * Memory-bounded set with LRU eviction
 */
class BoundedSet {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.data = new Map();
    this.accessOrder = [];
  }

  add(item) {
    const key = typeof item === 'object' ? JSON.stringify(item) : item;
    
    if (this.data.has(key)) {
      // Move to end (most recently used)
      const index = this.accessOrder.indexOf(key);
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
      return false;
    }

    if (this.data.size >= this.maxSize) {
      // Evict least recently used
      const lruKey = this.accessOrder.shift();
      this.data.delete(lruKey);
    }

    this.data.set(key, item);
    this.accessOrder.push(key);
    return true;
  }

  has(item) {
    const key = typeof item === 'object' ? JSON.stringify(item) : item;
    return this.data.has(key);
  }

  delete(item) {
    const key = typeof item === 'object' ? JSON.stringify(item) : item;
    const index = this.accessOrder.indexOf(key);
    
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    
    return this.data.delete(key);
  }

  size() {
    return this.data.size;
  }

  toArray() {
    return Array.from(this.data.values());
  }

  clear() {
    this.data.clear();
    this.accessOrder.length = 0;
  }
}

/**
 * Memory-efficient event emitter with bounded listeners
 */
class BoundedEventEmitter {
  constructor(maxListeners = 100) {
    this.maxListeners = maxListeners;
    this.listeners = new Map();
    this.eventQueue = new CircularBuffer(1000); // Bounded event queue
    this.processing = false;
  }

  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    const eventListeners = this.listeners.get(event);
    if (eventListeners.length >= this.maxListeners) {
      console.warn(`Too many listeners for event ${event}: ${eventListeners.length}`);
      return false;
    }
    
    eventListeners.push(listener);
    return true;
  }

  off(event, listener) {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return false;
    
    const index = eventListeners.indexOf(listener);
    if (index !== -1) {
      eventListeners.splice(index, 1);
      return true;
    }
    return false;
  }

  emit(event, data) {
    // Queue event to prevent stack overflow
    this.eventQueue.push({ event, data, timestamp: Date.now() });
    
    if (!this.processing) {
      this.processQueue();
    }
  }

  processQueue() {
    this.processing = true;
    
    while (!this.eventQueue.isEmpty()) {
      const { event, data } = this.eventQueue.shift();
      const listeners = this.listeners.get(event) || [];
      
      // Copy listeners to prevent issues with removal during iteration
      const listenersCopy = listeners.slice();
      for (const listener of listenersCopy) {
        try {
          listener(data);
        } catch (error) {
          console.error(`Event listener error for ${event}:`, error);
        }
      }
    }
    
    this.processing = false;
  }

  getStats() {
    return {
      queueSize: this.eventQueue.size(),
      listenerCounts: Object.fromEntries(
        Array.from(this.listeners.entries()).map(([event, listeners]) => [event, listeners.length])
      )
    };
  }
}

/**
 * Memory usage monitor with thresholds
 */
class MemoryMonitor {
  constructor(options = {}) {
    this.warningThreshold = options.warningThreshold || 100 * 1024 * 1024; // 100MB
    this.criticalThreshold = options.criticalThreshold || 200 * 1024 * 1024; // 200MB
    this.checkInterval = options.checkInterval || 5000; // 5 seconds
    this.history = new CircularBuffer(100); // Keep 100 samples
    this.monitoring = false;
  }

  start() {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.interval = setInterval(() => {
      this.checkMemory();
    }, this.checkInterval);
  }

  stop() {
    if (!this.monitoring) return;
    
    this.monitoring = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  checkMemory() {
    const usage = process.memoryUsage();
    const heapUsed = usage.heapUsed;
    
    this.history.push({
      heapUsed,
      timestamp: Date.now()
    });

    if (heapUsed > this.criticalThreshold) {
      console.error(`CRITICAL: Memory usage ${Math.round(heapUsed / 1024 / 1024)}MB exceeds critical threshold`);
      this.triggerMemoryCleanup();
    } else if (heapUsed > this.warningThreshold) {
      console.warn(`WARNING: Memory usage ${Math.round(heapUsed / 1024 / 1024)}MB exceeds warning threshold`);
    }
  }

  triggerMemoryCleanup() {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Clear object pools
    if (global.objectPools) {
      for (const pool of global.objectPools) {
        pool.clear();
      }
    }
  }

  getStats() {
    if (this.history.isEmpty()) return null;
    
    const samples = this.history.toArray();
    const heapUsages = samples.map(s => s.heapUsed);
    
    return {
      current: heapUsages[heapUsages.length - 1],
      average: heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length,
      max: Math.max(...heapUsages),
      min: Math.min(...heapUsages),
      samples: heapUsages.length
    };
  }
}

// Global memory management utilities
const MemoryUtils = {
  /**
   * Create bounded array with automatic cleanup
   */
  createBoundedArray(maxSize) {
    const array = [];
    
    array.push = function(item) {
      if (this.length >= maxSize) {
        this.splice(0, this.length - maxSize + 1);
      }
      return Array.prototype.push.call(this, item);
    };
    
    return array;
  },

  /**
   * Memory-efficient string concatenation
   */
  joinStrings(strings, separator = '') {
    if (strings.length === 0) return '';
    if (strings.length === 1) return strings[0];
    
    // Calculate total length first to avoid reallocations
    let totalLength = 0;
    for (const str of strings) {
      totalLength += str.length;
    }
    totalLength += separator.length * (strings.length - 1);
    
    // Allocate final string once
    const result = new Array(totalLength);
    let pos = 0;
    
    for (let i = 0; i < strings.length; i++) {
      if (i > 0) {
        for (let j = 0; j < separator.length; j++) {
          result[pos++] = separator[j];
        }
      }
      
      const str = strings[i];
      for (let j = 0; j < str.length; j++) {
        result[pos++] = str[j];
      }
    }
    
    return String.fromCharCode.apply(null, result);
  },

  /**
   * Efficient object cloning with memory limits
   */
  deepClone(obj, maxDepth = 10, maxProperties = 1000) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (maxDepth <= 0) return null; // Prevent infinite recursion
    
    let propertyCount = 0;
    const clone = Array.isArray(obj) ? [] : {};
    
    for (const key in obj) {
      if (propertyCount++ >= maxProperties) {
        console.warn('Object has too many properties, truncating clone');
        break;
      }
      
      if (obj.hasOwnProperty(key)) {
        clone[key] = MemoryUtils.deepClone(obj[key], maxDepth - 1, maxProperties);
      }
    }
    
    return clone;
  }
};

module.exports = {
  CircularBuffer,
  ObjectPool,
  BoundedSet,
  BoundedEventEmitter,
  MemoryMonitor,
  MemoryUtils
};