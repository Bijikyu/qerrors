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
function getQueueRejectCount() { return queueRejectCount; } //expose reject count

/**
 * Queue Metrics Logging
 * 
 * Purpose: Periodically logs queue health metrics for monitoring
 */
function logQueueMetrics() { //(write queue metrics to logger)
  const logger = require('./logger'); //(load logger for metric output)
  logger.then(log => log.info(`Queue metrics: rejects=${queueRejectCount}`)); //(log current queue state)
}

function startQueueMetrics() { //(begin periodic queue metric logging)
  const intervalMs = config.getInt('QERRORS_METRIC_INTERVAL_MS', 1000); //(configurable metric interval)
  if (!queueMetricsInterval) { queueMetricsInterval = setInterval(logQueueMetrics, intervalMs); } //(start interval if not already running)
}

function stopQueueMetrics() { //(halt metric emission)
  if (queueMetricsInterval) { clearInterval(queueMetricsInterval); queueMetricsInterval = null; } //(clear interval and reset tracker)
}

/**
 * Advice Cache Cleanup Management
 * 
 * Purpose: Manages periodic cleanup of expired cache entries
 */
function startAdviceCleanup(purgeFunction) { //(kick off periodic advice cleanup)
  const ttl = config.getInt('QERRORS_CACHE_TTL', 86400) * 1000; //(convert TTL to milliseconds for interval timing)
  const intervalMs = Math.max(ttl / 4, 60000); //(cleanup every quarter TTL, minimum 1 minute)
  if (!adviceCleanupInterval) { adviceCleanupInterval = setInterval(purgeFunction, intervalMs); } //(start cleanup if not running)
}

function stopAdviceCleanup() { //(stop periodic purge when needed)
  if (adviceCleanupInterval) { clearInterval(adviceCleanupInterval); adviceCleanupInterval = null; } //(clear interval and reset tracker)
}

/**
 * Queue Limit Enforcement
 * 
 * Purpose: Enforces queue size limits and increments reject counters
 */
function enforceQueueLimit(currentLength, maxLength) { //(check if operation should be queued or rejected)
  if (currentLength >= maxLength) {
    queueRejectCount++; //(increment reject counter for monitoring)
    return false; //(reject operation)
  }
  return true; //(allow operation)
}

/**
 * Concurrency Limiter Factory
 * 
 * Purpose: Creates p-limit instances with consistent API
 */
function createLimiter(max) { //create p-limit instance
  return pLimit(max); //return p-limit limiter
}

module.exports = { //(export queue management utilities)
  createLimiter, //(concurrency limiting utility)
  getQueueRejectCount, //(reject count monitoring)
  logQueueMetrics, //(manual metrics logging)
  startQueueMetrics, //(start periodic metrics)
  stopQueueMetrics, //(stop periodic metrics)
  startAdviceCleanup, //(start cache cleanup)
  stopAdviceCleanup, //(stop cache cleanup)
  enforceQueueLimit //(queue limit enforcement)
};