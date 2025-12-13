'use strict';

const config = require('./config');
const pLimit = require('p-limit').default;


let queueRejectCount = 0;
let adviceCleanupInterval = null;
let queueMetricsInterval = null;

const getQueueRejectCount = () => queueRejectCount;

const logQueueMetrics = () => {
  require('./logger').then(log => {
    const message = `Queue metrics: rejects=${queueRejectCount}`;
    log.info(message);
  }).catch(() => {
    console.log('Queue metrics:', queueRejectCount);
  });
};

const startQueueMetrics = () => {
  const intervalMs = config.getInt('QERRORS_METRIC_INTERVAL_MS', 1000);
  if (!queueMetricsInterval) {
    queueMetricsInterval = setInterval(logQueueMetrics, intervalMs);
    queueMetricsInterval.unref();
  }
};

const stopQueueMetrics = () => {
  if (queueMetricsInterval) {
    clearInterval(queueMetricsInterval);
    queueMetricsInterval = null;
  }
};

const startAdviceCleanup = (purgeFunction) => {
  const ttl = config.getInt('QERRORS_CACHE_TTL', 86400) * 1000;
  const intervalMs = Math.max(ttl / 4, 60000);
  if (!adviceCleanupInterval) {
    adviceCleanupInterval = setInterval(purgeFunction, intervalMs);
    adviceCleanupInterval.unref();
  }
};

const stopAdviceCleanup = () => {
  if (adviceCleanupInterval) {
    clearInterval(adviceCleanupInterval);
    adviceCleanupInterval = null;
  }
};

const enforceQueueLimit = (currentLength, maxLength) => {
  if (currentLength >= maxLength) {
    queueRejectCount++;
    return false;
  }
  return true;
};

const createLimiter = (max) => pLimit(max);

module.exports = {
  createLimiter,
  getQueueRejectCount,
  logQueueMetrics,
  startQueueMetrics,
  stopQueueMetrics,
  startAdviceCleanup,
  stopAdviceCleanup,
  enforceQueueLimit
};