'use strict';

const pLimit = require('p-limit').default;
const localVars = require('../config/localVars');
const { CONCURRENCY_LIMIT, QUEUE_LIMIT } = localVars;
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

const limit = pLimit(CONCURRENCY_LIMIT);
let queueRejectCount = 0;
let metricHandle = null;

const METRIC_INTERVAL_MS = config.getInt('QERRORS_METRIC_INTERVAL_MS', 0);

const logQueueMetrics = () => {
  console.log(`metrics queueLength=${limit.pendingCount} queueRejects=${queueRejectCount}`);
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
    queueRejectCount++;
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

const getQueueRejectCount = () => queueRejectCount;
const getQueueLength = () => limit.pendingCount;

module.exports = {
  scheduleAnalysis,
  getQueueRejectCount,
  getQueueLength,
  startQueueMetrics,
  stopQueueMetrics
};