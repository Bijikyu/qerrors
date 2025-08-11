#!/usr/bin/env node

/**
 * Test AI advice visibility in console vs logs
 * Shows the difference between verbose and non-verbose modes
 */

const qerrors = require('./lib/qerrors');

// Create a mock response object
function createMockResponse() {
  return {
    headersSent: false,
    statusCode: null,
    responseData: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.responseData = data; return this; }
  };
}

async function testAdviceVisibility() {
  console.log('Testing AI advice visibility...\n');
  
  // Test without verbose mode (current default)
  console.log('=== Test 1: Normal Mode (QERRORS_VERBOSE not set) ===');
  console.log('AI advice will be logged to files but NOT printed to console\n');
  
  const testError1 = new Error('Failed to connect to MongoDB at localhost:27017');
  testError1.code = 'ECONNREFUSED';
  
  const mockReq = { headers: { 'accept': 'application/json' } };
  const mockRes = createMockResponse();
  
  console.log('Triggering error analysis...');
  await qerrors(testError1, 'databaseConnection', mockReq, mockRes);
  
  console.log('Response sent with unique ID:', mockRes.responseData?.error?.uniqueErrorName);
  console.log('Notice: AI advice does not appear in console output above');
  
  // Give time for async analysis
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('\n=== Test 2: Verbose Mode (QERRORS_VERBOSE=true) ===');
  console.log('AI advice WILL be printed to console\n');
  
  // Temporarily enable verbose mode
  process.env.QERRORS_VERBOSE = 'true';
  
  const testError2 = new Error('Redis connection timeout after 5000ms');
  testError2.code = 'ETIMEDOUT';
  
  const mockRes2 = createMockResponse();
  
  console.log('Triggering error analysis with verbose mode...');
  await qerrors(testError2, 'cacheLayer', mockReq, mockRes2);
  
  console.log('Response sent with unique ID:', mockRes2.responseData?.error?.uniqueErrorName);
  console.log('Notice: With verbose mode, you should see detailed logging above including AI advice');
  
  // Reset verbose mode
  delete process.env.QERRORS_VERBOSE;
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('\n=== Summary ===');
  console.log('- Normal mode: AI advice goes to log files only');
  console.log('- Verbose mode (QERRORS_VERBOSE=true): AI advice appears in console');
  console.log('- Check logs/combined.log to see all AI advice regardless of verbose setting');
}

// Run test if this file is executed directly
if (require.main === module) {
  testAdviceVisibility().then(() => {
    console.log('\nTest completed. Check logs/combined.log for full AI advice details.');
    process.exit(0);
  }).catch((error) => {
    console.error('Test error:', error);
    process.exit(1);
  });
}

module.exports = { testAdviceVisibility };