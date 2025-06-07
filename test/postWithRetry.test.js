const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stub utility

const qerrorsModule = require('../lib/qerrors'); //module under test
const { postWithRetry, axiosInstance } = qerrorsModule; //target helper and axios

function withRetryEnv(retry, base) { //temporarily set retry env vars
  const origRetry = process.env.QERRORS_RETRY_ATTEMPTS; //save attempts
  const origBase = process.env.QERRORS_RETRY_BASE_MS; //save base delay
  if (retry === undefined) { delete process.env.QERRORS_RETRY_ATTEMPTS; } else { process.env.QERRORS_RETRY_ATTEMPTS = String(retry); }
  if (base === undefined) { delete process.env.QERRORS_RETRY_BASE_MS; } else { process.env.QERRORS_RETRY_BASE_MS = String(base); }
  return () => { //restore env vars
    if (origRetry === undefined) { delete process.env.QERRORS_RETRY_ATTEMPTS; } else { process.env.QERRORS_RETRY_ATTEMPTS = origRetry; }
    if (origBase === undefined) { delete process.env.QERRORS_RETRY_BASE_MS; } else { process.env.QERRORS_RETRY_BASE_MS = origBase; }
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
