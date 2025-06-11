const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //strict assertion helpers

const logger = require('../lib/logger'); //logger promise under test
const qtests = require('qtests'); //stubbing utilities
const winston = require('winston'); //winston stub to intercept config
const DailyRotateFile = require('winston-daily-rotate-file'); //daily rotate stub
const fs = require('fs'); //filesystem for stubbing mkdir behaviour

function reloadLogger() { //reload logger with current env
  delete require.cache[require.resolve('../lib/logger')];
  delete require.cache[require.resolve('../lib/config')];
  // Clear winston-daily-rotate-file from cache to get fresh stub instance
  const stubPath = require.resolve('winston-daily-rotate-file');
  delete require.cache[stubPath];
  return require('../lib/logger');
}

// Scenario: verify logger exposes basic Winston-style methods
test('logger exposes standard logging methods', async () => {
  const log = await logger; //wait for initialization
  assert.equal(typeof log.error, 'function');
  assert.equal(typeof log.warn, 'function');
  assert.equal(typeof log.info, 'function');
});

test('logger uses daily rotate when QERRORS_LOG_MAX_DAYS set', async () => {
  const orig = process.env.QERRORS_LOG_MAX_DAYS; //store original days
  const origDisable = process.env.QERRORS_DISABLE_FILE_LOGS; //store original disable flag
  process.env.QERRORS_LOG_MAX_DAYS = '2'; //enable two day rotation
  delete process.env.QERRORS_DISABLE_FILE_LOGS; //ensure file logs are enabled
  let captured; //will capture config passed to createLogger
  
  const restore = qtests.stubMethod(winston, 'createLogger', (cfg) => { 
    captured = cfg; 
    return { transports: cfg.transports, warn() {}, info() {}, error() {} }; 
  }); //include warn for startup check
  const log = await reloadLogger();
  await log; //ensure init completed
  try {
    // Verify that 2 transports are created and they are DailyRotateFile instances
    assert.equal(captured.transports.length, 2); //two transports created
    assert.equal(captured.transports[0].constructor.name, 'DailyRotateFile'); //first is daily rotate
    assert.equal(captured.transports[1].constructor.name, 'DailyRotateFile'); //second is daily rotate
    // Verify the maxFiles configuration matches expected pattern for daily retention
    assert.equal(captured.transports[0].opts.maxFiles, '2d'); //stub records options under opts
  } finally {
    restore();
    if (orig === undefined) { delete process.env.QERRORS_LOG_MAX_DAYS; } else { process.env.QERRORS_LOG_MAX_DAYS = orig; }
    if (origDisable === undefined) { delete process.env.QERRORS_DISABLE_FILE_LOGS; } else { process.env.QERRORS_DISABLE_FILE_LOGS = origDisable; }
    reloadLogger(); //reset logger cache
  }
});

test('file transports active when mkdirSync succeeds', async () => {
  const origDisable = process.env.QERRORS_DISABLE_FILE_LOGS; //save flag state
  delete process.env.QERRORS_DISABLE_FILE_LOGS; //ensure files allowed
  let captured; //capture logger config
  const restoreLogger = qtests.stubMethod(winston, 'createLogger', cfg => { captured = cfg; return { transports: cfg.transports, warn() {}, info() {}, error() {} }; }); //capture transports
  let callCount = 0; //track mkdir calls
  const restoreMkdir = qtests.stubMethod(fs.promises, 'mkdir', async () => { callCount++; }); //stub async mkdir
  const log = await reloadLogger();
  await log;
  try {
    assert.ok(callCount > 0); //directory attempted
    assert.ok((await log).transports.length >= 2); //file transports configured
    assert.ok(captured.transports.length >= 2); //logger received file transports
  } finally {
    restoreLogger();
    restoreMkdir();
    if (origDisable === undefined) { delete process.env.QERRORS_DISABLE_FILE_LOGS; } else { process.env.QERRORS_DISABLE_FILE_LOGS = origDisable; }
    reloadLogger(); //reset logger
  }
});

test('logger continues with console transport when mkdirSync fails', async () => {
  const origVerbose = process.env.QERRORS_VERBOSE; //save current verbose
  process.env.QERRORS_VERBOSE = 'true'; //ensure console transport
  let captured; //capture logger config
  const restoreLogger = qtests.stubMethod(winston, 'createLogger', (cfg) => { captured = cfg; return { transports: cfg.transports, warn() {}, info() {}, error() {} }; }); //include warn for startup check
  const restoreMkdir = qtests.stubMethod(fs.promises, 'mkdir', async () => { throw new Error('fail'); }); //simulate failure with async mkdir
  let errMsg; //capture console error message
  const restoreErr = qtests.stubMethod(console, 'error', (msg) => { errMsg = msg; });
  const log = await reloadLogger();
  await log;
  try {
    assert.ok((await log).transports.length > 0); //logger returned usable instance
    assert.ok(captured.transports.length >= 1); //console transport configured even if files remain
    assert.ok(errMsg.includes('Failed to create log directory')); //error logged
  } finally {
    restoreLogger();
    restoreMkdir();
    restoreErr();
    if (origVerbose === undefined) { delete process.env.QERRORS_VERBOSE; } else { process.env.QERRORS_VERBOSE = origVerbose; }
  reloadLogger(); //reset cached module
  }
});

test('file logs stay disabled after mkdir failure when env unset', async () => {
  const origVerbose = process.env.QERRORS_VERBOSE; //preserve verbose setting
  const origDisable = process.env.QERRORS_DISABLE_FILE_LOGS; //preserve disable flag
  process.env.QERRORS_VERBOSE = 'true'; //enable console transport for test
  delete process.env.QERRORS_DISABLE_FILE_LOGS; //simulate no disable env var
  let captured; //capture logger configuration
  const restoreLogger = qtests.stubMethod(winston, 'createLogger', cfg => { captured = cfg; return { transports: cfg.transports, warn() {}, info() {}, error() {} }; }); //capture transports
  const restoreMkdir = qtests.stubMethod(fs.promises, 'mkdir', async () => { throw new Error('fail'); }); //simulate mkdir failure
  const restoreErr = qtests.stubMethod(console, 'error', () => {}); //suppress console error output during test
  const log = await reloadLogger();
  await log;
  try {
    assert.equal(captured.transports.length, 1); //only console transport should be active
    assert.ok(captured.transports[0] instanceof winston.transports.Console); //verify transport is console
  } finally {
    restoreLogger();
    restoreMkdir();
    restoreErr();
    if (origVerbose === undefined) { delete process.env.QERRORS_VERBOSE; } else { process.env.QERRORS_VERBOSE = origVerbose; }
    if (origDisable === undefined) { delete process.env.QERRORS_DISABLE_FILE_LOGS; } else { process.env.QERRORS_DISABLE_FILE_LOGS = origDisable; }
    reloadLogger(); //reset cached module
  }
});

test('logger warns when max days zero with file logs', async () => {
  const origDays = process.env.QERRORS_LOG_MAX_DAYS; //save env day setting
  const origDisable = process.env.QERRORS_DISABLE_FILE_LOGS; //save disable flag
  process.env.QERRORS_LOG_MAX_DAYS = '0'; //explicit zero days
  delete process.env.QERRORS_DISABLE_FILE_LOGS; //ensure file logs active
  let warned = false; //track warn call
  const restore = qtests.stubMethod(winston, 'createLogger', cfg => { return { transports: cfg.transports, warn: () => { warned = true; }, info() {}, error() {} }; }); //provide stub logger
  await reloadLogger(); //load module which should warn
  try {
    assert.equal(warned, true); //expect warning
  } finally {
    restore();
    if (origDays === undefined) { delete process.env.QERRORS_LOG_MAX_DAYS; } else { process.env.QERRORS_LOG_MAX_DAYS = origDays; }
    if (origDisable === undefined) { delete process.env.QERRORS_DISABLE_FILE_LOGS; } else { process.env.QERRORS_DISABLE_FILE_LOGS = origDisable; }
    reloadLogger(); //reset logger
  }
});

test('logger defaults to console when mkdir fails and verbose unset', async () => {
  const origVerbose = process.env.QERRORS_VERBOSE; //preserve verbose state
  const origDisable = process.env.QERRORS_DISABLE_FILE_LOGS; //preserve disable state
  delete process.env.QERRORS_VERBOSE; //unset verbose so fallback logic triggers
  delete process.env.QERRORS_DISABLE_FILE_LOGS; //allow file logs so mkdir will attempt
  let captured; //capture logger configuration
  const restoreLogger = qtests.stubMethod(winston, 'createLogger', cfg => { captured = cfg; return { transports: cfg.transports, warn() {}, info() {}, error() {} }; }); //intercept createLogger
  const restoreMkdir = qtests.stubMethod(fs.promises, 'mkdir', async () => { throw new Error('fail'); }); //force init failure
  const restoreErr = qtests.stubMethod(console, 'error', () => {}); //suppress console error
  const logPromise = await reloadLogger();
  await logPromise;
  try {
    const hasConsole = captured.transports.some(t => t instanceof winston.transports.Console); //look for console transport
    assert.equal(hasConsole, true); //expect console added
    assert.ok((await logPromise).transports.length >= 1); //logger exposes transport
  } finally {
    restoreLogger();
    restoreMkdir();
    restoreErr();
    if (origVerbose === undefined) { delete process.env.QERRORS_VERBOSE; } else { process.env.QERRORS_VERBOSE = origVerbose; }
    if (origDisable === undefined) { delete process.env.QERRORS_DISABLE_FILE_LOGS; } else { process.env.QERRORS_DISABLE_FILE_LOGS = origDisable; }
    reloadLogger(); //reset logger cache
  }
});

