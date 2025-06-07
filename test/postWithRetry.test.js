const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stub utility

const qerrorsModule = require('../lib/qerrors'); //module under test
const { postWithRetry, axiosInstance } = qerrorsModule; //target helper and axios

function withRetryEnv(retry, base, max) { //temporarily set retry env vars
  const origRetry = process.env.QERRORS_RETRY_ATTEMPTS; //save attempts
  const origBase = process.env.QERRORS_RETRY_BASE_MS; //save base delay
  const origMax = process.env.QERRORS_RETRY_MAX_MS; //save cap delay
  if (retry === undefined) { delete process.env.QERRORS_RETRY_ATTEMPTS; } else { process.env.QERRORS_RETRY_ATTEMPTS = String(retry); }
  if (base === undefined) { delete process.env.QERRORS_RETRY_BASE_MS; } else { process.env.QERRORS_RETRY_BASE_MS = String(base); }
  if (max === undefined) { delete process.env.QERRORS_RETRY_MAX_MS; } else { process.env.QERRORS_RETRY_MAX_MS = String(max); }
  return () => { //restore env vars
    if (origRetry === undefined) { delete process.env.QERRORS_RETRY_ATTEMPTS; } else { process.env.QERRORS_RETRY_ATTEMPTS = origRetry; }
    if (origBase === undefined) { delete process.env.QERRORS_RETRY_BASE_MS; } else { process.env.QERRORS_RETRY_BASE_MS = origBase; }
    if (origMax === undefined) { delete process.env.QERRORS_RETRY_MAX_MS; } else { process.env.QERRORS_RETRY_MAX_MS = origMax; }
  };
}

test('postWithRetry adds jitter to wait time', async () => {
  const restoreEnv = withRetryEnv(1, 100); //set small base for test
  let callCount = 0; //track axios.post calls
  const restoreAxios = qtests.stubMethod(axiosInstance, 'post', async () => { //stub axios
    callCount++; //increment on each call
    if (callCount === 1) { throw new Error('fail'); } //fail first
    return { ok: true }; //succeed second
  });
  let waited; //capture wait duration
  const restoreTimeout = qtests.stubMethod(global, 'setTimeout', (fn, ms) => { waited = ms; fn(); }); //capture delay and run immediately
  const origRandom = Math.random; //keep original random
  Math.random = () => 0.5; //predictable jitter
  try {
    const res = await postWithRetry('url', {}); //call helper
    assert.equal(res.ok, true); //success after retry
    assert.equal(callCount, 2); //called twice
    assert.ok(waited >= 100 && waited < 200); //jitter range check
  } finally {
    Math.random = origRandom; //restore Math.random
    restoreTimeout(); //restore timeout
    restoreAxios(); //restore axios
    restoreEnv(); //restore env
  }
});

test('postWithRetry uses defaults with invalid env', async () => { //invalid values fallback to defaults
  const restoreEnv = withRetryEnv('abc', 'abc'); //set invalid strings
  let callCount = 0; //track axios calls
  const restoreAxios = qtests.stubMethod(axiosInstance, 'post', async () => { //stub post
    callCount++; //increment each time
    if (callCount === 1) { throw new Error('fail'); } //first call fails
    return { ok: true }; //success second
  });
  let waited; //capture delay used
  const restoreTimeout = qtests.stubMethod(global, 'setTimeout', (fn, ms) => { waited = ms; fn(); }); //intercept timeout
  const origRandom = Math.random; //save random
  Math.random = () => 0.5; //predictable jitter
  try {
    const res = await postWithRetry('url', {}); //invoke helper
    assert.equal(res.ok, true); //successful result
    assert.equal(callCount, 2); //one retry
    assert.ok(waited >= 100 && waited < 200); //default base of 100 used
  } finally {
    Math.random = origRandom; //restore random
    restoreTimeout(); //restore timeout
    restoreAxios(); //restore axios
    restoreEnv(); //restore env vars
  }
});

test('postWithRetry enforces backoff cap', async () => { //cap ensures wait time not excessive
  const restoreEnv = withRetryEnv(1, 300, 400); //set base and cap
  let callCount = 0; //track axios calls
  const restoreAxios = qtests.stubMethod(axiosInstance, 'post', async () => { //stub post
    callCount++; //increment each time
    if (callCount === 1) { throw new Error('fail'); } //fail first
    return { ok: true }; //succeed second
  });
  let waited; //capture capped wait
  const restoreTimeout = qtests.stubMethod(global, 'setTimeout', (fn, ms) => { waited = ms; fn(); }); //capture delay
  const origRandom = Math.random; //save random
  Math.random = () => 0.5; //predictable jitter
  try {
    const res = await postWithRetry('url', {}); //invoke helper
    assert.equal(res.ok, true); //successful result
    assert.equal(waited, 400); //delay capped at 400
  } finally {
    Math.random = origRandom; //restore random
    restoreTimeout(); //restore timeout
    restoreAxios(); //restore axios
    restoreEnv(); //restore env
  }
});
