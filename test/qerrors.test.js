const test = require('node:test');
const assert = require('node:assert/strict');

const qerrors = require('../lib/qerrors');
const logger = require('../lib/logger');

const origLoggerError = logger.error;

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
  logger.error = (err) => { logged = err; };
  qerrors.analyzeError = async () => 'adv';
  const res = createRes();
  const req = { headers: {} };
  const err = new Error('boom');
  let nextArg;
  const next = (e) => { nextArg = e; };
  await qerrors(err, 'ctx', req, res, next);
  assert.ok(err.uniqueErrorName);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.payload.error.uniqueErrorName, err.uniqueErrorName);
  assert.deepEqual(logged.uniqueErrorName, err.uniqueErrorName);
  assert.equal(nextArg, err);
});

test('qerrors sends html when accept header requests it', async () => {
  logger.error = () => {};
  qerrors.analyzeError = async () => {};
  const res = createRes();
  const req = { headers: { accept: 'text/html' } };
  const err = new Error('boom');
  await qerrors(err, 'ctx', req, res);
  assert.equal(res.statusCode, 500);
  assert.ok(typeof res.payload === 'string');
});

test('qerrors does nothing when headers already sent', async () => {
  logger.error = () => {};
  qerrors.analyzeError = async () => {};
  const res = createRes();
  res.headersSent = true;
  const err = new Error('boom');
  let nextCalled = false;
  await qerrors(err, 'ctx', {}, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, null);
  assert.equal(nextCalled, false);
});

test('qerrors handles absence of req res and next', async () => {
  let logged;
  logger.error = (err) => { logged = err; };
  qerrors.analyzeError = async () => {};
  const err = new Error('boom');
  await qerrors(err);
  assert.ok(err.uniqueErrorName);
  assert.equal(logged.context, 'unknown context');
});

test('qerrors calls next without res', async () => {
  logger.error = () => {};
  qerrors.analyzeError = async () => {};
  const err = new Error('boom');
  let nextArg;
  await qerrors(err, 'ctx', undefined, undefined, (e) => { nextArg = e; });
  assert.equal(nextArg, err);
});

test('qerrors exits if no error provided', async () => {
  let warned = false;
  const origWarn = console.warn;
  console.warn = () => { warned = true; };
  await qerrors(null, 'ctx');
  assert.equal(warned, true);
  console.warn = origWarn;
});

test.after(() => {
  logger.error = origLoggerError;
});
