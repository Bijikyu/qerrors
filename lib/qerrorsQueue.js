'use strict';

const pLimit = require('p-limit').default;
const { CONCURRENCY_LIMIT, QUEUE_LIMIT } = require('./qerrorsConfig');
const config = require('./config');

// Helper function for async logger access
async function logAsync(level, message) {
  try {
    const logger = require('./logger');
    const log = await logger;
    log[level](message);
  } catch (err) {
    console.error("Logger error:", String(err.message || "").substring(0, 100));
  }
}

const limit = pLimit(CONCURRENCY_LIMIT || 5);
let metricHandle = null;

// Shared queue reject count - use the one from queueManager
const getQueueRejectCount = () => {
  const { getQueueRejectCount: managerGetRejectCount } = require('./queueManager');
  return managerGetRejectCount();
};

const METRIC_INTERVAL_MS = config.getInt('QERRORS_METRIC_INTERVAL_MS', 0);

const logQueueMetrics = () => {
  const { getQueueRejectCount: managerGetRejectCount } = require('./queueManager');
  console.log(`metrics queueLength=${limit.pendingCount} queueRejects=${managerGetRejectCount()}`);
};

const startQueueMetrics = () => {
  if (metricHandle || METRIC_INTERVAL_MS === 0) return;
  metricHandle = setInterval(logQueueMetrics, METRIC_INTERVAL_MS);
  metricHandle.unref();
};

const stopQueueMetrics = () => {
  metricHandle && (clearInterval(metricHandle), metricHandle = null);
};

async function scheduleAnalysis(err, ctx, analyzeErrorFn) {
  const { startAdviceCleanup } = require('./qerrorsCache');
  startAdviceCleanup();
  
  const idle = limit.activeCount === 0 && limit.pendingCount === 0;
  const total = limit.pendingCount + limit.activeCount;
  
if (total >= QUEUE_LIMIT) {
    // Increment reject count in queueManager
    const { enforceQueueLimit } = require('./queueManager');
    enforceQueueLimit(total, QUEUE_LIMIT);
    await logAsync('warn', `analysis queue full pending ${limit.pendingCount} active ${limit.activeCount}`);
    return Promise.reject(new Error('queue full'));
  }
  
  const run = limit(() => analyzeErrorFn(err, ctx));
  
  if (idle) startQueueMetrics();
  
  await run.finally(() => {
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
  stopQueueMetrics
};