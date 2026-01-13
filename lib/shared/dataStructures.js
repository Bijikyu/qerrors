/**
 * Unified Data Structures Module
 *
 * Purpose: Consolidates common data structure implementations to eliminate
 * duplication across the qerrors codebase and provide consistent behavior.
 *
 * This module provides optimized, reusable implementations of frequently
 * used data structures with consistent APIs and performance characteristics.
 *
 * Design Philosophy:
 * - Performance: Optimized for high-throughput scenarios
 * - Memory efficiency: Bounded structures with predictable memory usage
 * - Consistency: Standardized interfaces across all data structures
 * - Safety: Input validation and error handling built-in
 */

const { withQerrorsErrorHandling } = require('./errorWrapper');
const { verboseLog } = require('./logging');

/**
 * Unified Circular Buffer Implementation
 *
 * Combines the best features from CircularBuffer and CircularLogBuffer
 * implementations with enhanced performance and safety features.
 */
class UnifiedCircularBuffer {
  constructor (maxSize = 1000, options = {}) {
    this.maxSize = Math.max(1, parseInt(maxSize) || 1000);
    this.options = {
      enableMetrics: false,
      enableOverflowLogging: false,
      name: 'UnifiedCircularBuffer',
      ...options
    };

    // Use denque for performance if available, otherwise fallback to array
    try {
      const Denque = require('denque');
      this.buffer = new Denque();
    } catch (error) {
      // Fallback implementation
      this.buffer = [];
      this._useArrayFallback = true;
    }

    // Metrics tracking (optional)
    if (this.options.enableMetrics) {
      this.metrics = {
        pushCount: 0,
        shiftCount: 0,
        overflowCount: 0,
        totalProcessed: 0
      };
    }
  }

  /**
   * Add an item to the buffer, removing oldest if at capacity
   * @param {*} item - Item to add
   * @returns {number} Current buffer size after operation
   */
  push (item) {
    try {
      // Check capacity and make room if needed
      if (this.length >= this.maxSize) {
        if (this.options.enableOverflowLogging) {
          verboseLog(`${this.options.name}: Buffer overflow, removing oldest item`);
        }

        if (this._useArrayFallback) {
          this.buffer.shift();
        } else {
          this.buffer.shift();
        }

        if (this.options.enableMetrics) {
          this.metrics.overflowCount++;
        }
      }

      // Add new item
      if (this._useArrayFallback) {
        this.buffer.push(item);
      } else {
        this.buffer.push(item);
      }

      if (this.options.enableMetrics) {
        this.metrics.pushCount++;
        this.metrics.totalProcessed++;
      }

      return this.length;
    } catch (error) {
      const wrappedOperation = withQerrorsErrorHandling(
        () => { throw error; },
        `${this.options.name}.push`
      );
      wrappedOperation();
      throw error;
    }
  }

  /**
   * Remove and return the oldest item
   * @returns {*} The oldest item, or undefined if empty
   */
  shift () {
    try {
      const item = this._useArrayFallback
        ? this.buffer.shift()
        : this.buffer.shift();

      if (item !== undefined && this.options.enableMetrics) {
        this.metrics.shiftCount++;
      }

      return item;
    } catch (error) {
      const wrappedOperation = withQerrorsErrorHandling(
        () => { throw error; },
        `${this.options.name}.shift`
      );
      wrappedOperation();
      throw error;
    }
  }

  /**
   * Peek at the oldest item without removing it
   * @returns {*} The oldest item, or undefined if empty
   */
  peek () {
    try {
      return this._useArrayFallback
        ? this.buffer[0]
        : this.buffer.peekFirst();
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Peek at the newest item without removing it
   * @returns {*} The newest item, or undefined if empty
   */
  peekLast () {
    try {
      if (this._useArrayFallback) {
        return this.buffer[this.buffer.length - 1];
      } else {
        return this.buffer.peekLast();
      }
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get current buffer size
   * @returns {number} Number of items in buffer
   */
  get length () {
    return this._useArrayFallback
      ? this.buffer.length
      : this.buffer.length;
  }

  /**
   * Check if buffer is empty
   * @returns {boolean} True if buffer has no items
   */
  isEmpty () {
    return this.length === 0;
  }

  /**
   * Check if buffer is at capacity
   * @returns {boolean} True if buffer is full
   */
  isFull () {
    return this.length >= this.maxSize;
  }

  /**
   * Get buffer capacity utilization
   * @returns {number} Utilization percentage (0-100)
   */
  getUtilization () {
    return Math.round((this.length / this.maxSize) * 100);
  }

  /**
   * Convert buffer to array (oldest to newest)
   * @returns {Array} Array copy of buffer contents
   */
  toArray () {
    if (this._useArrayFallback) {
      return [...this.buffer];
    } else {
      return this.buffer.toArray();
    }
  }

  /**
   * Remove multiple items from the beginning
   * @param {number} count - Number of items to remove
   * @returns {Array} Removed items
   */
  splice (count) {
    const result = [];
    const itemsToRemove = Math.min(count, this.length);

    for (let i = 0; i < itemsToRemove; i++) {
      const item = this.shift();
      if (item !== undefined) {
        result.push(item);
      }
    }

    return result;
  }

  /**
   * Clear all items from buffer
   */
  clear () {
    try {
      if (this._useArrayFallback) {
        this.buffer.length = 0;
      } else {
        this.buffer.clear();
      }

      if (this.options.enableMetrics) {
        this.metrics.totalProcessed = 0;
      }
    } catch (error) {
      const wrappedOperation = withQerrorsErrorHandling(
        () => { throw error; },
        `${this.options.name}.clear`
      );
      wrappedOperation();
    }
  }

  /**
   * Get performance metrics (if enabled)
   * @returns {Object|null} Metrics object or null if disabled
   */
  getMetrics () {
    if (!this.options.enableMetrics) {
      return null;
    }

    return {
      ...this.metrics,
      utilization: this.getUtilization(),
      capacity: this.maxSize,
      currentSize: this.length
    };
  }

  /**
   * Get buffer statistics
   * @returns {Object} Current buffer statistics
   */
  getStats () {
    return {
      maxSize: this.maxSize,
      currentSize: this.length,
      utilization: this.getUtilization(),
      isEmpty: this.isEmpty(),
      isFull: this.isFull(),
      metrics: this.getMetrics()
    };
  }
}

/**
 * Factory function for creating specialized circular buffers
 */
const BufferFactory = {
  /**
   * Create a logging buffer with appropriate defaults
   * @param {number} size - Buffer size
   * @param {Object} options - Additional options
   * @returns {UnifiedCircularBuffer} Logging-optimized buffer
   */
  createLogBuffer: (size = 500, options = {}) => {
    return new UnifiedCircularBuffer(size, {
      name: 'LogBuffer',
      enableMetrics: true,
      enableOverflowLogging: true,
      ...options
    });
  },

  /**
   * Create a memory buffer for general use
   * @param {number} size - Buffer size
   * @param {Object} options - Additional options
   * @returns {UnifiedCircularBuffer} Memory-optimized buffer
   */
  createMemoryBuffer: (size = 1000, options = {}) => {
    return new UnifiedCircularBuffer(size, {
      name: 'MemoryBuffer',
      enableMetrics: false,
      enableOverflowLogging: false,
      ...options
    });
  },

  /**
   * Create a metrics buffer with performance tracking
   * @param {number} size - Buffer size
   * @param {Object} options - Additional options
   * @returns {UnifiedCircularBuffer} Metrics-optimized buffer
   */
  createMetricsBuffer: (size = 200, options = {}) => {
    return new UnifiedCircularBuffer(size, {
      name: 'MetricsBuffer',
      enableMetrics: true,
      enableOverflowLogging: false,
      ...options
    });
  }
};

// Export the unified implementations
module.exports = {
  UnifiedCircularBuffer,
  BufferFactory,

  // Convenience exports for backward compatibility
  CircularBuffer: UnifiedCircularBuffer,
  CircularLogBuffer: UnifiedCircularBuffer
};
