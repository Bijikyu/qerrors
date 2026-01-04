/**
 * Comprehensive Integration Tests for Qerrors
 * 
 * Tests edge cases, error scenarios, and production-level usage patterns
 * to ensure robustness and reliability under various conditions.
 */

const { performance } = require('perf_hooks');
const qerrors = require('../lib/qerrors');

class IntegrationTestSuite {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
    this.startTime = Date.now();
  }

  async runTest(testName, testFn) {
    this.testResults.total++;
    const startTime = performance.now();
    
    try {
      await testFn();
      const duration = performance.now() - startTime;
      this.testResults.passed++;
      this.testResults.details.push({
        name: testName,
        status: 'PASS',
        duration: `${duration.toFixed(2)}ms`,
        error: null
      });
      console.log(`✓ ${testName} (${duration.toFixed(2)}ms)`);
    } catch (error) {
      const duration = performance.now() - startTime;
      this.testResults.failed++;
      this.testResults.details.push({
        name: testName,
        status: 'FAIL',
        duration: `${duration.toFixed(2)}ms`,
        error: error.message
      });
      console.log(`✗ ${testName} (${duration.toFixed(2)}ms) - ${error.message}`);
    }
  }

  async testBasicErrorHandling() {
    // Test basic error processing
    const response = await qerrors(new Error('Test error'), 'test.basic');
    
    if (!response.id) {
      throw new Error('Expected error ID in response');
    }
    
    if (!response.message || !response.name) {
      throw new Error('Expected error message and name in response');
    }
  }

  async testConcurrentErrors() {
    // Test multiple concurrent errors
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(qerrors(new Error(`Concurrent error ${i}`), 'test.concurrent'));
    }
    
    const results = await Promise.all(promises);
    
    if (results.length !== 50) {
      throw new Error(`Expected 50 results, got ${results.length}`);
    }
    
    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0) {
      throw new Error(`${failedResults.length} requests failed`);
    }
  }

  async testErrorTypeHandling() {
    // Test different error types
    const errorTypes = [
      new Error('Standard Error'),
      new TypeError('Type Error'),
      new RangeError('Range Error'),
      new ReferenceError('Reference Error'),
      new SyntaxError('Syntax Error'),
      new URIError('URI Error'),
      new EvalError('Eval Error')
    ];

    for (const error of errorTypes) {
      const response = await qerrors(error, 'test.errorTypes');
      
      if (!response.success) {
        throw new Error(`Failed for ${error.constructor.name}`);
      }
    }
  }

  async testLargeErrorHandling() {
    // Test handling of large error messages
    const largeMessage = 'x'.repeat(10000); // 10KB error message
    const largeError = new Error(largeMessage);
    
    const response = await qerrors(largeError, 'test.largeError');
    
    if (!response.success) {
      throw new Error('Failed to handle large error');
    }
  }

  async testErrorObjectHandling() {
    // Test errors with custom properties
    const customError = new Error('Custom error');
    customError.code = 'CUSTOM_CODE';
    customError.statusCode = 400;
    customError.details = { userId: 123, action: 'test' };
    customError.timestamp = new Date().toISOString();
    
    const response = await qerrors(customError, 'test.customError');
    
    if (!response.success) {
      throw new Error('Failed to handle custom error object');
    }
  }

  async testQueueOverflowHandling() {
    // Test behavior under queue overflow
    const promises = [];
    
    // Create high load to test queue limits
    for (let i = 0; i < 3000; i++) {
      promises.push(
        qerrors(new Error(`Queue test ${i}`), 'test.queueOverflow')
          .catch(error => {
            // Some requests may be rejected - this is expected
            if (error.message.includes('Queue at capacity')) {
              return { success: false, rejected: true };
            }
            throw error;
          })
      );
    }
    
    const results = await Promise.all(promises);
    const rejectedCount = results.filter(r => r.rejected).length;
    const successfulCount = results.filter(r => r.success && !r.rejected).length;
    
    console.log(`    Queue: ${successfulCount} processed, ${rejectedCount} rejected`);
    
    if (successfulCount === 0) {
      throw new Error('No requests were processed');
    }
  }

  async testCacheEfficiency() {
    // Test cache hit performance
    const sameError = new Error('Cache test error');
    
    // First call - cache miss
    const start1 = performance.now();
    await qerrors(sameError, 'test.cache');
    const time1 = performance.now() - start1;
    
    // Second call - cache hit
    const start2 = performance.now();
    await qerrors(sameError, 'test.cache');
    const time2 = performance.now() - start2;
    
    console.log(`    Cache: miss ${time1.toFixed(2)}ms, hit ${time2.toFixed(2)}ms`);
    
    // Cache hit should be faster (though this is a rough test)
    if (time2 > time1 * 2) {
      console.log('    Warning: Cache may not be working efficiently');
    }
  }

  async testMemoryUsage() {
    // Test memory usage under load
    const memBefore = process.memoryUsage();
    
    // Process errors and measure memory
    for (let i = 0; i < 500; i++) {
      await qerrors(new Error(`Memory test ${i}`), 'test.memory');
    }
    
    // Allow GC
    if (global.gc) global.gc();
    
    const memAfter = process.memoryUsage();
    const memIncrease = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
    
    console.log(`    Memory: ${memIncrease.toFixed(2)}MB increase for 500 errors`);
    
    // Memory increase should be reasonable (< 50MB for 500 errors)
    if (memIncrease > 50) {
      throw new Error(`Excessive memory usage: ${memIncrease.toFixed(2)}MB`);
    }
  }

  async testErrorRecovery() {
    // Test system recovery from errors
    let recoveryCount = 0;
    
    for (let i = 0; i < 20; i++) {
      try {
        await qerrors(new Error(`Recovery test ${i}`), 'test.recovery');
        recoveryCount++;
      } catch (error) {
        // Count recoverable errors
        if (!error.message.includes('Queue at capacity')) {
          throw error;
        }
      }
    }
    
    if (recoveryCount < 10) {
      throw new Error(`Poor recovery: only ${recoveryCount}/20 succeeded`);
    }
  }

  async testPerformanceDegradation() {
    // Test performance under sustained load
    const times = [];
    
    for (let batch = 0; batch < 5; batch++) {
      const startTime = performance.now();
      
      for (let i = 0; i < 20; i++) {
        await qerrors(new Error(`Performance test ${batch}-${i}`), 'test.performance');
      }
      
      const batchTime = performance.now() - startTime;
      times.push(batchTime);
    }
    
    // Check if performance degrades significantly
    const firstBatch = times[0];
    const lastBatch = times[times.length - 1];
    const degradation = (lastBatch - firstBatch) / firstBatch;
    
    console.log(`    Performance: ${firstBatch.toFixed(2)}ms → ${lastBatch.toFixed(2)}ms (${(degradation * 100).toFixed(1)}% change)`);
    
    // Performance should not degrade by more than 100%
    if (degradation > 1.0) {
      throw new Error(`Excessive performance degradation: ${(degradation * 100).toFixed(1)}%`);
    }
  }

  async runAllTests() {
    console.log('🧪 Running Comprehensive Integration Tests\\n');
    
    // Basic functionality tests
    await this.runTest('Basic Error Handling', () => this.testBasicErrorHandling());
    await this.runTest('Error Type Handling', () => this.testErrorTypeHandling());
    await this.runTest('Large Error Handling', () => this.testLargeErrorHandling());
    await this.runTest('Error Object Handling', () => this.testErrorObjectHandling());
    
    // Performance and load tests
    await this.runTest('Concurrent Error Processing', () => this.testConcurrentErrors());
    await this.runTest('Queue Overflow Handling', () => this.testQueueOverflowHandling());
    await this.runTest('Cache Efficiency', () => this.testCacheEfficiency());
    await this.runTest('Memory Usage', () => this.testMemoryUsage());
    await this.runTest('Performance Degradation', () => this.testPerformanceDegradation());
    
    // Reliability tests
    await this.runTest('Error Recovery', () => this.testErrorRecovery());
    
    this.printSummary();
  }

  printSummary() {
    const totalTime = Date.now() - this.startTime;
    const successRate = ((this.testResults.passed / this.testResults.total) * 100).toFixed(1);
    
    console.log('\\n📊 Test Results Summary');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${this.testResults.total}`);
    console.log(`Passed: ${this.testResults.passed}`);
    console.log(`Failed: ${this.testResults.failed}`);
    console.log(`Success Rate: ${successRate}%`);
    console.log(`Total Duration: ${(totalTime / 1000).toFixed(2)}s`);
    
    if (this.testResults.failed > 0) {
      console.log('\\n❌ Failed Tests:');
      this.testResults.details
        .filter(t => t.status === 'FAIL')
        .forEach(t => {
          console.log(`  - ${t.name}: ${t.error}`);
        });
    }
    
    console.log('\\n' + '='.repeat(50));
    
    if (this.testResults.failed === 0) {
      console.log('🎉 All tests passed! System is production ready.');
    } else {
      console.log(`⚠️  ${this.testResults.failed} test(s) failed. Review before production deployment.`);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const testSuite = new IntegrationTestSuite();
  testSuite.runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = IntegrationTestSuite;