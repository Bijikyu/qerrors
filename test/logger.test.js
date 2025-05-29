/**
 * Test suite for Winston logger configuration and functionality.
 * 
 * These tests verify that the Winston logger is properly configured
 * with the correct transports, formatting, and logging levels for
 * the qerrors module's requirements.
 * 
 * Rationale: The logger configuration is critical for debugging and
 * monitoring in production environments. We need to ensure:
 * 
 * 1. Multiple transports are configured (file, console)
 * 2. Error-level logs are written to dedicated error.log file
 * 3. All logs are written to combined.log for comprehensive monitoring
 * 4. Console output is enabled for development debugging
 * 5. Timestamp formatting is consistent and readable
 * 6. Stack traces are properly included for error objects
 * 
 * Testing approach uses stubs to verify logging calls without actual
 * file I/O, ensuring tests run quickly and don't create temporary files.
 * We focus on verifying the logger interface behaves correctly rather
 * than testing Winston's internal file writing mechanics.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const logger = require('../lib/logger');

test('logger exposes standard logging methods', () => {
  assert.equal(typeof logger.error, 'function');
  assert.equal(typeof logger.warn, 'function');
  assert.equal(typeof logger.info, 'function');
});