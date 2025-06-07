const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stubbing util

function withOpenAIToken(token) { //temporarily set token
  const orig = process.env.OPENAI_TOKEN; //save original token
  if (token === undefined) { delete process.env.OPENAI_TOKEN; } else { process.env.OPENAI_TOKEN = token; }
  return () => { if (orig === undefined) { delete process.env.OPENAI_TOKEN; } else { process.env.OPENAI_TOKEN = orig; } };
}

function reloadQerrors() { //reload module with env
  delete require.cache[require.resolve('../lib/qerrors')];
  return require('../lib/qerrors');
}

test('purgeExpiredAdvice removes entries after ttl', async () => {
  const restoreToken = withOpenAIToken('ttl-token'); //set token for caching
  const origLimit = process.env.QERRORS_CACHE_LIMIT; //save limit env
  const origTtl = process.env.QERRORS_CACHE_TTL; //save ttl env
  process.env.QERRORS_CACHE_LIMIT = '2'; //enable cache
  process.env.QERRORS_CACHE_TTL = '1'; //short ttl
  const qerrors = reloadQerrors(); //reload under new env
  const { analyzeError, axiosInstance, purgeExpiredAdvice } = qerrors; //extract functions
  const restoreAxios1 = qtests.stubMethod(axiosInstance, 'post', async () => ({ data: { choices: [{ message: { content: { info: 'one' } } }] } }));
  const err = new Error('boom'); //sample error
  err.stack = 'stack'; //fake stack trace
  err.uniqueErrorName = 'TTL'; //set unique name
  await analyzeError(err, 'ctx'); //populate cache
  restoreAxios1(); //cleanup first stub
  let called = false; //track second call
  const restoreAxios2 = qtests.stubMethod(axiosInstance, 'post', async () => { called = true; return { data: { choices: [{ message: { content: { info: 'two' } } }] } }; });
  await new Promise(r => setTimeout(r, 1100)); //wait past ttl
  purgeExpiredAdvice(); //trigger purge
  await analyzeError(err, 'ctx'); //should hit axios again
  restoreAxios2(); //restore stub
  if (origLimit === undefined) { delete process.env.QERRORS_CACHE_LIMIT; } else { process.env.QERRORS_CACHE_LIMIT = origLimit; }
  if (origTtl === undefined) { delete process.env.QERRORS_CACHE_TTL; } else { process.env.QERRORS_CACHE_TTL = origTtl; }
  restoreToken(); //restore token
  reloadQerrors(); //reset module
  assert.equal(called, true); //verify second axios call
});
