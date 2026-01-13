/**
 * Production Monitoring and Metrics Collection
 * 
 * Provides comprehensive monitoring capabilities for qerrors production deployments
 * including real-time metrics, health checks, and alerting.
 */

const { performance } = require('perf_hooks');
const EventEmitter = require('events');
const os = require('os');

class ProductionMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      metricsInterval: options.metricsInterval || 60000, // 1 minute
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
      alertThresholds: {
        errorRate: options.alertErrorRate || 0.1, // 10% error rate
        memoryUsage: options.alertMemoryUsage || 0.8, // 80% memory
        queueLength: options.alertQueueLength || 0.9, // 90% queue capacity
        responseTime: options.alertResponseTime || 1000, // 1 second
        ...options.alertThresholds
      },
      enableAlerts: options.enableAlerts !== false,
      ...options
    };
    
    // Metrics storage
    this.metrics = {
      errors: {
        total: 0,
        byType: new Map(),
        bySeverity: new Map(),
        rateHistory: [],
        averageResponseTime: 0
      },
      performance: {
        memoryHistory: [],
        cpuHistory: [],
        responseTimeHistory: []
      },
      queue: {
        lengthHistory: [],
        rejectionHistory: [],
        throughputHistory: []
      },
      system: {
        uptime: process.uptime(),
        startTime: Date.now()
      }
    };
    
    // Monitoring state
    this.isMonitoring = false;
    this.alerts = new Map();
    this.lastHealthCheck = null;
    
    // Timers
    this.metricsTimer = null;
    this.healthTimer = null;
  }

  /**
   * Start production monitoring
   */
  start() {
    if (this.isMonitoring) {
      this.emit('warning', 'Monitoring already started');
      return;
    }
    
    this.isMonitoring = true;
    this.emit('started', 'Production monitoring started');
    
    // Clear any existing timers
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    
    // Start periodic metrics collection
    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
    }, this.options.metricsInterval);
    this.metricsTimer.unref();
    
    // Start health checks
    this.healthTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.options.healthCheckInterval);
    this.healthTimer.unref();
    
    // Initial collection
    this.collectMetrics();
    this.performHealthCheck();
  }

  /**
   * Stop production monitoring
   */
  stop() {
    if (!this.isMonitoring) {
      this.emit('warning', 'Monitoring not started');
      return;
    }
    
    this.isMonitoring = false;
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
    
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    
    this.emit('stopped', 'Production monitoring stopped');
  }

  /**
   * Record error occurrence
   */
  recordError(error, responseTime = 0) {
    const timestamp = Date.now();
    const errorType = error.name || 'UnknownError';
    const severity = error.severity || 'medium';
    
    // Update error metrics
    this.metrics.errors.total++;
    
    // Update by type
    if (!this.metrics.errors.byType.has(errorType)) {
      this.metrics.errors.byType.set(errorType, { count: 0, lastSeen: timestamp });
    }
    this.metrics.errors.byType.get(errorType).count++;
    this.metrics.errors.byType.get(errorType).lastSeen = timestamp;
    
    // Update by severity
    if (!this.metrics.errors.bySeverity.has(severity)) {
      this.metrics.errors.bySeverity.set(severity, { count: 0, lastSeen: timestamp });
    }
    this.metrics.errors.bySeverity.get(severity).count++;
    this.metrics.errors.bySeverity.get(severity).lastSeen = timestamp;
    
    // Update response time
    if (responseTime > 0) {
      const total = this.metrics.errors.averageResponseTime * (this.metrics.errors.total - 1) + responseTime;
      this.metrics.errors.averageResponseTime = total / this.metrics.errors.total;
    }
    
    // Calculate error rate (last minute)
    this.calculateErrorRate();
    
    // Check for alerts
    if (this.options.enableAlerts) {
      this.checkErrorAlerts(error);
    }
    
    this.emit('errorRecorded', { error, timestamp, metrics: this.getMetrics() });
  }

  /**
   * Record queue metrics
   */
  recordQueueMetrics(length, rejections = 0, processed = 0) {
    const timestamp = Date.now();
    
    // Update queue metrics
    this.metrics.queue.lengthHistory.push({ timestamp, value: length });
    this.metrics.queue.rejectionHistory.push({ timestamp, value: rejections });
    this.metrics.queue.throughputHistory.push({ timestamp, value: processed });
    
    // Keep only recent history (last 100 data points)
    if (this.metrics.queue.lengthHistory.length > 100) {
      this.metrics.queue.lengthHistory.shift();
    }
    if (this.metrics.queue.rejectionHistory.length > 100) {
      this.metrics.queue.rejectionHistory.shift();
    }
    if (this.metrics.queue.throughputHistory.length > 100) {
      this.metrics.queue.throughputHistory.shift();
    }
    
    // Check queue alerts
    if (this.options.enableAlerts) {
      this.checkQueueAlerts(length, rejections);
    }
    
    this.emit('queueMetrics', { length, rejections, processed, timestamp });
  }

  /**
   * Collect system metrics
   */
  collectMetrics() {
    const timestamp = Date.now();
    
    // Memory metrics
    const memUsage = process.memoryUsage();
    this.metrics.performance.memoryHistory.push({
      timestamp,
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      percentage: memUsage.heapUsed / memUsage.heapTotal
    });
    
    // CPU metrics
    const cpuUsage = process.cpuUsage();
    this.metrics.performance.cpuHistory.push({
      timestamp,
      user: cpuUsage.user,
      system: cpuUsage.system
    });
    
    // Keep only recent history
    if (this.metrics.performance.memoryHistory.length > 100) {
      this.metrics.performance.memoryHistory.shift();
    }
    if (this.metrics.performance.cpuHistory.length > 100) {
      this.metrics.performance.cpuHistory.shift();
    }
    
    this.emit('metricsCollected', {
      timestamp,
      memory: this.metrics.performance.memoryHistory[this.metrics.performance.memoryHistory.length - 1],
      cpu: this.metrics.performance.cpuHistory[this.metrics.performance.cpuHistory.length - 1]
    });
  }

  /**
   * Perform comprehensive health check
   */
  performHealthCheck() {
    const timestamp = Date.now();
    const health = {
      timestamp,
      status: 'healthy',
      issues: [],
      metrics: this.getHealthMetrics()
    };
    
    // Check memory usage
    const currentMemory = process.memoryUsage();
    const memoryPercentage = currentMemory.heapUsed / currentMemory.heapTotal;
    if (memoryPercentage > this.options.alertThresholds.memoryUsage) {
      health.status = 'degraded';
      health.issues.push({
        type: 'memory',
        severity: 'warning',
        message: `Memory usage at ${(memoryPercentage * 100).toFixed(1)}%`,
        value: memoryPercentage
      });
    }
    
    // Check error rate
    if (this.metrics.errors.rateHistory.length > 0) {
      const latestRate = this.metrics.errors.rateHistory[this.metrics.errors.rateHistory.length - 1];
      if (latestRate > this.options.alertThresholds.errorRate) {
        health.status = 'degraded';
        health.issues.push({
          type: 'error_rate',
          severity: 'warning',
          message: `Error rate at ${(latestRate * 100).toFixed(2)}%`,
          value: latestRate
        });
      }
    }
    
    // Check response time
    if (this.metrics.errors.averageResponseTime > this.options.alertThresholds.responseTime) {
      health.status = 'degraded';
      health.issues.push({
        type: 'response_time',
        severity: 'warning',
        message: `Average response time ${this.metrics.errors.averageResponseTime.toFixed(2)}ms`,
        value: this.metrics.errors.averageResponseTime
      });
    }
    
    this.lastHealthCheck = health;
    this.emit('healthCheck', health);
    
    // Alert if status degraded
    if (health.status !== 'healthy' && this.options.enableAlerts) {
      this.emit('alert', {
        type: 'health',
        severity: 'warning',
        message: 'System health degraded',
        details: health.issues
      });
    }
  }

  /**
   * Calculate error rate over time window
   */
  calculateErrorRate() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000; // Last minute
    
    // Count errors in last minute
    let recentErrors = 0;
    for (const [type, data] of this.metrics.errors.byType.entries()) {
      if (data.lastSeen >= oneMinuteAgo) {
        recentErrors += data.count;
      }
    }
    
    const rate = this.metrics.errors.total > 0 ? recentErrors / this.metrics.errors.total : 0;
    
    this.metrics.errors.rateHistory.push({
      timestamp: now,
      rate,
      count: recentErrors
    });
    
    // Keep only recent history
    if (this.metrics.errors.rateHistory.length > 60) { // Keep last hour
      this.metrics.errors.rateHistory.shift();
    }
  }

  /**
   * Check error-related alerts
   */
  checkErrorAlerts(error) {
    const errorType = error.name || 'UnknownError';
    const alertKey = `error_type_${errorType}`;
    
    // Check for error frequency spikes
    const typeData = this.metrics.errors.byType.get(errorType);
    if (typeData && typeData.count > 10) { // More than 10 of same error
      this.createAlert(alertKey, {
        type: 'error_frequency',
        severity: 'warning',
        message: `High frequency of ${errorType} errors`,
        count: typeData.count
      });
    }
  }

  /**
   * Check queue-related alerts
   */
  checkQueueAlerts(length, rejections) {
    // Check queue capacity
    const queueCapacity = length / 2000; // Assuming max queue size of 2000
    if (queueCapacity > this.options.alertThresholds.queueLength) {
      this.createAlert('queue_capacity', {
        type: 'queue_capacity',
        severity: 'warning',
        message: `Queue at ${(queueCapacity * 100).toFixed(1)}% capacity`,
        value: queueCapacity
      });
    }
    
    // Check rejection rate
    if (rejections > 0) {
      this.createAlert('queue_rejection', {
        type: 'queue_rejection',
        severity: 'warning',
        message: `Queue rejecting requests: ${rejections} rejections`,
        count: rejections
      });
    }
  }

  /**
   * Create alert with deduplication
   */
  createAlert(key, alert) {
    const now = Date.now();
    
    // Check if alert already exists and is recent (within 5 minutes)
    const existingAlert = this.alerts.get(key);
    if (existingAlert && (now - existingAlert.timestamp) < 300000) {
      existingAlert.count++;
      return; // Suppress duplicate alerts
    }
    
    // Create new alert
    const newAlert = {
      ...alert,
      key,
      timestamp: now,
      count: 1,
      resolved: false
    };
    
    this.alerts.set(key, newAlert);
    this.emit('alert', newAlert);
  }

  /**
   * Get current metrics summary
   */
  getMetrics() {
    return {
      errors: {
        total: this.metrics.errors.total,
        averageResponseTime: this.metrics.errors.averageResponseTime,
        byType: Object.fromEntries(this.metrics.errors.byType),
        bySeverity: Object.fromEntries(this.metrics.errors.bySeverity),
        rateHistory: this.metrics.errors.rateHistory.slice(-10) // Last 10 data points
      },
      performance: {
        memory: this.metrics.performance.memoryHistory.slice(-1),
        cpu: this.metrics.performance.cpuHistory.slice(-1),
        memoryHistory: this.metrics.performance.memoryHistory.slice(-60), // Last hour
        cpuHistory: this.metrics.performance.cpuHistory.slice(-60)
      },
      queue: {
        current: this.metrics.queue.lengthHistory.slice(-1),
        rejections: this.metrics.queue.rejectionHistory.slice(-10), // Last 10
        throughput: this.metrics.queue.throughputHistory.slice(-10)
      },
      system: {
        uptime: process.uptime(),
        startTime: this.metrics.system.startTime,
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        memory: os.totalmem()
      },
      alerts: {
        active: Array.from(this.alerts.values()).filter(alert => !alert.resolved),
        total: this.alerts.size
      }
    };
  }

  /**
   * Get health metrics for monitoring
   */
  getHealthMetrics() {
    const latestMemory = this.metrics.performance.memoryHistory.length > 0 ? 
      this.metrics.performance.memoryHistory.slice(-1)[0] : null;
    const latestCpu = this.metrics.performance.cpuHistory.length > 0 ? 
      this.metrics.performance.cpuHistory.slice(-1)[0] : null;
    const latestQueue = this.metrics.queue.lengthHistory.length > 0 ? 
      this.metrics.queue.lengthHistory.slice(-1)[0] : null;
    
    return {
      memory: latestMemory ? {
        used: latestMemory.heapUsed,
        total: latestMemory.heapTotal,
        percentage: latestMemory.percentage
      } : null,
      cpu: latestCpu,
      queue: latestQueue,
      uptime: process.uptime(),
      errorRate: this.metrics.errors.rateHistory.length > 0 ? 
        this.metrics.errors.rateHistory.slice(-1)[0]?.rate || 0 : 0
    };
  }

  /**
   * Get alerts summary
   */
  getAlerts() {
    return {
      active: Array.from(this.alerts.values()).filter(alert => !alert.resolved),
      all: Array.from(this.alerts.values())
    };
  }

  /**
   * Resolve alert
   */
  resolveAlert(key) {
    const alert = this.alerts.get(key);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.emit('alertResolved', alert);
    }
  }

  /**
   * Clear all alerts
   */
  clearAlerts() {
    this.alerts.clear();
    this.emit('alertsCleared');
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      startTime: this.metrics.system.startTime,
      uptime: process.uptime(),
      lastHealthCheck: this.lastHealthCheck,
      alertCount: this.alerts.size,
      metricsCollected: this.metrics.performance.memoryHistory.length
    };
  }
}

// Export singleton instance
const productionMonitor = new ProductionMonitor({
  metricsInterval: 60000, // 1 minute
  healthCheckInterval: 30000, // 30 seconds
  enableAlerts: true,
  alertThresholds: {
    errorRate: 0.1, // 10% error rate
    memoryUsage: 0.8, // 80% memory
    queueLength: 0.9, // 90% queue capacity
    responseTime: 1000 // 1 second
  }
});

module.exports = {
  ProductionMonitor,
  productionMonitor,
  
  // Convenience functions
  start: () => productionMonitor.start(),
  stop: () => productionMonitor.stop(),
  recordError: (error, responseTime) => productionMonitor.recordError(error, responseTime),
  recordQueueMetrics: (length, rejections, processed) => productionMonitor.recordQueueMetrics(length, rejections, processed),
  getMetrics: () => productionMonitor.getMetrics(),
  getHealthMetrics: () => productionMonitor.getHealthMetrics(),
  getAlerts: () => productionMonitor.getAlerts(),
  getStatus: () => productionMonitor.getStatus()
};