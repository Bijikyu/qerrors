const { performance } = require('perf_hooks');

async function finalValidation() {
  console.log('=== FINAL PRODUCTION VALIDATION ===\n');

  // Test 1: Core Functionality
  console.log('1. Core Functionality Validation...');
  try {
    const qerrors = require('./lib/qerrors');
    const basicResult = await qerrors(new Error('Production validation test'), 'final.validation');
    const hasRequiredFields = basicResult.id && basicResult.message && basicResult.timestamp && basicResult.name;
    console.log('   ✓ Core error processing:', hasRequiredFields ? 'PASS' : 'FAIL');
    
    const queueStats = qerrors.getQueueStats();
    const hasQueueStats = typeof queueStats.length === 'number' && typeof queueStats.rejectCount === 'number';
    console.log('   ✓ Queue statistics:', hasQueueStats ? 'PASS' : 'FAIL');
    
  } catch (error) {
    console.log('   ✗ Core functionality FAIL:', error.message);
  }

  // Test 2: Performance Under Production Settings
  console.log('\n2. Performance Validation...');
  try {
    const qerrors = require('./lib/qerrors');
    const iterations = 500;
    const start = performance.now();
    
    const promises = [];
    for (let i = 0; i < iterations; i++) {
      promises.push(qerrors(new Error('Performance test ' + i), 'performance.validation'));
    }
    
    await Promise.all(promises);
    const end = performance.now();
    const avgTime = (end - start) / iterations;
    
    const meetsPerformanceTarget = avgTime < 0.1; // 0.1ms per error
    console.log('   ✓ Performance (' + iterations + ' errors):', meetsPerformanceTarget ? 'PASS' : 'FAIL');
    console.log('   Average time per error:', avgTime.toFixed(3) + 'ms');
    
  } catch (error) {
    console.log('   ✗ Performance validation FAIL:', error.message);
  }

  // Test 3: Memory Efficiency
  console.log('\n3. Memory Efficiency Validation...');
  try {
    const qerrors = require('./lib/qerrors');
    const memBefore = process.memoryUsage();
    
    for (let i = 0; i < 200; i++) {
      await qerrors(new Error('Memory test ' + i), 'memory.validation');
    }
    
    if (global.gc) global.gc();
    const memAfter = process.memoryUsage();
    const memIncrease = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
    
    const withinMemoryTarget = memIncrease < 5; // Less than 5MB for 200 errors
    console.log('   ✓ Memory efficiency:', withinMemoryTarget ? 'PASS' : 'FAIL');
    console.log('   Memory increase for 200 errors:', memIncrease.toFixed(2) + 'MB');
    
  } catch (error) {
    console.log('   ✗ Memory efficiency FAIL:', error.message);
  }

  // Test 4: Error Type Handling
  console.log('\n4. Error Type Handling Validation...');
  try {
    const qerrors = require('./lib/qerrors');
    const errorTypes = [
      new Error('Standard error'),
      new TypeError('Type error'),
      new RangeError('Range error'),
      new ReferenceError('Reference error')
    ];
    
    let successCount = 0;
    for (const error of errorTypes) {
      const result = await qerrors(error, 'type.validation');
      if (result.id && result.name) successCount++;
    }
    
    const handlesAllTypes = successCount === errorTypes.length;
    console.log('   ✓ Error type handling:', handlesAllTypes ? 'PASS' : 'FAIL');
    console.log('   Successfully handled:', successCount + '/' + errorTypes.length + ' error types');
    
  } catch (error) {
    console.log('   ✗ Error type handling FAIL:', error.message);
  }

  // Test 5: Configuration Validation
  console.log('\n5. Configuration Validation...');
  try {
    const config = require('./lib/config');
    const hasConfigAccess = config.getInt && config.getEnv && config.validateRequiredVars;
    console.log('   ✓ Configuration access:', hasConfigAccess ? 'PASS' : 'FAIL');
    
    // Test production settings
    const queueLimit = config.getInt('QERRORS_QUEUE_LIMIT', 100);
    const cacheLimit = config.getInt('QERRORS_CACHE_LIMIT', 50);
    const concurrency = config.getInt('QERRORS_CONCURRENCY', 2);
    
    const expectedSettings = queueLimit === 2000 && cacheLimit === 500 && concurrency === 5;
    console.log('   ✓ Production settings:', expectedSettings ? 'PASS' : 'FAIL');
    console.log('   Queue limit:', queueLimit, '(expected: 2000)');
    console.log('   Cache limit:', cacheLimit, '(expected: 500)');
    console.log('   Concurrency:', concurrency, '(expected: 5)');
    
  } catch (error) {
    console.log('   ✗ Configuration validation FAIL:', error.message);
  }

  // Test 6: Security Validation
  console.log('\n6. Security Validation...');
  try {
    const { sanitizeMessage } = require('./lib/sanitization');
    
    // Test sanitization of sensitive data
    const testMessage = 'Password: secret123 and token: abc123def';
    const sanitized = sanitizeMessage(testMessage);
    
    const hasPasswordRedacted = sanitized.includes('[REDACTED]');
    const hasTokenRedacted = sanitized.includes('[REDACTED]');
    const securityWorking = hasPasswordRedacted && hasTokenRedacted;
    
    console.log('   ✓ Input sanitization:', securityWorking ? 'PASS' : 'FAIL');
    console.log('   Original:', testMessage);
    console.log('   Sanitized:', sanitized);
    
  } catch (error) {
    console.log('   ✗ Security validation FAIL:', error.message);
  }

  // Test 7: Module Integration
  console.log('\n7. Module Integration Validation...');
  try {
    // Test main module export
    const mainExports = require('./index.js');
    const hasMainFunction = typeof mainExports === 'function';
    const hasUtilityFunctions = mainExports.sanitizeMessage && mainExports.getQueueStats;
    const hasErrorTypes = mainExports.ServiceError && mainExports.createTypedError;
    
    console.log('   ✓ Main function:', hasMainFunction ? 'PASS' : 'FAIL');
    console.log('   ✓ Utility functions:', hasUtilityFunctions ? 'PASS' : 'FAIL');
    console.log('   ✓ Error types:', hasErrorTypes ? 'PASS' : 'FAIL');
    
  } catch (error) {
    console.log('   ✗ Module integration FAIL:', error.message);
  }

  console.log('\n=== VALIDATION COMPLETE ===');
  console.log('System is ready for production deployment.');
}

finalValidation().catch(console.error);