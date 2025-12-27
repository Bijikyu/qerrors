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
const qerrors = require('./qerrors');
const pLimit = require('p-limit').default;

// Global state variables for queue management with memory-efficient limits
let queueRejectCount = 0;        // Track number of rejected queue requests
let adviceCleanupInterval = null; // Interval reference for cache cleanup
let queueMetricsInterval = null;  // Interval reference for metrics logging
let queueSize = 0;               // Track current queue size to prevent unbounded growth
let activeCount = 0;             // Track active operations for concurrency control
let totalProcessed = 0;         // Track total processed operations
let averageProcessingTime = 0;  // Track average processing time with rolling average
const MAX_QUEUE_SIZE = 100;     // Reduced maximum queue size to prevent memory exhaustion
const MAX_METRICS_HISTORY = 1000; // Bound metrics tracking to prevent memory growth

/**
 * Get the current count of rejected queue requests
 */
const getQueueRejectCount = () => queueRejectCount;

/**
 * Get the current queue length for monitoring
 */
const getQueueLength = () => queueSize;

/**
 * Log current queue metrics with error-safe fallback and non-blocking I/O
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
 * - Non-blocking: Uses setImmediate to avoid blocking request processing
 * 
 * @private
 * 
 * Example output:
 * // With Winston logger: [INFO] Queue metrics: rejects=5
 * // With console fallback: Queue metrics: 5
 */
const logQueueMetrics = () => {
  try {
    // Use setImmediate to make logging non-blocking and move out of request path
    setImmediate(() => {
      try {
        // Try to use the application logger first
        require('./logger').then(log => {
          try {
            const message = `Queue metrics: rejects=${queueRejectCount}`;
            log.info(message);
          } catch (logError) {
            qerrors(logError, 'queueManager.logQueueMetrics.logger', {
              operation: 'queue_metrics_logging',
              rejectCount: queueRejectCount
            });
            // Fallback to console logging if logger fails
            console.log('Queue metrics:', queueRejectCount);
          }
        }).catch(loggerError => {
          qerrors(loggerError, 'queueManager.logQueueMetrics.loggerLoad', {
            operation: 'queue_logger_loading',
            rejectCount: queueRejectCount
          });
          // Fallback to console logging if logger fails
          console.log('Queue metrics:', queueRejectCount);
        });
      } catch (error) {
        qerrors(error, 'queueManager.logQueueMetrics.setImmediate', {
          operation: 'queue_metrics_set_immediate',
          rejectCount: queueRejectCount
        });
        // Ultimate fallback - should never reach here but ensures safety
        console.error('Queue metrics logging failed:', error.message);
      }
    });
  } catch (error) {
    qerrors(error, 'queueManager.logQueueMetrics', {
      operation: 'queue_metrics_logging',
      rejectCount: queueRejectCount
    });
  }
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
 * Start automatic cache cleanup for expired advice entries with non-blocking I/O
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
 * - Non-blocking: Cleanup operations run outside request processing paths
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
  try {
    // Get cache TTL from configuration (default: 24 hours)
    const ttl = config.getInt('QERRORS_CACHE_TTL', 86400) * 1000;
    
    // Calculate cleanup interval: 1/4 of TTL, minimum 60 seconds
    const intervalMs = Math.max(ttl / 4, 60000);
    
    try {
      // Prevent creating multiple intervals (idempotent operation)
      if (!adviceCleanupInterval) {
        adviceCleanupInterval = setInterval(() => {
          try {
            // Use setImmediate to move cleanup outside of request processing
            setImmediate(() => {
              try {
                purgeFunction();
              } catch (purgeError) {
                qerrors(purgeError, 'queueManager.startAdviceCleanup.purge', {
                  operation: 'cache_cleanup_purge',
                  intervalMs: intervalMs,
                  ttl: ttl
                });
                console.error('Cache cleanup failed:', purgeError.message);
              }
            });
          } catch (setImmediateError) {
            qerrors(setImmediateError, 'queueManager.startAdviceCleanup.setImmediate', {
              operation: 'cache_cleanup_set_immediate',
              intervalMs: intervalMs
            });
          }
        }, intervalMs);
        // Use unref() to allow process to exit even if cleanup is active
        adviceCleanupInterval.unref();
      }
    } catch (intervalError) {
      qerrors(intervalError, 'queueManager.startAdviceCleanup.interval', {
        operation: 'cache_cleanup_interval_creation',
        intervalMs: intervalMs,
        ttl: ttl
      });
    }
  } catch (error) {
    qerrors(error, 'queueManager.startAdviceCleanup', {
      operation: 'cache_cleanup_startup',
      hasPurgeFunction: !!purgeFunction
    });
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
 * Create a memory-efficient concurrency limiter using p-limit library
 * 
 * This function creates a concurrency limiter that restricts the number
 * of simultaneous operations while preventing memory leaks through
 * bounded metrics tracking and efficient cleanup.
 * 
 * Design Rationale:
 * - Rate limiting: Prevents API rate limit violations
 * - Memory efficiency: Bounded metrics tracking to prevent memory growth
 * - Resource management: Controls concurrent expensive operations
 * - System stability: Prevents overload during traffic spikes
 * - Cost optimization: Limits expensive AI API calls
 * 
 * @param {number} max - Maximum number of concurrent operations allowed
 * @returns {Function} Memory-efficient concurrency limiter function
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

// Limiter pool for reusing instances with same concurrency limits
const limiterPool = new Map();

const createLimiter = (max) => {
  try {
    // Check if we already have a limiter with this concurrency limit
    if (limiterPool.has(max)) {
      return limiterPool.get(max);
    }
    
    try {
      // Create new limiter if not found in pool
      const baseLimiter = pLimit(max);
      let localActiveCount = 0;
      let localTotalProcessed = 0;
      let localAverageProcessingTime = 0;
      const maxMetricsHistory = 1000; // Bound metrics tracking to prevent memory growth
      
      const limiter = async (task) => {
        try {
          // Check queue size limit before accepting new tasks
          if (queueSize >= MAX_QUEUE_SIZE) {
            queueRejectCount++;
            const error = new Error('Queue at capacity - request rejected to prevent memory exhaustion');
            qerrors(error, 'queueManager.createLimiter.capacity', {
              operation: 'queue_capacity_check',
              queueSize: queueSize,
              maxQueueSize: MAX_QUEUE_SIZE,
              maxConcurrency: max
            });
            throw error;
          }
          
          queueSize++;
          const startTime = Date.now();
          activeCount++;
          
          try {
            const result = await baseLimiter(task);
            
            try {
              // Track processing metrics with bounded history
              const processingTime = Date.now() - startTime;
              totalProcessed++;
              
              // Prevent memory growth by limiting metrics history
              if (totalProcessed <= maxMetricsHistory) {
                averageProcessingTime = (averageProcessingTime * (totalProcessed - 1) + processingTime) / totalProcessed;
              } else {
                // Use rolling average for older entries to prevent memory growth
                averageProcessingTime = (averageProcessingTime * 0.99 + processingTime * 0.01);
              }
              
              return result;
            } catch (metricsError) {
              qerrors(metricsError, 'queueManager.createLimiter.metrics', {
                operation: 'queue_metrics_tracking',
                processingTime: Date.now() - startTime,
                totalProcessed: totalProcessed
              });
              throw metricsError;
            }
          } catch (taskError) {
            qerrors(taskError, 'queueManager.createLimiter.task', {
              operation: 'queue_task_execution',
              maxConcurrency: max,
              activeCount: activeCount
            });
            throw taskError;
          } finally {
            activeCount--;
            queueSize = Math.max(0, queueSize - 1); // Prevent negative queue size
          }
        } catch (error) {
          qerrors(error, 'queueManager.createLimiter.execution', {
            operation: 'queue_limiter_execution',
            queueSize: queueSize,
            maxConcurrency: max
          });
          throw error;
        }
      };
      
      // Store the created limiter in pool for reuse
      limiterPool.set(max, limiter);
      return limiter;
    } catch (creationError) {
      qerrors(creationError, 'queueManager.createLimiter.creation', {
        operation: 'queue_limiter_creation',
        maxConcurrency: max
      });
      throw creationError;
    }
  } catch (error) {
    qerrors(error, 'queueManager.createLimiter', {
      operation: 'queue_limiter_setup',
      maxConcurrency: max
    });
    throw error;
  }
};
  
  // Store the created limiter in the pool for reuse
  limiterPool.set(max, limiter);
  return limiter;
};

/**
 * Get queue performance metrics
 */
const getQueueMetrics = () => {
  return {
    rejectCount: queueRejectCount,
    activeCount: activeCount || 0,
    totalProcessed: totalProcessed || 0,
    averageProcessingTime: averageProcessingTime || 0,
    queueSize: queueSize,
    maxQueueSize: MAX_QUEUE_SIZE
  };
};

// Export all queue management functions for use in other modules
module.exports = {
  // Concurrency control
  createLimiter,
  
  // Queue metrics and monitoring
  getQueueRejectCount,
  getQueueMetrics,
  logQueueMetrics,
  startQueueMetrics,
  stopQueueMetrics,
  
  // Cache management
  startAdviceCleanup,
  stopAdviceCleanup,
  
  // Queue enforcement
  enforceQueueLimit
};