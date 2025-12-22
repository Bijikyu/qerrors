'use strict';

/**
 * Unified Performance Timer Implementation
 * 
 * Purpose: Provides high-precision performance timing for operations with optional
 * memory tracking and integrated logging. This timer uses Node.js's high-resolution
 * timer (process.hrtime.bigint()) for nanosecond precision timing.
 * 
 * Design Rationale:
 * - High precision: Uses process.hrtime.bigint() for accurate timing
 * - Memory awareness: Optional memory usage tracking for performance analysis
 * - Integrated logging: Built-in performance logging with context
 * - Flexible formatting: Multiple output formats for different use cases
 * - Request correlation: Optional request ID for distributed tracing
 * 
 * Use Cases:
 * - API endpoint performance monitoring
 * - Database query timing
 * - External service call timing
 * - Memory leak detection
 * - Performance bottleneck identification
 */

/**
 * Create unified performance timer with comprehensive tracking
 * 
 * Purpose: Creates a timer instance that can track operation duration, optional
 * memory usage, and automatically log performance metrics. The timer provides
 * multiple output formats and integrates with the application's logging system.
 * 
 * @param {string} operation - Human-readable name of the operation being timed
 * @param {boolean} [includeMemoryTracking=false] - Whether to track memory usage changes
 * @param {string} [requestId=null] - Optional request ID for correlation
 * @returns {Object} Timer instance with multiple timing and logging methods
 */
const createUnifiedTimer = (operation, includeMemoryTracking = false, requestId = null) => {
  // Capture start time using high-resolution timer for precision
  const startTime = process.hrtime.bigint();
  // Optionally capture initial memory usage for delta calculations
  const startMemory = includeMemoryTracking ? process.memoryUsage() : null;
  
  /**
   * Timer instance object with comprehensive timing capabilities
   * 
   * This object provides multiple methods for accessing timing data in different
   * formats and automatically logs performance metrics when operations complete.
   */
  return {
    /**
     * Get elapsed time in milliseconds with high precision
     * 
     * Purpose: Returns the exact elapsed time since timer creation using
     * high-resolution timing for accurate performance measurements.
     * 
     * @returns {number} Elapsed time in milliseconds with decimal precision
     */
    elapsed: () => Number(process.hrtime.bigint() - startTime) / 1000000,
    
    /**
     * Get elapsed time in human-readable format
     * 
     * Purpose: Returns elapsed time in the most appropriate unit based on duration.
     * This provides intuitive timing information for logs and debugging.
     * 
     * Format Logic:
     * - < 1000ms: Display in milliseconds (e.g., "123.45ms")
     * - 1000ms-60s: Display in seconds (e.g., "1.23s") 
     * - > 60s: Display in minutes (e.g., "2.34m")
     * 
     * @returns {string} Formatted elapsed time with appropriate unit
     */
    elapsedFormatted: () => {
      const ms = Number(process.hrtime.bigint() - startTime) / 1000000;
      return ms < 1000 ? `${ms.toFixed(2)}ms` : 
             ms < 60000 ? `${(ms / 1000).toFixed(2)}s` : 
             `${(ms / 60000).toFixed(2)}m`;
    },
    
    /**
     * Log performance metrics with comprehensive context
     * 
     * Purpose: Automatically logs operation performance including duration,
     * success status, optional memory usage changes, and additional context.
     * This method integrates with the application's logging system and provides
     * fallback to console logging if the logger is unavailable.
     * 
     * Performance Data Captured:
     * - Operation duration in milliseconds with 2 decimal precision
     * - Success/failure status for operation outcome tracking
     * - Memory usage deltas (if tracking enabled)
     * - Additional context provided by caller
     * - Request correlation ID (if provided)
     * 
     * Error Handling:
     * - Gracefully falls back to console logging if logger fails
     * - Prevents logging errors from affecting application flow
     * - Maintains consistent log format across all logging methods
     * 
     * @param {boolean} [success=true] - Whether the operation completed successfully
     * @param {Object} [additionalContext={}] - Additional context data to include in logs
     * @returns {Promise<Object>} Performance context data with timing and metrics
     */
    logPerformance: async (success = true, additionalContext = {}) => {
      // Capture end time and memory for delta calculations
      const endTime = process.hrtime.bigint();
      const endMemory = includeMemoryTracking ? process.memoryUsage() : null;
      const duration = Number(endTime - startTime) / 1000000;
      
      // Build comprehensive performance context
      const context = {
        operation,
        duration_ms: Math.round(duration * 100) / 100, // Round to 2 decimal places
        success,
        ...additionalContext
      };
      
      // Calculate memory usage deltas if tracking is enabled
      if (includeMemoryTracking && startMemory && endMemory) {
        context.memory_delta = {
          heapUsed: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024),
          external: Math.round((endMemory.external - startMemory.external) / 1024)
        };
      }
      
      // Generate human-readable performance message
      const message = `${operation} completed in ${context.duration_ms}ms (${success ? 'success' : 'failure'})`;
      
      try {
        // Attempt to use application logger with appropriate log level
        const logger = require('../logger');
        if (success) {
          await logger.logInfo(message, context, requestId);
        } else {
          await logger.logWarn(message, context, requestId);
        }
      } catch (err) {
        // Fallback to console logging if application logger fails
        console[success ? 'log' : 'warn'](message, context);
      }
      
      return context;
    }
  };
};

/**
 * Backward compatibility aliases
 * 
 * These aliases maintain compatibility with existing code that uses the older
 * timer creation functions. New code should use createUnifiedTimer directly.
 * 
 * @deprecated Use createUnifiedTimer for new implementations
 */

/**
 * Basic timer without memory tracking
 * 
 * Purpose: Provides a simple timer for basic duration measurement without
 * the overhead of memory tracking. This is useful for quick timing checks
 * where memory usage is not relevant.
 * 
 * @deprecated Use createUnifiedTimer('operation', false) instead
 * @returns {Object} Basic timer instance
 */
const createTimer = () => createUnifiedTimer('operation', false);

/**
 * Performance timer with memory tracking
 * 
 * Purpose: Creates a timer with memory tracking enabled for comprehensive
 * performance analysis. This is useful for identifying memory-related
 * performance issues and resource usage patterns.
 * 
 * @deprecated Use createUnifiedTimer(operation, true, requestId) instead
 * @param {string} operation - Operation name for timing
 * @param {string} [requestId] - Optional request ID for correlation
 * @returns {Object} Performance timer with memory tracking
 */
const createPerformanceTimer = (operation, requestId = null) => createUnifiedTimer(operation, true, requestId);

/**
 * Module exports - Timer utilities
 * 
 * Exports all timer creation functions with clear naming to indicate
 * their specific capabilities and use cases.
 */
module.exports = {
  createUnifiedTimer,
  createTimer,
  createPerformanceTimer
};