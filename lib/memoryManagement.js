/**
 * Memory Management Module - Bounded Data Structures and Resource Control
 * 
 * Purpose: Provides a comprehensive collection of memory-efficient data structures
 * that prevent unbounded memory growth and ensure predictable resource usage.
 * This module serves as a centralized export point for all bounded data structures
 * used throughout the qerrors system.
 * 
 * Design Rationale:
 * - Memory safety: Prevents memory exhaustion through bounded collections
 * - Performance optimization: Uses efficient algorithms for common operations
 * - Predictable resource usage: Ensures memory usage stays within defined limits
 * - Unified interface: Provides consistent API across different data structure types
 * - Backward compatibility: Maintains existing exports while providing new unified structures
 * 
 * Key Features:
 * - Circular buffers with fixed capacity and automatic overflow handling
 * - LRU caches with size limits and automatic eviction policies
 * - Bounded queues that prevent unlimited growth
 * - Bounded sets with cardinality limits
 * - Unified factory methods for creating optimized data structures
 * - Thread-safe operations for concurrent environments
 */

'use strict';

// Import qerrors for potential error logging in data structures
const qerrors = require('./qerrors');

/**
 * Import unified data structures to replace duplicate implementations
 * 
 * The unified data structures provide consistent behavior and optimized
 * performance across the entire application. They replace older duplicate
 * implementations while maintaining backward compatibility.
 */
const { UnifiedCircularBuffer, BufferFactory } = require('./shared/dataStructures');

/**
 * Import existing shared data structures
 * 
 * These are specialized bounded data structures that provide specific
 * functionality for different use cases within the qerrors system.
 * Each structure is optimized for memory efficiency and performance.
 */
const BoundedLRUCache = require('./shared/BoundedLRUCache');
const BoundedQueue = require('./shared/BoundedQueue');
const BoundedSet = require('./shared/BoundedSet');

/**
 * Backward compatibility export
 * 
 * The CircularBuffer name is maintained for backward compatibility with
 * existing code that uses the old name. Internally it uses the new unified
 * implementation for better performance and consistency.
 */
const CircularBuffer = UnifiedCircularBuffer;

/**
 * Module exports - Complete memory management toolkit
 * 
 * This module exports all bounded data structures needed for memory-safe
 * operations throughout the qerrors system. The exports are organized to
 * provide both backward compatibility and access to new unified implementations.
 */
module.exports = {
  /**
   * Unified Circular Buffer - Primary implementation for fixed-size buffers
   * 
   * This is the recommended circular buffer implementation that provides
   * consistent behavior, optimized performance, and comprehensive features.
   * It automatically handles overflow by overwriting the oldest data.
   * 
   * Use Cases:
   * - Log message buffering with fixed size limits
   * - Metrics collection with rolling windows
   * - Event streaming with bounded memory usage
   * - Performance data with automatic cleanup
   * 
   * @example
   * const { CircularBuffer } = require('./memoryManagement');
   * const buffer = new CircularBuffer(100); // 100 item capacity
   * buffer.push({ timestamp: Date.now(), data: 'sample' });
   */
  CircularBuffer,
  
  /**
   * LRU Cache - Least Recently Used cache with size limits
   * 
   * Provides automatic eviction of least recently used items when the
   * cache reaches its maximum size. Ideal for caching frequently accessed
   * data with memory constraints.
   * 
   * Use Cases:
   * - API response caching with memory limits
   * - Computation result caching
   * - Database query result caching
   * - Configuration data caching
   * 
   * @example
   * const { BoundedLRUCache } = require('./memoryManagement');
   * const cache = new BoundedLRUCache(50); // 50 item limit
   * cache.set('key', { data: 'value' });
   * const value = cache.get('key');
   */
  BoundedLRUCache,
  
  /**
   * Bounded Queue - Queue with fixed maximum size
   * 
   * Implements a queue data structure that prevents unlimited growth
   * by either rejecting new items when full or removing the oldest items.
   * Useful for task queues and message processing systems.
   * 
   * Use Cases:
   * - Task queues with memory limits
   * - Message processing pipelines
   * - Event processing with backpressure
   * - Request throttling systems
   * 
   * @example
   * const { BoundedQueue } = require('./memoryManagement');
   * const queue = new BoundedQueue(25); // 25 item limit
   * queue.enqueue({ task: 'process', data: 'sample' });
   * const item = queue.dequeue();
   */
  BoundedQueue,
  
  /**
   * Bounded Set - Set with fixed maximum cardinality
   * 
   * Provides set functionality with a maximum number of unique items.
   * When the limit is reached, new items can either be rejected or cause
   * eviction of existing items based on configurable policies.
   * 
   * Use Cases:
   * - Unique request tracking with memory limits
   * - User session management
   * - Deduplication systems with bounded memory
   * - Feature flag user tracking
   * 
   * @example
   * const { BoundedSet } = require('./memoryManagement');
   * const set = new BoundedSet(100); // 100 unique item limit
   * set.add('unique-item-1');
   * set.add('unique-item-2');
   * const hasItem = set.has('unique-item-1');
   */
  BoundedSet,
  
  /**
   * Buffer Factory - Factory methods for creating optimized buffers
   * 
   * Provides convenient factory methods for creating different types
   * of unified buffers with pre-configured settings for common use cases.
   * This is the recommended way to create new buffer instances.
   * 
   * Use Cases:
   * - Log buffers with optimized settings for logging
   * - Metric buffers with performance-optimized settings
   * - Event buffers with high-throughput settings
   * - Custom buffers with application-specific settings
   * 
   * @example
   * const { BufferFactory } = require('./memoryManagement');
   * const logBuffer = BufferFactory.createLogBuffer(500);
   * const metricBuffer = BufferFactory.createMetricBuffer(1000);
   */
  BufferFactory,
  
  /**
   * Unified Circular Buffer - Advanced circular buffer implementation
   * 
   * This is the full-featured circular buffer implementation that provides
   * comprehensive functionality including statistics, metrics, and advanced
   * configuration options. Use this when you need full control over buffer
   * behavior and detailed monitoring capabilities.
   * 
   * Use Cases:
   * - High-performance buffering with detailed metrics
   * - Advanced monitoring and statistics collection
   * - Custom buffer behavior configuration
   * - Performance-critical applications
   * 
   * @example
   * const { UnifiedCircularBuffer } = require('./memoryManagement');
   * const buffer = new UnifiedCircularBuffer(200, {
   *   enableMetrics: true,
   *   trackStatistics: true
   * });
   */
  UnifiedCircularBuffer
};