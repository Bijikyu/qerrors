const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stub utilities

function reloadQerrors() { //load fresh module with env
  delete require.cache[require.resolve('../lib/qerrors')];
  return require('../lib/qerrors');
}

test('scheduleAnalysis rejects when queue exceeds limit', async () => {
  const origConc = process.env.QERRORS_CONCURRENCY; //save original concurrency
  const origQueue = process.env.QERRORS_QUEUE_LIMIT; //save original queue limit
  process.env.QERRORS_CONCURRENCY = '1'; //one concurrent analysis
  process.env.QERRORS_QUEUE_LIMIT = '0'; //no waiting allowed
  const qerrors = reloadQerrors(); //reload with env vars
  const logger = require('../lib/logger'); //logger instance
  let logged; //capture logged error
  const restoreLog = qtests.stubMethod(logger, 'error', (e) => { logged = e; });
  const restoreAnalyze = qtests.stubMethod(qerrors, 'analyzeError', async () => {
    return new Promise((r) => setTimeout(r, 20)); //simulate long analysis
  });
  try {
    qerrors(new Error('one')); //first call fills slot
    qerrors(new Error('two')); //second call should exceed queue limit
    await new Promise((r) => setTimeout(r, 30)); //wait for processing
  } finally {
    restoreLog(); //restore logger stub
    restoreAnalyze(); //restore analyze stub
    if (origConc === undefined) { delete process.env.QERRORS_CONCURRENCY; } else { process.env.QERRORS_CONCURRENCY = origConc; }
    if (origQueue === undefined) { delete process.env.QERRORS_QUEUE_LIMIT; } else { process.env.QERRORS_QUEUE_LIMIT = origQueue; }
    reloadQerrors(); //reset module
  }
  assert.ok(logged instanceof Error); //expect error object logged
  assert.equal(logged.message, 'queue full'); //message indicates queue full
});

test('getQueueStats reflects limiter counts', async () => {
  const origConc = process.env.QERRORS_CONCURRENCY; //save original concurrency
  const origTok = process.env.OPENAI_TOKEN; //save token
  process.env.QERRORS_CONCURRENCY = '1'; //restrict to one running task
  process.env.OPENAI_TOKEN = 'tkn'; //enable analyze flow
  const qerrors = reloadQerrors(); //reload module with env
  const restorePost = qtests.stubMethod(qerrors, 'postWithRetry', async () => {
    return new Promise(r => setTimeout(r, 20)); //delay request
  });
  try {
    qerrors(new Error('a')); //start first task
    qerrors(new Error('b')); //queue second task
    await new Promise(r => setTimeout(r, 10)); //allow queue setup
    const during = qerrors.getQueueStats(); //read stats while one queued
    await new Promise(r => setTimeout(r, 40)); //wait for completion
    const after = qerrors.getQueueStats(); //stats after all done
    assert.deepEqual(during, { active: 1, queued: 1 }); //expect one running and one queued
    assert.deepEqual(after, { active: 0, queued: 0 }); //expect none after finish
  } finally {
    restorePost(); //restore postWithRetry stub
    if (origConc === undefined) { delete process.env.QERRORS_CONCURRENCY; } else { process.env.QERRORS_CONCURRENCY = origConc; }
    if (origTok === undefined) { delete process.env.OPENAI_TOKEN; } else { process.env.OPENAI_TOKEN = origTok; }
    reloadQerrors(); //reset module state
  }
});
