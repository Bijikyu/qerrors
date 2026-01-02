#!/usr/bin/env node

/**
 * Production Performance Monitoring Script
 * 
 * Monitors qerrors performance in production environment
 * Provides real-time metrics and alerting for performance issues
 */

const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');
const { getCurrentMemoryPressure } = require('./lib/shared/memoryMonitor');

class ProductionMonitor {
  constructor() {
    this.metrics = {
      startTime: Date.now(),
      checks: [],
      alerts: [],
      performance: {
        eventLoopLag: [],
        memoryUsage: [],
        responseTime: [],
        errorRate: []
      }
    };
    
    this.alertThresholds = {
      eventLoopLag: 10, // ms
      memoryUsage: 80, // percentage
      responseTime: 1000, // ms
      errorRate: 0.05 // 5%
    };
    
    this.monitoring = false;
    this.interval = null;
  }

  /**
   * Start production monitoring
   */
  startMonitoring(intervalMs = 60000) { // Default: 1 minute
    console.log('🔍 Starting Production Performance Monitoring...\n');
    
    this.monitoring = true;
    this.interval = setInterval(() => {
      this.runHealthChecks();
      this.printMetrics();
    }, intervalMs);
    
    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    
    console.log(`📊 Monitoring started with ${intervalMs/1000}s interval`);
    console.log('⚠️  Press Ctrl+C to stop monitoring\n');
  }

  /**
   * Run comprehensive health checks
   */
  async runHealthChecks() {
    try {
      const checkResults = await Promise.allSettled([
        this.checkEventLoop(),
        this.checkMemoryUsage(),
        this.checkModuleLoad(),
        this.checkQueuePerformance()
      ]);
      
      this.metrics.checks = checkResults.map((result, index) => ({
        name: ['Event Loop', 'Memory', 'Module Load', 'Queue Performance'][index],
        status: result.status,
        value: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null,
        timestamp: Date.now()
      }));
      
      this.analyzeResults();
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
    }
  }

  /**
   * Check event loop lag
   */
  checkEventLoop() {
    return new Promise((resolve) => {
      const start = performance.now();
      
      setImmediate(() => {
        const lag = performance.now() - start;
        this.metrics.performance.eventLoopLag.push({
          value: lag,
          timestamp: Date.now()
        });
        
        resolve(lag);
      });
    });
  }

  /**
   * Check memory usage
   */
  checkMemoryUsage() {
    const memoryInfo = getCurrentMemoryPressure();
    const memUsage = memoryInfo.raw;
    
    this.metrics.performance.memoryUsage.push({
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      percentage: memoryInfo.heapUsageRatio * 100,
      external: memUsage.external,
      rss: memUsage.rss,
      timestamp: Date.now()
    });
    
    return memoryInfo.heapUsageRatio * 100;
  }

  /**
   * Check module load performance
   */
  async checkModuleLoad() {
    const start = performance.now();
    
    try {
      // Test loading of key modules
      const qerrors = require('../index.js');
      const loadTime = performance.now() - start;
      
      return {
        loadTime,
        success: true,
        moduleCount: Object.keys(qerrors).length
      };
    } catch (error) {
      return {
        loadTime: performance.now() - start,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check queue performance if available
   */
  async checkQueuePerformance() {
    try {
      const qerrors = require('../index.js');
      
      if (typeof qerrors.getQueueStats === 'function') {
        const stats = qerrors.getQueueStats();
        
        return {
          activeConnections: stats.activeConnections || 0,
          pendingRequests: stats.pendingRequests || 0,
          processedRequests: stats.processedRequests || 0,
          successRate: stats.successRate || 0
        };
      } else {
        return { message: 'Queue stats not available' };
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Analyze results and generate alerts
   */
  analyzeResults() {
    const latest = this.getLatestMetrics();
    const newAlerts = [];
    
    // Check event loop lag
    if (latest.eventLoop > this.alertThresholds.eventLoopLag) {
      newAlerts.push({
        type: 'EVENT_LOOP_LAG',
        severity: 'HIGH',
        message: `Event loop lag: ${latest.eventLoop.toFixed(2)}ms (threshold: ${this.alertThresholds.eventLoopLag}ms)`,
        recommendation: 'Investigate blocking operations or high CPU usage'
      });
    }
    
    // Check memory usage
    if (latest.memory > this.alertThresholds.memoryUsage) {
      newAlerts.push({
        type: 'HIGH_MEMORY',
        severity: 'MEDIUM',
        message: `Memory usage: ${latest.memory.toFixed(1)}% (threshold: ${this.alertThresholds.memoryUsage}%)`,
        recommendation: 'Check for memory leaks or optimize memory usage'
      });
    }
    
    // Check module load time
    if (latest.moduleLoad && latest.moduleLoad.loadTime > 100) {
      newAlerts.push({
        type: 'SLOW_MODULE_LOAD',
        severity: 'MEDIUM',
        message: `Module load time: ${latest.moduleLoad.loadTime.toFixed(2)}ms`,
        recommendation: 'Check for module loading optimization opportunities'
      });
    }
    
    this.metrics.alerts.push(...newAlerts);
    
    // Print alerts immediately
    if (newAlerts.length > 0) {
      console.log('\n🚨 PERFORMANCE ALERTS:');
      newAlerts.forEach(alert => {
        const icon = alert.severity === 'HIGH' ? '🔴' : '🟡';
        console.log(`${icon} ${alert.type}: ${alert.message}`);
        console.log(`   💡 ${alert.recommendation}\n`);
      });
    }
  }

  /**
   * Get latest metrics
   */
  getLatestMetrics() {
    const eventLoop = this.metrics.performance.eventLoopLag.slice(-1)[0];
    const memory = this.metrics.performance.memoryUsage.slice(-1)[0];
    const moduleLoad = this.metrics.checks.find(c => c.name === 'Module Load');
    const queue = this.metrics.checks.find(c => c.name === 'Queue Performance');
    
    return {
      eventLoop: eventLoop ? eventLoop.value : 0,
      memory: memory ? memory.percentage : 0,
      moduleLoad: moduleLoad ? moduleLoad.value : null,
      queue: queue ? queue.value : null,
      timestamp: Date.now()
    };
  }

  /**
   * Print current metrics dashboard
   */
  printMetrics() {
    const latest = this.getLatestMetrics();
    const uptime = Math.floor((Date.now() - this.metrics.startTime) / 1000);
    
    console.clear();
    console.log('🔍 Qerrors Production Performance Monitor');
    console.log('=====================================\n');
    
    console.log(`⏱️  Uptime: ${uptime}s\n`);
    
    // System Health
    console.log('🏥 System Health:');
    console.log(`   Event Loop Lag: ${latest.eventLoop.toFixed(2)}ms`);
    console.log(`   Memory Usage: ${latest.memory.toFixed(1)}%`);
    console.log(`   Total Alerts: ${this.metrics.alerts.length}\n`);
    
    // Module Performance
    if (latest.moduleLoad) {
      console.log('📦 Module Performance:');
      console.log(`   Load Time: ${latest.moduleLoad.loadTime.toFixed(2)}ms`);
      console.log(`   Functions Available: ${latest.moduleLoad.moduleCount || 0}\n`);
    }
    
    // Queue Performance
    if (latest.queue && latest.queue.activeConnections !== undefined) {
      console.log('🚦 Queue Performance:');
      console.log(`   Active Connections: ${latest.queue.activeConnections}`);
      console.log(`   Pending Requests: ${latest.queue.pendingRequests}`);
      console.log(`   Success Rate: ${(latest.queue.successRate * 100).toFixed(1)}%\n`);
    }
    
    // Recent Alerts Summary
    if (this.metrics.alerts.length > 0) {
      console.log('📊 Recent Alerts Summary:');
      const recentAlerts = this.metrics.alerts.slice(-5);
      recentAlerts.forEach(alert => {
        const icon = alert.severity === 'HIGH' ? '🔴' : '🟡';
        console.log(`   ${icon} ${alert.type}: ${alert.message}`);
      });
      console.log('');
    }
    
    // Performance Indicators
    this.printHealthIndicators(latest);
  }

  /**
   * Print health indicators
   */
  printHealthIndicators(latest) {
    console.log('🏥 Health Indicators:');
    
    // Event Loop Health
    const eventLoopHealth = latest.eventLoop < this.alertThresholds.eventLoopLag ? '✅' : 
                          latest.eventLoop < this.alertThresholds.eventLoopLag * 2 ? '🟡' : '❌';
    console.log(`   Event Loop: ${eventLoopHealth} ${latest.eventLoop.toFixed(2)}ms`);
    
    // Memory Health
    const memoryHealth = latest.memory < this.alertThresholds.memoryUsage ? '✅' :
                      latest.memory < this.alertThresholds.memoryUsage * 1.2 ? '🟡' : '❌';
    console.log(`   Memory: ${memoryHealth} ${latest.memory.toFixed(1)}%`);
    
    // Overall Health
    const overallHealth = latest.eventLoop < this.alertThresholds.eventLoopLag && 
                       latest.memory < this.alertThresholds.memoryUsage ? '✅ HEALTHY' : 
                       latest.eventLoop < this.alertThresholds.eventLoopLag * 2 && 
                       latest.memory < this.alertThresholds.memoryUsage * 1.2 ? '🟡 ATTENTION' : '❌ CRITICAL';
    
    console.log(`   Overall: ${overallHealth}\n`);
  }

  /**
   * Generate performance summary report
   */
  generateSummary() {
    const uptime = Math.floor((Date.now() - this.metrics.startTime) / 1000 / 60); // minutes
    
    console.log('\n📋 Production Performance Summary Report');
    console.log('===================================\n');
    
    console.log(`📊 Monitoring Duration: ${uptime.toFixed(1)} minutes\n`);
    
    // Performance averages
    if (this.metrics.performance.eventLoopLag.length > 0) {
      const avgEventLoop = this.metrics.performance.eventLoopLag.reduce((sum, m) => sum + m.value, 0) / 
                          this.metrics.performance.eventLoopLag.length;
      console.log('⚡ Performance Summary:');
      console.log(`   Avg Event Loop Lag: ${avgEventLoop.toFixed(2)}ms`);
    }
    
    if (this.metrics.performance.memoryUsage.length > 0) {
      const avgMemory = this.metrics.performance.memoryUsage.reduce((sum, m) => sum + m.percentage, 0) / 
                        this.metrics.performance.memoryUsage.length;
      const maxMemory = Math.max(...this.metrics.performance.memoryUsage.map(m => m.percentage));
      console.log(`   Avg Memory Usage: ${avgMemory.toFixed(1)}%`);
      console.log(`   Peak Memory Usage: ${maxMemory.toFixed(1)}%`);
    }
    
    // Alert summary
    if (this.metrics.alerts.length > 0) {
      console.log(`\n🚨 Total Alerts Generated: ${this.metrics.alerts.length}`);
      const highSeverity = this.metrics.alerts.filter(a => a.severity === 'HIGH').length;
      const mediumSeverity = this.metrics.alerts.filter(a => a.severity === 'MEDIUM').length;
      console.log(`   High Severity: ${highSeverity}`);
      console.log(`   Medium Severity: ${mediumSeverity}`);
    }
    
    // Recommendations
    console.log('\n💡 Operational Recommendations:');
    if (this.metrics.alerts.length > 10) {
      console.log('   🔴 High alert frequency - investigate performance bottlenecks');
    }
    if (this.metrics.performance.memoryUsage.some(m => m.percentage > 80)) {
      console.log('   💾 Consider memory optimization or increased resources');
    }
    if (this.metrics.performance.eventLoopLag.some(m => m.value > 20)) {
      console.log('   ⏱️  Investigate blocking operations or CPU-intensive tasks');
    }
    if (this.metrics.alerts.length === 0) {
      console.log('   ✅ Performance looks optimal - continue monitoring');
    }
    
    console.log('\n🔍 Monitoring data saved for analysis');
    this.saveMetrics();
  }

  /**
   * Save metrics to file for historical analysis
   */
  async saveMetrics() {
    try {
      const reportPath = path.join(process.cwd(), 'performance-report.json');
      const reportData = {
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.metrics.startTime,
        metrics: this.metrics,
        summary: {
          totalAlerts: this.metrics.alerts.length,
          avgEventLoopLag: this.metrics.performance.eventLoopLag.length > 0 ? 
            this.metrics.performance.eventLoopLag.reduce((sum, m) => sum + m.value, 0) / 
            this.metrics.performance.eventLoopLag.length : 0,
          avgMemoryUsage: this.metrics.performance.memoryUsage.length > 0 ?
            this.metrics.performance.memoryUsage.reduce((sum, m) => sum + m.percentage, 0) / 
            this.metrics.performance.memoryUsage.length : 0
        }
      };
      
      await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
      console.log(`   📁 Report saved to: ${reportPath}`);
    } catch (error) {
      console.error('   ❌ Failed to save report:', error.message);
    }
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    console.log('\n🛑 Stopping performance monitoring...');
    this.generateSummary();
    console.log('\n✅ Monitoring stopped safely');
    process.exit(0);
  }
}

// Start monitoring if run directly
if (require.main === module) {
  const monitor = new ProductionMonitor();
  
  // Allow custom interval from command line
  const interval = process.argv[2] ? parseInt(process.argv[2]) : 60000;
  
  monitor.startMonitoring(interval);
}

module.exports = ProductionMonitor;