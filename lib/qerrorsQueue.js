'use strict';

const pLimit = require('p-limit').default;
const { CONCURRENCY_LIMIT, QUEUE_LIMIT } = require('./qerrorsConfig');
const config = require('./config');
const { getCurrentMemoryPressure } = require('./shared/memoryMonitor');
const { calculateQueueSize } = require('./shared/adaptiveSizing');

const logAsync = async (level, message) => {
  try {
    const logger = require('./logger');
    const log = await logger;
    log[level](message);
  } catch (err) {
    console.error("Logger error:", String(err.message || "").substring(0, 100));
  }
};

const limit = pLimit(CONCURRENCY_LIMIT || 10);

const MEMORY_BASED_QUEUE_LIMITS = {
  low: QUEUE_LIMIT,
  medium: Math.floor(QUEUE_LIMIT * 0.7),
  high: Math.floor(QUEUE_LIMIT * 0.4),
  critical: Math.floor(QUEUE_LIMIT * 0.2)
};

const getMemoryAwareQueueLimit = () => {
  return calculateQueueSize(MEMORY_BASED_QUEUE_LIMITS);
};

const estimateItemMemoryUsage = (err, ctx) => {
  try {
    const util = require('util');
    
    const itemRepresentation = {
      error: {
        message: err?.message || '',
        name: err?.name || 'Error',
        code: err?.code,
        stackLength: err?.stack ? err.stack.length : 0
      },
      contextLength: ctx ? ctx.length : 0,
      additionalProps: err ? Object.keys(err).filter(key => 
        !['message', 'name', 'stack', 'code'].includes(key)
      ).length : 0
    };
    
    const inspected = util.inspect(itemRepresentation, {
      depth: 2,
      maxArrayLength: 10,
      maxStringLength: 100
    });
    
    let estimatedSize = inspected.length * 2;
    estimatedSize += 2048;
    
    if (err?.stack) {
      estimatedSize += err.stack.length * 2;
    }
    
    if (ctx) {
      estimatedSize += ctx.length * 2;
    }
    
    return Math.min(Math.max(estimatedSize, 1024), 10 * 1024 * 1024);
    
  } catch (error) {
    console.warn('Error in accurate memory estimation, using fallback:', error.message);
    
    let estimatedSize = 1024;
    
    if (err && err.message) {
      estimatedSize += err.message.length * 2;
    }
    if (err && err.stack) {
      estimatedSize += err.stack.length * 2;
    }
    if (ctx) {
      estimatedSize += ctx.length * 2;
    }
    
    estimatedSize += 512;
    
    return estimatedSize;
  }
};

const createErrorSignature = (err) => ({
  message: err.message ? err.message.substring(0, 200) : '',
  name: err.name ? err.name.substring(0, 50) : 'Error',
  code: err.code || '',
  timestamp: err.timestamp || Date.now(),
  stackHash: err.stack ? createStackHash(err.stack) : ''
});

const generateSignatureId = (signature) => {
  const crypto = require('crypto');
  const signatureString = `${signature.name}:${signature.message}:${signature.code}:${signature.stackHash}`;
  return crypto.createHash('sha256').update(signatureString).digest('hex').substring(0, 16);
};

const createStackHash = (stack) => {
  if (!stack) return '';
  
  if (!stack || typeof stack !== 'string') {
    return 'unknown-error';
  }
  
  const maxStackLength = 1000;
  const sanitizedStack = stack.length > maxStackLength 
    ? stack.substring(0, maxStackLength) + '...[truncated]'
    : stack;
  
  const stackLines = sanitizedStack.split('\n').slice(0, 5);
  
  const normalizedLines = stackLines.map(line => {
    const cleanLine = line.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    return cleanLine.trim().replace(/\d+/, 'N');
  });
  
  const normalizedStack = normalizedLines.join('|');
  
  const crypto = require('crypto');
  return crypto.createHash('md5').update(normalizedStack).digest('hex').substring(0, 8);
};

const estimateSignatureMemoryUsage = (signature) => {
  let estimatedSize = 256;
  
  estimatedSize += (signature.message || '').length * 2;
  estimatedSize += (signature.name || '').length * 2;
  estimatedSize += (signature.code || '').length * 2;
  estimatedSize += (signature.stackHash || '').length * 2;
  estimatedSize += 8;
  
  return estimatedSize;
};

const getFullErrorFromCache = async (signatureId, signature) => {
  const { getAdviceFromCache } = require('./qerrorsCache');
  const cacheKey = `error_full_${signatureId}`;
  const cached = getAdviceFromCache(cacheKey);
  
  if (cached && cached.error) {
    return cached;
  }
  
  const error = new Error(signature?.message || 'Unknown error');
  error.name = signature?.name || 'Error';
  error.code = signature?.code;
  error.timestamp = signature?.timestamp || Date.now();
  
  return { error, context: {}, timestamp: Date.now() };
};

// Memory-based queue size limits (already defined above)

let metricHandle = null;

class SimpleTimerRegistry {
  constructor(maxSize = 50) {
    this.timers = [];
    this.maxSize = maxSize;
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
    this.cleanupInterval.unref();
    this.maxAge = 300000;
    this.lastCleanup = Date.now();
  }

  add(timer) {
    if (!timer) return false;
    this.timers.length >= this.maxSize && (oldest => oldest && this.clearTimer(oldest))(this.timers.shift());
    this.timers.push({ timer, added: Date.now() });
    return true;
  }

  has(timer) {
    const index = this.timers.findIndex(entry => entry.timer === timer);
    return index !== -1 ? (entry => (this.timers.splice(index, 1), this.timers.push(entry), true))(this.timers[index]) : false;
  }

  delete(timer) {
    const index = this.timers.findIndex(entry => entry.timer === timer);
    return index !== -1 ? (removed => (this.timers.splice(index, 1), this.clearTimer(removed.timer), true))(this.timers[index]) : false;
  }

  clearTimer(timer) {
    try {
      typeof clearTimeout === 'function' && clearTimeout(timer);
      timer.unref && timer.unref();
    } catch (err) {}
  }

  cleanup() {
    const now = Date.now();
    if (now - this.lastCleanup < 20000) return;
    this.lastCleanup = now;
    const expired = this.timers.filter(entry => now - entry.added > this.maxAge);
    expired.forEach(entry => this.delete(entry.timer));
  }

  clear() {
    this.timers.forEach(entry => this.clearTimer(entry.timer));
    this.timers = [];
  }

  get size() {
    return this.timers.length;
  }

  forEach(callback) {
    this.timers.forEach(entry => callback(entry.timer));
  }

  destroy() {
    this.cleanupInterval && (clearInterval(this.cleanupInterval), this.cleanupInterval = null);
    this.clear();
  }
}

const activeTimers = new SimpleTimerRegistry(50);

const cleanupTimers = () => {
  activeTimers && activeTimers.destroy();
  metricHandle = null;
};

const registerTimer = (timer) => {
  timer && (activeTimers.add(timer), timer.unref());
  return timer;
};

const getQueueRejectCount = () => {
  try {
    const { getQueueRejectCount: managerGetRejectCount } = require('./queueMetrics');
    return managerGetRejectCount();
  } catch {
    return 0;
  }
};

const METRIC_INTERVAL_MS = config.getInt('QERRORS_METRIC_INTERVAL_MS', 0);

const logQueueMetrics = () => {
  try {
    const { getQueueRejectCount: managerGetRejectCount } = require('./queueMetrics');
    const memoryStats = getCurrentMemoryPressure();
    const memoryAwareLimit = getMemoryAwareQueueLimit();
    
    console.log(`metrics queueLength=${limit.pendingCount} queueRejects=${managerGetRejectCount()} memoryPressure=${memoryStats.pressureLevel} memoryLimit=${memoryAwareLimit} heap_used=${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  } catch (error) {
    console.error('Error logging queue metrics:', error.message);
  }
};

const startQueueMetrics = () => {
  metricHandle || METRIC_INTERVAL_MS === 0 || (metricHandle = registerTimer(setInterval(logQueueMetrics, METRIC_INTERVAL_MS)));
};

const stopQueueMetrics = () => {
  metricHandle && (clearInterval(metricHandle), activeTimers.delete(metricHandle), metricHandle = null);
};

async function scheduleAnalysis(err, ctx, analyzeErrorFn) {
  const { startAdviceCleanup } = require('./qerrorsCache');
  startAdviceCleanup();
  
  const errorSignature = createErrorSignature(err);
  const signatureId = generateSignatureId(errorSignature);
  
  const { setAdviceInCache } = require('./qerrorsCache');
  const cacheKey = `error_full_${signatureId}`;
  try {
    setAdviceInCache(cacheKey, { error: err, context: ctx, timestamp: Date.now() });
  } catch (cacheError) {
    console.warn('Failed to cache error advice:', cacheError.message);
  }
  
  const idle = limit.activeCount === 0 && limit.pendingCount === 0;
  const total = limit.pendingCount + limit.activeCount;
  const memoryAwareLimit = getMemoryAwareQueueLimit();
  const itemMemoryUsage = estimateSignatureMemoryUsage(errorSignature);
  const memoryPressure = (getCurrentMemoryPressure()?.pressureLevel || 'LOW');
  
  if (total >= memoryAwareLimit) {
    try {
      const { enforceQueueLimit } = require('./queueManager');
      enforceQueueLimit(total, memoryAwareLimit);
    } catch (error) {
      console.warn('Failed to enforce queue limit:', error.message);
    }
    
    const sanitizeNumber = (num) => Math.max(0, parseInt(num) || 0);
    await logAsync('warn', `analysis queue full - memory pressure: ${memoryPressure}, limit: ${memoryAwareLimit}, pending: ${sanitizeNumber(limit.pendingCount)}, active: ${sanitizeNumber(limit.activeCount)}, item memory: ${itemMemoryUsage} bytes`);
    
    return Promise.reject(new Error('queue full due to memory pressure'));
  }
  
  const ABSOLUTE_MAX_QUEUE_SIZE = 200;
  if (total >= ABSOLUTE_MAX_QUEUE_SIZE) {
    await logAsync('error', `queue exceeded absolute maximum size (${total} >= ${ABSOLUTE_MAX_QUEUE_SIZE}), forcing rejection`);
    return Promise.reject(new Error('queue size exceeded absolute maximum'));
  }
  
  if (memoryPressure === 'CRITICAL' && itemMemoryUsage > 10240) {
    await logAsync('warn', `rejecting large item under critical memory pressure - item size: ${itemMemoryUsage} bytes`);
    return Promise.reject(new Error('memory pressure - item too large'));
  }
  
  const run = limit(async () => {
    const fullErrorData = await getFullErrorFromCache(signatureId, errorSignature);
    return await analyzeErrorFn(fullErrorData.error, fullErrorData.context);
  });
  
  if (idle) startQueueMetrics();
  
  run.finally(() => {
    if (limit.activeCount === 0 && limit.pendingCount === 0) stopQueueMetrics();
  });
  
  return run;
}

const getQueueLength = () => limit.pendingCount;

module.exports = {
  scheduleAnalysis,
  getQueueRejectCount,
  getQueueLength,
  startQueueMetrics,
  stopQueueMetrics,
  getMemoryAwareQueueLimit,
  getMemoryStats: () => getCurrentMemoryPressure(),
  cleanupTimers
};
