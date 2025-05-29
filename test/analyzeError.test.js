const test = require('node:test');
const assert = require('node:assert/strict');

const axios = require('axios');
const stubMethod = require('./utils/stubMethod'); //(import stubMethod for stubbing axios.post)
const qerrorsModule = require('../lib/qerrors');
const { analyzeError } = qerrorsModule;


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

test('analyzeError handles AxiosError gracefully', async () => {
  const err = new Error('axios fail');
  err.name = 'AxiosError';
  err.uniqueErrorName = 'AXERR';
  const result = await analyzeError(err, 'ctx');
  assert.equal(result, undefined);
});

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

test('analyzeError returns advice from api', async () => {
  const restoreToken = withOpenAIToken('t'); //(set OPENAI_TOKEN)
  const restorePost = stubMethod(axios, 'post', async () => ({ data: { choices: [{ message: { content: { data: 'adv' } } }] } })); //(stub axios.post)
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

test('analyzeError handles non-object advice as null', async () => {
  const restoreToken = withOpenAIToken('t'); //(set OPENAI_TOKEN)
  const restorePost = stubMethod(axios, 'post', async () => ({ data: { choices: [{ message: { content: 'adv' } }] } })); //(stub axios.post)
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

