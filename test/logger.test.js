const test = require('node:test');
const assert = require('node:assert/strict');

const logger = require('../lib/logger');

test('logger exposes standard logging methods', () => {
  assert.equal(typeof logger.error, 'function');
  assert.equal(typeof logger.warn, 'function');
  assert.equal(typeof logger.info, 'function');
});

