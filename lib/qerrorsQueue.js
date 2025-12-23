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

// Import memory management for backpressure-aware queue management
const { MemoryMonitor } = require('./memoryManagement');

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
const limit = pLimit(CONCURRENCY_LIMIT || 10); // Increased default concurrency for better scalability

// Memory monitor for backpressure-aware queue management
const memoryMonitor = new MemoryMonitor({
  warningPercent: 60,  // Lower threshold for queue management
  criticalPercent: 75, // Critical threshold for queue rejection
  checkInterval: 2000, // Check memory pressure every 2 seconds
  cleanupInterval: 10000 // Cleanup every 10 seconds under pressure
});

// Start memory monitoring for queue backpressure
memoryMonitor.start();

// Memory-based queue size limits
const MEMORY_BASED_QUEUE_LIMITS = {
  low: QUEUE_LIMIT,           // Normal operation
  medium: Math.floor(QUEUE_LIMIT * 0.7),   // Reduce queue under medium pressure
  high: Math.floor(QUEUE_LIMIT * 0.4),    // Aggressively reduce queue under high pressure
  critical: Math.floor(QUEUE_LIMIT * 0.2)  // Minimal queue under critical pressure
};

/**
 * Get memory-aware queue limit based on current memory pressure
 * 
 * @returns {number} Current queue limit based on memory pressure
 */
const getMemoryAwareQueueLimit = () => {
  const currentPressure = memoryMonitor.getCurrentPressure();
  const limit = MEMORY_BASED_QUEUE_LIMITS[currentPressure] || MEMORY_BASED_QUEUE_LIMITS.low;
  
  // Log memory pressure changes for debugging
  if (currentPressure !== 'low') {
    console.warn(`Memory pressure: ${currentPressure}, queue limit reduced to: ${limit}`);
  }
  
  return limit;
};

/**
 * Estimate memory usage of queued items for backpressure calculation
 * 
 * @param {Error} err - Error object to analyze
 * @param {string} ctx - Context string for the error
 * @returns {number} Estimated memory usage in bytes
 */
const estimateItemMemoryUsage = (err, ctx) => {
  // Base memory overhead for queue item
  let estimatedSize = 1024; // 1KB base overhead
  
  // Add error object size
  if (err && err.message) {
    estimatedSize += err.message.length * 2; // UTF-16 characters
  }
  if (err && err.stack) {
    estimatedSize += err.stack.length * 2;
  }
  
  // Add context size
  if (ctx) {
    estimatedSize += ctx.length * 2;
  }
  
  // Add overhead for promise and queue management
  estimatedSize += 512; // Promise and queue overhead
  
  return estimatedSize;
};

// Memory-based queue size limits
const MEMORY_BASED_QUEUE_LIMITS = {
  low: QUEUE_LIMIT,           // Normal operation
  medium: Math.floor(QUEUE_LIMIT * 0.7),   // Reduce queue under medium pressure
  high: Math.floor(QUEUE_LIMIT * 0.4),    // Aggressively reduce queue under high pressure
  critical: Math.floor(QUEUE_LIMIT * 0.2)  // Minimal queue under critical pressure
};

// Background metrics collection timer handle
// Stored for graceful cleanup and to prevent multiple timers
let metricHandle = null;

// Registry for all active timers to ensure proper cleanup
const activeTimers = new Set();

// Cleanup function for all timers and memory monitor
const cleanupTimers = () => {
  activeTimers.forEach(timer => {
    if (timer && timer.unref) {
      clearInterval(timer);
      timer.unref();
    }
  });
  activeTimers.clear();
  metricHandle = null;
  
  // Stop memory monitor to prevent resource leaks
  if (memoryMonitor) {
    memoryMonitor.stop();
  }
};

// Register timer for cleanup
const registerTimer = (timer) => {
  if (timer) {
    activeTimers.add(timer);
    timer.unref(); // Allow process to exit
  }
  return timer;
};

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
  const memoryStats = memoryMonitor.getMemoryStats();
  const memoryAwareLimit = getMemoryAwareQueueLimit();
  
  console.log(`metrics queueLength=${limit.pendingCount} queueRejects=${managerGetRejectCount()} memoryPressure=${memoryStats.pressure} memoryLimit=${memoryAwareLimit} heapUsed=${Math.round(memoryStats.process.heapUsed / 1024 / 1024)}MB`);
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
  
  // Start periodic metrics collection with proper timer management
  metricHandle = registerTimer(setInterval(logQueueMetrics, METRIC_INTERVAL_MS));
};

/**
 * Stop background queue metrics collection
 * 
 * Gracefully stops the metrics collection timer and resets the handle.
 * This is called during shutdown or when the queue becomes empty
 * to save resources.
 */
const stopQueueMetrics = () => {
  // Proper timer cleanup
  if (metricHandle) {
    clearInterval(metricHandle);
    activeTimers.delete(metricHandle);
    metricHandle = null;
  }
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
  
  // Get memory-aware queue limit based on current memory pressure
  const memoryAwareLimit = getMemoryAwareQueueLimit();
  
  // Estimate memory usage of this item for backpressure calculation
  const itemMemoryUsage = estimateItemMemoryUsage(err, ctx);
  
  // Get current memory statistics for additional backpressure
  const memoryStats = memoryMonitor.getMemoryStats();
  const memoryPressure = memoryStats.pressure;
  
  // Enforce memory-aware queue size limits to prevent memory exhaustion
  if (total >= memoryAwareLimit) {
    // Increment reject count in centralized queue manager for metrics
    const { enforceQueueLimit } = require('./queueManager');
    enforceQueueLimit(total, memoryAwareLimit);
    
    // Log queue overflow with memory pressure context for debugging and monitoring
    const sanitizeNumber = (num) => Math.max(0, parseInt(num) || 0);
    await logAsync('warn', `analysis queue full - memory pressure: ${memoryPressure}, limit: ${memoryAwareLimit}, pending: ${sanitizeNumber(limit.pendingCount)}, active: ${sanitizeNumber(limit.activeCount)}, item memory: ${itemMemoryUsage} bytes`);
    
    // Reject the request - this is handled gracefully by the calling code
    return Promise.reject(new Error('queue full due to memory pressure'));
  }
  
  // Additional memory pressure check - reject if memory is critical regardless of queue size
  if (memoryPressure === 'critical' && itemMemoryUsage > 10240) { // 10KB threshold for critical memory
    await logAsync('warn', `rejecting large item under critical memory pressure - item size: ${itemMemoryUsage} bytes`);
    return Promise.reject(new Error('memory pressure - item too large'));
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
  stopQueueMetrics,    // Stop background metrics collection
  
  // Memory-aware queue management
  getMemoryAwareQueueLimit, // Get current queue limit based on memory pressure
  getMemoryStats: () => memoryMonitor.getMemoryStats(), // Get memory statistics
  cleanupTimers       // Clean up all timers and memory monitor
};