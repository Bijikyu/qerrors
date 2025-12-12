/**
 * Queue Management Utilities for qerrors
 * 
 * This module handles concurrency limiting, queue metrics, and background
 * task management for AI analysis operations. Provides centralized queue
 * management with monitoring and health tracking capabilities.
 * 
 * Design rationale:
 * - Centralized queue logic separates concerns from main error handling
 * - Concurrency limiting prevents resource exhaustion
 * - Metrics collection enables monitoring and alerting
 * - Background cleanup tasks maintain system health
 * - Configurable limits adapt to different deployment environments
 */

const config = require('./config'); //load configuration utilities
const pLimit = require('p-limit').default; //concurrency limiter with identical API

let queueRejectCount = 0; //track rejected queue operations for monitoring
let adviceCleanupInterval = null; //track cleanup interval for lifecycle management
let queueMetricsInterval = null; //track metrics interval for lifecycle management



/**
 * Queue Length Monitoring
 * 
 * Purpose: Provides visibility into queue depth for monitoring and alerting
 */
const getQueueRejectCount = () => queueRejectCount;

/**
 * Queue Metrics Logging
 * 
 * Purpose: Periodically logs queue health metrics for monitoring
 */
const logQueueMetrics = () => require('./logger').then(log => log.info(`Queue metrics: rejects=${queueRejectCount}`));

const startQueueMetrics = () => {
  const intervalMs = config.getInt('QERRORS_METRIC_INTERVAL_MS', 1000);
  !queueMetricsInterval && (queueMetricsInterval = setInterval(logQueueMetrics, intervalMs));
};

const stopQueueMetrics = () => { queueMetricsInterval && (clearInterval(queueMetricsInterval), queueMetricsInterval = null); };

/**
 * Advice Cache Cleanup Management
 * 
 * Purpose: Manages periodic cleanup of expired cache entries
 */
const startAdviceCleanup = purgeFunction => {
  const ttl = config.getInt('QERRORS_CACHE_TTL', 86400) * 1000;
  const intervalMs = Math.max(ttl / 4, 60000);
  !adviceCleanupInterval && (adviceCleanupInterval = setInterval(purgeFunction, intervalMs));
};

const stopAdviceCleanup = () => { adviceCleanupInterval && (clearInterval(adviceCleanupInterval), adviceCleanupInterval = null); };

/**
 * Queue Limit Enforcement
 * 
 * Purpose: Enforces queue size limits and increments reject counters
 */
const enforceQueueLimit = (currentLength, maxLength) => currentLength >= maxLength ? (queueRejectCount++, false) : true;

/**
 * Concurrency Limiter Factory
 * 
 * Purpose: Creates p-limit instances with consistent API
 */
const createLimiter = max => pLimit(max);

module.exports = { createLimiter, getQueueRejectCount, logQueueMetrics, startQueueMetrics, stopQueueMetrics, startAdviceCleanup, stopAdviceCleanup, enforceQueueLimit };