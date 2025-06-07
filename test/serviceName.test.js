const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stubbing helper
const winston = require('winston'); //stubbed winston module

function reloadLogger() { //reload logger with current env
  delete require.cache[require.resolve('../lib/logger')];
  delete require.cache[require.resolve('../lib/config')];
  return require('../lib/logger');
}

test('logger uses QERRORS_SERVICE_NAME env var', () => {
  const orig = process.env.QERRORS_SERVICE_NAME; //save original value
  process.env.QERRORS_SERVICE_NAME = 'svc'; //set custom name
  let captured; //will capture config passed to createLogger
  const restore = qtests.stubMethod(winston, 'createLogger', (cfg) => { captured = cfg; return { defaultMeta: cfg.defaultMeta, warn() {}, info() {}, error() {} }; }); //include warn for startup check
  const logger = reloadLogger(); //reload module
  try {
    assert.equal(captured.defaultMeta.service, 'svc'); //verify custom service
    assert.equal(logger.defaultMeta.service, 'svc'); //logger carries meta
  } finally {
    restore(); //restore stubbed method
    if (orig === undefined) { delete process.env.QERRORS_SERVICE_NAME; } else { process.env.QERRORS_SERVICE_NAME = orig; }
    reloadLogger(); //reset cache
  }
});

test('logger defaults QERRORS_SERVICE_NAME when unset', () => {
  const orig = process.env.QERRORS_SERVICE_NAME; //store original
  delete process.env.QERRORS_SERVICE_NAME; //unset for default test
  let captured; //capture config
  const restore = qtests.stubMethod(winston, 'createLogger', (cfg) => { captured = cfg; return { defaultMeta: cfg.defaultMeta, warn() {}, info() {}, error() {} }; }); //include warn for startup check
  const logger = reloadLogger(); //reload module
  try {
    assert.equal(captured.defaultMeta.service, 'qerrors'); //uses default
    assert.equal(logger.defaultMeta.service, 'qerrors'); //logger meta default
  } finally {
    restore(); //restore stub
    if (orig === undefined) { delete process.env.QERRORS_SERVICE_NAME; } else { process.env.QERRORS_SERVICE_NAME = orig; }
    reloadLogger(); //restore cache
  }
});
