/**
 * Production Performance Monitoring Script
 * 
 * This script provides comprehensive monitoring for the qerrors module
 * after performance optimizations have been deployed to production.
 * 
 * Usage: node monitor-production-performance.js
 */

const { performance } = require('perf_hooks');
const { EnhancedRateLimiter } = require('./lib/enhancedRateLimiter');
const qerrors = require('./index');

class ProductionPerformanceMonitor {
  constructor() {
    this.metrics = {
      memoryUsage: [],
      cacheHitRates: new Map(),
      requestLatencies: [],
      errorRates: [],
      cleanupTimes: [],
      startTime: Date.now()
    };
    
    this.limiter = new EnhancedRateLimiter();
    this.monitoringInterval = null;
  }

  /**
   * Start comprehensive performance monitoring
   */
  startMonitoring(intervalMs = 60000) { // Default: 1 minute
    console.log('🔍 Starting Production Performance Monitoring...\n');
    
    // Monitor memory usage
    this.monitoringInterval = setInterval(() => {
      this.collectMemoryMetrics();
      this.collectCacheMetrics();
      this.collectPerformanceMetrics();
      this.printCurrentMetrics();
    }, intervalMs);
    
    // Graceful shutdown handling
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    
    console.log(`📊 Monitoring started with ${intervalMs/1000}s interval`);
    console.log('🎯 Press Ctrl+C to stop monitoring and see summary\n');
  }

  /**
   * Collect memory usage metrics
   */
  collectMemoryMetrics() {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    this.metrics.memoryUsage.push({
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapUsedPercent,
      external: memUsage.external,
      rss: memUsage.rss
    });
    
    // Keep only last 60 minutes of data
    if (this.metrics.memoryUsage.length > 60) {
      this.metrics.memoryUsage.shift();
    }
    
    // Alert on high memory usage
    if (heapUsedPercent > 70) {
      console.warn(`⚠️  HIGH MEMORY USAGE: ${heapUsedPercent.toFixed(1)}%`);
    }
  }

  /**
   * Collect cache performance metrics
   */
  collectCacheMetrics() {
    const stats = this.limiter.getStats();
    const cacheStats = stats.cache;
    
    if (cacheStats.hits + cacheStats.misses > 0) {
      const hitRate = cacheStats.hits / (cacheStats.hits + cacheStats.misses);
      this.metrics.cacheHitRates.set('rateLimiter', hitRate);
      
      // Alert on low cache performance
      if (hitRate < 0.8) {
        console.warn(`⚠️  LOW CACHE HIT RATE: ${(hitRate * 100).toFixed(1)}%`);
      }
    }
  }

  /**
   * Collect performance metrics for request processing
   */
  collectPerformanceMetrics() {
    // Simulate request latency measurement
    const start = performance.now();
    
    // Test hash generation performance
    this.limiter.hashUserAgent('test-user-agent').then(() => {
      const latency = performance.now() - start;
      this.metrics.requestLatencies.push({
        timestamp: Date.now(),
        latency
      });
      
      // Keep only last 100 measurements
      if (this.metrics.requestLatencies.length > 100) {
        this.metrics.requestLatencies.shift();
      }
    });
  }

  /**
   * Print current metrics summary
   */
  printCurrentMetrics() {
    const latest = this.getLatestMetrics();
    
    console.clear();
    console.log('📊 Qerrors Production Performance Monitor');
    console.log('=====================================');
    console.log(`⏱️  Uptime: ${Math.floor((Date.now() - this.metrics.startTime) / 1000)}s\n`);
    
    // Memory metrics
    console.log('💾 Memory Usage:');
    console.log(`   Heap Used: ${(latest.memory.heapUsed / 1024 / 1024).toFixed(1)} MB`);
    console.log(`   Heap Total: ${(latest.memory.heapTotal / 1024 / 1024).toFixed(1)} MB`);
    console.log(`   Usage: ${latest.memory.heapUsedPercent.toFixed(1)}%`);
    console.log(`   RSS: ${(latest.memory.rss / 1024 / 1024).toFixed(1)} MB\n`);
    
    // Cache metrics
    console.log('🎯 Cache Performance:');
    latest.cache.forEach((hitRate, cacheName) => {
      console.log(`   ${cacheName}: ${(hitRate * 100).toFixed(1)}% hit rate`);
    });
    console.log('');
    
    // Performance metrics
    if (this.metrics.requestLatencies.length > 0) {
      const avgLatency = this.metrics.requestLatencies.reduce((sum, m) => sum + m.latency, 0) / this.metrics.requestLatencies.length;
      console.log('⚡ Request Performance:');
      console.log(`   Avg Latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`   Samples: ${this.metrics.requestLatencies.length}\n`);
    }
    
    // Rate limiter stats
    const limiterStats = this.limiter.getStats();
    console.log('🚦 Rate Limiter:');
    console.log(`   Total Requests: ${limiterStats.totalRequests}`);
    console.log(`   Blocked Requests: ${limiterStats.blockedRequests}`);
    console.log(`   Cache Keys: ${limiterStats.cache.keys}\n`);
    
    // System health indicators
    this.printHealthIndicators(latest);
  }

  /**
   * Print system health indicators
   */
  printHealthIndicators(latest) {
    console.log('🏥 System Health:');
    
    // Memory health
    const memoryHealth = latest.memory.heapUsedPercent < 70 ? '✅' : 
                      latest.memory.heapUsedPercent < 85 ? '⚠️' : '❌';
    console.log(`   Memory: ${memoryHealth} ${latest.memory.heapUsedPercent.toFixed(1)}%`);
    
    // Cache health
    let cacheHealth = '✅';
    latest.cache.forEach((hitRate) => {
      if (hitRate < 0.8) cacheHealth = hitRate < 0.6 ? '❌' : '⚠️';
    });
    console.log(`   Cache: ${cacheHealth}`);
    
    // Overall health
    const overallHealth = latest.memory.heapUsedPercent < 70 && 
                       Array.from(latest.cache.values()).every(rate => rate >= 0.8) ? '✅ HEALTHY' : '⚠️ ATTENTION';
    
    console.log(`   Overall: ${overallHealth}\n`);
  }

  /**
   * Get latest metrics for display
   */
  getLatestMetrics() {
    return {
      memory: this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1] || {},
      cache: this.metrics.cacheHitRates,
      timestamp: Date.now()
    };
  }

  /**
   * Generate performance summary report
   */
  generateSummary() {
    const uptime = (Date.now() - this.metrics.startTime) / 1000 / 60; // minutes
    
    console.log('\n📋 Performance Summary Report');
    console.log('============================');
    console.log(`📊 Monitoring Duration: ${uptime.toFixed(1)} minutes\n`);
    
    // Memory summary
    if (this.metrics.memoryUsage.length > 0) {
      const avgMemory = this.metrics.memoryUsage.reduce((sum, m) => sum + m.heapUsedPercent, 0) / this.metrics.memoryUsage.length;
      const maxMemory = Math.max(...this.metrics.memoryUsage.map(m => m.heapUsedPercent));
      
      console.log('💾 Memory Summary:');
      console.log(`   Average Usage: ${avgMemory.toFixed(1)}%`);
      console.log(`   Peak Usage: ${maxMemory.toFixed(1)}%`);
      console.log(`   Samples Collected: ${this.metrics.memoryUsage.length}\n`);
    }
    
    // Cache summary
    if (this.metrics.cacheHitRates.size > 0) {
      console.log('🎯 Cache Summary:');
      this.metrics.cacheHitRates.forEach((hitRate, cacheName) => {
        console.log(`   ${cacheName}: ${(hitRate * 100).toFixed(1)}% average hit rate`);
      });
      console.log('');
    }
    
    // Recommendations
    console.log('💡 Recommendations:');
    const latest = this.getLatestMetrics();
    
    if (latest.memory.heapUsedPercent > 70) {
      console.log('   - Consider reducing cache sizes or adding memory');
    }
    
    let cacheIssues = 0;
    latest.cache.forEach((hitRate) => {
      if (hitRate < 0.8) cacheIssues++;
    });
    
    if (cacheIssues > 0) {
      console.log('   - Review cache configuration for low hit rate caches');
    }
    
    if (this.metrics.requestLatencies.length > 0) {
      const avgLatency = this.metrics.requestLatencies.reduce((sum, m) => sum + m.latency, 0) / this.metrics.requestLatencies.length;
      if (avgLatency > 50) {
        console.log('   - High latency detected, consider optimization');
      }
    }
    
    if (latest.memory.heapUsedPercent < 70 && cacheIssues === 0) {
      console.log('   - Performance looks good! Continue monitoring.');
    }
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('\n🛑 Stopping performance monitoring...');
    this.generateSummary();
    console.log('\n✅ Monitoring stopped safely');
    process.exit(0);
  }
}

// Start monitoring if run directly
if (require.main === module) {
  const monitor = new ProductionPerformanceMonitor();
  
  // Allow custom interval from command line
  const interval = process.argv[2] ? parseInt(process.argv[2]) : 60000;
  
  monitor.startMonitoring(interval);
}

module.exports = ProductionPerformanceMonitor;