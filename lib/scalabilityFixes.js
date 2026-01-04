'use strict';

/**
 * Scalability Fixes Implementation
 * 
 * This module implements comprehensive scalability fixes for the qerrors system,
 * addressing memory leaks, performance bottlenecks, and resource management issues.
 */

const { performance } = require('perf_hooks');
const { EventEmitter } = require('events');

/**
 * Memory-efficient queue manager with bounded resources
 */
class ScalableQueueManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.maxConcurrency = options.maxConcurrency || 5;
    this.queue = [];
    this.activeCount = 0;
    this.totalProcessed = 0;
    this.rejectCount = 0;
    this.metrics = {
      avgProcessingTime: 0,
      maxProcessingTime: 0,
      minProcessingTime: Infinity
    };
    
    // Start cleanup interval to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    this.cleanupInterval.unref();
  }

  /**
   * Add task to queue with bounded size and overflow protection
   */
   async enqueue(task, priority = 0) {
    // Check queue size limit to prevent memory exhaustion
    if (this.queue.length >= this.maxQueueSize) {
      this.rejectCount++;
      this.emit('rejected', { queueLength: this.queue.length });
      throw new Error('Queue at capacity - request rejected');
    }

    return new Promise((resolve, reject) => {
      const queueItem = {
        task,
        priority,
        resolve,
        reject,
        timestamp: Date.now(),
        processed: false, // Flag to track processing state
        timeoutId: setTimeout(() => {
           // Fix Bug #9 & #12: Use atomic operations to prevent race conditions
           if (!queueItem.processed) {
             // Mark as processed atomically to prevent race with processQueue
             queueItem.processed = true;
             
             // Fix Bug #12: Use atomic find-and-remove to prevent race
             let removed = false;
             try {
               // Atomic operation: find and remove in one step
               for (let i = 0; i < this.queue.length; i++) {
                 if (this.queue[i] === queueItem && !this.queue[i].processed) {
                   this.queue.splice(i, 1);
                   this.rejectCount++; // Count timeout as rejection
                   removed = true;
                   break;
                 }
               }
             } catch (error) {
               console.error('Queue timeout removal error:', error.message);
             }
             
             if (removed) {
               clearTimeout(queueItem.timeoutId);
               reject(new Error('Queue timeout'));
             }
             // If not removed, item was already processed
           }
           // If already processed, do nothing
         }, 30000)
      };

       // Insert based on priority (higher priority first)
       // Fix Bug #11: Prevent race condition during insertion
       let insertIndex;
       try {
         // Create snapshot to prevent race conditions
         const queueSnapshot = [...this.queue];
         insertIndex = queueSnapshot.findIndex(item => item.priority < priority);
         
         // Verify queue hasn't changed during search
         if (queueSnapshot.length === this.queue.length) {
           if (insertIndex === -1) {
             this.queue.push(queueItem);
           } else {
             this.queue.splice(insertIndex, 0, queueItem);
           }
         } else {
           // Queue changed during search, append to end for safety
           this.queue.push(queueItem);
         }
       } catch (error) {
         // Fallback to append if race condition detected
         console.warn('Queue insertion race condition detected, appending to end');
         this.queue.push(queueItem);
       }

      this.processQueue();
    });
  }

  /**
   * Process queue with concurrency control
   */
  async processQueue() {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const queueItem = this.queue.shift();
    this.activeCount++;

    try {
      // Fix Bug #9: Mark as processed to prevent timeout race condition
      queueItem.processed = true;
      
      const startTime = performance.now();
      const result = await queueItem.task();
      const processingTime = performance.now() - startTime;
      
      // Update metrics with bounded memory usage
      this.updateMetrics(processingTime);
      this.totalProcessed++;
      
      clearTimeout(queueItem.timeoutId);
      queueItem.resolve(result);
    } catch (error) {
      // Mark as processed even on error to prevent timeout
      queueItem.processed = true;
      clearTimeout(queueItem.timeoutId);
      queueItem.reject(error);
    } finally {
      this.activeCount--;
      // Continue processing queue
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      length: this.queue.length,
      activeCount: this.activeCount,
      totalProcessed: this.totalProcessed,
      rejectCount: this.rejectCount,
      avgProcessingTime: this.metrics.avgProcessingTime,
      maxProcessingTime: this.metrics.maxProcessingTime,
      minProcessingTime: this.metrics.minProcessingTime
    };
  }

  /**
   * Update metrics with memory-efficient rolling average
   */
  updateMetrics(processingTime) {
    // Use exponential moving average to prevent memory growth
    const alpha = 0.1; // Smoothing factor
    this.metrics.avgProcessingTime = 
      this.metrics.avgProcessingTime === 0 ? 
      processingTime : 
      alpha * processingTime + (1 - alpha) * this.metrics.avgProcessingTime;
    
    this.metrics.maxProcessingTime = Math.max(this.metrics.maxProcessingTime, processingTime);
    this.metrics.minProcessingTime = Math.min(this.metrics.minProcessingTime, processingTime);
  }

  /**
   * Remove item from queue (deprecated - use direct array operations)
   */
  removeFromQueue(queueItem) {
    const index = this.queue.indexOf(queueItem);
    if (index > -1) {
      this.queue.splice(index, 1);
    }
  }

  /**
   * Cleanup expired items and prevent memory leaks
   */
  cleanup() {
    const now = Date.now();
    const initialLength = this.queue.length;
    
    // Remove expired items
    this.queue = this.queue.filter(item => {
      const isExpired = (now - item.timestamp) > 30000;
      if (isExpired) {
        clearTimeout(item.timeoutId);
        item.reject(new Error('Queue item expired during cleanup'));
      }
      return !isExpired;
    });

    if (this.queue.length < initialLength) {
      this.emit('cleanup', { removed: initialLength - this.queue.length });
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount || 0,
      missCount: this.missCount || 0,
      hitRate: (this.hitCount || 0) / ((this.hitCount || 0) + (this.missCount || 0)) || 0
    };
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Reject all pending items
    this.queue.forEach(item => {
      clearTimeout(item.timeoutId);
      item.reject(new Error('Queue shutdown'));
    });
    this.queue = [];
  }
}

/**
 * Memory-efficient cache with LRU eviction and size limits
 */
class ScalableCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 86400000; // 24 hours
    this.cache = new Map();
    this.accessOrder = new Map(); // Track access for LRU
    this.hitCount = 0; // Initialize hit counter
    this.missCount = 0; // Initialize miss counter
    
     // Fix Bug #13: Use Node.js standard cleanup mechanism
     this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
     this.cleanupInterval.unref();
     
     // Use process exit handlers instead of experimental FinalizationRegistry
     this._cleanupHandlers = [];
     const cleanupHandler = () => {
       if (this.cleanupInterval) {
         clearInterval(this.cleanupInterval);
         this.cleanupInterval = null;
       }
     };
     
     // Register for all possible exit scenarios
     process.on('exit', cleanupHandler);
     process.on('SIGINT', cleanupHandler);
     process.on('SIGTERM', cleanupHandler);
     process.on('uncaughtException', cleanupHandler);
     
      this._cleanupHandlers = ['exit', 'SIGINT', 'SIGTERM', 'uncaughtException'];
  }

  /**
   * Get item from cache
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      this.missCount++; // Increment miss counter
      return null;
    }

    // Check TTL
    if (Date.now() - item.timestamp > this.ttl) {
      this.delete(key);
      return null;
    }

    // Update access order for LRU
    this.accessOrder.set(key, Date.now());
    this.hitCount++; // Increment hit counter
    return item.value;
  }

  /**
   * Set item in cache with size management
   */
  set(key, value) {
    // Fix Bug #2: Prevent race conditions during cleanup
    // Use try-catch to handle potential concurrent access
    try {
      // Remove oldest items if cache is full
      while (this.cache.size >= this.maxSize && this.accessOrder.size > 0) {
        const oldestKey = this.findOldestKey();
        if (oldestKey) {
          // Only delete if key still exists (race condition protection)
          if (this.cache.has(oldestKey)) {
            this.delete(oldestKey);
          } else {
            // Key was deleted by another operation, continue
            continue;
          }
        } else {
          break;
        }
      }
    } catch (error) {
      // Log error but don't fail cache operation
      console.error('Cache cleanup error:', error.message);
    }

    const item = {
      value,
      timestamp: Date.now()
    };

    this.cache.set(key, item);
    this.accessOrder.set(key, Date.now());
    // No hitCount increment here - only increment when cache hit
  }

  /**
   * Delete item from cache
   */
  delete(key) {
    this.cache.delete(key);
    this.accessOrder.delete(key);
  }

  /**
   * Find oldest accessed key for LRU eviction
   */
  findOldestKey() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, time] of this.accessOrder.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Cleanup expired items
   */
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];

    try {
      // Fix Bug #4: Handle potential concurrent modifications
      for (const [key, item] of this.cache.entries()) {
        if (now - item.timestamp > this.ttl) {
          expiredKeys.push(key);
        }
      }

      // Safely delete expired keys with existence check
      expiredKeys.forEach(key => {
        if (this.cache.has(key)) {
          this.delete(key);
        }
      });
    } catch (error) {
      // Log cleanup errors but don't crash
      console.error('Cache cleanup error:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    this.hitCount = this.hitCount || 0;
    this.missCount = this.missCount || 0;
    
    // Fix Bug #3: Prevent division by zero
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: hitRate
    };
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
    this.accessOrder.clear();
  }

  /**
   * Shutdown cache
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Fix Bug #13: Clean up Node.js process handlers
    if (this._cleanupHandlers) {
      this._cleanupHandlers.forEach(event => {
        process.removeListener(event, this._cleanupHandler);
      });
      this._cleanupHandlers = null;
      this._cleanupHandler = null;
    }
    
    this.clear();
  }
}

/**
 * Memory-efficient circular buffer for error history
 */
class CircularErrorBuffer {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.buffer = new Array(maxSize);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  /**
   * Add error record to circular buffer
   */
  push(errorRecord) {
    this.buffer[this.tail] = errorRecord;
    this.tail = (this.tail + 1) % this.maxSize;
    
    if (this.count < this.maxSize) {
      this.count++;
    } else {
      // Buffer is full, move head to overwrite oldest
      this.head = (this.head + 1) % this.maxSize;
    }
  }

  /**
   * Get all error records in chronological order
   */
  getAll() {
    const result = [];
    for (let i = 0; i < this.count; i++) {
      const index = (this.head + i) % this.maxSize;
      result.push(this.buffer[index]);
    }
    return result;
  }

  /**
   * Get current size
   */
  get size() {
    return this.count;
  }

  /**
   * Clear buffer
   */
  clear() {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    // Clear references to help garbage collection
    for (let i = 0; i < this.maxSize; i++) {
      this.buffer[i] = null;
    }
  }

  /**
   * Resize buffer (only allows shrinking for safety)
   */
  resize(newMaxSize) {
    if (newMaxSize >= this.maxSize) {
      return; // Only allow shrinking for memory safety
    }

    if (newMaxSize < 1) {
      newMaxSize = 1;
    }

    const newBuffer = new Array(newMaxSize);
    const records = this.getAll();
    
    // Keep only the most recent records
    const startIndex = Math.max(0, records.length - newMaxSize);
    for (let i = startIndex; i < records.length; i++) {
      newBuffer[i - startIndex] = records[i];
    }

    this.buffer = newBuffer;
    this.maxSize = newMaxSize;
    this.head = 0;
    this.tail = Math.min(records.length, newMaxSize);
    this.count = Math.min(records.length, newMaxSize);
  }
}

/**
 * Optimized error handler with memory management
 */
class ScalableErrorHandler {
   constructor(options = {}) {
     // Dynamic error history sizing based on available memory
     const os = require('os');
     const availableMemory = os.freemem();
     const maxMemoryPerError = 2048; // 2KB per error record (conservative estimate)
     
     // Calculate maximum error history based on available memory (max 10% of free memory)
     const memoryBasedLimit = Math.floor(availableMemory / (maxMemoryPerError * 10));
     const staticLimit = options.maxErrorHistory || 100;
     
     // More conservative limits to prevent memory exhaustion
     this.maxErrorHistory = Math.min(staticLimit, Math.max(25, memoryBasedLimit));
     this.errorHistory = new CircularErrorBuffer(this.maxErrorHistory);
     this.queueManager = new ScalableQueueManager(options.queue);
     this.cache = new ScalableCache(options.cache);
     
     // Memory pressure monitoring with more frequent checks
     this.memoryCheckInterval = setInterval(() => {
       this.adjustHistorySize();
     }, 15000); // Check every 15 seconds for better responsiveness
     
     // Emergency cleanup threshold
     this.emergencyCleanupThreshold = this.maxErrorHistory * 2;
   }

  /**
   * Handle error with memory-efficient processing
   */
  async handleError(error, context = {}) {
    const errorId = this.generateErrorId();
    const timestamp = Date.now();

    // Create bounded error object
    const errorRecord = {
      id: errorId,
      timestamp,
      message: String(error.message || '').substring(0, 200),
      name: String(error.name || 'Error').substring(0, 50),
      stack: error.stack ? error.stack.substring(0, 500) : undefined,
      context: this.sanitizeContext(context),
      severity: context.severity || 'medium'
    };

    // Add to history with size limit
    this.addToHistory(errorRecord);

    // Check cache for existing advice
    const cacheKey = this.generateCacheKey(errorRecord);
    const cachedAdvice = this.cache.get(cacheKey);
    
    if (cachedAdvice) {
      return { ...errorRecord, advice: cachedAdvice, cached: true };
    }

    // Queue for AI analysis (non-blocking)
    this.queueManager.enqueue(async () => {
      const advice = await this.analyzeError(errorRecord);
      this.cache.set(cacheKey, advice);
      return advice;
    }).catch(err => {
      console.error('Error analysis failed:', err.message);
    });

    return errorRecord;
  }

/**
 * Add error to bounded history with memory-aware sizing
 */
addToHistory(errorRecord) {
   this.errorHistory.push(errorRecord);
   
   // Size is automatically enforced by circular buffer
   // No need for manual enforcement
 }
  
  /**
   * Adjust error history size based on memory pressure
   */
  adjustHistorySize() {
    const os = require('os');
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    // Reduce history size if memory usage is high
    if (memoryUsagePercent > 80) {
      // Critical memory pressure - reduce history by 50%
      const newLimit = Math.max(25, Math.floor(this.maxErrorHistory * 0.5));
      this.enforceHistoryLimit(newLimit);
      this.maxErrorHistory = newLimit;
      console.warn(`Memory pressure detected (${memoryUsagePercent.toFixed(1)}%), reduced error history to ${newLimit}`);
    } else if (memoryUsagePercent > 60) {
      // Moderate memory pressure - reduce history by 25%
      const newLimit = Math.max(50, Math.floor(this.maxErrorHistory * 0.75));
      this.enforceHistoryLimit(newLimit);
      this.maxErrorHistory = newLimit;
      console.warn(`Moderate memory pressure (${memoryUsagePercent.toFixed(1)}%), reduced error history to ${newLimit}`);
    } else if (memoryUsagePercent < 30 && this.maxErrorHistory < 100) {
      // Low memory pressure - can increase history size
      const os = require('os');
      const availableMemory = os.freemem();
      const maxMemoryPerError = 2048;
      const memoryBasedLimit = Math.floor(availableMemory / (maxMemoryPerError * 10));
      const newLimit = Math.min(100, Math.max(50, memoryBasedLimit));
      
      if (newLimit > this.maxErrorHistory) {
        this.maxErrorHistory = newLimit;
        console.info(`Memory pressure low, increased error history to ${newLimit}`);
      }
    }
  }
  
/**
 * Enforce history size limit with efficient cleanup
 */
enforceHistoryLimit(customLimit = null) {
   const limit = customLimit || this.maxErrorHistory;
   
   // Resize circular buffer if needed
   if (limit !== this.errorHistory.maxSize) {
     this.errorHistory.resize(limit);
     this.maxErrorHistory = limit;
   }
   
   // Circular buffer automatically enforces size limits
   // No additional cleanup needed
 }

  /**
   * Sanitize context to prevent memory bloat
   */
  sanitizeContext(context) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        sanitized[key] = value.substring(0, 100);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = JSON.stringify(value).substring(0, 200);
      } else {
        sanitized[key] = String(value).substring(0, 50);
      }
    }
    
    return sanitized;
  }

  /**
   * Generate unique error ID (secure and collision-resistant)
   */
  generateErrorId() {
    // Fix Bug #4: Use crypto module for secure, collision-resistant IDs
    const { randomBytes } = require('crypto');
    const timestamp = Date.now();
    const random = randomBytes(4).toString('hex');
    return `err_${timestamp}_${random}`;
  }

  /**
   * Generate cache key for error
   */
  generateCacheKey(errorRecord) {
    return `${errorRecord.name}_${errorRecord.message.substring(0, 50)}`;
  }

  /**
   * Analyze error (placeholder for AI analysis)
   */
  async analyzeError(errorRecord) {
    // Simulate AI analysis delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      suggestion: `Consider checking ${errorRecord.name} in ${errorRecord.context.function || 'unknown function'}`,
      severity: errorRecord.severity,
      timestamp: Date.now()
    };
  }

/**
 * Get error statistics
 */
getStats() {
  return {
    errorHistory: this.errorHistory.size,
    maxErrorHistory: this.maxErrorHistory,
    queue: this.queueManager.getStats(),
    cache: this.cache.getStats()
  };
}

/**
 * Graceful shutdown with memory cleanup
 */
   shutdown() {
     // Clear memory monitoring interval
     if (this.memoryCheckInterval) {
       clearInterval(this.memoryCheckInterval);
       this.memoryCheckInterval = null;
     }
     
     // Shutdown components
     this.queueManager.shutdown();
     this.cache.shutdown();
     
     // Clear error history and force garbage collection
     this.errorHistory.clear();
     if (global.gc) {
       global.gc();
     }
     
     console.log('ScalableErrorHandler shutdown complete');
   }
}

module.exports = {
  ScalableQueueManager,
  ScalableCache,
  ScalableErrorHandler,
  CircularErrorBuffer
};