'use strict';

/**
 * Queue Manager Module - Background Job Processing and Metrics Management
 * 
 * Purpose: Provides comprehensive queue management for the qerrors AI analysis
 * system, including concurrency limiting, metrics collection, cache cleanup,
 * and queue overflow tracking. This module ensures that AI analysis requests
 * are processed efficiently without overwhelming the system or external APIs.
 * 
 * Design Rationale:
 * - Concurrency control: Prevents too many simultaneous AI API calls
 * - Graceful degradation: Handles queue overflow with proper tracking
 * - Performance monitoring: Provides real-time metrics for queue health
 * - Resource management: Automatically cleans up expired cache entries
 * - Cost optimization: Limits expensive AI API calls through queue management
 * - Observability: Enables monitoring and alerting through metrics collection
 * 
 * Key Features:
 * - Configurable concurrency limits using p-limit library
 * - Queue overflow detection and rejection counting
 * - Periodic metrics logging for monitoring
 * - Automatic cache cleanup with configurable intervals
 * - Graceful interval management with unref() to prevent blocking process exit
 * - Error-safe logging with fallback to console when logger unavailable
 */

// Import required dependencies
const config = require('./config');
const localVars = require('../config/localVars');
const pLimit = require('p-limit').default;

// Global state variables for queue management
let queueRejectCount = 0;        // Track number of rejected queue requests
let adviceCleanupInterval = null; // Interval reference for cache cleanup
let queueMetricsInterval = null;  // Interval reference for metrics logging

/**
 * Get the current count of rejected queue requests
 * 
 * This function returns the total number of requests that have been rejected
 * due to queue overflow since the application started. This metric is useful
 * for monitoring queue health and determining if queue limits need to be
 * adjusted for better performance.
 * 
 * @returns {number} Total number of rejected queue requests
 * 
 * Example:
 * const rejectCount = getQueueRejectCount();
 * if (rejectCount > 100) {
 *   console.warn('High queue rejection rate detected:', rejectCount);
 * }
 */
const getQueueRejectCount = () => queueRejectCount;

/**
 * Log current queue metrics with error-safe fallback
 * 
 * This function logs the current queue metrics including the number of
 * rejected requests. It uses the application logger when available,
 * but falls back to console logging if the logger fails to initialize.
 * This error-safe approach ensures that metrics logging never causes
 * additional errors or application failures.
 * 
 * Design Rationale:
 * - Error safety: Never throws errors, always provides some logging output
 * - Graceful degradation: Falls back to console when Winston logger unavailable
 * - Consistent format: Provides structured logging for monitoring systems
 * 
 * @private
 * 
 * Example output:
 * // With Winston logger: [INFO] Queue metrics: rejects=5
 * // With console fallback: Queue metrics: 5
 */
const logQueueMetrics = () => {
  // Try to use the application logger first
  require('./logger').then(log => {
    const message = `Queue metrics: rejects=${queueRejectCount}`;
    log.info(message);
  }).catch(() => {
    // Fallback to console logging if logger fails
    console.log('Queue metrics:', queueRejectCount);
  });
};

/**
 * Start periodic queue metrics logging
 * 
 * This function begins periodic logging of queue metrics at a configurable
 * interval. The metrics logging helps monitor queue health and performance
 * over time. The interval is configured via QERRORS_METRIC_INTERVAL_MS
 * environment variable, with a sensible default if not specified.
 * 
 * Key Features:
 * - Configurable interval via environment variable
 * - Prevents duplicate interval creation (idempotent)
 * - Uses unref() to prevent blocking process exit
 * - Error-safe logging with fallback mechanisms
 * 
 * Environment Variables:
 * - QERRORS_METRIC_INTERVAL_MS: Logging interval in milliseconds (default: 1000)
 * 
 * @returns {void}
 * 
 * Example:
 * // Start metrics logging with default 1-second interval
 * startQueueMetrics();
 * 
 * // Configure custom 30-second interval via environment
 * // QERRORS_METRIC_INTERVAL_MS=30000 node app.js
 */
const startQueueMetrics = () => {
  const intervalMs = config.getInt('QERRORS_METRIC_INTERVAL_MS', 1000);
  
  // Prevent creating multiple intervals (idempotent operation)
  if (!queueMetricsInterval) {
    queueMetricsInterval = setInterval(logQueueMetrics, intervalMs);
    // Use unref() to allow process to exit even if interval is active
    queueMetricsInterval.unref();
  }
};

/**
 * Stop periodic queue metrics logging
 * 
 * This function stops the periodic metrics logging interval and cleans up
 * the interval reference. This is useful for graceful shutdown scenarios
 * or when you want to temporarily disable metrics logging. The function
 * is idempotent and safe to call multiple times.
 * 
 * Use Cases:
 * - Graceful application shutdown
 * - Temporary metrics logging suspension
 * - Resource cleanup during testing
 * - Dynamic metrics control based on environment
 * 
 * @returns {void}
 * 
 * Example:
 * // During application shutdown
 * process.on('SIGTERM', () => {
 *   stopQueueMetrics();
 *   stopAdviceCleanup();
 *   process.exit(0);
 * });
 */
const stopQueueMetrics = () => {
  if (queueMetricsInterval) {
    clearInterval(queueMetricsInterval);
    queueMetricsInterval = null;
  }
};

/**
 * Start automatic cache cleanup for expired advice entries
 * 
 * This function begins periodic cleanup of expired AI advice cache entries.
 * The cleanup interval is calculated based on the cache TTL (time-to-live)
 * setting, with a minimum interval of 60 seconds to prevent excessive
 * cleanup operations. This ensures that expired cache entries are removed
 * to free memory and maintain cache performance.
 * 
 * Design Rationale:
 * - Memory management: Prevents memory leaks from expired cache entries
 * - Performance optimization: Maintains cache efficiency by removing stale data
 * - Configurable frequency: Cleanup interval based on TTL with sensible minimum
 * - Resource efficiency: Uses unref() to prevent blocking process exit
 * 
 * Environment Variables:
 * - QERRORS_CACHE_TTL: Cache entry TTL in seconds (default: 86400 = 24 hours)
 * 
 * @param {Function} purgeFunction - Function to call for cache cleanup
 * @returns {void}
 * 
 * Example:
 * // Start cleanup with default TTL-based interval
 * startAdviceCleanup(clearAdviceCache);
 * 
 * // With custom TTL (6 hours = 21600 seconds)
 * // QERRORS_CACHE_TTL=21600 node app.js
 * // Cleanup will run every max(21600/4, 60) = 3600 seconds (1 hour)
 */
const startAdviceCleanup = (purgeFunction) => {
  // Get cache TTL from configuration (default: 24 hours)
  const ttl = config.getInt('QERRORS_CACHE_TTL', 86400) * 1000;
  
  // Calculate cleanup interval: 1/4 of TTL, minimum 60 seconds
  const intervalMs = Math.max(ttl / 4, 60000);
  
  // Prevent creating multiple intervals (idempotent operation)
  if (!adviceCleanupInterval) {
    adviceCleanupInterval = setInterval(purgeFunction, intervalMs);
    // Use unref() to allow process to exit even if cleanup is active
    adviceCleanupInterval.unref();
  }
};

/**
 * Stop automatic cache cleanup
 * 
 * This function stops the periodic cache cleanup interval and cleans up
 * the interval reference. This is useful for graceful shutdown scenarios
 * or when you want to temporarily disable automatic cache cleanup.
 * The function is idempotent and safe to call multiple times.
 * 
 * Use Cases:
 * - Graceful application shutdown
 * - Temporary cleanup suspension during maintenance
 * - Resource cleanup during testing
 * - Dynamic cleanup control based on application state
 * 
 * @returns {void}
 * 
 * Example:
 * // During graceful shutdown
 * const shutdown = () => {
 *   console.log('Stopping background processes...');
 *   stopQueueMetrics();
 *   stopAdviceCleanup();
 *   console.log('Background processes stopped');
 *   process.exit(0);
 * };
 * 
 * process.on('SIGINT', shutdown);
 * process.on('SIGTERM', shutdown);
 */
const stopAdviceCleanup = () => {
  if (adviceCleanupInterval) {
    clearInterval(adviceCleanupInterval);
    adviceCleanupInterval = null;
  }
};

/**
 * Enforce queue size limits and track overflow rejections
 * 
 * This function checks if the current queue length exceeds the maximum
 * allowed length. If the queue is full, it increments the rejection counter
 * and returns false to indicate that the request should be rejected.
 * This mechanism prevents unlimited queue growth and provides metrics
 * for monitoring queue overflow situations.
 * 
 * Design Rationale:
 * - Resource protection: Prevents memory exhaustion from unlimited queue growth
 * - Performance monitoring: Tracks rejection metrics for capacity planning
 * - Graceful degradation: Rejects requests instead of crashing when overloaded
 * - Cost control: Limits expensive AI API calls during high load
 * 
 * @param {number} currentLength - Current number of items in the queue
 * @param {number} maxLength - Maximum allowed queue length
 * @returns {boolean} True if request can be queued, false if should be rejected
 * 
 * Example:
 * const canQueue = enforceQueueLimit(currentQueueSize, maxQueueSize);
 * if (!canQueue) {
 *   console.log('Queue full, rejecting request');
 *   // Return appropriate error response
 *   return res.status(429).json({ error: 'Service temporarily unavailable' });
 * }
 * 
 * // Queue the request
 * queue.add(processRequest);
 */
const enforceQueueLimit = (currentLength, maxLength) => {
  if (currentLength >= maxLength) {
    // Increment rejection counter for monitoring
    queueRejectCount++;
    return false; // Reject the request
  }
  return true; // Allow the request to be queued
};

/**
 * Create a concurrency limiter using p-limit library
 * 
 * This function creates a concurrency limiter that restricts the number
 * of simultaneous operations that can run at once. This is essential for
 * controlling access to expensive resources like AI APIs, preventing
 * rate limiting, and managing system load during high traffic periods.
 * 
 * Design Rationale:
 * - Rate limiting: Prevents API rate limit violations
 * - Resource management: Controls concurrent expensive operations
 * - System stability: Prevents overload during traffic spikes
 * - Cost optimization: Limits expensive AI API calls
 * 
 * @param {number} max - Maximum number of concurrent operations allowed
 * @returns {Function} Concurrency limiter function from p-limit
 * 
 * Example:
 * // Create limiter for max 5 concurrent AI analysis requests
 * const analysisLimiter = createLimiter(5);
 * 
 * // Use the limiter to control concurrent operations
 * const requests = data.map(item => 
 *   analysisLimiter(() => analyzeWithAI(item))
 * );
 * 
 * // Only 5 requests will run simultaneously, others will wait
 * const results = await Promise.all(requests);
 */
const createLimiter = (max) => pLimit(max);

// Export all queue management functions for use in other modules
module.exports = {
  // Concurrency control
  createLimiter,
  
  // Queue metrics and monitoring
  getQueueRejectCount,
  logQueueMetrics,
  startQueueMetrics,
  stopQueueMetrics,
  
  // Cache management
  startAdviceCleanup,
  stopAdviceCleanup,
  
  // Queue enforcement
  enforceQueueLimit
};