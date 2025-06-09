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
  process.env.QERRORS_QUEUE_LIMIT = '1'; //allow single queued item
  const qerrors = reloadQerrors(); //reload with env vars
  const logger = await require('../lib/logger'); //logger instance
  let logged; //capture logged error
  const restoreLog = qtests.stubMethod(logger, 'error', (e) => { logged = e; });
  const restoreAnalyze = qtests.stubMethod(qerrors, 'analyzeError', async () => {
    return new Promise((r) => setTimeout(r, 20)); //simulate long analysis
  });
  try {
    qerrors(new Error('one')); //first call fills active slot
    qerrors(new Error('two')); //second call should exceed queue limit
    qerrors(new Error('three')); //third call also exceeds queue limit
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

test('queue reject count increments when queue exceeds limit', async () => {
  const origConc = process.env.QERRORS_CONCURRENCY; //backup env
  const origQueue = process.env.QERRORS_QUEUE_LIMIT; //backup env
  process.env.QERRORS_CONCURRENCY = '1'; //force single concurrency
  process.env.QERRORS_QUEUE_LIMIT = '1'; //allow one queued before rejection
  const qerrors = reloadQerrors(); //reload to apply env
  const logger = await require('../lib/logger'); //logger instance
  const restoreWarn = qtests.stubMethod(logger, 'warn', () => {}); //silence warn
  const restoreError = qtests.stubMethod(logger, 'error', () => {}); //silence err
  const restoreAnalyze = qtests.stubMethod(qerrors, 'analyzeError', async () => {
    return new Promise((r) => setTimeout(r, 20)); //simulate analysis time
  });
  try {
    qerrors(new Error('one')); //consume active slot
    qerrors(new Error('two')); //first rejection increments counter
    qerrors(new Error('three')); //second rejection increments counter
    await new Promise((r) => setTimeout(r, 30)); //allow tasks
  } finally {
    restoreWarn(); //restore warn stub
    restoreError(); //restore error stub
    restoreAnalyze(); //restore analyze stub
    if (origConc === undefined) { delete process.env.QERRORS_CONCURRENCY; } else { process.env.QERRORS_CONCURRENCY = origConc; }
    if (origQueue === undefined) { delete process.env.QERRORS_QUEUE_LIMIT; } else { process.env.QERRORS_QUEUE_LIMIT = origQueue; }
    reloadQerrors(); //reset state
  }
  assert.equal(qerrors.getQueueRejectCount(), 2); //expect two rejections
});

test('getQueueLength reflects queued analyses', async () => {
  const origConc = process.env.QERRORS_CONCURRENCY; //backup env
  const origQueue = process.env.QERRORS_QUEUE_LIMIT; //backup env
  process.env.QERRORS_CONCURRENCY = '1'; //force single concurrency
  process.env.QERRORS_QUEUE_LIMIT = '2'; //allow one queued item
  process.env.OPENAI_TOKEN = 'tkn'; //enable analyzeError path
  const qerrors = reloadQerrors(); //reload to apply env
  const logger = await require('../lib/logger'); //logger instance
  const restoreWarn = qtests.stubMethod(logger, 'warn', () => {}); //silence warn
  const restoreError = qtests.stubMethod(logger, 'error', () => {}); //silence err
  const capture = {}; //track axios args
  const restorePost = qtests.stubMethod(qerrors.axiosInstance, 'post', async () => {
    return new Promise((r) => setTimeout(() => r({ data: { choices: [{ message: { content: '{}' } }] } }), 20)); //simulate delay
  });
  try {
    qerrors(new Error('one')); //consume concurrency slot
    qerrors(new Error('two')); //queued under limit
    await new Promise((r) => setTimeout(r, 15)); //allow queue update
    assert.equal(qerrors.getQueueLength(), 1); //expect one item queued
    await new Promise((r) => setTimeout(r, 30)); //allow tasks
  } finally {
    restoreWarn(); //restore warn stub
    restoreError(); //restore error stub
    restorePost(); //restore axios stub
    if (origConc === undefined) { delete process.env.QERRORS_CONCURRENCY; } else { process.env.QERRORS_CONCURRENCY = origConc; }
    if (origQueue === undefined) { delete process.env.QERRORS_QUEUE_LIMIT; } else { process.env.QERRORS_QUEUE_LIMIT = origQueue; }
    delete process.env.OPENAI_TOKEN; //cleanup token
    reloadQerrors(); //reset state
  }
});

test('scheduleAnalysis uses defaults on invalid env', () => { //verify helper fallback
  const origConc = process.env.QERRORS_CONCURRENCY; //backup
  const origQueue = process.env.QERRORS_QUEUE_LIMIT; //backup
  process.env.QERRORS_CONCURRENCY = 'abc'; //invalid concurrency
  process.env.QERRORS_QUEUE_LIMIT = 'abc'; //invalid queue limit
  delete require.cache[require.resolve('../lib/config')]; //reload config
  const cfg = require('../lib/config'); //load fresh config
  try {
    assert.equal(cfg.getInt('QERRORS_CONCURRENCY'), 5); //falls back to default
    assert.equal(cfg.getInt('QERRORS_QUEUE_LIMIT'), 100); //falls back to default
  } finally {
    if (origConc === undefined) { delete process.env.QERRORS_CONCURRENCY; } else { process.env.QERRORS_CONCURRENCY = origConc; }
    if (origQueue === undefined) { delete process.env.QERRORS_QUEUE_LIMIT; } else { process.env.QERRORS_QUEUE_LIMIT = origQueue; }
    delete require.cache[require.resolve('../lib/config')]; //reset module
    require('../lib/config'); //reapply defaults
  }
});

test('queue never exceeds limit under high concurrency', async () => {
  const origConc = process.env.QERRORS_CONCURRENCY; //backup env
  const origQueue = process.env.QERRORS_QUEUE_LIMIT; //backup env
  process.env.QERRORS_CONCURRENCY = '3'; //allow more active analyses
  process.env.QERRORS_QUEUE_LIMIT = '1'; //only one queued task
  const qerrors = reloadQerrors(); //reload config vars
  const logger = await require('../lib/logger'); //logger instance
  const restoreWarn = qtests.stubMethod(logger, 'warn', () => {}); //silence warn
  const restoreError = qtests.stubMethod(logger, 'error', () => {}); //silence error
  const restoreAnalyze = qtests.stubMethod(qerrors, 'analyzeError', async () => new Promise(r => setTimeout(r, 20))); //simulate work
  try {
    qerrors(new Error('one')); //start first analysis
    qerrors(new Error('two')); //rejected since limit reached
    qerrors(new Error('three')); //rejected since limit reached
    qerrors(new Error('four')); //rejected since limit reached
    qerrors(new Error('five')); //another rejection due to limit
    await new Promise(r => setTimeout(r, 50)); //allow processing
  } finally {
    restoreWarn();
    restoreError();
    restoreAnalyze();
    if (origConc === undefined) { delete process.env.QERRORS_CONCURRENCY; } else { process.env.QERRORS_CONCURRENCY = origConc; }
    if (origQueue === undefined) { delete process.env.QERRORS_QUEUE_LIMIT; } else { process.env.QERRORS_QUEUE_LIMIT = origQueue; }
    reloadQerrors(); //reset state
  }
  assert.ok(qerrors.getQueueLength() <= 1); //queue length at most limit
  assert.equal(qerrors.getQueueRejectCount(), 4); //four tasks rejected
});

test('metrics stop when queue drains then restart on new analysis', async () => {
  const origConc = process.env.QERRORS_CONCURRENCY; //backup concurrency
  const origInterval = process.env.QERRORS_METRIC_INTERVAL_MS; //backup metric interval
  const realSet = global.setInterval; //save original setInterval
  const realClear = global.clearInterval; //save original clearInterval
  let startCount = 0; //track interval creation
  global.setInterval = (fn, ms) => { startCount++; fn(); return { unref() {} }; }; //simulate immediate tick
  global.clearInterval = () => {}; //noop for test
  process.env.QERRORS_CONCURRENCY = '1'; //single task
  process.env.QERRORS_METRIC_INTERVAL_MS = '5'; //fast metrics
  const qerrors = reloadQerrors(); //reload with env
  const logger = await require('../lib/logger'); //logger instance
  let metrics = 0; //metric log count
  const restoreInfo = qtests.stubMethod(logger, 'info', (m) => { if (String(m).startsWith('metrics')) metrics++; });
  const restoreWarn = qtests.stubMethod(logger, 'warn', () => {}); //silence warn
  const restoreError = qtests.stubMethod(logger, 'error', () => {}); //silence error
  const restoreAnalyze = qtests.stubMethod(qerrors, 'analyzeError', async () => new Promise(r => setTimeout(r, 10))); //simulate work
  try {
    qerrors(new Error('one')); //start first analysis
    await new Promise(r => setTimeout(r, 20)); //wait for completion
    const first = metrics; //capture metric count
    await new Promise(r => setTimeout(r, 5)); //allow stopQueueMetrics
    qerrors(new Error('two')); //restart queue
    await new Promise(r => setTimeout(r, 20)); //wait for run
    assert.ok(metrics > first); //metrics resumed
    assert.equal(startCount, 3); //cleanup once and metrics twice
  } finally {
    global.setInterval = realSet; //restore interval
    global.clearInterval = realClear; //restore clear
    restoreInfo();
    restoreWarn();
    restoreError();
    restoreAnalyze();
    if (origConc === undefined) { delete process.env.QERRORS_CONCURRENCY; } else { process.env.QERRORS_CONCURRENCY = origConc; }
    if (origInterval === undefined) { delete process.env.QERRORS_METRIC_INTERVAL_MS; } else { process.env.QERRORS_METRIC_INTERVAL_MS = origInterval; }
    reloadQerrors();
  }
});
