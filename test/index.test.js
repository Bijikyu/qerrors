const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //strict assertion helpers

const pkg = require('../index'); //entry module with exports to verify
const qerrors = require('../lib/qerrors'); //expected qerrors function
const logger = require('../lib/logger'); //expected logger instance

// Scenario: ensure module exports match the library internals
test('index exports qerrors and logger', () => {
  assert.equal(pkg.qerrors, qerrors);
  assert.equal(pkg.logger, logger);
  assert.equal(pkg.default, qerrors);
});
