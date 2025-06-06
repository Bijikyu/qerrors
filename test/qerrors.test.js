
const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //strict assertion helpers
const qtests = require('qtests'); //qtests stubbing utilities

const qerrors = require('../lib/qerrors'); //module under test
const logger = require('../lib/logger'); //winston logger stubbed during tests


function createRes() { //construct minimal Express-like response mock
  return {
    headersSent: false, //simulates whether headers have been sent
    statusCode: null, //captured status for assertions
    payload: null, //body content returned by status/json/send
    status(code) { this.statusCode = code; return this; }, //chainable setter
    json(data) { this.payload = data; return this; }, //capture JSON payload
    send(html) { this.payload = html; return this; } //capture HTML output
  };
}

function stubDeps(loggerFn, analyzeFn) { //create combined stub utility for tests
  const restoreLogger = qtests.stub(logger, 'error', loggerFn); //stub logger.error with provided function
  const restoreAnalyze = qtests.stub(qerrors, 'analyzeError', analyzeFn); //stub analyzeError with provided function
  return () => { //return unified restore
    restoreLogger(); //restore logger.error after each test
    restoreAnalyze(); //restore analyzeError after each test
  };
}

// Scenario: standard JSON error handling and next() invocation
test('qerrors logs and responds with json then calls next', async () => {
  let logged; //capture logger output for assertions
  const restore = stubDeps((err) => { logged = err; }, async () => 'adv'); //stub logger and analyze with helper
  const res = createRes(); //mock response object
  const req = { headers: {} }; //minimal request object
  const err = new Error('boom'); //sample error to handle
  let nextArg; //store argument passed to next()
  const next = (e) => { nextArg = e; }; //spy for next()
  try {
    await qerrors(err, 'ctx', req, res, next);
  } finally {
    restore(); //restore all stubs after test
  }
  assert.ok(err.uniqueErrorName);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.payload.error.uniqueErrorName, err.uniqueErrorName);
  assert.deepEqual(logged.uniqueErrorName, err.uniqueErrorName);
  assert.equal(nextArg, err);
});

// Scenario: send HTML when browser requests it
test('qerrors sends html when accept header requests it', async () => {
  const restore = stubDeps(() => {}, async () => {}); //stub logger and analyze with helper
  const res = createRes(); //mock response object to capture html
  const req = { headers: { accept: 'text/html' } }; //request asking for html
  const err = new Error('boom'); //sample error to send
  try {
    await qerrors(err, 'ctx', req, res);
  } finally {
    restore(); //restore all stubs after test
  }
  assert.equal(res.statusCode, 500);
  assert.ok(typeof res.payload === 'string');
});

// Scenario: skip response when headers already sent
test('qerrors does nothing when headers already sent', async () => {
  const restore = stubDeps(() => {}, async () => {}); //stub logger and analyze with helper
  const res = createRes(); //mock response object with headers already sent
  res.headersSent = true; //simulate Express sending headers prior
  const err = new Error('boom'); //error to pass into handler
  let nextCalled = false; //track if next() invoked
  try {
    await qerrors(err, 'ctx', {}, res, () => { nextCalled = true; });
  } finally {
    restore(); //restore all stubs after test
  }
  assert.equal(res.statusCode, null);
  assert.equal(nextCalled, false);
});

// Scenario: operate without Express objects
test('qerrors handles absence of req res and next', async () => {
  let logged; //capture logger output
  const restore = stubDeps((err) => { logged = err; }, async () => {}); //stub logger and analyze with helper
  const err = new Error('boom'); //error for generic usage
  try {
    await qerrors(err);
  } finally {
    restore(); //restore all stubs after test
  }
  assert.ok(err.uniqueErrorName);
  assert.equal(logged.context, 'unknown context');
});

// Scenario: still call next when res is undefined
test('qerrors calls next without res', async () => {
  const restore = stubDeps(() => {}, async () => {}); //stub logger and analyze with helper
  const err = new Error('boom'); //error when res missing
  let nextArg; //captured arg for next()
  try {
    await qerrors(err, 'ctx', undefined, undefined, (e) => { nextArg = e; });
  } finally {
    restore(); //restore all stubs after test
  }
  assert.equal(nextArg, err);
});

// Scenario: warn and exit when called without an error
test('qerrors exits if no error provided', async () => {
  const restore = stubDeps(() => {}, async () => {}); //stub logger and analyze with helper
  let warned = false; //track if warn was called
  const restoreWarn = qtests.stub(console, 'warn', () => { warned = true; }); //use qtests to stub console.warn
  try {
    await qerrors(null, 'ctx');
    assert.equal(warned, true);
  } finally {
    restoreWarn(); //restore console.warn after test
    restore(); //restore all stubs after test
  }
});
