/**
 * Queue management utilities for qerrors module
 *
 * This module provides queue management functionality for handling
 * AI analysis requests with proper rate limiting and metrics.
 */
import { getInt } from './config.js';
// Workaround for TypeScript interface mismatch - use any to bypass incorrect typing
const getIntCorrect = getInt;
import pLimit from 'p-limit';
let queueRejectCount = 0;
let adviceCleanupInterval = null;
let queueMetricsInterval = null;
/**
 * Get the current queue reject count
 * @returns Number of rejected queue requests
 */
export const getQueueRejectCount = () => queueRejectCount;
/**
 * Log queue metrics
 */
const logQueueMetrics = () => {
    import('./logger.js').then((logger) => {
        const message = `Queue metrics: rejects=${queueRejectCount}`;
        logger.info(message);
    }).catch(() => {
        console.log('Queue metrics:', queueRejectCount);
    });
};
/**
 * Start queue metrics logging
 */
export const startQueueMetrics = () => {
    const intervalMs = getIntCorrect('QERRORS_METRIC_INTERVAL_MS', 1000);
    if (!queueMetricsInterval) {
        queueMetricsInterval = setInterval(logQueueMetrics, intervalMs);
        queueMetricsInterval.unref();
    }
};
/**
 * Stop queue metrics logging
 */
export const stopQueueMetrics = () => {
    if (queueMetricsInterval) {
        clearInterval(queueMetricsInterval);
        queueMetricsInterval = null;
    }
};
/**
 * Start advice cleanup interval
 * @param purgeFunction - Function to call for cleanup
 */
export const startAdviceCleanup = (purgeFunction) => {
    const ttl = getIntCorrect('QERRORS_CACHE_TTL', 86400) * 1000;
    const intervalMs = Math.max(ttl / 4, 60000);
    if (!adviceCleanupInterval) {
        adviceCleanupInterval = setInterval(purgeFunction, intervalMs);
        adviceCleanupInterval.unref();
    }
};
/**
 * Stop advice cleanup interval
 */
export const stopAdviceCleanup = () => {
    if (adviceCleanupInterval) {
        clearInterval(adviceCleanupInterval);
        adviceCleanupInterval = null;
    }
};
/**
 * Enforce queue limit
 * @param currentLength - Current queue length
 * @param maxLength - Maximum allowed queue length
 * @returns True if request is allowed, false if rejected
 */
export const enforceQueueLimit = (currentLength, maxLength) => {
    if (currentLength >= maxLength) {
        queueRejectCount++;
        return false;
    }
    return true;
};
/**
 * Create a rate limiter
 * @param max - Maximum concurrent operations
 * @returns pLimit instance
 */
export const createLimiter = (max) => pLimit(max);
//# sourceMappingURL=queueManager.js.map