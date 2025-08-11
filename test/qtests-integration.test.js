/**
 * qtests Integration Test
 * 
 * This test demonstrates how we can leverage qtests functionality
 * to improve our testing patterns and reduce code duplication.
 * Shows practical integration of qtests utilities in our qerrors project.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const qtests = require('qtests'); //import qtests utilities

// Import modules under test
const qerrors = require('../lib/qerrors');
const logger = require('../lib/logger');

test('qtests environment management demonstration', async () => {
  // Use qtests environment utilities instead of manual env handling
  const savedEnv = qtests.testEnv.saveEnv(); //save current environment
  
  try {
    // Set test environment with qtests defaults
    qtests.testEnv.setTestEnv(); //sets standard test env vars
    
    // Verify qtests set our expected environment
    assert.equal(process.env.OPENAI_TOKEN, 'token'); //qtests default token
    // Note: NODE_ENV might already be 'test' from test runner
    
    // Additional custom env vars for our specific test
    process.env.QERRORS_VERBOSE = 'true';
    process.env.QERRORS_CACHE_TTL = '30';
    
    // Test our module with the controlled environment
    const restore = await stubDepsWithQtests(() => {}, async () => 'mocked advice');
    const res = createMockResponse();
    const req = { headers: {} };
    const err = new Error('test error');
    
    await qerrors(err, 'test context', req, res);
    restore();
    
    assert.ok(err.uniqueErrorName); //error processed correctly
    assert.equal(res.statusCode, 500); //proper status set
    
  } finally {
    qtests.testEnv.restoreEnv(savedEnv); //restore original environment
  }
});

test('qtests console mocking demonstration', async () => {
  // Use qtests console mocking for cleaner test output
  const consoleSpy = qtests.mockConsole('log');
  
  try {
    // Code that logs to console
    console.log('This would normally pollute test output');
    console.log('Multiple log calls', { data: 'test' });
    
    // Verify console calls were captured (may include qtests internal logging)
    assert.ok(consoleSpy.mock.calls.length >= 2); //at least two calls captured
    // Find our specific log messages among the calls
    const messageCalls = consoleSpy.mock.calls.filter(call => 
      call[0] === 'This would normally pollute test output' || 
      (call[0] === 'Multiple log calls' && call[1]?.data === 'test')
    );
    assert.equal(messageCalls.length, 2); //our two messages were captured
    
  } finally {
    consoleSpy.mockRestore(); //restore original console.log
  }
});

test('qtests stubMethod vs our custom stubbing', async () => {
  // Compare qtests stubMethod with our current approach
  const realLogger = await logger;
  let loggedError;
  
  // Using qtests stubMethod - more robust error handling
  const restoreLogger = qtests.stubMethod(realLogger, 'error', (err) => {
    loggedError = err;
  });
  
  try {
    // Use the stubbed logger
    realLogger.error('test error message');
    assert.equal(loggedError, 'test error message');
    
  } finally {
    restoreLogger(); //qtests handles restoration cleanly
  }
  
  // Verify original method is restored
  assert.equal(typeof realLogger.error, 'function');
});

test('qtests offline mode demonstration', async () => {
  // Test how qtests offline mode could work with our axios usage
  qtests.offlineMode.setOfflineMode(true);
  
  try {
    // Get qtests axios stub when in offline mode
    const axios = qtests.offlineMode.getAxios();
    
    // Test that axios returns qtests default format
    const response = await axios.get('/test-endpoint');
    assert.equal(response.status, 200); //qtests default response
    assert.equal(typeof response.data, 'object'); //qtests provides object
    
  } finally {
    qtests.offlineMode.setOfflineMode(false); //restore online mode
  }
});

// Helper function using qtests utilities
async function stubDepsWithQtests(loggerFn, analyzeFn) {
  const realLogger = await logger;
  const restoreLogger = qtests.stubMethod(realLogger, 'error', loggerFn);
  const restoreAnalyze = qtests.stubMethod(qerrors, 'analyzeError', analyzeFn);
  return () => {
    restoreLogger();
    restoreAnalyze();
  };
}

// Helper function for response mocking
function createMockResponse() {
  return {
    headersSent: false,
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; },
    send(html) { this.payload = html; return this; }
  };
}