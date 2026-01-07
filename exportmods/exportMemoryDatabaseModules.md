## Memory/Database
### @qerrors/circular-buffer
**Purpose:** High-performance circular buffer implementation with memory-efficient bounded storage.
**Explanation:**  
This module provides a unified circular buffer implementation that combines the best features from various buffer implementations with enhanced performance and safety features. It uses the denque library for optimal performance when available, with array fallback for compatibility. The buffer is memory-efficient with bounded storage, comprehensive metrics tracking, and overflow handling, making it valuable for any application that needs efficient circular data storage for logs, metrics, or streaming data.

Key problems solved:
- Provides memory-efficient bounded data storage with predictable memory usage
- Handles overflow scenarios gracefully with automatic old item removal
- Offers comprehensive performance metrics and utilization tracking
- Supports multiple use cases (logging, memory, metrics) with factory patterns
- Includes error safety and input validation for robust operation

```javascript
// Exact current implementation copied from the codebase
const { withQerrorsErrorHandling } = require('./errorWrapper');
const { verboseLog } = require('./logging');

class UnifiedCircularBuffer {
  constructor (maxSize = 1000, options = {}) {
    this.maxSize = Math.max(1, parseInt(maxSize) || 1000);
    this.options = {
      enableMetrics: false,
      enableOverflowLogging: false,
      name: 'UnifiedCircularBuffer',
      ...options
    };

    try {
      const Denque = require('denque');
      this.buffer = new Denque();
    } catch (error) {
      this.buffer = [];
      this._useArrayFallback = true;
    }

    if (this.options.enableMetrics) {
      this.metrics = {
        pushCount: 0,
        shiftCount: 0,
        overflowCount: 0,
        totalProcessed: 0
      };
    }
  }

  push (item) {
    try {
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

  peek () {
    try {
      return this._useArrayFallback
        ? this.buffer[0]
        : this.buffer.peekFirst();
    } catch (error) {
      return undefined;
    }
  }

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

  get length () {
    return this._useArrayFallback
      ? this.buffer.length
      : this.buffer.length;
  }

  isEmpty () {
    return this.length === 0;
  }

  isFull () {
    return this.length >= this.maxSize;
  }

  getUtilization () {
    return Math.round((this.length / this.maxSize) * 100);
  }

  toArray () {
    if (this._useArrayFallback) {
      return [...this.buffer];
    } else {
      return this.buffer.toArray();
    }
  }

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

const BufferFactory = {
  createLogBuffer: (size = 500, options = {}) => {
    return new UnifiedCircularBuffer(size, {
      name: 'LogBuffer',
      enableMetrics: true,
      enableOverflowLogging: true,
      ...options
    });
  },

  createMemoryBuffer: (size = 1000, options = {}) => {
    return new UnifiedCircularBuffer(size, {
      name: 'MemoryBuffer',
      enableMetrics: false,
      enableOverflowLogging: false,
      ...options
    });
  },

  createMetricsBuffer: (size = 200, options = {}) => {
    return new UnifiedCircularBuffer(size, {
      name: 'MetricsBuffer',
      enableMetrics: true,
      enableOverflowLogging: false,
      ...options
    });
  }
};

module.exports = {
  UnifiedCircularBuffer,
  BufferFactory,
  CircularBuffer: UnifiedCircularBuffer,
  CircularLogBuffer: UnifiedCircularBuffer
};
```