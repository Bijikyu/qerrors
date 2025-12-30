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

// Simple memory monitor to avoid circular dependency
class SimpleMemoryMonitor {
  constructor(options = {}) {
    this.warningPercent = options.warningPercent || 60;
    this.criticalPercent = options.criticalPercent || 75;
    this.checkInterval = options.checkInterval || 5000;
    this.cleanupInterval = options.cleanupInterval || 30000;
    this.isHighMemoryUsage = false;
  }

  checkMemoryUsage() {
    const usage = process.memoryUsage();
    const heapTotal = usage.heapTotal > 0 ? usage.heapTotal : 1;
    const heapUsedPercent = (usage.heapUsed / heapTotal) * 100;
    
    // Simplified memory pressure calculation
    if (heapUsedPercent > this.criticalPercent) {
      this.isHighMemoryUsage = true;
      return { level: 'critical', percent: heapUsedPercent };
    } else if (heapUsedPercent > this.warningPercent) {
      this.isHighMemoryUsage = true;
      return { level: 'warning', percent: heapUsedPercent };
    } else {
      this.isHighMemoryUsage = false;
      return { level: 'normal', percent: heapUsedPercent };
    }
  }

  triggerCleanup() {
    if (global.gc) {
      global.gc();
    }
  }

  start() {
    // Reduced frequency memory check
    this.interval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkInterval * 2); // Double the interval
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

const memoryMonitor = new SimpleMemoryMonitor({
  warningPercent: 60,  // Lower threshold for queue management
  criticalPercent: 75, // Critical threshold for queue rejection
  checkInterval: 5000, // Reduced memory pressure check frequency
  cleanupInterval: 30000 // Increased cleanup interval to reduce CPU usage
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
  try {
    const util = require('util');
    
    // Create a simplified representation for size measurement
    const itemRepresentation = {
      error: {
        message: err?.message || '',
        name: err?.name || 'Error',
        code: err?.code,
        // Include limited stack for size estimation
        stackLength: err?.stack ? err.stack.length : 0
      },
      contextLength: ctx ? ctx.length : 0,
      // Count additional properties
      additionalProps: err ? Object.keys(err).filter(key => 
        !['message', 'name', 'stack', 'code'].includes(key)
      ).length : 0
    };
    
    // Use util.inspect to get accurate size estimation
    const inspected = util.inspect(itemRepresentation, {
      depth: 2,
      maxArrayLength: 10,
      maxStringLength: 100
    });
    
    // Calculate base size from inspected string
    let estimatedSize = inspected.length * 2; // UTF-16 approximation
    
    // Add overhead for actual objects not captured in inspection
    estimatedSize += 2048; // Base overhead for Promise, queue management, and object references
    
    // Add more accurate estimation for error stack
    if (err?.stack) {
      estimatedSize += err.stack.length * 2; // Full stack in UTF-16
    }
    
    // Add context size
    if (ctx) {
      estimatedSize += ctx.length * 2;
    }
    
    // Cap the estimation to prevent unrealistic values
    return Math.min(Math.max(estimatedSize, 1024), 10 * 1024 * 1024); // Between 1KB and 10MB
    
  } catch (error) {
    // Fallback to rough estimation if util.inspect fails
    console.warn('Error in accurate memory estimation, using fallback:', error.message);
    
    let estimatedSize = 1024; // 1KB base overhead
    
    if (err && err.message) {
      estimatedSize += err.message.length * 2;
    }
    if (err && err.stack) {
      estimatedSize += err.stack.length * 2;
    }
    if (ctx) {
      estimatedSize += ctx.length * 2;
    }
    
    estimatedSize += 512; // Promise and queue overhead
    
    return estimatedSize;
  }
};

/**
 * Create minimal error signature for queue storage
 * 
 * This function extracts only the essential information needed to identify
 * and retrieve the full error object from cache, dramatically reducing memory
 * usage in the queue while maintaining full functionality.
 */
const createErrorSignature = (err) => {
  return {
    message: err.message ? err.message.substring(0, 200) : '',
    name: err.name ? err.name.substring(0, 50) : 'Error',
    code: err.code || '',
    timestamp: err.timestamp || Date.now(),
    // Create a hash of the stack trace for similarity detection
    stackHash: err.stack ? createStackHash(err.stack) : ''
  };
};

/**
 * Generate unique signature ID for cache lookup
 */
const generateSignatureId = (signature) => {
  const crypto = require('crypto');
  const signatureString = `${signature.name}:${signature.message}:${signature.code}:${signature.stackHash}`;
  return crypto.createHash('sha256').update(signatureString).digest('hex').substring(0, 16);
};

/**
 * Create hash of stack trace for similarity detection
 */
const createStackHash = (stack) => {
  if (!stack) return '';
  
  // Validate and sanitize stack trace before processing
  if (!stack || typeof stack !== 'string') {
    return 'unknown-error';
  }
  
  // Limit stack trace length to prevent memory issues
  const maxStackLength = 1000;
  const sanitizedStack = stack.length > maxStackLength 
    ? stack.substring(0, maxStackLength) + '...[truncated]'
    : stack;
  
  // Extract only the first few lines for hashing
  const stackLines = sanitizedStack.split('\n').slice(0, 5);
  
  // Remove potential injection characters and normalize
  const normalizedLines = stackLines.map(line => {
    // Remove null bytes and control characters
    const cleanLine = line.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    // Trim and replace line numbers with N
    return cleanLine.trim().replace(/\d+/, 'N');
  });
  
  const normalizedStack = normalizedLines.join('|');
  
  const crypto = require('crypto');
  return crypto.createHash('md5').update(normalizedStack).digest('hex').substring(0, 8);
};

/**
 * Estimate memory usage of error signature (much smaller than full error)
 */
const estimateSignatureMemoryUsage = (signature) => {
  let estimatedSize = 256; // Base overhead for signature object
  
  // Add signature field sizes
  estimatedSize += (signature.message || '').length * 2;
  estimatedSize += (signature.name || '').length * 2;
  estimatedSize += (signature.code || '').length * 2;
  estimatedSize += (signature.stackHash || '').length * 2;
  estimatedSize += 8; // timestamp
  
  return estimatedSize;
};

/**
 * Retrieve full error object from cache using signature
 */
const getFullErrorFromCache = async (signatureId) => {
  const { getAdviceFromCache } = require('./qerrorsCache');
  const cacheKey = `error_full_${signatureId}`;
  const cached = getAdviceFromCache(cacheKey);
  
  if (cached && cached.error) {
    return cached;
  }
  
  // If not found in cache, reconstruct minimal error from signature
  // This is a fallback to prevent analysis failures
  const error = new Error(signature.message || 'Unknown error');
  error.name = signature.name || 'Error';
  error.code = signature.code;
  error.timestamp = signature.timestamp;
  
  return { error, context: {}, timestamp: Date.now() };
};

// Memory-based queue size limits (already defined above)

// Background metrics collection timer handle
// Stored for graceful cleanup and to prevent multiple timers
let metricHandle = null;

// Simplified timer registry for memory efficiency
class SimpleTimerRegistry {
  constructor(maxSize = 50) { // Reduced size for memory efficiency
    this.timers = [];
    this.maxSize = maxSize;
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000); // Cleanup every 30 seconds
    this.cleanupInterval.unref();
    this.maxAge = 300000; // 5 minutes max age
    this.lastCleanup = Date.now();
  }

  add(timer) {
    if (!timer) return false;
    
    // Remove oldest timer if at capacity
    if (this.timers.length >= this.maxSize) {
      const oldest = this.timers.shift();
      if (oldest) this.clearTimer(oldest);
    }
    
    this.timers.push({
      timer,
      added: Date.now()
    });
    
    return true;
  }

  has(timer) {
    const index = this.timers.findIndex(entry => entry.timer === timer);
    if (index !== -1) {
      // Move to end (most recently used)
      const entry = this.timers.splice(index, 1)[0];
      this.timers.push(entry);
      return true;
    }
    return false;
  }

  delete(timer) {
    const index = this.timers.findIndex(entry => entry.timer === timer);
    if (index !== -1) {
      const removed = this.timers.splice(index, 1)[0];
      this.clearTimer(removed.timer);
      return true;
    }
    return false;
  }

  clearTimer(timer) {
    try {
      if (typeof clearTimeout === 'function') {
        clearTimeout(timer);
      }
      if (timer.unref) {
        timer.unref();
      }
    } catch (err) {
      // Ignore cleanup errors
    }
  }

  cleanup() {
    const now = Date.now();
    
    // Skip cleanup if run too recently
    if (now - this.lastCleanup < 20000) return;
    
    this.lastCleanup = now;
    
    // Remove expired timers
    const expired = this.timers.filter(entry => now - entry.added > this.maxAge);
    expired.forEach(entry => {
      this.delete(entry.timer);
    });
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
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

const activeTimers = new SimpleTimerRegistry(50); // Reduced to 50 active timers for memory efficiency

// Cleanup function for all timers and memory monitor
const cleanupTimers = () => {
  if (activeTimers) {
    activeTimers.destroy();
  }
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
  
  // Create minimal error signature for queue storage
  const errorSignature = createErrorSignature(err);
  const signatureId = generateSignatureId(errorSignature);
  
  // Store full error object in cache for retrieval during analysis
  const { setAdviceInCache, getAdviceFromCache } = require('./qerrorsCache');
  const cacheKey = `error_full_${signatureId}`;
  setAdviceInCache(cacheKey, { error: err, context: ctx, timestamp: Date.now() }).catch(err => {
    console.warn('Failed to cache error advice:', err.message);
  });
  
  // Check if queue is currently idle (no active or pending requests)
  const idle = limit.activeCount === 0 && limit.pendingCount === 0;
  
  // Calculate total queue load (active + pending requests)
  const total = limit.pendingCount + limit.activeCount;
  
  // Get memory-aware queue limit based on current memory pressure
  const memoryAwareLimit = getMemoryAwareQueueLimit();
  
  // Estimate memory usage of signature (much smaller than full error)
  const itemMemoryUsage = estimateSignatureMemoryUsage(errorSignature);
  
  // Get current memory statistics for additional backpressure
  const memoryPressure = memoryMonitor.checkMemoryUsage().level;
  
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
  
  // Additional safety check - enforce absolute maximum queue size
  const ABSOLUTE_MAX_QUEUE_SIZE = 200; // Reduced hard limit to prevent memory exhaustion
  if (total >= ABSOLUTE_MAX_QUEUE_SIZE) {
    await logAsync('error', `queue exceeded absolute maximum size (${total} >= ${ABSOLUTE_MAX_QUEUE_SIZE}), forcing rejection`);
    return Promise.reject(new Error('queue size exceeded absolute maximum'));
  }
  
  // Additional memory pressure check - reject if memory is critical regardless of queue size
  if (memoryPressure === 'critical' && itemMemoryUsage > 10240) { // 10KB threshold for critical memory
    await logAsync('warn', `rejecting large item under critical memory pressure - item size: ${itemMemoryUsage} bytes`);
    return Promise.reject(new Error('memory pressure - item too large'));
  }
  
  // Schedule the analysis through the concurrency limiter with signature-based approach
  // This ensures we don't exceed the configured concurrency limits while minimizing memory usage
  const run = limit(async () => {
    // Retrieve full error object from cache using signature ID
    const fullErrorData = await getFullErrorFromCache(signatureId);
    
    // Call the original analysis function with the full error data
    return await analyzeErrorFn(fullErrorData.error, fullErrorData.context);
  });
  
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