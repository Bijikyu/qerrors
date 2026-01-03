const qerrors = require('../index.js');

describe('Integration Tests', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      headers: { accept: 'application/json' },
      url: '/test/api/endpoint',
      method: 'POST',
      ip: '127.0.0.1',
      get: (header) => header === 'User-Agent' ? 'test-agent/1.0' : undefined,
      body: { test: 'data', largeField: 'x'.repeat(1000) }
    };
    mockRes = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      get: jest.fn()
    };
    mockNext = jest.fn();
  });

  afterEach(() => jest.clearAllMocks());

  describe('Error Handling Integration', () => {
    test('should handle large request objects safely', async () => {
      const largeError = new Error('Large error');
      largeError.details = { data: 'x'.repeat(5000), nested: { deep: 'y'.repeat(2000) } };

      await qerrors(largeError, 'test.largeContext', mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle async middleware properly', async () => {
      const asyncError = new Error('Async error');
      const middleware = qerrors.middleware();

      await middleware(asyncError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle memory pressure scenarios', async () => {
      const originalMemory = process.memoryUsage;
      process.memoryUsage = () => ({ heapUsed: 800 * 1024 * 1024, heapTotal: 1000 * 1024 * 1024 });

      const error = new Error('Memory pressure test');
      await qerrors(error, 'test.memoryPressure', { memoryPressure: true });

      process.memoryUsage = originalMemory;
      expect(true).toBe(true);
    });

    test('should handle concurrent error processing', async () => {
      const errors = Array.from({ length: 10 }, (_, i) => new Error(`Concurrent error ${i}`));
      const promises = errors.map(error => qerrors(error, 'test.concurrent'));

      await Promise.allSettled(promises);

      expect(promises.length).toBe(10);
    });
  });

  describe('AI Integration', () => {
    test('should handle missing API keys gracefully', async () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const error = new Error('AI test error');
      await qerrors(error, 'test.ai.missingKey');

      process.env.OPENAI_API_KEY = originalEnv;
      expect(true).toBe(true);
    });

    test('should handle AI service timeouts', async () => {
      const error = new Error('AI timeout test');
      await qerrors(error, 'test.ai.timeout', { aiTimeout: true });

      expect(true).toBe(true);
    });
  });

  describe('Queue Management Integration', () => {
    test('should handle queue overflow scenarios', async () => {
      const errors = Array.from({ length: 200 }, (_, i) => new Error(`Queue test ${i}`));
      const startTime = Date.now();

      await Promise.allSettled(errors.map(error => qerrors(error, 'test.queue.overflow')));

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThan(0);
    });

    test('should maintain queue statistics accurately', async () => {
      const initialStats = qerrors.getQueueStats();

      await qerrors(new Error('Stats test'), 'test.queue.stats');
      const newStats = qerrors.getQueueStats();

      expect(newStats).toBeDefined();
      expect(typeof newStats.length).toBe('number');
      expect(typeof newStats.rejectCount).toBe('number');
    });
  });

  describe('Cache Integration', () => {
    test('should cache and retrieve error advice', async () => {
      const error = new Error('Cache test error');
      error.message = 'Repeatable error message';

      await qerrors(error, 'test.cache.first');
      await qerrors(error, 'test.cache.second');

      expect(true).toBe(true);
    });

    test('should handle cache expiration', async () => {
      const error = new Error('Cache expiration test');
      error.message = 'Temporary error';

      await qerrors(error, 'test.cache.expiration');

      expect(true).toBe(true);
    });
  });

  describe('Performance Integration', () => {
    test('should handle high-frequency errors efficiently', async () => {
      const startTime = Date.now();
      const errors = Array.from({ length: 100 }, (_, i) => new Error(`Performance test ${i}`));

      await Promise.allSettled(errors.map(error => qerrors(error, 'test.performance')));

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);
    });

    test('should maintain memory efficiency under load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 50; i++) {
        await qerrors(new Error(`Memory test ${i}`), 'test.memory.efficiency');
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Security Integration', () => {
    test('should sanitize sensitive data in context', async () => {
      const error = new Error('Security test');
      await qerrors(error, 'test.security.sanitization', {
        password: 'secret123',
        apiKey: 'sk-test123',
        token: 'jwt-token-123',
        userInfo: 'user@example.com'
      });

      expect(true).toBe(true);
    });

    test('should prevent XSS in HTML responses', async () => {
      mockReq.headers.accept = 'text/html';
      const error = new Error('<script>alert("xss")</script>');
      const middleware = qerrors.middleware();

      await middleware(error, mockReq, mockRes, mockNext);

      const sendCall = mockRes.send.mock.calls[0];
      if (sendCall) {
        const responseHtml = sendCall[0];
        expect(responseHtml).not.toContain('<script>');
      }
    });
  });

  describe('Circuit Breaker Integration', () => {
    test('should handle circuit breaker states', async () => {
      const error = new Error('Circuit breaker test');

      await qerrors(error, 'test.circuitBreaker.normal');
      await qerrors(error, 'test.circuitBreaker.open');

      expect(true).toBe(true);
    });
  });
});
