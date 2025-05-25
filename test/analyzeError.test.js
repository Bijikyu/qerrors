const test = require('node:test');
const assert = require('node:assert/strict');

const axios = require('axios');
const qerrorsModule = require('../lib/qerrors');
const { analyzeError } = qerrorsModule;

const originalPost = axios.post;

test('analyzeError handles AxiosError gracefully', async () => {
  const err = new Error('axios fail');
  err.name = 'AxiosError';
  err.uniqueErrorName = 'AXERR';
  const result = await analyzeError(err, 'ctx');
  assert.equal(result, undefined);
});

test('analyzeError returns null without token', async () => {
  delete process.env.OPENAI_TOKEN;
  const err = new Error('no token');
  err.uniqueErrorName = 'NOTOKEN';
  const result = await analyzeError(err, 'ctx');
  assert.equal(result, null);
});

test('analyzeError returns advice from api', async () => {
  process.env.OPENAI_TOKEN = 't';
  axios.post = async () => ({ data: { choices: [{ message: { content: { data: 'adv' } } }] } });
  const err = new Error('test');
  err.uniqueErrorName = 'OK';
  const result = await analyzeError(err, 'ctx');
  assert.deepEqual(result, { data: 'adv' });
});

test.after(() => {
  axios.post = originalPost;
});
