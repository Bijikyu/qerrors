const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stubbing util
const winston = require('winston'); //winston stub

function reloadLogger() { //reload logger for each test
  delete require.cache[require.resolve('../lib/logger')];
  delete require.cache[require.resolve('../lib/config')];
  return require('../lib/logger');
}

test('logger adds Console transport when verbose true', async () => {
  const orig = process.env.QERRORS_VERBOSE; //save original env
  process.env.QERRORS_VERBOSE = 'true'; //enable console logging
  let captured; //will hold config passed in
  const restore = qtests.stubMethod(winston, 'createLogger', cfg => { captured = cfg; return { transports: cfg.transports, warn() {}, info() {}, error() {} }; }); //capture transports with warn for startup check
  const logger = await reloadLogger(); //load module under new env
  await logger;
  try {
    const hasConsole = captured.transports.some(t => t instanceof winston.transports.Console); //check captured transports
    assert.equal(hasConsole, true); //expect console present
    assert.equal(logger.transports.length, captured.transports.length); //logger returns same transports
  } finally {
    restore(); //restore stub
    if (orig === undefined) { delete process.env.QERRORS_VERBOSE; } else { process.env.QERRORS_VERBOSE = orig; } //restore env
    reloadLogger(); //clear cache
  }
});

test('logger excludes Console transport when verbose false', async () => {
  const orig = process.env.QERRORS_VERBOSE; //save env
  process.env.QERRORS_VERBOSE = 'false'; //disable console
  let captured; //hold config
  const restore = qtests.stubMethod(winston, 'createLogger', cfg => { captured = cfg; return { transports: cfg.transports, warn() {}, info() {}, error() {} }; }); //capture transports with warn for startup check
  const logger = await reloadLogger(); //reload module
  await logger;
  try {
    const hasConsole = captured.transports.some(t => t instanceof winston.transports.Console); //detect console
    assert.equal(hasConsole, false); //expect none
    assert.equal(logger.transports.length, captured.transports.length); //verify exports
  } finally {
    restore(); //cleanup stub
    if (orig === undefined) { delete process.env.QERRORS_VERBOSE; } else { process.env.QERRORS_VERBOSE = orig; } //restore env
    reloadLogger(); //reset
  }
});
