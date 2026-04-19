const test = require('node:test');
const assert = require('node:assert/strict');

test('CJS require: module.exports is callable function', () => {
  const qerrors = require('../index.js');
  assert.strictEqual(typeof qerrors, 'function', 'require result should be callable directly');
});

test('CJS require: no .default wrapping needed', () => {
  const qerrors = require('../index.js');
  assert.strictEqual(qerrors.default, undefined, '.default should not exist on CJS require result');
});

test('ESM dynamic import of index.js: default is callable, no .default.default needed', async () => {
  const mod = await import('../index.js');
  assert.strictEqual(typeof mod.default, 'function', 'mod.default must be callable — consumers must not need mod.default.default');
});

test('ESM dynamic import of index.js: named exports are accessible', async () => {
  const mod = await import('../index.js');
  assert.strictEqual(typeof mod.sanitizeMessage, 'function');
  assert.strictEqual(typeof mod.createTypedError, 'function');
  assert.strictEqual(typeof mod.generateErrorId, 'function');
  assert.strictEqual(typeof mod.getAIModelManager, 'function');
  assert.strictEqual(typeof mod.createTimer, 'function');
});

test('ESM import via index.mjs: default is callable function', async () => {
  const mod = await import('../index.mjs');
  assert.strictEqual(typeof mod.default, 'function', 'index.mjs default export must be the callable qerrors function');
});

test('ESM import via index.mjs: named exports are functions', async () => {
  const mod = await import('../index.mjs');
  assert.strictEqual(typeof mod.sanitizeMessage, 'function');
  assert.strictEqual(typeof mod.createTypedError, 'function');
  assert.strictEqual(typeof mod.generateErrorId, 'function');
  assert.strictEqual(typeof mod.getAIModelManager, 'function');
  assert.strictEqual(typeof mod.createTimer, 'function');
  assert.strictEqual(typeof mod.logError, 'function');
  assert.strictEqual(typeof mod.throwIfNotFound, 'function');
});

test('ESM import via index.mjs: default and CJS require are the same function', async () => {
  const mod = await import('../index.mjs');
  const cjs = require('../index.js');
  assert.strictEqual(mod.default, cjs, 'ESM default export should be identical to the CJS require result');
});
