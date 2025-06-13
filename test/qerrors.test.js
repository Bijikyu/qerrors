
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

async function stubDeps(loggerFn, analyzeFn) { //create combined stub utility for tests
  const realLogger = await logger; //wait for logger instance
  const restoreLogger = qtests.stubMethod(realLogger, 'error', loggerFn); //stub logger.error with provided function
  const restoreAnalyze = qtests.stubMethod(qerrors, 'analyzeError', analyzeFn); //stub analyzeError with provided function
  return () => { //return unified restore
    restoreLogger(); //restore logger.error after each test
    restoreAnalyze(); //restore analyzeError after each test
  };
}

// Scenario: standard JSON error handling and next() invocation
test('qerrors logs and responds with json then calls next', async () => {
  let logged; //capture logger output for assertions
  const restore = await stubDeps((err) => { logged = err; }, async () => 'adv'); //stub logger and analyze with helper
  const res = createRes(); //mock response object
  const req = { headers: {} }; //minimal request object
  const err = new Error('boom'); //sample error to handle
  let nextArg; //store argument passed to next()
  const next = (e) => { nextArg = e; }; //spy for next()
  try {
    await qerrors(err, 'ctx', req, res, next);
    await new Promise(r => setTimeout(r, 0)); //wait for queued analysis completion
  } finally {
    restore(); //restore all stubs after test
  }
  assert.ok(err.uniqueErrorName); //id generated
  assert.equal(res.statusCode, 500); //response uses default status
  assert.deepEqual(res.payload.error.uniqueErrorName, err.uniqueErrorName); //json includes id
  assert.deepEqual(logged.uniqueErrorName, err.uniqueErrorName); //logged id matches
  assert.equal(nextArg, err); //next() called with error
});

// Scenario: send HTML when browser requests it
test('qerrors sends html when accept header requests it', async () => {
  const restore = await stubDeps(() => {}, async () => {}); //stub logger and analyze with helper
  const res = createRes(); //mock response object to capture html
  const req = { headers: { accept: 'text/html' } }; //request asking for html
  const err = new Error('boom'); //sample error to send
  try {
    await qerrors(err, 'ctx', req, res);
    await new Promise(r => setTimeout(r, 0)); //wait for queued analysis completion
  } finally {
    restore(); //restore all stubs after test
  }
  assert.equal(res.statusCode, 500); //html response code
  assert.ok(typeof res.payload === 'string'); //html returned
});

// Scenario: sanitize html output to avoid injection
test('qerrors escapes html content', async () => {
  const restore = await stubDeps(() => {}, async () => {}); //stub logger and analyze with helper
  const res = createRes(); //mock response object
  const req = { headers: { accept: 'text/html' } }; //requesting html
  const err = new Error('<script>boom</script>'); //error message containing html
  err.stack = '<script>stack</script>'; //custom stack with html
  try {
    await qerrors(err, 'ctx', req, res);
    await new Promise(r => setTimeout(r, 0)); //wait for queued analysis completion
  } finally {
    restore(); //restore stubs after test
  }
  assert.ok(!res.payload.includes('<script>')); //ensure raw tag removed
  assert.ok(res.payload.includes('&lt;script&gt;')); //escaped content present
});

// Scenario: use statusCode from error object in json response
test('qerrors honors error.statusCode in json', async () => {
  const restore = await stubDeps(() => {}, async () => {}); //stub logger and analyze with helper
  const res = createRes(); //mock response for json
  const req = { headers: {} }; //no html accept header
  const err = new Error('not found'); //error with custom status
  err.statusCode = 404; //status code to verify
  try {
    await qerrors(err, 'ctx', req, res); //invoke handler with status
    await new Promise(r => setTimeout(r, 0)); //wait for queued analysis completion
  } finally {
    restore(); //restore stubs after test
  }
  assert.equal(res.statusCode, 404); //expect custom code set in response
  assert.equal(res.payload.error.statusCode, 404); //json includes status code
});

// Scenario: use statusCode from error object in html response
test('qerrors honors error.statusCode in html', async () => {
  const restore = await stubDeps(() => {}, async () => {}); //stub logger and analyze with helper
  const res = createRes(); //mock response for html
  const req = { headers: { accept: 'text/html' } }; //html accept header
  const err = new Error('not found'); //error with custom status
  err.statusCode = 404; //status code to verify
  try {
    await qerrors(err, 'ctx', req, res); //invoke handler with status and html
    await new Promise(r => setTimeout(r, 0)); //wait for queued analysis completion
  } finally {
    restore(); //restore stubs after test
  }
  assert.equal(res.statusCode, 404); //expect custom code set in response
  assert.ok(res.payload.includes('Error: 404')); //html output reflects code
});

// Scenario: skip response when headers already sent
test('qerrors does nothing when headers already sent', async () => {
  const restore = await stubDeps(() => {}, async () => {}); //stub logger and analyze with helper
  const res = createRes(); //mock response object with headers already sent
  res.headersSent = true; //simulate Express sending headers prior
  const err = new Error('boom'); //error to pass into handler
  let nextCalled = false; //track if next() invoked
  try {
    await qerrors(err, 'ctx', {}, res, () => { nextCalled = true; });
    await new Promise(r => setTimeout(r, 0)); //wait for queued analysis completion
  } finally {
    restore(); //restore all stubs after test
  }
  assert.equal(res.statusCode, null); //no response after headers sent
  assert.equal(nextCalled, false); //next not invoked
});

// Scenario: operate without Express objects
test('qerrors handles absence of req res and next', async () => {
  let logged; //capture logger output
  const restore = await stubDeps((err) => { logged = err; }, async () => {}); //stub logger and analyze with helper
  const err = new Error('boom'); //error for generic usage
  try {
    await qerrors(err);
    await new Promise(r => setTimeout(r, 0)); //wait for queued analysis completion
  } finally {
    restore(); //restore all stubs after test
  }
  assert.ok(err.uniqueErrorName); //id generated without req/res
  assert.equal(logged.context, 'unknown context'); //default context value
});

// Scenario: still call next when res is undefined
test('qerrors calls next without res', async () => {
  const restore = await stubDeps(() => {}, async () => {}); //stub logger and analyze with helper
  const err = new Error('boom'); //error when res missing
  let nextArg; //captured arg for next()
  try {
    await qerrors(err, 'ctx', undefined, undefined, (e) => { nextArg = e; });
    await new Promise(r => setTimeout(r, 0)); //wait for queued analysis completion
  } finally {
    restore(); //restore all stubs after test
  }
  assert.equal(nextArg, err); //next receives error
});

// Scenario: warn and exit when called without an error
test('qerrors exits if no error provided', async () => {
  const restore = await stubDeps(() => {}, async () => {}); //stub logger and analyze with helper
  let warned = false; //track if warn was called
  const restoreWarn = qtests.stubMethod(console, 'warn', () => { warned = true; }); //use qtests to stub console.warn
  try {
    await qerrors(null, 'ctx');
    await new Promise(r => setTimeout(r, 0)); //wait for queued analysis completion
    assert.equal(warned, true); //warning emitted
  } finally {
    restoreWarn(); //restore console.warn after test
    restore(); //restore all stubs after test
  }
});
