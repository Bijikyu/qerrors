const test = require('node:test'); //node builtin test runner
const assert = require('node:assert/strict'); //strict assertions for reliability

const axios = require('axios'); //real axios replaced by stub during tests
const stubMethod = require('./utils/stubMethod'); //(use stubMethod to stub axios.post so tests run without network)
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

// Scenario: provide advice object when API call succeeds
test('analyzeError returns advice from api', async () => {
  const restoreToken = withOpenAIToken('t'); //(set OPENAI_TOKEN)
  const restorePost = stubMethod(axios, 'post', async () => ({ data: { choices: [{ message: { content: { data: 'adv' } } }] } })); //(stub axios.post to avoid real network)
  try {
    const err = new Error('test');
    err.uniqueErrorName = 'OK';
    const result = await analyzeError(err, 'ctx');
    assert.deepEqual(result, { data: 'adv' });
  } finally {
    restorePost(); //(restore axios.post)
    restoreToken(); //(restore token)
  }
});

// Scenario: treat string advice as invalid and return null
test('analyzeError handles non-object advice as null', async () => {
  const restoreToken = withOpenAIToken('t'); //(set OPENAI_TOKEN)
  const restorePost = stubMethod(axios, 'post', async () => ({ data: { choices: [{ message: { content: 'adv' } }] } })); //(stub axios.post to avoid real network)
  try {
    const err = new Error('test2');
    err.uniqueErrorName = 'NOOBJ';
    const result = await analyzeError(err, 'ctx');
    assert.equal(result, null);
  } finally {
    restorePost(); //(restore axios.post)
    restoreToken(); //(restore token)
  }
});

