'use strict';

/**
 * Queue Metrics Module - Centralized Queue Statistics
 * 
 * Purpose: Provides centralized access to queue metrics without creating
 * circular dependencies. This module acts as a bridge between queueManager
 * and other modules that need queue statistics.
 * 
 * Design Rationale:
 * - Breaks circular dependencies by providing metrics without importing qerrors
 * - Thread-safe metrics access
 * - Performance optimized with minimal overhead
 * - Error-safe operation that never throws exceptions
 */

// Import only the queue manager state, not the qerrors module
let stateManager = null;

// Initialize state manager lazily to avoid circular dependencies
const getStateManager = () => {
  if (!stateManager) {
    try {
      const queueManager = require('./queueManager');
      // Access the internal state manager through a backdoor
      stateManager = queueManager._getStateManager?.() || {
        getQueueRejectCount: () => 0,
        getQueueLength: () => 0,
        getActiveCount: () => 0,
        getTotalProcessed: () => 0,
        getAverageProcessingTime: () => 0
      };
    } catch (err) {
      // Fallback to safe defaults if queueManager is not available
      stateManager = {
        getQueueRejectCount: () => 0,
        getQueueLength: () => 0,
        getActiveCount: () => 0,
        getTotalProcessed: () => 0,
        getAverageProcessingTime: () => 0
      };
    }
  }
  return stateManager;
};

/**
 * Get the current queue reject count
 * @returns {number} Number of rejected queue operations
 */
const getQueueRejectCount = () => {
  try {
    return getStateManager().getQueueRejectCount();
  } catch (err) {
    return 0;
  }
};

/**
 * Get the current queue length
 * @returns {number} Number of items currently in queue
 */
const getQueueLength = () => {
  try {
    return getStateManager().getQueueLength();
  } catch (err) {
    return 0;
  }
};

/**
 * Get the number of active processing jobs
 * @returns {number} Number of currently active jobs
 */
const getActiveCount = () => {
  try {
    return getStateManager().getActiveCount();
  } catch (err) {
    return 0;
  }
};

/**
 * Get the total number of processed jobs
 * @returns {number} Total number of jobs processed
 */
const getTotalProcessed = () => {
  try {
    return getStateManager().getTotalProcessed();
  } catch (err) {
    return 0;
  }
};

/**
 * Get the average processing time in milliseconds
 * @returns {number} Average processing time in ms
 */
const getAverageProcessingTime = () => {
  try {
    return getStateManager().getAverageProcessingTime();
  } catch (err) {
    return 0;
  }
};

/**
 * Get comprehensive queue metrics
 * @returns {object} Complete queue metrics object
 */
const getQueueMetrics = () => {
  return {
    rejectCount: getQueueRejectCount(),
    queueLength: getQueueLength(),
    activeCount: getActiveCount(),
    totalProcessed: getTotalProcessed(),
    averageProcessingTime: getAverageProcessingTime()
  };
};

module.exports = {
  getQueueRejectCount,
  getQueueLength,
  getActiveCount,
  getTotalProcessed,
  getAverageProcessingTime,
  getQueueMetrics
};