const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //strict assertions
const qtests = require('qtests'); //helper for stubbing

function withOpenAIToken(token) { //temporarily modify OPENAI_API_KEY
  const orig = process.env.OPENAI_API_KEY; //remember current token
  if (token === undefined) { delete process.env.OPENAI_API_KEY; } else { process.env.OPENAI_API_KEY = token; }
  return () => { if (orig === undefined) { delete process.env.OPENAI_API_KEY; } else { process.env.OPENAI_API_KEY = orig; } };
}

function reloadQerrors() { //load qerrors fresh with current env
  delete require.cache[require.resolve('../lib/qerrors')];
  return require('../lib/qerrors');
}

test('clearAdviceCache empties cache', async () => {
  const restoreToken = withOpenAIToken('cache-token'); //set token for analysis
  const origLimit = process.env.QERRORS_CACHE_LIMIT; //save env limit
  process.env.QERRORS_CACHE_LIMIT = '2'; //ensure caching enabled
  const qerrors = reloadQerrors(); //reload module
  const { analyzeError, axiosInstance } = qerrors; //extract functions
  const restoreAxios = qtests.stubMethod(axiosInstance, 'post', async () => ({ data: { choices: [{ message: { content: { info: 'one' } } }] } }));
  try {
    const err = new Error('boom');
    err.stack = 'stack';
    err.uniqueErrorName = 'CACHECLR';
    const first = await analyzeError(err, 'ctx');
    assert.equal(first.info, 'one'); //initial call fetches advice
    restoreAxios(); //restore first stub
    let calledAgain = false;
    const restoreAxios2 = qtests.stubMethod(axiosInstance, 'post', async () => { calledAgain = true; return { data: { choices: [{ message: { content: { info: 'two' } } }] } }; });
    await analyzeError(err, 'ctx');
    assert.equal(calledAgain, false); //should use cache
    qerrors.clearAdviceCache(); //reset cache
    const afterClear = await analyzeError(err, 'ctx');
    restoreAxios2();
    assert.equal(afterClear.info, 'two'); //axios called again
    assert.equal(calledAgain, true); //verify second stub ran
  } finally {
    if (origLimit === undefined) { delete process.env.QERRORS_CACHE_LIMIT; } else { process.env.QERRORS_CACHE_LIMIT = origLimit; }
    restoreToken();
    reloadQerrors();
  }
});

test('cache limit above threshold clamps and warns', async () => {
  const orig = process.env.QERRORS_CACHE_LIMIT; //backup current env
  process.env.QERRORS_CACHE_LIMIT = '5000'; //set exaggerated limit
  const loggerPromise = require('../lib/logger'); //logger promise for stub
  const log = await loggerPromise; //wait for logger instance
  let warned = false; //track call state
  const restoreWarn = qtests.stubMethod(log, 'warn', () => { warned = true; });
  let limit; //will capture clamped limit
  try {
    const qerrors = reloadQerrors(); //reload module with large limit
    await new Promise(r => setImmediate(r)); //allow async warn callback
    limit = qerrors.getAdviceCacheLimit(); //fetch clamped limit value
  } finally {
    restoreWarn(); //restore logger warn
    if (orig === undefined) { delete process.env.QERRORS_CACHE_LIMIT; } else { process.env.QERRORS_CACHE_LIMIT = orig; }
    delete require.cache[require.resolve('../lib/qerrors')]; //reset state
    require('../lib/qerrors'); //reload defaults
  }
  assert.equal(limit, 1000); //expect clamp to safe threshold
  assert.equal(warned, true); //warning should fire
});
