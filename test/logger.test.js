const test = require('node:test');
const assert = require('node:assert/strict');

const logger = require('../lib/logger');

// Scenario: verify logger exposes basic Winston-style methods
test('logger exposes standard logging methods', () => {
  assert.equal(typeof logger.error, 'function');
  assert.equal(typeof logger.warn, 'function');
  assert.equal(typeof logger.info, 'function');
});

