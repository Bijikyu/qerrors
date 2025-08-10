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
  
  // Mock the AI model manager
  const { getAIModelManager } = require('../lib/aiModelManager');
  const aiManager = getAIModelManager();
  const originalAnalyzeError = aiManager.analyzeError;
  let callCount = 0;
  aiManager.analyzeError = async () => {
    callCount++;
    return { info: callCount === 1 ? 'one' : 'two' };
  };
  
  try {
    const err = new Error('boom');
    err.stack = 'stack';
    err.uniqueErrorName = 'CACHECLR';
    const first = await qerrors.analyzeError(err, 'ctx');
    assert.equal(first.info, 'one'); //initial call fetches advice
    await qerrors.analyzeError(err, 'ctx');
    assert.equal(callCount, 1); //should use cache (no second call)
    qerrors.clearAdviceCache(); //reset cache
    const afterClear = await qerrors.analyzeError(err, 'ctx');
    assert.equal(afterClear.info, 'two'); //new analysis after cache clear
    assert.equal(callCount, 2); //verify second call was made
  } finally {
    if (origLimit === undefined) { delete process.env.QERRORS_CACHE_LIMIT; } else { process.env.QERRORS_CACHE_LIMIT = origLimit; }
    aiManager.analyzeError = originalAnalyzeError; //restore AI manager
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
