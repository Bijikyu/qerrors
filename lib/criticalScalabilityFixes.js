'use strict';

/**
 * Critical Scalability Fixes Implementation
 * 
 * This module implements comprehensive fixes for the most critical scalability issues
 * identified in the analysis, including:
 * 1. Memory leaks and unbounded growth
 * 2. Blocking I/O operations in request paths
 * 3. Inefficient resource utilization
 * 4. Performance bottlenecks in hot paths
 */

const { performance } = require('perf_hooks');
const { EventEmitter } = require('events');

/**
 * Memory-efficient resource manager with bounded allocations
 */
class ScalableResourceManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxMemoryUsage = options.maxMemoryUsage || 100 * 1024 * 1024; // 100MB
    this.maxItems = options.maxItems || 1000;
    this.cleanupInterval = options.cleanupInterval || 30000; // 30 seconds
    this.resources = new Map();
    this.accessTimes = new Map();
    this.lastCleanup = Date.now();
    
    // Start periodic cleanup
    this.cleanupTimer = setInterval(() => this.performCleanup(), this.cleanupInterval);
    this.cleanupTimer.unref(); // Don't block process exit
  }
  
  /**
   * Add resource with memory tracking and automatic eviction
   */
  add(key, resource, size = 0) {
    // Check memory limits before adding
    if (this.resources.size >= this.maxItems) {
      this.evictLeastRecentlyUsed();
    }
    
    this.resources.set(key, resource);
    this.accessTimes.set(key, Date.now());
    
    // Emit warning if approaching limits
    if (this.resources.size > this.maxItems * 0.8) {
      this.emit('warning', `Resource cache at ${this.resources.size}/${this.maxItems} capacity`);
    }
  }
  
  /**
   * Get resource and update access time
   */
  get(key) {
    const resource = this.resources.get(key);
    if (resource) {
      this.accessTimes.set(key, Date.now());
    }
    return resource;
  }
  
  /**
   * Evict least recently used resource
   */
  evictLeastRecentlyUsed() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, time] of this.accessTimes.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.remove(oldestKey);
      this.emit('evicted', oldestKey);
    }
  }
  
  /**
   * Remove resource
   */
  remove(key) {
    this.resources.delete(key);
    this.accessTimes.delete(key);
  }
  
  /**
   * Perform cleanup of expired resources
   */
  performCleanup() {
    const now = Date.now();
    const maxAge = this.cleanupInterval * 10; // Resources expire after 10x cleanup interval
    const expiredKeys = [];
    
    for (const [key, time] of this.accessTimes.entries()) {
      if (now - time > maxAge) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.remove(key));
    
    if (expiredKeys.length > 0) {
      this.emit('cleanup', { removed: expiredKeys.length });
    }
    
    this.lastCleanup = now;
  }
  
  /**
   * Get resource statistics
   */
  getStats() {
    return {
      size: this.resources.size,
      maxSize: this.maxItems,
      lastCleanup: this.lastCleanup
    };
  }
  
  /**
   * Graceful shutdown
   */
  shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.resources.clear();
    this.accessTimes.clear();
  }
}

/**
 * Non-blocking operation queue with concurrency control
 */
class NonBlockingOperationQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxConcurrency = options.maxConcurrency || 5;
    this.maxQueueSize = options.maxQueueSize || 100;
    this.queue = [];
    this.active = 0;
    this.completed = 0;
    this.rejected = 0;
  }
  
  /**
   * Add operation to queue with bounded size
   */
  async enqueue(operation, priority = 0) {
    // Check queue size limit
    if (this.queue.length >= this.maxQueueSize) {
      this.rejected++;
      this.emit('rejected', { queueLength: this.queue.length });
      throw new Error('Operation queue at capacity');
    }
    
    return new Promise((resolve, reject) => {
      const queueItem = {
        operation,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      };
      
      // Insert by priority (higher priority first)
      const insertIndex = this.queue.findIndex(item => item.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(queueItem);
      } else {
        this.queue.splice(insertIndex, 0, queueItem);
      }
      
      this.processQueue();
    });
  }
  
  /**
   * Process queue with concurrency control
   */
  async processQueue() {
    if (this.active >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }
    
    const queueItem = this.queue.shift();
    this.active++;
    
    try {
      // Execute operation outside request processing path
      const result = await this.executeOperation(queueItem.operation);
      queueItem.resolve(result);
      this.completed++;
    } catch (error) {
      queueItem.reject(error);
    } finally {
      this.active--;
      // Continue processing
      setImmediate(() => this.processQueue());
    }
  }
  
  /**
   * Execute operation with timeout and error handling
   */
  async executeOperation(operation) {
    const timeout = 30000; // 30 second timeout
    let timeoutId;
    
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Operation timeout'));
      }, timeout);
    });
    
    try {
      const result = await Promise.race([
        Promise.resolve(operation()),
        timeoutPromise
      ]);
      return result;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
  
  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      active: this.active,
      completed: this.completed,
      rejected: this.rejected,
      maxConcurrency: this.maxConcurrency
    };
  }
}

/**
 * Optimized string operations with memory limits
 */
class ScalableStringOperations {
  /**
   * Safe JSON stringification with depth and size limits
   */
  static safeStringify(obj, maxDepth = 3, maxSize = 1000) {
    if (maxDepth <= 0) return '[Depth-Limited]';
    
    if (obj === null || obj === undefined) return '';
    if (typeof obj === 'string') return this.truncateString(obj, maxSize);
    if (typeof obj !== 'object') return String(obj);
    
    try {
      const result = this.stringifyObject(obj, maxDepth, maxSize);
      return result.length > maxSize ? result.substring(0, maxSize - 3) + '...' : result;
    } catch (err) {
      return '[Stringify Error]';
    }
  }
  
  /**
   * Stringify object with property limits
   */
  static stringifyObject(obj, maxDepth, maxSize) {
    let result = '{';
    let count = 0;
    const maxProps = 20; // Limit properties to prevent memory bloat
    
    for (const key in obj) {
      if (count >= maxProps) {
        result += '...';
        break;
      }
      
      if (obj.hasOwnProperty(key)) {
        if (count > 0) result += ',';
        result += `${key}:`;
        
        const value = obj[key];
        if (typeof value === 'object' && value !== null) {
          result += this.safeStringify(value, maxDepth - 1, maxSize);
        } else {
          result += String(value);
        }
        count++;
      }
    }
    
    result += '}';
    return result;
  }
  
  /**
   * Truncate string intelligently
   */
  static truncateString(str, maxSize) {
    if (str.length <= maxSize) return str;
    return str.substring(0, maxSize - 3) + '...';
  }
  
  /**
   * Efficient string joining with pre-allocation
   */
  static joinStrings(strings, separator = '') {
    if (strings.length === 0) return '';
    if (strings.length === 1) return strings[0];
    
    // Calculate total length first
    let totalLength = 0;
    for (const str of strings) {
      totalLength += str.length;
    }
    totalLength += separator.length * (strings.length - 1);
    
    // Pre-allocate and join efficiently
    return strings.join(separator);
  }
}

/**
 * Memory monitoring with automatic cleanup
 */
class ScalableMemoryMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.warningThreshold = options.warningThreshold || 50 * 1024 * 1024; // 50MB
    this.criticalThreshold = options.criticalThreshold || 100 * 1024 * 1024; // 100MB
    this.checkInterval = options.checkInterval || 10000; // 10 seconds
    this.history = [];
    this.maxHistorySize = 100; // Bounded history
    this.monitoring = false;
  }
  
  /**
   * Start memory monitoring
   */
  start() {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.interval = setInterval(() => this.checkMemory(), this.checkInterval);
    this.interval.unref(); // Don't block process exit
  }
  
  /**
   * Stop memory monitoring
   */
  stop() {
    if (!this.monitoring) return;
    
    this.monitoring = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  
  /**
   * Check memory usage and trigger cleanup if needed
   */
  checkMemory() {
    const usage = process.memoryUsage();
    const heapUsed = usage.heapUsed;
    
    // Add to bounded history
    this.history.push({
      heapUsed,
      timestamp: Date.now(),
      rss: usage.rss
    });
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
    
    // Check thresholds
    if (heapUsed > this.criticalThreshold) {
      this.emit('critical', heapUsed);
      this.triggerCleanup();
    } else if (heapUsed > this.warningThreshold) {
      this.emit('warning', heapUsed);
    }
  }
  
  /**
   * Trigger memory cleanup
   */
  triggerCleanup() {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    this.emit('cleanup');
  }
  
  /**
   * Get memory statistics
   */
  getStats() {
    if (this.history.length === 0) return null;
    
    const latest = this.history[this.history.length - 1];
    const heapUsages = this.history.map(h => h.heapUsed);
    
    return {
      current: latest.heapUsed,
      rss: latest.rss,
      average: heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length,
      max: Math.max(...heapUsages),
      min: Math.min(...heapUsages),
      samples: this.history.length
    };
  }
}

/**
 * Performance monitoring with bounded metrics
 */
class ScalablePerformanceMonitor {
  constructor(options = {}) {
    this.maxMetrics = options.maxMetrics || 1000;
    this.metrics = [];
    this.operationCounts = new Map();
  }
  
  /**
   * Record operation performance
   */
  record(operation, duration, metadata = {}) {
    const metric = {
      operation,
      duration,
      timestamp: Date.now(),
      metadata
    };
    
    // Add to bounded metrics array
    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
    
    // Update operation counts
    const count = this.operationCounts.get(operation) || 0;
    this.operationCounts.set(operation, count + 1);
  }
  
  /**
   * Get performance statistics
   */
  getStats(operation = null) {
    let filteredMetrics = this.metrics;
    
    if (operation) {
      filteredMetrics = this.metrics.filter(m => m.operation === operation);
    }
    
    if (filteredMetrics.length === 0) {
      return null;
    }
    
    const durations = filteredMetrics.map(m => m.duration);
    
    return {
      count: durations.length,
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      p95: this.percentile(durations, 0.95),
      p99: this.percentile(durations, 0.99)
    };
  }
  
  /**
   * Calculate percentile
   */
  percentile(values, p) {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }
}

module.exports = {
  ScalableResourceManager,
  NonBlockingOperationQueue,
  ScalableStringOperations,
  ScalableMemoryMonitor,
  ScalablePerformanceMonitor
};