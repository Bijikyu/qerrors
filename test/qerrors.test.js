const test = require('node:test');
const assert = require('node:assert/strict');

const qerrors = require('../lib/qerrors');
const logger = require('../lib/logger');

function stubLogger(mock) { //helper to stub logger.error and return restore function
  const orig = logger.error; //store original method for later restore
  logger.error = mock; //replace logger.error with provided mock
  return () => { logger.error = orig; }; //return restore function
}

function stubAnalyzeError(mock) { //helper to stub analyzeError and return restore
  const orig = qerrors.analyzeError; //store original function
  qerrors.analyzeError = mock; //replace analyzeError with mock
  return () => { qerrors.analyzeError = orig; }; //return restore function
}

function createRes() {
  return {
    headersSent: false,
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; },
    send(html) { this.payload = html; return this; }
  };
}

test('qerrors logs and responds with json then calls next', async () => {
  let logged;
  const restoreLogger = stubLogger((err) => { logged = err; }); //stub logger.error for test
  const restoreAnalyze = stubAnalyzeError(async () => 'adv'); //stub analyzeError for test
  const res = createRes();
  const req = { headers: {} };
  const err = new Error('boom');
  let nextArg;
  const next = (e) => { nextArg = e; };
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

test('qerrors sends html when accept header requests it', async () => {
  const restoreLogger = stubLogger(() => {}); //stub logger.error for test
  const restoreAnalyze = stubAnalyzeError(async () => {}); //stub analyzeError for test
  const res = createRes();
  const req = { headers: { accept: 'text/html' } };
  const err = new Error('boom');
  try {
    await qerrors(err, 'ctx', req, res);
  } finally {
    restoreLogger(); //restore logger.error after test
    restoreAnalyze(); //restore analyzeError after test
  }
  assert.equal(res.statusCode, 500);
  assert.ok(typeof res.payload === 'string');
});

test('qerrors does nothing when headers already sent', async () => {
  const restoreLogger = stubLogger(() => {}); //stub logger.error for test
  const restoreAnalyze = stubAnalyzeError(async () => {}); //stub analyzeError for test
  const res = createRes();
  res.headersSent = true;
  const err = new Error('boom');
  let nextCalled = false;
  try {
    await qerrors(err, 'ctx', {}, res, () => { nextCalled = true; });
  } finally {
    restoreLogger(); //restore logger.error after test
    restoreAnalyze(); //restore analyzeError after test
  }
  assert.equal(res.statusCode, null);
  assert.equal(nextCalled, false);
});

test('qerrors handles absence of req res and next', async () => {
  let logged;
  const restoreLogger = stubLogger((err) => { logged = err; }); //stub logger.error for test
  const restoreAnalyze = stubAnalyzeError(async () => {}); //stub analyzeError for test
  const err = new Error('boom');
  try {
    await qerrors(err);
  } finally {
    restoreLogger(); //restore logger.error after test
    restoreAnalyze(); //restore analyzeError after test
  }
  assert.ok(err.uniqueErrorName);
  assert.equal(logged.context, 'unknown context');
});

test('qerrors calls next without res', async () => {
  const restoreLogger = stubLogger(() => {}); //stub logger.error for test
  const restoreAnalyze = stubAnalyzeError(async () => {}); //stub analyzeError for test
  const err = new Error('boom');
  let nextArg;
  try {
    await qerrors(err, 'ctx', undefined, undefined, (e) => { nextArg = e; });
  } finally {
    restoreLogger(); //restore logger.error after test
    restoreAnalyze(); //restore analyzeError after test
  }
  assert.equal(nextArg, err);
});

test('qerrors exits if no error provided', async () => {
  const restoreLogger = stubLogger(() => {}); //stub logger.error for test
  const restoreAnalyze = stubAnalyzeError(async () => {}); //stub analyzeError for test
  let warned = false;
  const origWarn = console.warn;
  console.warn = () => { warned = true; };
  try {
    await qerrors(null, 'ctx');
    assert.equal(warned, true);
  } finally {
    console.warn = origWarn; //restore console.warn after test
    restoreLogger(); //restore logger.error after test
    restoreAnalyze(); //restore analyzeError after test
  }
});

