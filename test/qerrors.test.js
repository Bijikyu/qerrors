const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //strict assertion helpers

const qerrors = require('../lib/qerrors'); //module under test
const logger = require('../lib/logger'); //winston logger stubbed during tests
const stubMethod = require('./utils/stubMethod'); //(use stubMethod to replace logger and analyzer to isolate external deps)


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

// Scenario: standard JSON error handling and next() invocation
test('qerrors logs and responds with json then calls next', async () => {
  let logged; //capture logger output for assertions
  const restoreLogger = stubMethod(logger, 'error', (err) => { logged = err; }); //use stubMethod for logger to avoid real logging
  const restoreAnalyze = stubMethod(qerrors, 'analyzeError', async () => 'adv'); //use stubMethod for analyzeError to avoid API calls
  const res = createRes(); //mock response object
  const req = { headers: {} }; //minimal request object
  const err = new Error('boom'); //sample error to handle
  let nextArg; //store argument passed to next()
  const next = (e) => { nextArg = e; }; //spy for next()
  try {
    await qerrors(err, 'ctx', req, res, next);
  } finally {
    restoreLogger(); //restore logger.error after test
    restoreAnalyze(); //restore analyzeError after test
  }
  assert.ok(err.uniqueErrorName);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.payload.error.uniqueErrorName, err.uniqueErrorName);
  assert.deepEqual(logged.uniqueErrorName, err.uniqueErrorName);
  assert.equal(nextArg, err);
});

// Scenario: send HTML when browser requests it
test('qerrors sends html when accept header requests it', async () => {
  const restoreLogger = stubMethod(logger, 'error', () => {}); //use stubMethod for logger to avoid real logging
  const restoreAnalyze = stubMethod(qerrors, 'analyzeError', async () => {}); //use stubMethod for analyzeError to avoid API calls
  const res = createRes(); //mock response object to capture html
  const req = { headers: { accept: 'text/html' } }; //request asking for html
  const err = new Error('boom'); //sample error to send
  try {
    await qerrors(err, 'ctx', req, res);
  } finally {
    restoreLogger(); //restore logger.error after test
    restoreAnalyze(); //restore analyzeError after test
  }
  assert.equal(res.statusCode, 500);
  assert.ok(typeof res.payload === 'string');
});

// Scenario: skip response when headers already sent
test('qerrors does nothing when headers already sent', async () => {
  const restoreLogger = stubMethod(logger, 'error', () => {}); //use stubMethod for logger to avoid real logging
  const restoreAnalyze = stubMethod(qerrors, 'analyzeError', async () => {}); //use stubMethod for analyzeError to avoid API calls
  const res = createRes(); //mock response object with headers already sent
  res.headersSent = true; //simulate Express sending headers prior
  const err = new Error('boom'); //error to pass into handler
  let nextCalled = false; //track if next() invoked
  try {
    await qerrors(err, 'ctx', {}, res, () => { nextCalled = true; });
  } finally {
    restoreLogger(); //restore logger.error after test
    restoreAnalyze(); //restore analyzeError after test
  }
  assert.equal(res.statusCode, null);
  assert.equal(nextCalled, false);
});

// Scenario: operate without Express objects
test('qerrors handles absence of req res and next', async () => {
  let logged; //capture logger output
  const restoreLogger = stubMethod(logger, 'error', (err) => { logged = err; }); //use stubMethod for logger to avoid real logging
  const restoreAnalyze = stubMethod(qerrors, 'analyzeError', async () => {}); //use stubMethod for analyzeError to avoid API calls
  const err = new Error('boom'); //error for generic usage
  try {
    await qerrors(err);
  } finally {
    restoreLogger(); //restore logger.error after test
    restoreAnalyze(); //restore analyzeError after test
  }
  assert.ok(err.uniqueErrorName);
  assert.equal(logged.context, 'unknown context');
});

// Scenario: still call next when res is undefined
test('qerrors calls next without res', async () => {
  const restoreLogger = stubMethod(logger, 'error', () => {}); //use stubMethod for logger to avoid real logging
  const restoreAnalyze = stubMethod(qerrors, 'analyzeError', async () => {}); //use stubMethod for analyzeError to avoid API calls
  const err = new Error('boom'); //error when res missing
  let nextArg; //captured arg for next()
  try {
    await qerrors(err, 'ctx', undefined, undefined, (e) => { nextArg = e; });
  } finally {
    restoreLogger(); //restore logger.error after test
    restoreAnalyze(); //restore analyzeError after test
  }
  assert.equal(nextArg, err);
});

// Scenario: warn and exit when called without an error
test('qerrors exits if no error provided', async () => {
  const restoreLogger = stubMethod(logger, 'error', () => {}); //use stubMethod for logger to avoid real logging
  const restoreAnalyze = stubMethod(qerrors, 'analyzeError', async () => {}); //use stubMethod for analyzeError to avoid API calls
  let warned = false; //track if warn was called
  const origWarn = console.warn; //preserve original warn
  console.warn = () => { warned = true; }; //override to detect call
  try {
    await qerrors(null, 'ctx');
    assert.equal(warned, true);
  } finally {
    console.warn = origWarn; //restore console.warn after test
    restoreLogger(); //restore logger.error after test
    restoreAnalyze(); //restore analyzeError after test
  }
});

