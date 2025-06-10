
const test = require('node:test'); //node builtin test runner
const assert = require('node:assert/strict'); //strict assertions for reliability
const qtests = require('qtests'); //qtests stubbing utilities
const crypto = require('crypto'); //node crypto for hashing count

const qerrorsModule = require('../lib/qerrors'); //import module under test
const { analyzeError } = qerrorsModule; //extract analyzeError for direct calls
const { axiosInstance } = qerrorsModule; //instance used inside analyzeError
const { postWithRetry } = qerrorsModule; //helper used for retrying requests
const config = require('../lib/config'); //load env defaults for assertions //(new import)


function withOpenAIToken(token) { //(temporarily set OPENAI_TOKEN)
  const orig = process.env.OPENAI_TOKEN; //(capture existing value)
  if (token === undefined) { //(check if token unset)
    delete process.env.OPENAI_TOKEN; //(remove from env)
  } else {
    process.env.OPENAI_TOKEN = token; //(assign token)
  }
  return () => { //(return restore)
    if (orig === undefined) { //(restore by delete)
      delete process.env.OPENAI_TOKEN; //(delete if absent before)
    } else {
      process.env.OPENAI_TOKEN = orig; //(otherwise restore value)
    }
  };
}

function withRetryEnv(retry, base, max) { //(temporarily set retry env vars)
  const origRetry = process.env.QERRORS_RETRY_ATTEMPTS; //(store original attempts)
  const origBase = process.env.QERRORS_RETRY_BASE_MS; //(store original delay)
  const origMax = process.env.QERRORS_RETRY_MAX_MS; //(store original cap)
  if (retry === undefined) { delete process.env.QERRORS_RETRY_ATTEMPTS; } else { process.env.QERRORS_RETRY_ATTEMPTS = String(retry); } //(apply retry)
  if (base === undefined) { delete process.env.QERRORS_RETRY_BASE_MS; } else { process.env.QERRORS_RETRY_BASE_MS = String(base); } //(apply delay)
  if (max === undefined) { delete process.env.QERRORS_RETRY_MAX_MS; } else { process.env.QERRORS_RETRY_MAX_MS = String(max); } //(apply cap)
  return () => { //(restore both variables)
    if (origRetry === undefined) { delete process.env.QERRORS_RETRY_ATTEMPTS; } else { process.env.QERRORS_RETRY_ATTEMPTS = origRetry; }
    if (origBase === undefined) { delete process.env.QERRORS_RETRY_BASE_MS; } else { process.env.QERRORS_RETRY_BASE_MS = origBase; }
    if (origMax === undefined) { delete process.env.QERRORS_RETRY_MAX_MS; } else { process.env.QERRORS_RETRY_MAX_MS = origMax; }
  };
}

function stubAxiosPost(content, capture) { //(capture axiosInstance.post args and stub response)
  return qtests.stubMethod(axiosInstance, 'post', async (url, body) => { //(store url and body for assertions)
    capture.url = url; //(save called url)
    capture.body = body; //(save called body)
    return { data: { choices: [{ message: { content } }] } }; //(return predictable api response as object)
  });
}

// Scenario: skip analyzing Axios errors to prevent infinite loops
test('analyzeError handles AxiosError gracefully', async () => {
  const err = new Error('axios fail');
  err.name = 'AxiosError';
  err.uniqueErrorName = 'AXERR';
  const result = await analyzeError(err, 'ctx');
  assert.equal(result, null); //(expect null when axios error is skipped)
});

// Scenario: return null when API token is missing
test('analyzeError returns null without token', async () => {
  const restoreToken = withOpenAIToken(undefined); //(unset OPENAI_TOKEN)
  try {
    const err = new Error('no token');
    err.uniqueErrorName = 'NOTOKEN';
    const result = await analyzeError(err, 'ctx');
    assert.equal(result, null);
  } finally {
    restoreToken(); //(restore original token)
  }
});

// Scenario: handle successful API response with JSON content
test('analyzeError processes JSON response from API', async () => {
  const restoreToken = withOpenAIToken('test-token'); //(set valid token)
  const capture = {}; //(object to collect axios call args)
  const restoreAxios = stubAxiosPost({ advice: 'test advice' }, capture); //(stub axios and capture arguments with object)
  try {
    const err = new Error('test error');
    err.uniqueErrorName = 'TESTERR';
    const result = await analyzeError(err, 'test context');
    assert.ok(result);
    assert.equal(result.advice, 'test advice');
    assert.equal(capture.url, config.getEnv('QERRORS_OPENAI_URL')); //(assert api endpoint used)
    assert.equal(capture.body.model, 'gpt-4.1'); //(validate model in request body)
    assert.ok(Array.isArray(capture.body.messages)); //(ensure messages array sent)
    assert.equal(capture.body.messages[0].role, 'user'); //(first message role should be user)
    assert.deepEqual(capture.body.response_format, { type: 'json_object' }); //(verify response_format object)
  } finally {
    restoreToken(); //(restore original token)
    restoreAxios(); //(restore axios)
  }
});

// Scenario: handle API response parsing errors gracefully
test('analyzeError handles JSON parse errors', async () => {
  const restoreToken = withOpenAIToken('test-token'); //(set valid token)
  const cap = {}; //(obj to capture axios args if needed)
  const restoreAxios = stubAxiosPost('invalid json', cap); //(stub axios with invalid JSON)
  try {
    const err = new Error('test error');
    err.uniqueErrorName = 'PARSEERR';
    const result = await analyzeError(err, 'test context');
    assert.equal(result, null); //(expect null when JSON parsing fails)
  } finally {
    restoreToken(); //(restore original token)
    restoreAxios(); //(restore axios)
  }
});

// Scenario: reuse cached advice when same error repeats
test('analyzeError returns cached advice on repeat call', async () => {
  const restoreToken = withOpenAIToken('cache-token'); //(set token for analysis)
  const capture = {}; //(capture axios parameters)
  const restoreAxios = stubAxiosPost({ advice: 'cached' }, capture); //(first api response as object)
  try {
    const err = new Error('cache me');
    err.stack = 'stack';
    err.uniqueErrorName = 'CACHE1';
    const first = await analyzeError(err, 'ctx');
    assert.equal(first.advice, 'cached');
    restoreAxios(); //(remove first stub)
    let secondCalled = false; //(track second axios call)
    const restoreAxios2 = qtests.stubMethod(axiosInstance, 'post', async () => { secondCalled = true; return {}; });
    const err2 = new Error('cache me');
    err2.stack = 'stack';
    err2.uniqueErrorName = 'CACHE2';
    const second = await analyzeError(err2, 'ctx');
    restoreAxios2(); //(restore second stub)
    assert.equal(second.advice, 'cached');
    assert.equal(secondCalled, false); //(axios should not run second time)
  } finally {
    restoreToken(); //(restore environment)
  }
});

// Scenario: reuse provided qerrorsKey without rehashing
test('analyzeError reuses error.qerrorsKey when present', async () => {
  const restoreToken = withOpenAIToken('reuse-token'); //(set token for test)
  const capture = {}; //(capture axios parameters)
  const restoreAxios = stubAxiosPost({ info: 'first' }, capture); //(stub axios with object)
  let hashCount = 0; //(track calls to crypto.createHash)
  const origHash = crypto.createHash; //(store original function)
  const restoreHash = qtests.stubMethod(crypto, 'createHash', (...args) => { hashCount++; return origHash(...args); });
  try {
    const err = new Error('reuse error');
    err.stack = 'stack';
    err.uniqueErrorName = 'REUSEKEY';
    err.qerrorsKey = 'preset';
    const first = await analyzeError(err, 'ctx');
    assert.equal(first.info, 'first');
    assert.equal(hashCount, 0); //(ensure hashing not called)
    const again = await analyzeError(err, 'ctx');
    assert.equal(again.info, 'first');
  } finally {
    restoreHash(); //(restore crypto.createHash)
    restoreToken(); //(restore token)
    restoreAxios(); //(restore axios)
  }
});

test('analyzeError retries failed axios calls', async () => {
  const restoreToken = withOpenAIToken('retry-token'); //(set token for test)
  const restoreEnv = withRetryEnv(2, 1); //(set small retry delay for speed)
  let callCount = 0; //(track number of axios posts)
  const restoreAxios = qtests.stubMethod(axiosInstance, 'post', async () => { //(stub post to fail then succeed)
    callCount++; //(increment counter)
    if (callCount < 3) { throw new Error('fail'); } //(fail first two)
    return { data: { choices: [{ message: { content: { ok: true } } }] } }; //(success after retries)
  });
  try {
    const err = new Error('retry');
    err.uniqueErrorName = 'RETRYERR';
    const res = await analyzeError(err, 'ctx');
    assert.equal(res.ok, true); //(ensure success after retry)
    assert.equal(callCount, 3); //(called initial + 2 retries)
  } finally {
    restoreAxios(); //(restore axios)
    restoreEnv(); //(restore env vars)
    restoreToken(); //(restore token)
  }
});

test('analyzeError uses postWithRetry helper', async () => {
  const restoreToken = withOpenAIToken('helper-token'); //(set token for test)
  let helperCalled = false; //(flag when helper invoked)
  const restoreHelper = qtests.stubMethod(qerrorsModule, 'postWithRetry', async () => { //(stub helper)
    helperCalled = true; //(mark invocation)
    return { data: { choices: [{ message: { content: { ok: true } } }] } }; //(fake success response)
  });
  try {
    const err = new Error('helper');
    err.uniqueErrorName = 'HELPER';
    const result = await analyzeError(err, 'ctx');
    assert.equal(result.ok, true); //(expect parsed advice)
    assert.equal(helperCalled, true); //(ensure helper ran)
  } finally {
    restoreHelper(); //(restore stub)
    restoreToken(); //(restore token)
  }
});

function reloadQerrors() { //helper to reload module with current env for cache tests
  delete require.cache[require.resolve('../lib/qerrors')]; //remove cached module so env changes apply
  return require('../lib/qerrors'); //load qerrors again with new env
}

// Scenario: disable caching when limit is zero
test('analyzeError bypasses cache when limit is zero', async () => {
  const restoreToken = withOpenAIToken('zero-token'); //(set token for api)
  const origLimit = process.env.QERRORS_CACHE_LIMIT; //(store existing cache limit)
  process.env.QERRORS_CACHE_LIMIT = '0'; //(env value to disable cache)
  const fresh = reloadQerrors(); //(reload module with zero cache limit)
  const restoreAxios1 = qtests.stubMethod(fresh.axiosInstance, 'post', async () => ({ data: { choices: [{ message: { content: { msg: 1 } } }] } })); //(stub for first analysis)
  try {
    const err = new Error('nocache');
    err.stack = 'stack';
    err.uniqueErrorName = 'NOCACHE1';
    await fresh.analyzeError(err, 'ctx');
    restoreAxios1(); //(remove first stub)
    let secondCalled = false; //(track second axios call when cache disabled)
    const restoreAxios2 = qtests.stubMethod(fresh.axiosInstance, 'post', async () => { secondCalled = true; return { data: { choices: [{ message: { content: { msg: 2 } } }] } }; });
    const err2 = new Error('nocache');
    err2.stack = 'stack';
    err2.uniqueErrorName = 'NOCACHE2';
    await fresh.analyzeError(err2, 'ctx');
    restoreAxios2(); //(restore second stub)
    assert.equal(secondCalled, true); //(axios should run again without caching)
  } finally {
    if (origLimit === undefined) { delete process.env.QERRORS_CACHE_LIMIT; } else { process.env.QERRORS_CACHE_LIMIT = origLimit; }
    reloadQerrors(); //(restore default module state)
    restoreToken(); //(restore token)
  }
});

// Scenario: ensure hashing skipped when cache disabled
test('analyzeError does not hash when cache limit is zero', async () => {
  const restoreToken = withOpenAIToken('nohash-token'); //(set token for api)
  const origLimit = process.env.QERRORS_CACHE_LIMIT; //(store current limit)
  process.env.QERRORS_CACHE_LIMIT = '0'; //(disable caching)
  const fresh = reloadQerrors(); //(reload module with new env)
  let hashCount = 0; //(track hashing)
  const origHash = crypto.createHash; //(reference original)
  const restoreHash = qtests.stubMethod(crypto, 'createHash', (...args) => { hashCount++; return origHash(...args); }); //(count calls)
  try {
    const err = new Error('nohash');
    err.stack = 'stack';
    err.uniqueErrorName = 'NOHASH';
    await fresh.analyzeError(err, 'ctx');
    assert.equal(hashCount, 0); //(expect hashing skipped)
    assert.equal(err.qerrorsKey, undefined); //(ensure key not set)
  } finally {
    restoreHash(); //(restore createHash)
    if (origLimit === undefined) { delete process.env.QERRORS_CACHE_LIMIT; } else { process.env.QERRORS_CACHE_LIMIT = origLimit; }
    reloadQerrors(); //(reset module)
    restoreToken(); //(restore token)
  }
});
