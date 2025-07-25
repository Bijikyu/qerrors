const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stubbing util

function withEnv(vars) {
  const orig = {};
  Object.entries(vars).forEach(([k, v]) => { orig[k] = process.env[k]; if (v === undefined) { delete process.env[k]; } else { process.env[k] = v; } });
  return () => { Object.entries(orig).forEach(([k, v]) => { if (v === undefined) { delete process.env[k]; } else { process.env[k] = v; } }); };
}

function reloadConfig() {
  delete require.cache[require.resolve('../lib/config')];
  return require('../lib/config');
}

// Scenario: getEnv returns environment variable when set
test('getEnv returns env var when present', () => {
  const restore = withEnv({ TEST_VAL: 'xyz' });
  const cfg = reloadConfig();
  try {
    assert.equal(cfg.getEnv('TEST_VAL'), 'xyz'); //returns provided env value
  } finally { restore(); }
});

// Scenario: getEnv falls back to default when undefined
test('getEnv falls back to default', () => {
  const restore = withEnv({ QERRORS_QUEUE_LIMIT: undefined });
  const cfg = reloadConfig();
  try {
    assert.equal(cfg.getEnv('QERRORS_QUEUE_LIMIT'), '100'); //falls back to default
  } finally { restore(); }
});

// Scenario: safeRun returns function result
test('safeRun returns result', () => {
  const cfg = reloadConfig();
  const res = cfg.safeRun('fn', () => 5, 0);
  assert.equal(res, 5); //returns function output
});

// Scenario: safeRun catches error and returns fallback
test('safeRun returns fallback on error', () => {
  const cfg = reloadConfig();
  let msg;
  const restoreErr = qtests.stubMethod(console, 'error', m => { msg = m; });
  try {
    const out = cfg.safeRun('fn', () => { throw new Error('boom'); }, 7, 'info');
    assert.equal(out, 7); //fallback value used
    assert.ok(msg.includes('fn failed')); //error logged for context
  } finally { restoreErr(); }
});

// Scenario: getInt parses env value
test('getInt parses integer env value', () => {
  const restore = withEnv({ QERRORS_TIMEOUT: '9000' });
  const cfg = reloadConfig();
  try {
    assert.equal(cfg.getInt('QERRORS_TIMEOUT'), 9000); //parses integer env
  } finally { restore(); }
});

// Scenario: getInt falls back to default on invalid env
test('getInt uses default when env invalid', () => {
  const restore = withEnv({ QERRORS_TIMEOUT: 'abc' });
  const cfg = reloadConfig();
  try {
    assert.equal(cfg.getInt('QERRORS_TIMEOUT'), 10000); //invalid env uses default
  } finally { restore(); }
});

// Scenario: getInt enforces minimum value
test('getInt enforces minimum bound', () => {
  const restore = withEnv({ QERRORS_TIMEOUT: '1' });
  const cfg = reloadConfig();
  try {
    assert.equal(cfg.getInt('QERRORS_TIMEOUT', 5), 5); //result respects minimum
  } finally { restore(); }
});
