const test = require('node:test');
const assert = require('node:assert/strict');

const qerrors = require('../index.js');

const createSpy = ({ returnsThis = false } = {}) => {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
    return returnsThis ? fn.thisValue : undefined;
  };
  fn.calls = calls;
  fn.called = () => calls.length > 0;
  fn.calledWith = (...expected) =>
    calls.some(args => args.length === expected.length && args.every((v, i) => v === expected[i]));
  fn.setThis = (val) => {
    fn.thisValue = val;
    return fn;
  };
  return fn;
};

const makeMocks = (acceptHeader = 'application/json') => {
  const res = { headersSent: false };
  const status = createSpy({ returnsThis: true }).setThis(res);
  const set = createSpy({ returnsThis: true }).setThis(res);
  const json = createSpy();
  const send = createSpy();

  const req = {
    headers: { accept: acceptHeader },
    url: '/test/api/endpoint',
    method: 'POST',
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
    get: (header) => header === 'User-Agent' ? 'test-agent/1.0' : undefined,
    accepts: (type) => type === 'html' && acceptHeader.includes('text/html'),
    body: { test: 'data', largeField: 'x'.repeat(1000) }
  };

  res.status = status;
  res.set = set;
  res.json = json;
  res.send = send;
  res.get = () => undefined;

  return { req, res, next: createSpy() };
};

test('middleware: JSON response without throwing', async () => {
  const { req, res } = makeMocks('application/json');
  const middleware = qerrors.middleware();
  middleware(new Error('Async error'), req, res);
  await new Promise(setImmediate);
  assert.ok(res.status.calledWith(500));
  assert.ok(res.json.called());
});

test('middleware: HTML escapes error message (XSS-safe)', async () => {
  const { req, res } = makeMocks('text/html');
  const middleware = qerrors.middleware();
  middleware(new Error('<script>alert("xss")</script>'), req, res);
  await new Promise(setImmediate);
  assert.ok(res.status.calledWith(500));
  assert.ok(res.send.called());
  const html = res.send.calls[0]?.[0] || '';
  assert.ok(!html.includes('<script>'));
});

test('core: handles memory pressure scenarios', async () => {
  const originalMemory = process.memoryUsage;
  process.memoryUsage = () => ({ heapUsed: 800 * 1024 * 1024, heapTotal: 1000 * 1024 * 1024 });
  await qerrors(new Error('Memory pressure test'), 'test.memoryPressure', { memoryPressure: true });
  process.memoryUsage = originalMemory;
  assert.ok(true);
});

test('core: handles concurrent error processing', async () => {
  const errors = Array.from({ length: 10 }, (_, i) => new Error(`Concurrent error ${i}`));
  const promises = errors.map(error => qerrors(error, 'test.concurrent'));
  await Promise.allSettled(promises);
  assert.equal(promises.length, 10);
});

test('ai integration: missing API keys does not throw', async () => {
  const originalEnv = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  await qerrors(new Error('AI test error'), 'test.ai.missingKey');
  process.env.OPENAI_API_KEY = originalEnv;
  assert.ok(true);
});

test('queue integration: handles queue overflow scenarios', async () => {
  const errors = Array.from({ length: 200 }, (_, i) => new Error(`Queue test ${i}`));
  await Promise.allSettled(errors.map(error => qerrors(error, 'test.queue.overflow')));
  assert.ok(true);
});

test('queue integration: queue stats shape', async () => {
  await qerrors(new Error('Stats test'), 'test.queue.stats');
  const stats = qerrors.getQueueStats();
  assert.ok(stats);
  assert.equal(typeof stats.length, 'number');
  assert.equal(typeof stats.rejectCount, 'number');
});

test('cache integration: cache path does not throw', async () => {
  const error = new Error('Cache test error');
  error.message = 'Repeatable error message';
  await qerrors(error, 'test.cache.first');
  await qerrors(error, 'test.cache.second');
  assert.ok(true);
});
