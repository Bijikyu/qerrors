/**
 * Enhanced Test Utilities for qerrors
 * 
 * This module provides enhanced testing utilities that leverage qtests functionality
 * while adding qerrors-specific helpers. It demonstrates best practices for integrating
 * qtests into our existing testing infrastructure.
 * 
 * Design rationale:
 * - Leverages qtests utilities to reduce code duplication
 * - Provides qerrors-specific testing patterns
 * - Maintains backward compatibility with existing tests
 * - Demonstrates qtests integration patterns
 */

const qtests = require('qtests');

/**
 * Enhanced Environment Management using qtests
 * 
 * Provides a wrapper around qtests environment utilities that includes
 * qerrors-specific environment variables and testing patterns.
 */
class QerrorsTestEnv {
  constructor() {
    this.savedEnv = null;
  }

  /**
   * Setup test environment with qerrors-specific defaults
   * Combines qtests standard test env with qerrors configuration
   */
  setupTestEnvironment() {
    // Save current environment using qtests
    this.savedEnv = qtests.testEnv.saveEnv();
    
    // Apply qtests standard test environment
    qtests.testEnv.setTestEnv();
    
    // Add qerrors-specific test environment variables
    Object.assign(process.env, {
      QERRORS_VERBOSE: 'false', // reduce noise in tests
      QERRORS_CACHE_TTL: '30', // short cache for tests
      QERRORS_CACHE_SIZE: '10', // small cache for tests
      QERRORS_CONCURRENCY: '2', // reduced concurrency for tests
      QERRORS_QUEUE_SIZE: '5', // small queue for tests
      QERRORS_DISABLE_FILE_LOGS: 'true', // no file logs in tests
      NODE_ENV: 'test' // ensure test environment
    });
    
    return this;
  }

  /**
   * Restore original environment using qtests
   */
  restore() {
    if (this.savedEnv) {
      qtests.testEnv.restoreEnv(this.savedEnv);
      this.savedEnv = null;
    }
  }

  /**
   * Execute function with test environment and auto-restore
   * Similar to qtests.testHelpers.withSavedEnv but with qerrors defaults
   */
  static async withTestEnv(fn) {
    const testEnv = new QerrorsTestEnv();
    try {
      testEnv.setupTestEnvironment();
      return await fn();
    } finally {
      testEnv.restore();
    }
  }
}

/**
 * Enhanced Stubbing Utilities
 * 
 * Provides qerrors-specific stubbing patterns that build on qtests.stubMethod
 * with domain-specific knowledge about our module structure.
 */
class QerrorsStubbing {
  constructor() {
    this.restoreFunctions = [];
  }

  /**
   * Stub logger methods with tracking
   * Uses qtests.stubMethod with qerrors-specific logger handling
   */
  async stubLogger(logLevel, mockFn) {
    const logger = require('./logger');
    const realLogger = await logger;
    const restore = qtests.stubMethod(realLogger, logLevel, mockFn);
    this.restoreFunctions.push(restore);
    return restore;
  }

  /**
   * Stub qerrors analyzeError method
   * Centralizes the common pattern of stubbing AI analysis
   */
  stubAnalyzeError(mockFn) {
    const qerrorsModule = require('./qerrors');
    // Use custom stubbing since qtests.stubMethod has issues with function objects
    const originalAnalyzeError = qerrorsModule.analyzeError;
    qerrorsModule.analyzeError = mockFn;
    
    const restore = () => {
      qerrorsModule.analyzeError = originalAnalyzeError;
    };
    
    this.restoreFunctions.push(restore);
    return restore;
  }

  /**
   * Stub console output for clean test runs
   * Uses qtests.mockConsole with automatic cleanup tracking
   */
  stubConsole(method = 'log') {
    const spy = qtests.mockConsole(method);
    this.restoreFunctions.push(() => spy.mockRestore());
    return spy;
  }

  /**
   * Restore all stubs created by this instance
   */
  restoreAll() {
    this.restoreFunctions.forEach(restore => restore());
    this.restoreFunctions = [];
  }

  /**
   * Execute function with stubs and auto-restore
   */
  static async withStubs(setupFn, testFn) {
    const stubbing = new QerrorsStubbing();
    try {
      await setupFn(stubbing);
      return await testFn(stubbing);
    } finally {
      stubbing.restoreAll();
    }
  }
}

/**
 * Mock Response Factory
 * 
 * Creates Express-like response mocks for testing qerrors middleware.
 * Enhanced with assertion helpers for common testing patterns.
 */
function createMockResponse() {
  const response = {
    headersSent: false,
    statusCode: null,
    payload: null,
    headers: {},
    
    status(code) { 
      this.statusCode = code; 
      return this; 
    },
    
    json(data) { 
      this.payload = data; 
      this.headers['content-type'] = 'application/json';
      return this; 
    },
    
    send(html) { 
      this.payload = html; 
      this.headers['content-type'] = 'text/html';
      return this; 
    },

    // Test assertion helpers
    assertStatus(expectedStatus) {
      if (this.statusCode !== expectedStatus) {
        throw new Error(`Expected status ${expectedStatus}, got ${this.statusCode}`);
      }
    },

    assertJsonResponse() {
      if (this.headers['content-type'] !== 'application/json') {
        throw new Error('Expected JSON response');
      }
      if (typeof this.payload !== 'object') {
        throw new Error('Expected object payload for JSON response');
      }
    },

    assertHtmlResponse() {
      if (this.headers['content-type'] !== 'text/html') {
        throw new Error('Expected HTML response');
      }
      if (typeof this.payload !== 'string') {
        throw new Error('Expected string payload for HTML response');
      }
    }
  };

  return response;
}

/**
 * Mock Request Factory
 * 
 * Creates Express-like request mocks with common headers and properties
 * needed for testing qerrors middleware functionality.
 */
function createMockRequest(options = {}) {
  return {
    headers: options.headers || {},
    method: options.method || 'GET',
    url: options.url || '/',
    ip: options.ip || '127.0.0.1',
    ...options
  };
}

/**
 * Integration Test Helper
 * 
 * Combines environment setup, stubbing, and mocking for comprehensive
 * integration testing of qerrors functionality.
 */
async function runQerrorsIntegrationTest(testName, testFn) {
  return QerrorsTestEnv.withTestEnv(async () => {
    return QerrorsStubbing.withStubs(
      async (stubbing) => {
        // Default stubs for integration tests
        await stubbing.stubLogger('error', () => {}); // silence error logs
        stubbing.stubAnalyzeError(async () => 'test advice'); // mock AI analysis
      },
      async (stubbing) => {
        const res = createMockResponse();
        const req = createMockRequest();
        return await testFn({ stubbing, res, req });
      }
    );
  });
}

/**
 * Offline Mode Testing
 * 
 * Demonstrates using qtests offline mode for testing without external dependencies
 */
function withOfflineMode(testFn) {
  const wasOffline = qtests.offlineMode.isOfflineMode();
  try {
    qtests.offlineMode.setOfflineMode(true);
    return testFn();
  } finally {
    qtests.offlineMode.setOfflineMode(wasOffline);
  }
}

module.exports = {
  QerrorsTestEnv,
  QerrorsStubbing,
  createMockResponse,
  createMockRequest,
  runQerrorsIntegrationTest,
  withOfflineMode,
  
  // Re-export qtests utilities for convenience
  qtests: {
    stubMethod: qtests.stubMethod,
    mockConsole: qtests.mockConsole,
    testEnv: qtests.testEnv,
    offlineMode: qtests.offlineMode,
    testHelpers: qtests.testHelpers
  }
};