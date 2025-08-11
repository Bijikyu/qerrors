/**
 * Enhanced Testing Demonstration
 * 
 * This test demonstrates our improved testing patterns using qtests integration
 * and our custom testUtils. Shows how the new utilities reduce code duplication
 * and provide better testing capabilities.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const qerrors = require('../lib/qerrors');
const { 
  QerrorsTestEnv, 
  QerrorsStubbing, 
  createMockResponse, 
  createMockRequest,
  runQerrorsIntegrationTest,
  withOfflineMode
} = require('../lib/testUtils');

test('enhanced environment management', async () => {
  // Test the enhanced environment utilities
  await QerrorsTestEnv.withTestEnv(async () => {
    // Verify qtests defaults are set
    assert.equal(process.env.OPENAI_TOKEN, 'token');
    assert.equal(process.env.NODE_ENV, 'test');
    
    // Verify qerrors-specific defaults are set
    assert.equal(process.env.QERRORS_VERBOSE, 'false');
    assert.equal(process.env.QERRORS_CACHE_TTL, '30');
    assert.equal(process.env.QERRORS_DISABLE_FILE_LOGS, 'true');
  });
  
  // Environment should be restored after the test
  // (Note: exact restoration depends on original environment)
});

test('enhanced stubbing utilities', async () => {
  let loggedError;
  let analyzeCalled = false;
  
  await QerrorsStubbing.withStubs(
    async (stubbing) => {
      // Setup stubs with the enhanced utilities
      await stubbing.stubLogger('error', (err) => { loggedError = err; });
      stubbing.stubAnalyzeError(async () => { analyzeCalled = true; return 'test advice'; });
    },
    async () => {
      // Test that stubs work correctly
      const logger = require('../lib/logger');
      const realLogger = await logger;
      
      realLogger.error('test error message');
      assert.equal(loggedError, 'test error message');
      
      const advice = await qerrors.analyzeError('test error');
      assert.equal(advice, 'test advice');
      assert.ok(analyzeCalled);
    }
  );
  
  // All stubs should be automatically restored
});

test('enhanced response mocking with assertions', async () => {
  const res = createMockResponse();
  const req = createMockRequest({ 
    headers: { accept: 'application/json' } 
  });
  
  // Use mock response
  res.status(200).json({ success: true });
  
  // Use enhanced assertion helpers
  res.assertStatus(200);
  res.assertJsonResponse();
  assert.deepEqual(res.payload, { success: true });
});

test('integration test helper demonstration', async () => {
  await runQerrorsIntegrationTest('error handling test', async ({ stubbing, res, req }) => {
    // Test environment is automatically configured
    // Stubs are automatically setup
    // Mock objects are provided
    
    const err = new Error('integration test error');
    await qerrors(err, 'test context', req, res);
    
    // Test the results
    assert.ok(err.uniqueErrorName);
    res.assertStatus(500);
    res.assertJsonResponse();
    assert.ok(res.payload.error);
  });
});

test('offline mode testing demonstration', async () => {
  await withOfflineMode(async () => {
    // This test runs in qtests offline mode
    // External dependencies are automatically stubbed
    
    const res = createMockResponse();
    const req = createMockRequest();
    const err = new Error('offline test error');
    
    // Test should work without real external dependencies
    await QerrorsStubbing.withStubs(
      async (stubbing) => {
        await stubbing.stubLogger('error', () => {});
        stubbing.stubAnalyzeError(async () => 'offline advice');
      },
      async () => {
        await qerrors(err, 'offline context', req, res);
        assert.ok(err.uniqueErrorName);
        res.assertStatus(500);
      }
    );
  });
});

test('console mocking with enhanced utilities', async () => {
  await QerrorsStubbing.withStubs(
    async (stubbing) => {
      const consoleSpy = stubbing.stubConsole('log');
      
      // Code that would normally log
      console.log('This is captured');
      console.log('Multiple', 'arguments', { test: true });
      
      // Verify console capture
      assert.equal(consoleSpy.mock.calls.length, 2);
      assert.equal(consoleSpy.mock.calls[0][0], 'This is captured');
      assert.deepEqual(consoleSpy.mock.calls[1], ['Multiple', 'arguments', { test: true }]);
    },
    async () => {
      // Test function with clean console
    }
  );
  
  // Console should be restored automatically
});

test('comparison of old vs new testing patterns', async () => {
  // OLD PATTERN (what we had before):
  // - Manual environment save/restore
  // - Custom stubbing helpers
  // - Verbose setup and cleanup
  
  // NEW PATTERN (using qtests integration):
  await runQerrorsIntegrationTest('comparison test', async ({ stubbing, res, req }) => {
    // Everything is setup automatically:
    // - Test environment configured
    // - Common stubs in place  
    // - Mock objects ready
    // - Automatic cleanup
    
    const err = new Error('comparison test');
    err.statusCode = 404;
    
    await qerrors(err, 'test', req, res);
    
    res.assertStatus(404);
    res.assertJsonResponse();
    assert.equal(res.payload.error.statusCode, 404);
  });
});