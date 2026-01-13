/**
 * Simplified Integration Tests for Qerrors
 * 
 * Tests core functionality to ensure reliability under various conditions.
 */

const { performance } = require('perf_hooks');
const qerrors = require('../lib/qerrors');

class SimpleIntegrationTest {
  constructor() {
    this.passed = 0;
    this.failed = 0;
  }

  async test(name, testFn) {
    try {
      await testFn();
      this.passed++;
      console.log(`✓ ${name}`);
    } catch (error) {
      this.failed++;
      console.log(`✗ ${name} - ${error.message}`);
    }
  }

  async testBasicFunctionality() {
    // Test basic error processing
    const result = await qerrors(new Error('Test error'), 'test.basic');
    
    if (!result.id) throw new Error('Missing error ID');
    if (!result.message) throw new Error('Missing error message');
    if (!result.timestamp) throw new Error('Missing timestamp');
  }

  async testConcurrentProcessing() {
    // Test concurrent error processing
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(qerrors(new Error(`Concurrent ${i}`), 'test.concurrent'));
    }
    
    const results = await Promise.all(promises);
    
    if (results.length !== 20) throw new Error('Incorrect number of results');
    
    results.forEach((result, index) => {
      if (!result.id) throw new Error(`Result ${index} missing ID`);
    });
  }

  async testDifferentErrorTypes() {
    // Test different error types
    const errors = [
      new Error('Standard error'),
      new TypeError('Type error'),
      new RangeError('Range error'),
      new ReferenceError('Reference error')
    ];

    for (const error of errors) {
      const result = await qerrors(error, 'test.types');
      
      if (!result.id) throw new Error(`Missing ID for ${error.constructor.name}`);
      if (!result.name) throw new Error(`Missing name for ${error.constructor.name}`);
    }
  }

  async testLargeErrorHandling() {
    // Test large error messages
    const largeMessage = 'x'.repeat(1000);
    const result = await qerrors(new Error(largeMessage), 'test.large');
    
    if (!result.id) throw new Error('Failed to handle large error');
    if (result.message.length > 500) throw new Error('Message not truncated properly');
  }

  async testCustomErrorObject() {
    // Test error with custom properties
    const customError = new Error('Custom error');
    customError.code = 'CUSTOM_CODE';
    customError.statusCode = 400;
    customError.details = { userId: 123 };
    
    const result = await qerrors(customError, 'test.custom');
    
    if (!result.id) throw new Error('Failed to handle custom error');
    if (result.context && typeof result.context !== 'object') {
      throw new Error('Context not properly handled');
    }
  }

  async testQueueStats() {
    // Test queue statistics
    const statsBefore = qerrors.getQueueStats();
    
    // Process some errors
    await qerrors(new Error('Stats test 1'), 'test.stats');
    await qerrors(new Error('Stats test 2'), 'test.stats');
    
    const statsAfter = qerrors.getQueueStats();
    
    if (typeof statsAfter.length !== 'number') throw new Error('Invalid queue length');
    if (typeof statsAfter.rejectCount !== 'number') throw new Error('Invalid reject count');
  }

  async testPerformance() {
    // Test basic performance
    const startTime = performance.now();
    
    for (let i = 0; i < 100; i++) {
      await qerrors(new Error(`Perf test ${i}`), 'test.performance');
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const avgTime = duration / 100;
    
    console.log(`    Performance: 100 errors in ${duration.toFixed(2)}ms (avg: ${avgTime.toFixed(2)}ms)`);
    
    // Should process 100 errors in reasonable time (< 5 seconds)
    if (duration > 5000) throw new Error('Performance too slow');
  }

  async testMemoryUsage() {
    // Test memory doesn't grow excessively
    const memBefore = process.memoryUsage();
    
    // Process errors
    for (let i = 0; i < 100; i++) {
      await qerrors(new Error(`Memory test ${i}`), 'test.memory');
    }
    
    // Allow GC
    if (global.gc) global.gc();
    
    const memAfter = process.memoryUsage();
    const memIncrease = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
    
    console.log(`    Memory: ${memIncrease.toFixed(2)}MB increase for 100 errors`);
    
    // Should not use excessive memory (< 20MB for 100 errors)
    if (memIncrease > 20) throw new Error(`Excessive memory usage: ${memIncrease.toFixed(2)}MB`);
  }

  async runAllTests() {
    console.log('🧪 Running Simplified Integration Tests\\n');
    
    await this.test('Basic Error Processing', () => this.testBasicFunctionality());
    await this.test('Concurrent Processing', () => this.testConcurrentProcessing());
    await this.test('Different Error Types', () => this.testDifferentErrorTypes());
    await this.test('Large Error Handling', () => this.testLargeErrorHandling());
    await this.test('Custom Error Objects', () => this.testCustomErrorObject());
    await this.test('Queue Statistics', () => this.testQueueStats());
    await this.test('Performance Test', () => this.testPerformance());
    await this.test('Memory Usage', () => this.testMemoryUsage());
    
    this.printSummary();
  }

  printSummary() {
    const total = this.passed + this.failed;
    const successRate = ((this.passed / total) * 100).toFixed(1);
    
    console.log('\\n📊 Test Results Summary');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    console.log(`Success Rate: ${successRate}%`);
    
    console.log('\\n' + '='.repeat(50));
    
    if (this.failed === 0) {
      console.log('🎉 All tests passed! System is working correctly.');
    } else {
      console.log(`⚠️  ${this.failed} test(s) failed. Review the issues above.`);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const testSuite = new SimpleIntegrationTest();
  testSuite.runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = {
  SimpleIntegrationTest
};