const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stubbing util

function reloadQerrors() { //reload qerrors module for env changes
  delete require.cache[require.resolve('../lib/qerrors')];
  return require('../lib/qerrors');
}

function withRedis(url) { //temporarily set redis url
  const orig = process.env.QERRORS_REDIS_URL;
  if (url === undefined) { delete process.env.QERRORS_REDIS_URL; } else { process.env.QERRORS_REDIS_URL = url; }
  return () => { if (orig === undefined) { delete process.env.QERRORS_REDIS_URL; } else { process.env.QERRORS_REDIS_URL = orig; } };
}

function withToken() { const orig = process.env.OPENAI_TOKEN; process.env.OPENAI_TOKEN = 'tkn'; return () => { if (orig === undefined) { delete process.env.OPENAI_TOKEN; } else { process.env.OPENAI_TOKEN = orig; } }; }

test('analyzeError uses redis cache when configured', async () => {
  const restoreToken = withToken();
  const restoreRedis = withRedis('redis://test');
  const qerrors = reloadQerrors();
  const { analyzeError, axiosInstance, clearAdviceCache } = qerrors;
  const redis = require('redis');
  const restoreAxios = qtests.stubMethod(axiosInstance, 'post', async () => ({ data: { choices: [{ message: { content: { msg: 'r' } } }] } }));
  try {
    const err = new Error('boom');
    err.stack = 'stack';
    err.uniqueErrorName = 'REDIS1';
    const first = await analyzeError(err, 'ctx');
    assert.equal(first.msg, 'r');
    clearAdviceCache();
    let called = false;
    const restoreAxios2 = qtests.stubMethod(axiosInstance, 'post', async () => { called = true; return {}; });
    const again = await analyzeError(err, 'ctx');
    restoreAxios2();
    assert.equal(called, false);
    assert.equal(again.msg, 'r');
    assert.equal(redis.lastClient.store.get(err.qerrorsKey) !== undefined, true);
  } finally {
    restoreAxios();
    restoreRedis();
    restoreToken();
    reloadQerrors();
  }
});
