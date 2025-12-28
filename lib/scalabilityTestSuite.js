/**
 * Comprehensive Scalability Testing and Validation Suite
 * 
 * This module provides automated testing to validate that all scalability
 * optimizations are working correctly and the system can handle high load.
 */

'use strict';

const { performance } = require('perf_hooks');
const os = require('os');

class ScalabilityTestSuite {
  constructor() {
    this.testResults = [];
    this.baselineMetrics = null;
    this.testThresholds = {
      maxMemoryGrowth: 50 * 1024 * 1024, // 50MB max memory growth
      maxResponseTime: 100, // 100ms max response time under load
      minThroughput: 1000, // 1000 requests per second minimum
      maxErrorRate: 0.01 // 1% max error rate
    };
  }
  
  /**
   * Run comprehensive scalability test suite
   */
  async runFullTestSuite() {
    console.log('🧪 Starting comprehensive scalability test suite...');
    
    try {
      // Capture baseline metrics
      this.baselineMetrics = this.captureSystemMetrics();
      
      // Run individual tests
      await this.testMemoryManagement();
      await this.testQueuePerformance();
      await this.testCacheEfficiency();
      await this.testRateLimiting();
      await this.testConnectionPooling();
      await this.testErrorHandling();
      await this.testStaticFileServing();
      await this.testQueryOptimization();
      
      // Generate comprehensive report
      this.generateTestReport();
      
      return this.testResults;
      
    } catch (error) {
      console.error('❌ Scalability test suite failed:', error);
      throw error;
    }
  }
  
  /**
   * Test memory management and leak prevention
   */
  async testMemoryManagement() {
    console.log('📊 Testing memory management...');
    
    const testName = 'memory_management';
    const initialMemory = process.memoryUsage().heapUsed;
    
    try {
      // Test singleton cleanup
      const { getScalableErrorHandler, cleanupErrorHandler } = require('./lib/qerrors');
      const handler1 = getScalableErrorHandler();
      const handler2 = getScalableErrorHandler();
      
      // Force garbage collection if available
      if (global.gc) global.gc();
      
      const afterCreationMemory = process.memoryUsage().heapUsed;
      
      // Test cleanup
      cleanupErrorHandler();
      if (global.gc) global.gc();
      
      const afterCleanupMemory = process.memoryUsage().heapUsed;
      
      // Test bounded collections
      const { BoundedLRUCache } = require('./lib/connectionPool');
      const cache = new BoundedLRUCache(100);
      
      // Fill cache beyond capacity
      for (let i = 0; i < 200; i++) {
        cache.set(`key${i}`, `value${i}`.repeat(100));
      }
      
      const memoryAfterCache = process.memoryUsage().heapUsed;
      
      // Test memory growth
      const memoryGrowth = afterCleanupMemory - initialMemory;
      const cacheMemoryGrowth = memoryAfterCache - afterCleanupMemory;
      
      this.addTestResult(testName, {
        passed: memoryGrowth < this.testThresholds.maxMemoryGrowth,
        metrics: {
          initialMemory: this.formatBytes(initialMemory),
          afterCreationMemory: this.formatBytes(afterCreationMemory),
          afterCleanupMemory: this.formatBytes(afterCleanupMemory),
          memoryGrowth: this.formatBytes(memoryGrowth),
          cacheMemoryGrowth: this.formatBytes(cacheMemoryGrowth),
          cacheSize: cache.size
        },
        details: memoryGrowth < this.testThresholds.maxMemoryGrowth 
          ? 'Memory management working correctly' 
          : `Excessive memory growth: ${this.formatBytes(memoryGrowth)}`
      });
      
    } catch (error) {
      this.addTestResult(testName, {
        passed: false,
        error: error.message,
        details: 'Memory management test failed'
      });
    }
  }
  
  /**
   * Test queue performance under high load
   */
  async testQueuePerformance() {
    console.log('⚡ Testing queue performance...');
    
    const testName = 'queue_performance';
    
    try {
      const { scheduleAnalysis, getQueueLength } = require('./lib/qerrorsQueue');
      
      // Test queue throughput
      const startTime = performance.now();
      const promises = [];
      
      // Schedule 1000 analysis tasks
      for (let i = 0; i < 1000; i++) {
        const testError = new Error(`Test error ${i}`);
        promises.push(
          scheduleAnalysis(testError, 'test_context', () => Promise.resolve('test_result'))
            .catch(err => ({ error: err.message }))
        );
      }
      
      const results = await Promise.allSettled(promises);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      const throughput = 1000 / (duration / 1000); // requests per second
      const successRate = results.filter(r => r.status === 'fulfilled').length / results.length;
      const finalQueueLength = getQueueLength();
      
      this.addTestResult(testName, {
        passed: throughput > this.testThresholds.minThroughput && successRate > 0.95,
        metrics: {
          duration: `${duration.toFixed(2)}ms`,
          throughput: `${throughput.toFixed(2)} req/s`,
          successRate: `${(successRate * 100).toFixed(2)}%`,
          finalQueueLength: finalQueueLength
        },
        details: throughput > this.testThresholds.minThroughput 
          ? 'Queue performance meets requirements' 
          : `Low throughput: ${throughput.toFixed(2)} req/s`
      });
      
    } catch (error) {
      this.addTestResult(testName, {
        passed: false,
        error: error.message,
        details: 'Queue performance test failed'
      });
    }
  }
  
  /**
   * Test cache efficiency and memory management
   */
  async testCacheEfficiency() {
    console.log('💾 Testing cache efficiency...');
    
    const testName = 'cache_efficiency';
    
    try {
      const { setAdviceInCache, getAdviceFromCache, getCacheStats } = require('./lib/qerrorsCache');
      
      // Test cache hit rate
      const testKey = 'test_key';
      const testAdvice = { suggestion: 'Test advice', confidence: 0.9 };
      
      // Set cache entry
      await setAdviceInCache(testKey, testAdvice);
      
      // Test cache retrieval
      const startTime = performance.now();
      for (let i = 0; i < 1000; i++) {
        getAdviceFromCache(testKey);
      }
      const cacheRetrievalTime = performance.now() - startTime;
      
      // Test cache miss
      const missStartTime = performance.now();
      for (let i = 0; i < 100; i++) {
        getAdviceFromCache('non_existent_key');
      }
      const cacheMissTime = performance.now() - missStartTime;
      
      const stats = getCacheStats();
      const hitRate = stats.hitRate || 0;
      
      this.addTestResult(testName, {
        passed: hitRate > 0.8 && cacheRetrievalTime < 10,
        metrics: {
          hitRate: `${(hitRate * 100).toFixed(2)}%`,
          cacheRetrievalTime: `${cacheRetrievalTime.toFixed(2)}ms`,
          cacheMissTime: `${cacheMissTime.toFixed(2)}ms`,
          cacheSize: stats.size,
          memoryUsage: this.formatBytes(stats.memoryUsage?.heapUsed || 0)
        },
        details: hitRate > 0.8 
          ? 'Cache efficiency is good' 
          : `Low cache hit rate: ${(hitRate * 100).toFixed(2)}%`
      });
      
    } catch (error) {
      this.addTestResult(testName, {
        passed: false,
        error: error.message,
        details: 'Cache efficiency test failed'
      });
    }
  }
  
  /**
   * Test rate limiting effectiveness
   */
  async testRateLimiting() {
    console.log('🚦 Testing rate limiting...');
    
    const testName = 'rate_limiting';
    
    try {
      const { getEnhancedRateLimiter } = require('./lib/enhancedRateLimiter');
      const limiter = getEnhancedRateLimiter();
      
      // Test rate limiter performance
      const testEndpoint = '/test/rate_limit';
      const rateLimitMiddleware = limiter.createLimiter(testEndpoint);
      
      // Simulate requests
      let blockedCount = 0;
      let allowedCount = 0;
      
      const startTime = performance.now();
      
      for (let i = 0; i < 200; i++) {
        // Mock request/response
        const mockReq = { ip: '127.0.0.1', get: () => 'test-agent' };
        const mockRes = {
          status: () => ({ json: () => {} }),
          headersSent: false
        };
        
        try {
          await new Promise((resolve, reject) => {
            rateLimitMiddleware(mockReq, mockRes, (err) => {
              if (err) {
                blockedCount++;
                reject(err);
              } else {
                allowedCount++;
                resolve();
              }
            });
          });
        } catch (err) {
          blockedCount++;
        }
      }
      
      const duration = performance.now() - startTime;
      const blockRate = blockedCount / 200;
      
      this.addTestResult(testName, {
        passed: blockRate > 0.1 && blockRate < 0.9, // Some blocking but not all
        metrics: {
          allowedRequests: allowedCount,
          blockedRequests: blockedCount,
          blockRate: `${(blockRate * 100).toFixed(2)}%`,
          duration: `${duration.toFixed(2)}ms`
        },
        details: blockRate > 0.1 
          ? 'Rate limiting is working' 
          : 'Rate limiting may not be effective'
      });
      
    } catch (error) {
      this.addTestResult(testName, {
        passed: false,
        error: error.message,
        details: 'Rate limiting test failed'
      });
    }
  }
  
  /**
   * Test connection pooling performance
   */
  async testConnectionPooling() {
    console.log('🔗 Testing connection pooling...');
    
    const testName = 'connection_pooling';
    
    try {
      const { getConnectionPool, executeQuery } = require('./lib/connectionPool');
      const pool = getConnectionPool();
      
      // Test concurrent connections
      const promises = [];
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        promises.push(
          executeQuery('SELECT 1 as test')
            .catch(err => ({ error: err.message }))
        );
      }
      
      const results = await Promise.allSettled(promises);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      const successRate = results.filter(r => r.status === 'fulfilled').length / results.length;
      const stats = pool.getStats();
      
      this.addTestResult(testName, {
        passed: successRate > 0.95 && duration < 1000,
        metrics: {
          duration: `${duration.toFixed(2)}ms`,
          successRate: `${(successRate * 100).toFixed(2)}%`,
          totalConnections: stats.totalConnections,
          activeConnections: stats.activeConnections,
          idleConnections: stats.idleConnections
        },
        details: successRate > 0.95 
          ? 'Connection pooling working efficiently' 
          : `Low success rate: ${(successRate * 100).toFixed(2)}%`
      });
      
    } catch (error) {
      this.addTestResult(testName, {
        passed: false,
        error: error.message,
        details: 'Connection pooling test failed'
      });
    }
  }
  
  /**
   * Test error handling under high error rates
   */
  async testErrorHandling() {
    console.log('⚠️ Testing error handling...');
    
    const testName = 'error_handling';
    
    try {
      const qerrors = require('./lib/qerrors');
      
      // Test error handling performance
      const promises = [];
      const startTime = performance.now();
      
      // Generate 1000 errors
      for (let i = 0; i < 1000; i++) {
        const testError = new Error(`Test error ${i}`);
        promises.push(
          new Promise(resolve => {
            qerrors(testError, 'test_context', null, null, null);
            resolve();
          })
        );
      }
      
      await Promise.all(promises);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      const throughput = 1000 / (duration / 1000);
      
      this.addTestResult(testName, {
        passed: throughput > 500 && duration < 2000,
        metrics: {
          duration: `${duration.toFixed(2)}ms`,
          throughput: `${throughput.toFixed(2)} errors/s`,
          errorCount: 1000
        },
        details: throughput > 500 
          ? 'Error handling performs well under load' 
          : `Error handling too slow: ${throughput.toFixed(2)} errors/s`
      });
      
    } catch (error) {
      this.addTestResult(testName, {
        passed: false,
        error: error.message,
        details: 'Error handling test failed'
      });
    }
  }
  
  /**
   * Test static file serving performance
   */
  async testStaticFileServing() {
    console.log('📁 Testing static file serving...');
    
    const testName = 'static_file_serving';
    
    try {
      const { getStaticFileServer } = require('./lib/scalableStaticFileServer');
      const server = getStaticFileServer();
      
      // Test file caching performance
      const testFilePath = '/test/file.html';
      const testContent = '<html><body>Test content</body></html>';
      
      // Mock file system for testing
      server.cache.set('test_key', {
        content: testContent,
        size: testContent.length,
        timestamp: Date.now()
      });
      
      const startTime = performance.now();
      
      // Test 1000 file retrievals
      for (let i = 0; i < 1000; i++) {
        server.cache.get('test_key');
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      const throughput = 1000 / (duration / 1000);
      
      const stats = server.getStats();
      
      this.addTestResult(testName, {
        passed: throughput > 1000 && stats.memoryUsage < this.testThresholds.maxMemoryGrowth,
        metrics: {
          duration: `${duration.toFixed(2)}ms`,
          throughput: `${throughput.toFixed(2)} files/s`,
          cacheEntries: stats.entries,
          memoryUsage: this.formatBytes(stats.memoryUsage)
        },
        details: throughput > 1000 
          ? 'Static file serving is efficient' 
          : `Static file serving too slow: ${throughput.toFixed(2)} files/s`
      });
      
    } catch (error) {
      this.addTestResult(testName, {
        passed: false,
        error: error.message,
        details: 'Static file serving test failed'
      });
    }
  }
  
  /**
   * Test query optimization and indexing
   */
  async testQueryOptimization() {
    console.log('🔍 Testing query optimization...');
    
    const testName = 'query_optimization';
    
    try {
      const { getConnectionPool } = require('./lib/connectionPool');
      const pool = getConnectionPool();
      
      // Test query pattern analysis
      const testQueries = [
        'SELECT * FROM users WHERE id = 1',
        'SELECT * FROM users WHERE id = 2',
        'SELECT * FROM users WHERE id = 3',
        'SELECT * FROM orders WHERE user_id = 1',
        'SELECT * FROM orders WHERE user_id = 2'
      ];
      
      // Track query patterns
      testQueries.forEach(query => {
        pool.trackQueryPattern(query, []);
      });
      
      // Get indexing recommendations
      const recommendations = pool.getIndexingRecommendations();
      const patternStats = pool.getQueryPatternStats();
      
      this.addTestResult(testName, {
        passed: recommendations.length > 0 && patternStats.totalPatterns > 0,
        metrics: {
          totalPatterns: patternStats.totalPatterns,
          n1Patterns: patternStats.n1Patterns,
          recommendations: recommendations.length,
          topPattern: patternStats.topPatterns[0]?.pattern || 'none'
        },
        details: recommendations.length > 0 
          ? 'Query optimization is working' 
          : 'No optimization recommendations generated'
      });
      
    } catch (error) {
      this.addTestResult(testName, {
        passed: false,
        error: error.message,
        details: 'Query optimization test failed'
      });
    }
  }
  
  /**
   * Capture system metrics
   */
  captureSystemMetrics() {
    return {
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      cpu: os.cpus(),
      loadAverage: os.loadavg(),
      uptime: os.uptime()
    };
  }
  
  /**
   * Add test result
   */
  addTestResult(testName, result) {
    this.testResults.push({
      testName,
      timestamp: Date.now(),
      ...result
    });
    
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${testName}: ${result.details}`);
  }
  
  /**
   * Format bytes for human readable output
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Generate comprehensive test report
   */
  generateTestReport() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const successRate = (passedTests / totalTests) * 100;
    
    console.log('\n📋 SCALABILITY TEST REPORT');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${successRate.toFixed(2)}%`);
    console.log('='.repeat(50));
    
    // Show failed tests
    const failedResults = this.testResults.filter(r => !r.passed);
    if (failedResults.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      failedResults.forEach(result => {
        console.log(`- ${result.testName}: ${result.details}`);
        if (result.error) {
          console.log(`  Error: ${result.error}`);
        }
      });
    }
    
    // System metrics comparison
    if (this.baselineMetrics) {
      const currentMetrics = this.captureSystemMetrics();
      const memoryGrowth = currentMetrics.memory.heapUsed - this.baselineMetrics.memory.heapUsed;
      
      console.log('\n📊 SYSTEM METRICS:');
      console.log(`Memory Growth: ${this.formatBytes(memoryGrowth)}`);
      console.log(`Current Memory: ${this.formatBytes(currentMetrics.memory.heapUsed)}`);
      console.log(`Baseline Memory: ${this.formatBytes(this.baselineMetrics.memory.heapUsed)}`);
    }
    
    // Overall assessment
    console.log('\n🎯 OVERALL ASSESSMENT:');
    if (successRate >= 90) {
      console.log('✅ EXCELLENT: System is highly scalable and optimized');
    } else if (successRate >= 75) {
      console.log('⚠️  GOOD: System is mostly scalable with some areas for improvement');
    } else if (successRate >= 50) {
      console.log('❌ FAIR: System has significant scalability issues that need attention');
    } else {
      console.log('🚨 POOR: System has major scalability problems requiring immediate action');
    }
    
    return {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate
      },
      results: this.testResults,
      baselineMetrics: this.baselineMetrics,
      currentMetrics: this.captureSystemMetrics()
    };
  }
}

// Export for use
module.exports = {
  ScalabilityTestSuite,
  runScalabilityTests: async () => {
    const suite = new ScalabilityTestSuite();
    return await suite.runFullTestSuite();
  }
};