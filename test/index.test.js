const test = require('node:test');
const assert = require('node:assert/strict');

const pkg = require('../index');
const qerrors = require('../lib/qerrors');
const logger = require('../lib/logger');

test('index exports qerrors and logger', () => {
  assert.equal(pkg.qerrors, qerrors);
  assert.equal(pkg.logger, logger);
  assert.equal(pkg.default, qerrors);
});
