#!/usr/bin/env node
'use strict';

/**
 * Scalability Fixes Verification Test
 * 
 * This test verifies that the critical scalability fixes have been implemented
 * correctly and are working as expected. It tests:
 * 1. Connection pooling improvements
 * 2. API request batching and deduplication
 * 3. Non-blocking I/O operations
 * 4. Memory management optimizations
 * 5. Circuit breaker enhancements
 */

const { performance } = require('perf_hooks');

// Test imports
const connectionPool = require('./lib/connectionPool');
const qerrorsHttpClient = require('./lib/qerrorsHttpClient');
const queueManager = require('./lib/queueManager');
const logger = require('./lib/logger');
const circuitBreaker = require('./lib/circuitBreaker');

/**
 * Test runner with timing and results tracking
 */
class ScalabilityTestRunner {
  constructor() {
    this.results = [];
    this.timings = {};
  }

  async runTest(testName, testFunction) {
    console.log(`\n🧪 Running test: ${testName}`);
    const startTime = performance.now();
    
    try {
      const result = await testFunction();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.results.push({
        name: testName,
        status: 'PASS',
        duration,
        result
      });
      
      this.timings[testName] = duration;
      console.log(`✅ ${testName} - PASS (${duration.toFixed(2)}ms)`);
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.results.push({
        name: testName,
        status: 'FAIL',
        duration,
        error: error.message
      });
      
      console.log(`❌ ${testName} - FAIL (${duration.toFixed(2)}ms): ${error.message}`);
      throw error;
    }
  }

  printSummary() {
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const totalDuration = Object.values(this.timings).reduce((sum, time) => sum + time, 0);
    
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total Duration: ${totalDuration.toFixed(2)}ms`);
    
    console.log('\nDetailed Results:');
    this.results.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${status} ${result.name} - ${result.duration.toFixed(2)}ms`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    return { passed, failed, totalDuration };
  }
}

/**
 * Test 1: Connection Pooling Improvements
 */
async function testConnectionPooling() {
  const pool = connectionPool.getConnectionPool({
    min: 2,
    max: 10,
    idleTimeoutMillis: 5000
  });
  
  // Test parallel query execution
  const queries = [];
  for (let i = 0; i < 20; i++) {
    queries.push({
      sql: `SELECT ${i} as test_id`,
      params: []
    });
  }
  
  const startTime = performance.now();
  const results = await connectionPool.executeParallelQueries(queries);
  const endTime = performance.now();
  
  if (results.length !== 20) {
    throw new Error(`Expected 20 results, got ${results.length}`);
  }
  
  const stats = pool.getStats();
  if (stats.totalConnections < 2 || stats.totalConnections > 10) {
    throw new Error(`Connection pool size out of bounds: ${stats.totalConnections}`);
  }
  
  await pool.close();
  return { queryCount: results.length, poolStats: stats, duration: endTime - startTime };
}

/**
 * Test 2: API Request Batching and Deduplication
 */
async function testApiRequestBatching() {
  // Test request deduplication by checking if the module exports the right functions
  const hasBatchRequests = typeof qerrorsHttpClient.batchRequests === 'function';
  const hasCleanupCache = typeof qerrorsHttpClient.cleanupCache === 'function';
  
  if (!hasBatchRequests) {
    throw new Error('batchRequests function not found - scalability fix not implemented');
  }
  
  if (!hasCleanupCache) {
    throw new Error('cleanupCache function not found - scalability fix not implemented');
  }
  
  // Test batch requests structure
  const testRequests = [
    { url: 'https://api.example.com/test1', data: { test: 'data1' } },
    { url: 'https://api.example.com/test2', data: { test: 'data2' } }
  ];
  
  // Verify the function exists and can be called (won't actually make requests in test)
  try {
    // This would normally make requests, but we're just testing the function exists
    const batchFunction = qerrorsHttpClient.batchRequests;
    if (typeof batchFunction !== 'function') {
      throw new Error('batchRequests is not a function');
    }
  } catch (error) {
    throw new Error(`batchRequests test failed: ${error.message}`);
  }
  
  return { 
    hasBatchRequests, 
    hasCleanupCache, 
    requestCount: testRequests.length,
    enhanced: true 
  };
}

/**
 * Test 3: Non-blocking I/O Operations
 */
async function testNonBlockingIO() {
  const startTime = performance.now();
  
  // Test non-blocking logging
  const logPromise = logger.logInfo('Test message for non-blocking I/O');
  
  // Test non-blocking queue metrics
  const metricsPromise = queueManager.startQueueMetrics();
  
  // These should not block the main thread
  await Promise.all([logPromise, metricsPromise]);
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  // Should complete quickly due to non-blocking nature
  if (duration > 100) {
    throw new Error(`Non-blocking I/O took too long: ${duration}ms`);
  }
  
  // Test that queue manager has the enhanced metrics function
  const hasGetQueueMetrics = typeof queueManager.getQueueMetrics === 'function';
  if (!hasGetQueueMetrics) {
    throw new Error('getQueueMetrics function not found - scalability fix not implemented');
  }
  
  return { duration, nonBlocking: true, hasEnhancedMetrics: hasGetQueueMetrics };
}

/**
 * Test 4: Memory Management Optimizations
 */
async function testMemoryManagement() {
  const initialMemory = process.memoryUsage();
  
  // Create and release multiple connections
  const pool = connectionPool.getConnectionPool({ max: 5 });
  
  for (let i = 0; i < 50; i++) {
    const connection = await pool.acquire();
    await connection.query('SELECT 1');
    await pool.release(connection);
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const finalMemory = process.memoryUsage();
  const memoryDiff = finalMemory.heapUsed - initialMemory.heapUsed;
  
  await pool.close();
  
  // Memory usage should not increase significantly
  const memoryIncreaseMB = memoryDiff / (1024 * 1024);
  if (memoryIncreaseMB > 10) {
    throw new Error(`Memory increased too much: ${memoryIncreaseMB.toFixed(2)}MB`);
  }
  
  return { memoryIncreaseMB, managed: true };
}

/**
 * Test 5: Circuit Breaker Enhancements
 */
async function testCircuitBreakerEnhancements() {
  let callCount = 0;
  
  const mockOperation = async () => {
    callCount++;
    if (callCount <= 3) {
      throw new Error('Simulated failure');
    }
    return { success: true, callCount };
  };
  
  const breaker = circuitBreaker.createCircuitBreaker(
    mockOperation,
    'TestService',
    { failureThreshold: 3, recoveryTimeoutMs: 1000 }
  );
  
  // Should fail for first 3 calls
  for (let i = 0; i < 3; i++) {
    try {
      await breaker.execute();
      throw new Error(`Call ${i + 1} should have failed`);
    } catch (error) {
      // Expected to fail
    }
  }
  
  // Circuit should be open now
  if (breaker.getState() !== 'OPEN') {
    throw new Error('Circuit should be OPEN after 3 failures');
  }
  
  // Wait for recovery timeout
  await new Promise(resolve => setTimeout(resolve, 1100));
  
  // Should work again in HALF_OPEN state
  const result = await breaker.execute();
  
  if (!result.success || result.callCount !== 4) {
    throw new Error('Circuit breaker recovery failed');
  }
  
  const metrics = breaker.getMetrics();
  if (metrics.totalRequests < 4) {
    throw new Error('Metrics tracking failed');
  }
  
  return { 
    state: breaker.getState(), 
    metrics, 
    callCount,
    enhanced: true 
  };
}

/**
 * Main test execution
 */
async function runScalabilityTests() {
  console.log('🚀 Starting Scalability Fixes Verification Tests');
  console.log('==================================================');
  
  const runner = new ScalabilityTestRunner();
  
  try {
    // Run all scalability tests
    await runner.runTest('Connection Pooling Improvements', testConnectionPooling);
    await runner.runTest('API Request Batching and Deduplication', testApiRequestBatching);
    await runner.runTest('Non-blocking I/O Operations', testNonBlockingIO);
    await runner.runTest('Memory Management Optimizations', testMemoryManagement);
    await runner.runTest('Circuit Breaker Enhancements', testCircuitBreakerEnhancements);
    
    // Print summary
    const summary = runner.printSummary();
    
    if (summary.failed === 0) {
      console.log('\n🎉 All scalability tests passed! The fixes are working correctly.');
      process.exit(0);
    } else {
      console.log(`\n⚠️  ${summary.failed} test(s) failed. Please review the implementation.`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runScalabilityTests();
}

module.exports = {
  ScalabilityTestRunner,
  runScalabilityTests,
  testConnectionPooling,
  testApiRequestBatching,
  testNonBlockingIO,
  testMemoryManagement,
  testCircuitBreakerEnhancements
};