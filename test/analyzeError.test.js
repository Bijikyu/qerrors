
const test = require('node:test'); //node builtin test runner
const assert = require('node:assert/strict'); //strict assertions for reliability
const qtests = require('qtests'); //qtests stubbing utilities
const crypto = require('crypto'); //node crypto for hashing count

const qerrorsModule = require('../lib/qerrors'); //import module under test
const { analyzeError } = qerrorsModule; //extract analyzeError for direct calls
const { axiosInstance } = qerrorsModule; //instance used inside analyzeError


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
    assert.equal(capture.url, 'https://api.openai.com/v1/chat/completions'); //(assert api endpoint used)
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
  const restoreAxios = stubAxiosPost('{"info":"first"}', capture); //(stub axios)
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
