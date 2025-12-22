'use strict';

/**
 * AI Analysis Queue Management Module - Asynchronous Processing with Concurrency Control
 * 
 * Purpose: Provides intelligent queue management for AI-powered error analysis to
 * ensure fast application responses while preventing resource exhaustion. This module
 * handles the complex coordination between error occurrence, AI analysis, and
 * resource management through sophisticated queuing and concurrency control.
 * 
 * Key Design Principles:
 * - Non-blocking: Error responses are never delayed by AI analysis
 * - Concurrency Control: Limits simultaneous AI API calls to prevent rate limiting
 * - Queue Management: Prevents memory exhaustion through queue size limits
 * - Metrics Collection: Provides visibility into queue performance and health
 * - Graceful Degradation: Queue overflows are handled without breaking the application
 * 
 * Economic Model:
 * - Concurrency limits prevent expensive API rate limit charges
 * - Queue size limits control memory usage for pending analysis
 * - Metrics enable cost optimization and performance tuning
 * - Background processing ensures user experience is never impacted
 * 
 * Architecture Overview:
 * - Uses p-limit library for sophisticated concurrency control
 * - Integrates with queueManager for shared metrics and limit enforcement
 * - Provides automatic metrics collection with configurable intervals
 * - Handles queue overflow scenarios with proper error tracking
 */

// Import p-limit for advanced concurrency control and queue management
const pLimit = require('p-limit').default;

// Import configuration values for queue and concurrency limits
const { CONCURRENCY_LIMIT, QUEUE_LIMIT } = require('./qerrorsConfig');
const config = require('./config');

/**
 * Helper function for async logger access with error-safe fallback
 * 
 * This function handles the asynchronous nature of the logger module and provides
 * a graceful fallback if the logger fails. This prevents queue operations from
 * causing additional errors when the logging system is unavailable.
 * 
 * @param {string} level - Log level (error, warn, info, debug, etc.)
 * @param {Object|string} message - Message to log
 */
async function logAsync(level, message) {
  try {
    // Await the logger module which may be initialized asynchronously
    const logger = require('./logger');
    const log = await logger;
    log[level](message);
  } catch (err) {
    // Fallback to console if logger fails - truncate to prevent log spam
    console.error("Logger error:", String(err.message || "").substring(0, 100));
  }
}

/**
 * Concurrency limiter for AI analysis requests
 * 
 * This p-limit instance controls how many AI analysis requests can run
 * simultaneously. This is critical for preventing API rate limiting and
 * controlling costs associated with AI API usage.
 * 
 * Configuration:
 * - Uses CONCURRENCY_LIMIT from configuration (default: 5)
 * - Limits both active and pending requests to prevent resource exhaustion
 * - Provides queue metrics for monitoring and optimization
 */
const limit = pLimit(CONCURRENCY_LIMIT || 5);

// Background metrics collection timer handle
// Stored for graceful cleanup and to prevent multiple timers
let metricHandle = null;

/**
 * Get queue reject count from centralized queue manager
 * 
 * This function delegates to the queueManager module to get the shared
 * reject count. This ensures that all queue-related metrics are
 * centralized and consistent across the application.
 * 
 * @returns {number} Total number of rejected queue requests
 */
const getQueueRejectCount = () => {
  const { getQueueRejectCount: managerGetRejectCount } = require('./queueManager');
  return managerGetRejectCount();
};

// Metrics collection interval configuration
// 0 disables metrics, positive values enable periodic logging
const METRIC_INTERVAL_MS = config.getInt('QERRORS_METRIC_INTERVAL_MS', 0);

/**
 * Log current queue metrics for monitoring and debugging
 * 
 * This function provides visibility into queue performance by logging
 * the current queue length and reject count. It's called periodically
 * by the metrics timer to enable monitoring of queue health.
 * 
 * Metrics Logged:
 * - queueLength: Number of pending analysis requests
 * - queueRejects: Total number of rejected requests due to queue overflow
 */
const logQueueMetrics = () => {
  const { getQueueRejectCount: managerGetRejectCount } = require('./queueManager');
  console.log(`metrics queueLength=${limit.pendingCount} queueRejects=${managerGetRejectCount()}`);
};

/**
 * Start background queue metrics collection
 * 
 * This function initiates periodic logging of queue metrics to provide
 * visibility into queue performance and health. The metrics timer
 * is configured to not prevent Node.js from exiting when it's the
 * only active timer.
 * 
 * Safety Features:
 * - Prevents multiple metrics timers from running simultaneously
 * - Only starts if metrics interval is configured (non-zero)
 * - Uses unref() to allow graceful application shutdown
 */
const startQueueMetrics = () => {
  // Prevent starting multiple timers or if metrics are disabled
  if (metricHandle || METRIC_INTERVAL_MS === 0) return;
  
  // Start periodic metrics collection
  metricHandle = setInterval(logQueueMetrics, METRIC_INTERVAL_MS);
  
  // Allow Node.js to exit even if metrics timer is active
  // This prevents the metrics system from keeping the process alive
  metricHandle.unref();
};

/**
 * Stop background queue metrics collection
 * 
 * Gracefully stops the metrics collection timer and resets the handle.
 * This is called during shutdown or when the queue becomes empty
 * to save resources.
 */
const stopQueueMetrics = () => {
  // Only stop if timer handle exists (prevents errors)
  metricHandle && (clearInterval(metricHandle), metricHandle = null);
};

/**
 * Schedule AI analysis with intelligent queue management
 * 
 * This function is the core of the queue system. It schedules AI analysis
 * requests while managing concurrency limits, queue size limits, and
 * metrics collection. The function ensures that error responses are
 * never delayed by AI analysis processing.
 * 
 * Queue Management Strategy:
 * 1. Check if queue is at capacity and reject if full
 * 2. Start metrics collection if queue was previously idle
 * 3. Schedule analysis through concurrency limiter
 * 4. Stop metrics when queue becomes empty
 * 5. Handle all errors gracefully without impacting application flow
 * 
 * @param {Error} err - Error object to analyze
 * @param {string} ctx - Context string for the error
 * @param {Function} analyzeErrorFn - AI analysis function to execute
 * @returns {Promise<Object>} Promise that resolves with analysis results
 * @throws {Error} If queue is full (rejection is handled gracefully by caller)
 */
async function scheduleAnalysis(err, ctx, analyzeErrorFn) {
  // Ensure advice cache cleanup is running when analysis is scheduled
  // This prevents expired cache entries from accumulating
  const { startAdviceCleanup } = require('./qerrorsCache');
  startAdviceCleanup();
  
  // Check if queue is currently idle (no active or pending requests)
  const idle = limit.activeCount === 0 && limit.pendingCount === 0;
  
  // Calculate total queue load (active + pending requests)
  const total = limit.pendingCount + limit.activeCount;
  
  // Enforce queue size limits to prevent memory exhaustion
  if (total >= QUEUE_LIMIT) {
    // Increment reject count in centralized queue manager for metrics
    const { enforceQueueLimit } = require('./queueManager');
    enforceQueueLimit(total, QUEUE_LIMIT);
    
    // Log queue overflow for debugging and monitoring
    const sanitizeNumber = (num) => Math.max(0, parseInt(num) || 0);
    await logAsync('warn', `analysis queue full pending ${sanitizeNumber(limit.pendingCount)} active ${sanitizeNumber(limit.activeCount)}`);
    
    // Reject the request - this is handled gracefully by the calling code
    return Promise.reject(new Error('queue full'));
  }
  
  // Schedule the analysis through the concurrency limiter
  // This ensures we don't exceed the configured concurrency limits
  const run = limit(() => analyzeErrorFn(err, ctx));
  
  // Start metrics collection if queue was previously idle
  // This ensures we only collect metrics when the queue is active
  if (idle) startQueueMetrics();
  
  // Set up cleanup to stop metrics when queue becomes empty
  // This prevents unnecessary resource usage
  await run.finally(() => {
    if (limit.activeCount === 0 && limit.pendingCount === 0) stopQueueMetrics();
  });
  
  return run;
}

/**
 * Get current queue length (number of pending requests)
 * 
 * This function provides visibility into the current queue load
 * for monitoring and debugging purposes. It returns the number
 * of requests that are waiting to be processed.
 * 
 * @returns {number} Number of pending analysis requests in queue
 */
const getQueueLength = () => limit.pendingCount;

/**
 * Module exports - Queue management API
 * 
 * This module provides the complete queue management system for AI analysis.
 * The exports are organized to provide both functional access and
 * monitoring capabilities for the queue system.
 * 
 * Export Categories:
 * - Core Queue Operations: Scheduling and queue management
 * - Monitoring and Metrics: Queue visibility and performance tracking
 * - Queue State: Current queue status and statistics
 */
module.exports = {
  // Core queue operations
  scheduleAnalysis,    // Schedule AI analysis with queue management
  
  // Queue monitoring and metrics
  getQueueRejectCount, // Get total rejected requests count
  getQueueLength,      // Get current pending requests count
  startQueueMetrics,   // Start background metrics collection
  stopQueueMetrics     // Stop background metrics collection
};