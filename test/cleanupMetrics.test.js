const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stubbing util

function withEnv(vars) {
  const orig = {};
  Object.entries(vars).forEach(([k, v]) => { orig[k] = process.env[k]; if (v === undefined) { delete process.env[k]; } else { process.env[k] = v; } });
  return () => { Object.entries(orig).forEach(([k, v]) => { if (v === undefined) { delete process.env[k]; } else { process.env[k] = v; } }); };
}

function reloadQerrors() {
  delete require.cache[require.resolve('../lib/qerrors')];
  delete require.cache[require.resolve('../lib/config')];
  return require('../lib/qerrors');
}

// Scenario: startAdviceCleanup schedules interval and stopAdviceCleanup clears it
test('advice cleanup interval start and stop', () => {
  const restoreEnv = withEnv({ QERRORS_CACHE_TTL: '1', QERRORS_CACHE_LIMIT: '2' });
  const realSet = global.setInterval;
  const realClear = global.clearInterval;
  let called = 0; let ms; let unref = false; const handle = { unref() { unref = true; } };
  global.setInterval = (fn, m) => { called++; ms = m; return handle; };
  let cleared; global.clearInterval = h => { cleared = h; };
  const qerrors = reloadQerrors();
  try {
    qerrors.startAdviceCleanup();
    assert.equal(called, 1); //interval should be created once
    assert.equal(ms, 1000); //interval uses env ttl in ms
    assert.equal(unref, true); //interval handle unref'd
    qerrors.stopAdviceCleanup();
    assert.equal(cleared, handle); //cleanup clears same handle
  } finally {
    global.setInterval = realSet;
    global.clearInterval = realClear;
    restoreEnv();
    reloadQerrors();
  }
});

// Scenario: purgeExpiredAdvice calls underlying cache purge
test('purgeExpiredAdvice triggers cache purge', () => {
  const restoreEnv = withEnv({ QERRORS_CACHE_TTL: '1', QERRORS_CACHE_LIMIT: '1' });
  const { LRUCache } = require('lru-cache');
  let purged = false;
  const restorePur = qtests.stubMethod(LRUCache.prototype, 'purgeStale', function() { purged = true; });
  const qerrors = reloadQerrors();
  try {
    qerrors.purgeExpiredAdvice();
    assert.equal(purged, true); //cache purge executed
  } finally {
    restorePur();
    restoreEnv();
    reloadQerrors();
  }
});

// Scenario: startQueueMetrics schedules interval and stopQueueMetrics clears it
test('queue metrics interval start and stop', () => {
  const restoreEnv = withEnv({ QERRORS_METRIC_INTERVAL_MS: '5' });
  const realSet = global.setInterval;
  const realClear = global.clearInterval;
  let called = 0; let ms; let unref = false; const handle = { unref() { unref = true; } };
  global.setInterval = (fn, m) => { called++; ms = m; return handle; };
  let cleared; global.clearInterval = h => { cleared = h; };
  const qerrors = reloadQerrors();
  try {
    qerrors.startQueueMetrics();
    assert.equal(called, 1); //metrics interval created
    assert.equal(ms, 5); //interval uses env value
    assert.equal(unref, true); //handle unref'd for cleanup
    qerrors.stopQueueMetrics();
    assert.equal(cleared, handle); //interval cleared correctly
  } finally {
    global.setInterval = realSet;
    global.clearInterval = realClear;
    restoreEnv();
    reloadQerrors();
  }
});

// Scenario: getAdviceCacheLimit clamps values
test('getAdviceCacheLimit reflects clamped env', () => {
  const restoreEnv = withEnv({ QERRORS_CACHE_LIMIT: '2000' });
  const qerrors = reloadQerrors();
  try {
    assert.equal(qerrors.getAdviceCacheLimit(), 1000); //limit clamped to max
  } finally {
    restoreEnv();
    reloadQerrors();
  }
});
