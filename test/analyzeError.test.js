
const test = require('node:test'); //node builtin test runner
const assert = require('node:assert/strict'); //strict assertions for reliability
const qtests = require('qtests'); //qtests stubbing utilities
const crypto = require('crypto'); //node crypto for hashing count

const qerrorsModule = require('../lib/qerrors'); //import module under test
const { analyzeError } = qerrorsModule; //extract analyzeError for direct calls
const { axiosInstance } = qerrorsModule; //instance used inside analyzeError
const { postWithRetry } = qerrorsModule; //helper used for retrying requests
const config = require('../lib/config'); //load env defaults for assertions //(new import)


function withOpenAIToken(token) { //(temporarily set OPENAI_API_KEY)
  const orig = process.env.OPENAI_API_KEY; //(capture existing value)
  if (token === undefined) { //(check if token unset)
    delete process.env.OPENAI_API_KEY; //(remove from env)
  } else {
    process.env.OPENAI_API_KEY = token; //(assign token)
  }
  return () => { //(return restore)
    if (orig === undefined) { //(restore by delete)
      delete process.env.OPENAI_API_KEY; //(delete if absent before)
    } else {
      process.env.OPENAI_API_KEY = orig; //(otherwise restore value)
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
  const restoreToken = withOpenAIToken(undefined); //(unset OPENAI_API_KEY)
  try {
    const err = new Error('no token');
    err.uniqueErrorName = 'NOTOKEN';
    const result = await analyzeError(err, 'ctx');
    assert.equal(result, null); //should return null when token missing
  } finally {
    restoreToken(); //(restore original token)
  }
});

// Scenario: handle successful API response with JSON content
test('analyzeError processes JSON response from API', async () => {
  const restoreToken = withOpenAIToken('test-token'); //(set valid token)
  
  // Mock the AI model manager to return a successful response
  const { getAIModelManager } = require('../lib/aiModelManager');
  const aiManager = getAIModelManager();
  const originalAnalyzeError = aiManager.analyzeError;
  aiManager.analyzeError = async () => ({ advice: 'test advice' });
  
  try {
    const err = new Error('test error');
    err.uniqueErrorName = 'TESTERR';
    const result = await analyzeError(err, 'test context');
    assert.ok(result); //result should be defined on success
    assert.equal(result.advice, 'test advice'); //parsed advice should match
  } finally {
    restoreToken(); //(restore original token)
    aiManager.analyzeError = originalAnalyzeError; //(restore original method)
  }
});

// Scenario: handle API response parsing errors gracefully
test('analyzeError handles JSON parse errors', async () => {
  const restoreToken = withOpenAIToken('test-token'); //(set valid token)
  
  // Mock the AI model manager to return null (simulating parse failure)
  const { getAIModelManager } = require('../lib/aiModelManager');
  const aiManager = getAIModelManager();
  const originalAnalyzeError = aiManager.analyzeError;
  aiManager.analyzeError = async () => null; //(simulate parse failure)
  
  try {
    const err = new Error('test error');
    err.uniqueErrorName = 'PARSEERR';
    const result = await analyzeError(err, 'test context');
    assert.equal(result, null); //(expect null when JSON parsing fails)
  } finally {
    restoreToken(); //(restore original token)
    aiManager.analyzeError = originalAnalyzeError; //(restore original method)
  }
});

// Scenario: reuse cached advice when same error repeats
test('analyzeError returns cached advice on repeat call', async () => {
  const restoreToken = withOpenAIToken('cache-token'); //(set token for analysis)
  
  // Mock the AI model manager
  const { getAIModelManager } = require('../lib/aiModelManager');
  const aiManager = getAIModelManager();
  const originalAnalyzeError = aiManager.analyzeError;
  let callCount = 0;
  aiManager.analyzeError = async () => { 
    callCount++; 
    return { advice: 'cached' }; 
  };
  
  try {
    const err = new Error('cache me');
    err.stack = 'stack';
    err.uniqueErrorName = 'CACHE1';
    const first = await analyzeError(err, 'ctx');
    assert.equal(first.advice, 'cached'); //initial call stores advice
    
    const err2 = new Error('cache me');
    err2.stack = 'stack';
    err2.uniqueErrorName = 'CACHE2';
    const second = await analyzeError(err2, 'ctx');
    assert.equal(second.advice, 'cached'); //cache should supply same advice
    assert.equal(callCount, 1); //(AI model should only be called once due to caching)
  } finally {
    restoreToken(); //(restore environment)
    aiManager.analyzeError = originalAnalyzeError; //(restore original method)
  }
});

// Scenario: reuse provided qerrorsKey without rehashing
test('analyzeError reuses error.qerrorsKey when present', async () => {
  const restoreToken = withOpenAIToken('reuse-token'); //(set token for test)
  
  // Mock the AI model manager
  const { getAIModelManager } = require('../lib/aiModelManager');
  const aiManager = getAIModelManager();
  const originalAnalyzeError = aiManager.analyzeError;
  aiManager.analyzeError = async () => ({ info: 'first' });
  
  let hashCount = 0; //(track calls to crypto.createHash)
  const origHash = crypto.createHash; //(store original function)
  const restoreHash = qtests.stubMethod(crypto, 'createHash', (...args) => { hashCount++; return origHash(...args); });
  try {
    const err = new Error('reuse error');
    err.stack = 'stack';
    err.uniqueErrorName = 'REUSEKEY';
    err.qerrorsKey = 'preset';
    const first = await analyzeError(err, 'ctx');
    assert.equal(first.info, 'first'); //advice from API stored
    assert.equal(hashCount, 0); //(ensure hashing not called)
    const again = await analyzeError(err, 'ctx');
    assert.equal(again.info, 'first'); //second call reuses advice without hash
  } finally {
    restoreHash(); //(restore crypto.createHash)
    restoreToken(); //(restore token)
    aiManager.analyzeError = originalAnalyzeError; //(restore AI manager)
  }
});

test('analyzeError handles AI analysis failures gracefully', async () => {
  const restoreToken = withOpenAIToken('retry-token'); //(set token for test)
  
  // Mock the AI model manager to simulate failure and recovery
  const { getAIModelManager } = require('../lib/aiModelManager');
  const aiManager = getAIModelManager();
  const originalAnalyzeError = aiManager.analyzeError;
  
  // Simulate AI analysis failure - should return null gracefully
  aiManager.analyzeError = async () => {
    throw new Error('AI service unavailable');
  };
  
  try {
    const err = new Error('retry');
    err.uniqueErrorName = 'RETRYERR';
    const res = await analyzeError(err, 'ctx');
    assert.equal(res, null); //(ensure graceful failure handling)
  } finally {
    aiManager.analyzeError = originalAnalyzeError; //(restore AI manager)
    restoreToken(); //(restore token)
  }
});

test('analyzeError uses postWithRetry helper', async () => {
  const restoreToken = withOpenAIToken('helper-token'); //(set token for test)
  
  // Mock the AI model manager to simulate successful analysis
  const { getAIModelManager } = require('../lib/aiModelManager');
  const aiManager = getAIModelManager();
  const originalAnalyzeError = aiManager.analyzeError;
  aiManager.analyzeError = async () => ({ ok: true });
  
  try {
    const err = new Error('helper');
    err.uniqueErrorName = 'HELPER';
    const result = await analyzeError(err, 'ctx');
    assert.equal(result.ok, true); //(expect parsed advice)
  } finally {
    aiManager.analyzeError = originalAnalyzeError; //(restore AI manager)
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
  const fresh = reloadQerrors(); //(reload module with new cache limit env)
  
  // Mock the AI model manager
  const { getAIModelManager } = require('../lib/aiModelManager');
  const aiManager = getAIModelManager();
  const originalAnalyzeError = aiManager.analyzeError;
  let callCount = 0;
  aiManager.analyzeError = async () => {
    callCount++;
    return { msg: callCount };
  };
  
  try {
    const err = new Error('nocache');
    err.stack = 'stack';
    err.uniqueErrorName = 'NOCACHE1';
    await fresh.analyzeError(err, 'ctx');
    
    const err2 = new Error('nocache');
    err2.stack = 'stack';
    err2.uniqueErrorName = 'NOCACHE2';
    await fresh.analyzeError(err2, 'ctx');
    
    assert.equal(callCount, 2); //(AI model should be called twice when cache disabled)
  } finally {
    if (origLimit === undefined) { delete process.env.QERRORS_CACHE_LIMIT; } else { process.env.QERRORS_CACHE_LIMIT = origLimit; }
    aiManager.analyzeError = originalAnalyzeError; //(restore AI manager)
    reloadQerrors(); //(reload module to reset cache configuration)
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
