const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stub utilities

function reloadQerrors() { //reload module to apply env vars
  delete require.cache[require.resolve('../lib/qerrors')];
  delete require.cache[require.resolve('../lib/config')];
  return require('../lib/qerrors');
}

function withToken(token) { //temporarily set OPENAI_TOKEN
  const orig = process.env.OPENAI_TOKEN; //save original
  if (token === undefined) { delete process.env.OPENAI_TOKEN; } else { process.env.OPENAI_TOKEN = token; }
  return () => { //restore previous value
    if (orig === undefined) { delete process.env.OPENAI_TOKEN; } else { process.env.OPENAI_TOKEN = orig; }
  };
}

test('analyzeError uses QERRORS_MAX_TOKENS', async () => {
  const restoreToken = withToken('tok'); //provide token for API
  const orig = process.env.QERRORS_MAX_TOKENS; //capture original value
  process.env.QERRORS_MAX_TOKENS = '4096'; //set custom env
  const fresh = reloadQerrors(); //reload with new env
  const capture = {}; //store axios call
  const restoreAxios = qtests.stubMethod(fresh.axiosInstance, 'post', async (u, b) => { capture.body = b; return { data: { choices: [{ message: { content: {} } }] } }; }); //stub post
  try {
    const err = new Error('tok');
    err.uniqueErrorName = 'TOK1';
    await fresh.analyzeError(err, 'ctx');
  } finally {
    restoreAxios();
    if (orig === undefined) { delete process.env.QERRORS_MAX_TOKENS; } else { process.env.QERRORS_MAX_TOKENS = orig; }
    reloadQerrors();
    restoreToken();
  }
  assert.equal(capture.body.max_tokens, 4096); //expect env value used
});

test('analyzeError defaults QERRORS_MAX_TOKENS when unset', async () => {
  const restoreToken = withToken('tok');
  const orig = process.env.QERRORS_MAX_TOKENS; //save env
  delete process.env.QERRORS_MAX_TOKENS; //unset variable
  const fresh = reloadQerrors(); //reload for defaults
  const capture = {}; //capture post body
  const restoreAxios = qtests.stubMethod(fresh.axiosInstance, 'post', async (u, b) => { capture.body = b; return { data: { choices: [{ message: { content: {} } }] } }; });
  try {
    const err = new Error('def');
    err.uniqueErrorName = 'TOKDEF';
    await fresh.analyzeError(err, 'ctx');
  } finally {
    restoreAxios();
    if (orig === undefined) { delete process.env.QERRORS_MAX_TOKENS; } else { process.env.QERRORS_MAX_TOKENS = orig; }
    reloadQerrors();
    restoreToken();
  }
  assert.equal(capture.body.max_tokens, 2048); //default should apply
});

test('analyzeError defaults QERRORS_MAX_TOKENS with invalid env', async () => {
  const restoreToken = withToken('tok');
  const orig = process.env.QERRORS_MAX_TOKENS; //store current
  process.env.QERRORS_MAX_TOKENS = 'abc'; //invalid value
  const fresh = reloadQerrors(); //reload module
  const capture = {}; //capture body
  const restoreAxios = qtests.stubMethod(fresh.axiosInstance, 'post', async (u, b) => { capture.body = b; return { data: { choices: [{ message: { content: {} } }] } }; });
  try {
    const err = new Error('bad');
    err.uniqueErrorName = 'TOKBAD';
    await fresh.analyzeError(err, 'ctx');
  } finally {
    restoreAxios();
    if (orig === undefined) { delete process.env.QERRORS_MAX_TOKENS; } else { process.env.QERRORS_MAX_TOKENS = orig; }
    reloadQerrors();
    restoreToken();
  }
  assert.equal(capture.body.max_tokens, 2048); //invalid falls back
});
