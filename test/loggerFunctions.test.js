const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stubbing util

const loggerPromise = require('../lib/logger');
const { logStart, logReturn } = require('../lib/logger');

// Scenario: logStart logs start message

test('logStart logs function start', async () => {
  const log = await loggerPromise;
  let msg;
  const restore = qtests.stubMethod(log, 'info', m => { msg = m; });
  try {
    await logStart('fn', { a: 1 });
  } finally { restore(); }
  assert.equal(msg, 'fn start {"a":1}'); //info logged at start
});

// Scenario: logReturn logs return message

test('logReturn logs function return', async () => {
  const log = await loggerPromise;
  let msg;
  const restore = qtests.stubMethod(log, 'info', m => { msg = m; });
  try {
    await logReturn('fn', { b: 2 });
  } finally { restore(); }
  assert.equal(msg, 'fn return {"b":2}'); //info logged with return value
});
