
const test = require('node:test'); //node builtin test runner
const assert = require('node:assert/strict'); //strict assertions for reliability
const qtests = require('qtests'); //qtests stubbing utilities

const axios = require('axios'); //axios module for stubbing
const qerrorsModule = require('../lib/qerrors'); //import module under test
const { analyzeError } = qerrorsModule; //extract analyzeError for direct calls


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

function stubAxiosPost(content) { //(stub axios.post for consistent responses)
  return qtests.stub(axios, 'post', async () => ({ data: { choices: [{ message: { content } }] } })); //use qtests stub
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
  const restoreAxios = stubAxiosPost('{"advice": "test advice"}'); //(stub axios with JSON response)
  try {
    const err = new Error('test error');
    err.uniqueErrorName = 'TESTERR';
    const result = await analyzeError(err, 'test context');
    assert.ok(result);
    assert.equal(result.advice, 'test advice');
  } finally {
    restoreToken(); //(restore original token)
    restoreAxios(); //(restore axios)
  }
});

// Scenario: handle API response parsing errors gracefully
test('analyzeError handles JSON parse errors', async () => {
  const restoreToken = withOpenAIToken('test-token'); //(set valid token)
  const restoreAxios = stubAxiosPost('invalid json'); //(stub axios with invalid JSON)
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
