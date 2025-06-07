const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //strict assertion helpers

const logger = require('../lib/logger'); //logger instance under test
const qtests = require('qtests'); //stubbing utilities
const winston = require('winston'); //winston stub to intercept config
const DailyRotateFile = require('winston-daily-rotate-file'); //daily rotate stub

function reloadLogger() { //reload logger with current env
  delete require.cache[require.resolve('../lib/logger')];
  delete require.cache[require.resolve('../lib/config')];
  return require('../lib/logger');
}

// Scenario: verify logger exposes basic Winston-style methods
test('logger exposes standard logging methods', () => {
  assert.equal(typeof logger.error, 'function');
  assert.equal(typeof logger.warn, 'function');
  assert.equal(typeof logger.info, 'function');
});

test('logger uses daily rotate when QERRORS_LOG_MAX_DAYS set', () => {
  const orig = process.env.QERRORS_LOG_MAX_DAYS; //store original days
  process.env.QERRORS_LOG_MAX_DAYS = '2'; //enable two day rotation
  let captured; //will capture config passed to createLogger
  DailyRotateFile.calls.length = 0; //reset constructor calls
  const restore = qtests.stubMethod(winston, 'createLogger', (cfg) => { captured = cfg; return { transports: cfg.transports }; });
  const log = reloadLogger();
  try {
    assert.equal(DailyRotateFile.calls.length, 2); //two rotate transports created
    assert.equal(DailyRotateFile.calls[0].maxFiles, '2d'); //retention uses env days
    assert.ok(captured.transports.length > 0); //transports configured
  } finally {
    restore();
    if (orig === undefined) { delete process.env.QERRORS_LOG_MAX_DAYS; } else { process.env.QERRORS_LOG_MAX_DAYS = orig; }
    reloadLogger(); //reset logger cache
  }
});

