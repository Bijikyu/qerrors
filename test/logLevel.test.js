const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stubbing util
const winston = require('winston'); //winston stub

function reloadLogger() { //reload logger with env changes
  delete require.cache[require.resolve('../lib/logger')];
  delete require.cache[require.resolve('../lib/config')];
  return require('../lib/logger');
}

test('logger uses QERRORS_LOG_LEVEL env var', async () => {
  const orig = process.env.QERRORS_LOG_LEVEL; //save original value
  process.env.QERRORS_LOG_LEVEL = 'debug'; //set custom level
  let captured; //capture config
  const restore = qtests.stubMethod(winston, 'createLogger', cfg => { captured = cfg; return { level: cfg.level, transports: cfg.transports, warn() {}, info() {}, error() {} }; }); //return stub logger
  const logger = await reloadLogger();
  try {
    assert.equal(captured.level, 'debug'); //logger configured with env level
    assert.equal((await logger).level, 'debug'); //promise resolves same level
  } finally {
    restore();
    if (orig === undefined) { delete process.env.QERRORS_LOG_LEVEL; } else { process.env.QERRORS_LOG_LEVEL = orig; }
    reloadLogger(); //reset cache
  }
});

test('logger defaults QERRORS_LOG_LEVEL when unset', async () => {
  const orig = process.env.QERRORS_LOG_LEVEL; //store original
  delete process.env.QERRORS_LOG_LEVEL; //unset for default test
  let captured; //capture config
  const restore = qtests.stubMethod(winston, 'createLogger', cfg => { captured = cfg; return { level: cfg.level, transports: cfg.transports, warn() {}, info() {}, error() {} }; }); //return stub logger
  const logger = await reloadLogger();
  try {
    assert.equal(captured.level, 'info'); //default level used when unset
    assert.equal((await logger).level, 'info'); //logger exposes default
  } finally {
    restore();
    if (orig === undefined) { delete process.env.QERRORS_LOG_LEVEL; } else { process.env.QERRORS_LOG_LEVEL = orig; }
    reloadLogger(); //reset cache
  }
});
