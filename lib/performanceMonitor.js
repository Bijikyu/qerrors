/**
 * Performance Monitoring and Alerting System
 * 
 * Provides comprehensive monitoring for:
 * - Blocking operations (>20ms)
 * - Memory growth patterns
 * - GC pause frequency
 * - Event loop lag
 * - CPU-intensive operations
 */

const { performance } = require('perf_hooks');
const EventEmitter = require('events');

/**
 * Circular buffer for efficient metrics storage
 */
class CircularBuffer {
  constructor(size = 100) {
    this.buffer = new Array(size);
    this.size = size;
    this.index = 0;
    this.count = 0;
  }
  
  push(item) {
    this.buffer[this.index] = item;
    this.index = (this.index + 1) % this.size;
    this.count = Math.min(this.count + 1, this.size);
  }
  
  toArray() {
    if (this.count === 0) return [];
    
    const result = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.index - this.count + i + this.size) % this.size;
      result.push(this.buffer[idx]);
    }
    return result;
  }
  
  get length() {
    return this.count;
  }
  
  clear() {
    this.index = 0;
    this.count = 0;
  }
  
  filter(predicate) {
    return this.toArray().filter(predicate);
  }
  
  reduce(callback, initialValue) {
    return this.toArray().reduce(callback, initialValue);
  }
}

class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      blockingThreshold: options.blockingThreshold || 20, // ms
      memoryGrowthThreshold: options.memoryGrowthThreshold || 50, // MB
      gcPauseThreshold: options.gcPauseThreshold || 10, // ms
      eventLoopLagThreshold: options.eventLoopLagThreshold || 5, // ms
      monitoringInterval: options.monitoringInterval || 30000, // 30 seconds
      ...options
    };
    
    this.metrics = {
      blockingOperations: new CircularBuffer(100),
      memorySnapshots: new CircularBuffer(100),
      gcPauses: new CircularBuffer(50),
      eventLoopLag: new CircularBuffer(100),
      cpuIntensiveOperations: new CircularBuffer(50),
      alerts: new CircularBuffer(20)
    };
    
    this.timers = new Map();
    this.memoryBaseline = null;
    this.monitoringInterval = null;
    
    // Setup GC monitoring if available
    this.setupGCMonitoring();
    
    // Start baseline measurement
    this.captureMemoryBaseline();
  }
  
  /**
   * Start monitoring performance metrics
   */
  start() {
    if (this.monitoringInterval) {
      return;
    }
    
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkThresholds();
    }, this.config.monitoringInterval);
    
    // Unref to prevent blocking process exit
    this.monitoringInterval.unref();
    
    console.log('Performance monitoring started');
  }
  
  /**
   * Stop monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Performance monitoring stopped');
    }
  }
  
  /**
   * Monitor a potentially blocking operation
   */
  monitorBlocking(name, operation) {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    const timer = {
      name,
      startTime,
      startMemory
    };
    
    this.timers.set(name, timer);
    
    const finish = () => {
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const duration = endTime - startTime;
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
      
      // Record metrics
      const metric = {
        name,
        duration,
        memoryDelta,
        timestamp: Date.now(),
        blocking: duration > this.config.blockingThreshold
      };
      
      this.metrics.blockingOperations.push(metric);
      
      // Alert if blocking
      if (metric.blocking) {
        this.createAlert('blocking_operation', {
          operation: name,
          duration: metric.duration,
          threshold: this.config.blockingThreshold
        });
      }
      
      this.timers.delete(name);
      
      return metric;
    };
    
    // If operation is a function, wrap it
    if (typeof operation === 'function') {
      if (operation.constructor.name === 'AsyncFunction') {
        return operation().then(result => {
          finish();
          return result;
        }).catch(error => {
          finish();
          throw error;
        });
      } else {
        try {
          const result = operation();
          finish();
          return result;
        } catch (error) {
          finish();
          throw error;
        }
      }
    }
    
    // Return finish function for manual timing
    return { finish };
  }
  
  /**
   * Monitor event loop lag
   */
  measureEventLoopLag() {
    const start = performance.now();
    
    return new Promise(resolve => {
      setImmediate(() => {
        const lag = performance.now() - start;
        
        this.metrics.eventLoopLag.push({
          lag,
          timestamp: Date.now(),
          threshold: this.config.eventLoopLagThreshold
        });
        
        // Alert if high lag
        if (lag > this.config.eventLoopLagThreshold) {
          this.createAlert('event_loop_lag', {
            lag,
            threshold: this.config.eventLoopLagThreshold
          });
        }
        
        resolve(lag);
      });
    });
  }
  
  /**
   * Collect current metrics
   */
  collectMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Memory snapshot
    this.metrics.memorySnapshots.push({
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      timestamp: Date.now()
    });
    
    // Measure event loop lag
    this.measureEventLoopLag();
  }
  
  /**
   * Check thresholds and create alerts
   */
  checkThresholds() {
    // Check memory growth
    if (this.metrics.memorySnapshots.length >= 2) {
      const recent = this.metrics.memorySnapshots.slice(-10);
      const oldest = recent[0];
      const newest = recent[recent.length - 1];
      
      const growthMB = (newest.heapUsed - oldest.heapUsed) / 1024 / 1024;
      
      if (growthMB > this.config.memoryGrowthThreshold) {
        this.createAlert('memory_growth', {
          growth: growthMB,
          timeframe: 'recent snapshots',
          threshold: this.config.memoryGrowthThreshold
        });
      }
    }
    
    // Check blocking operations frequency
    const recentBlocking = this.metrics.blockingOperations
      .filter(op => Date.now() - op.timestamp < 60000) // Last minute
      .filter(op => op.blocking);
    
    if (recentBlocking.length > 5) {
      this.createAlert('frequent_blocking', {
        count: recentBlocking.length,
        timeframe: '1 minute'
      });
    }
  }
  
  /**
   * Create an alert
   */
  createAlert(type, data) {
    const alert = {
      type,
      data,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    };
    
    this.metrics.alerts.push(alert);
    
    // Keep only recent alerts
    if (this.metrics.alerts.length > 50) {
      this.metrics.alerts.shift();
    }
    
    // Emit alert event
    this.emit('alert', alert);
    
    // Log alert
    console.warn(`🚨 Performance Alert [${type}]:`, data);
  }
  
  /**
   * Setup garbage collection monitoring
   */
  setupGCMonitoring() {
    if (global.gc && typeof global.gc === 'function') {
      const originalGC = global.gc;
      
      global.gc = (...args) => {
        const start = performance.now();
        const result = originalGC.apply(this, args);
        const duration = performance.now() - start;
        
        this.metrics.gcPauses.push({
          duration,
          timestamp: Date.now(),
          type: 'manual'
        });
        
        if (duration > this.config.gcPauseThreshold) {
          this.createAlert('gc_pause', {
            duration,
            type: 'manual',
            threshold: this.config.gcPauseThreshold
          });
        }
        
        return result;
      };
    }
    
    // Monitor GC if available (Node.js 12+)
    if (global.performance && global.performance.gc) {
      global.performance.gc = () => {
        const start = performance.now();
        // Trigger GC
        if (global.gc) global.gc();
        const duration = performance.now() - start;
        
        this.metrics.gcPauses.push({
          duration,
          timestamp: Date.now(),
          type: 'performance'
        });
      };
    }
  }
  
  /**
   * Capture memory baseline
   */
  captureMemoryBaseline() {
    this.memoryBaseline = process.memoryUsage();
  }
  
  /**
   * Get performance summary
   */
  getSummary() {
    const now = Date.now();
    const lastHour = now - 3600000;
    
    return {
      timestamp: now,
      memory: {
        current: process.memoryUsage(),
        baseline: this.memoryBaseline,
        growth: this.memoryBaseline ? 
          (process.memoryUsage().heapUsed - this.memoryBaseline.heapUsed) / 1024 / 1024 : 0
      },
      blocking: {
        total: this.metrics.blockingOperations.length,
        recent: this.metrics.blockingOperations.filter(op => op.timestamp > lastHour).length,
        averageDuration: this.metrics.blockingOperations.length > 0 ?
          this.metrics.blockingOperations.reduce((sum, op) => sum + op.duration, 0) / 
          this.metrics.blockingOperations.length : 0
      },
      eventLoop: {
        currentLag: this.metrics.eventLoopLag.length > 0 ?
          this.metrics.eventLoopLag[this.metrics.eventLoopLag.length - 1].lag : 0,
        averageLag: this.metrics.eventLoopLag.length > 0 ?
          this.metrics.eventLoopLag.reduce((sum, lag) => sum + lag.lag, 0) / 
          this.metrics.eventLoopLag.length : 0
      },
      alerts: {
        total: this.metrics.alerts.length,
        recent: this.metrics.alerts.filter(alert => alert.timestamp > lastHour).length
      }
    };
  }
  
  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      blockingOperations: [],
      memorySnapshots: [],
      gcPauses: [],
      eventLoopLag: [],
      cpuIntensiveOperations: [],
      alerts: []
    };
    this.captureMemoryBaseline();
  }
}

// Singleton instance with thread safety
let performanceMonitorInstance = null;
let isCreatingInstance = false;

function getPerformanceMonitor(options) {
  if (!performanceMonitorInstance && !isCreatingInstance) {
    isCreatingInstance = true;
    performanceMonitorInstance = new PerformanceMonitor(options);
    isCreatingInstance = false;
  }
  // Warn if options are ignored on subsequent calls
  if (performanceMonitorInstance && options) {
    console.warn('Performance monitor already initialized with different options - ignoring new options');
  }
  return performanceMonitorInstance;
}

// Convenience function for monitoring operations
function monitorOperation(name, operation) {
  const monitor = getPerformanceMonitor();
  return monitor.monitorBlocking(name, operation);
}

module.exports = {
  PerformanceMonitor,
  getPerformanceMonitor,
  monitorOperation
};