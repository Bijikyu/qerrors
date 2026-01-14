'use strict';

const { createPerformanceTimer } = require('./logging');

/**
 * Performance monitoring utilities
 */
class PerformanceMonitor {
  constructor () {
    this.metrics = new Map();
    this.timers = new Map();
  }

  /**
   * Start timing an operation
   */
  startTimer (operationId, operation, metadata = {}) {
    const timer = createPerformanceTimer(operation, metadata.requestId);
    this.timers.set(operationId, {
      timer,
      operation,
      metadata,
      startTime: Date.now()
    });
    return operationId;
  }

  /**
   * End timing an operation and record metrics
   */
  endTimer (operationId, success = true, additionalContext = {}) {
    const timerInfo = this.timers.get(operationId);
    if (!timerInfo) return null;

    const { timer, operation, metadata } = timerInfo;

    // Record the performance data
    const performanceData = timer(success, {
      ...additionalContext,
      ...metadata
    });

    // Store metrics
    this.recordMetric(operation, performanceData);

    // Clean up timer
    this.timers.delete(operationId);

    return performanceData;
  }

  /**
   * Record operation metrics
   */
  recordMetric (operation, data) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, {
        count: 0,
        totalTime: 0,
        failures: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0
      });
    }

    const metric = this.metrics.get(operation);
    metric.count++;
    metric.totalTime += data.duration_ms;
    metric.avgTime = metric.totalTime / metric.count;
    metric.minTime = Math.min(metric.minTime, data.duration_ms);
    metric.maxTime = Math.max(metric.maxTime, data.duration_ms);

    if (!data.success) {
      metric.failures++;
    }
  }

  /**
   * Get metrics for an operation
   */
  getMetrics (operation) {
    return this.metrics.get(operation) || null;
  }

  /**
   * Get all metrics
   */
  getAllMetrics () {
    return Object.fromEntries(this.metrics);
  }

  /**
   * Clear metrics for an operation
   */
  clearMetrics (operation) {
    this.metrics.delete(operation);
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics () {
    this.metrics.clear();
    this.timers.clear();
  }

  /**
   * Get summary statistics
   */
  getSummary () {
    const summary = {
      totalOperations: 0,
      totalFailures: 0,
      avgDuration: 0,
      operations: []
    };

    for (const [operation, metric] of this.metrics) {
      summary.totalOperations += metric.count;
      summary.totalFailures += metric.failures;
      summary.avgDuration += metric.totalTime;

      summary.operations.push({
        operation,
        ...metric,
        successRate: ((metric.count - metric.failures) / metric.count * 100).toFixed(2)
      });
    }

    if (summary.totalOperations > 0) {
      summary.avgDuration = summary.avgDuration / summary.totalOperations;
      summary.overallSuccessRate = ((summary.totalOperations - summary.totalFailures) / summary.totalOperations * 100).toFixed(2);
    }

    return summary;
  }
}

/**
 * Create performance monitoring decorator for async functions
 * Enhanced with slow operation detection and tracing options
 * 
 * @param {Function} fn - Function to wrap
 * @param {string} operationName - Operation name for tracking
 * @param {Object} options - Performance options
 * @param {boolean} options.logSlowOperations - Whether to log slow operations (default: true)
 * @param {number} options.slowThreshold - Threshold in ms for slow operations (default: 1000)
 * @param {boolean} options.enableTracing - Whether to log start/complete for all operations (default: false)
 * @param {Object} options.context - Additional context to include in logs
 * @returns {Function} Wrapped function with performance monitoring
 */
const withPerformanceMonitoring = (fn, operationName, options = {}) => {
  const {
    logSlowOperations = true,
    slowThreshold = 1000,
    enableTracing = false,
    context = {}
  } = options;

  const monitor = new PerformanceMonitor();

  return async function monitoredFunction (...args) {
    const startTime = Date.now();
    const operationId = monitor.startTimer(operationName, operationName, {
      args: args.length,
      timestamp: startTime,
      ...context
    });

    // Log operation start if tracing enabled
    if (enableTracing) {
      console.debug(`[PERF] Starting operation: ${operationName}`, {
        argsCount: args.length,
        startTime: new Date(startTime).toISOString(),
        ...context
      });
    }

    try {
      const result = await fn.apply(this, args);
      const duration = Date.now() - startTime;

      // Log slow operations
      if (logSlowOperations && duration > slowThreshold) {
        console.warn(`[PERF] Slow operation detected: ${operationName}`, {
          duration: `${duration}ms`,
          threshold: `${slowThreshold}ms`,
          ...context
        });
      }

      // Log completion if tracing enabled
      if (enableTracing) {
        console.debug(`[PERF] Completed operation: ${operationName}`, {
          duration: `${duration}ms`,
          success: true,
          ...context
        });
      }

      monitor.endTimer(operationId, true, {
        resultType: typeof result,
        success: true,
        duration
      });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Always log failed operations
      console.error(`[PERF] Operation failed: ${operationName}`, {
        error: error.message,
        duration: `${duration}ms`,
        stack: error.stack,
        ...context
      });

      monitor.endTimer(operationId, false, {
        errorType: error.constructor.name,
        errorMessage: error.message,
        duration
      });
      throw error;
    }
  };
};

/**
 * Memory usage monitoring utilities
 */
const memoryMonitor = {
  /**
   * Get current memory usage
   */
  getCurrentUsage () {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
      arrayBuffers: Math.round((usage.arrayBuffers || 0) / 1024 / 1024)
    };
  },

  /**
   * Get memory usage difference
   */
  getUsageDiff (before, after) {
    return {
      heapUsed: after.heapUsed - before.heapUsed,
      heapTotal: after.heapTotal - before.heapTotal,
      external: after.external - before.external,
      rss: after.rss - before.rss,
      arrayBuffers: after.arrayBuffers - before.arrayBuffers
    };
  },

  /**
   * Monitor memory usage during operation
   */
  async monitorMemory (fn, operation = 'operation') {
    const before = this.getCurrentUsage();
    const startTime = Date.now();

    try {
      const result = await fn();
      const after = this.getCurrentUsage();
      const duration = Date.now() - startTime;

      return {
        result,
        metrics: {
          operation,
          duration,
          memoryBefore: before,
          memoryAfter: after,
          memoryDelta: this.getUsageDiff(before, after)
        }
      };
    } catch (error) {
      const after = this.getCurrentUsage();
      const duration = Date.now() - startTime;

      throw Object.assign(error, {
        metrics: {
          operation,
          duration,
          memoryBefore: before,
          memoryAfter: after,
          memoryDelta: this.getUsageDiff(before, after)
        }
      });
    }
  }
};

// Create global performance monitor instance
const globalMonitor = new PerformanceMonitor();

module.exports = {
  PerformanceMonitor,
  globalMonitor,
  withPerformanceMonitoring,
  memoryMonitor,
  createPerformanceTimer
};
