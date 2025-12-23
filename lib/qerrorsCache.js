'use strict';

/**
 * AI Advice Cache Management Module
 * 
 * This module provides intelligent caching for AI-generated debugging advice to
 * optimize cost and performance. It uses an LRU (Least Recently Used) cache with
 * configurable TTL (Time To Live) to balance memory usage with cache effectiveness.
 * 
 * Economic Rationale:
 * - AI API calls are expensive and redundant analysis is wasteful
 * - Most production errors are repetitive patterns that benefit from caching
 * - Cache hit rate directly impacts operational costs for AI analysis
 * - Memory usage is controlled through configurable limits and automatic cleanup
 * 
 * Design Principles:
 * - Memory Efficiency: LRU eviction prevents unlimited memory growth
 * - Cost Control: Cache hits prevent expensive API calls
 * - Performance: Fast lookups for cached advice
 * - Graceful Degradation: Cache failures don't break error analysis
 * - Background Cleanup: Expired entries are removed without blocking operations
 */

// Import LRU cache implementation for efficient memory management
const { LRUCache } = require('lru-cache');
// Import cache configuration limits and timing parameters
const { ADVICE_CACHE_LIMIT, CACHE_TTL_SECONDS } = require('./qerrorsConfig');

// Memory monitoring for cache size management
const memoryMonitor = {
  getMemoryUsage: () => {
    const used = process.memoryUsage();
    return {
      heapUsed: used.heapUsed,
      heapTotal: used.heapTotal,
      external: used.external,
      rss: used.rss
    };
  },
  
  getMemoryPressure: () => {
    const usage = process.memoryUsage();
    const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
    
    if (heapUsedPercent > 85) return 'critical';
    if (heapUsedPercent > 70) return 'high';
    if (heapUsedPercent > 50) return 'medium';
    return 'low';
  }
};

/**
 * Memory-aware cache size calculator
 * 
 * Adjusts cache size based on current memory pressure to prevent
 * memory exhaustion while maintaining cache effectiveness.
 */
const calculateMemoryAwareCacheSize = () => {
  const baseLimit = ADVICE_CACHE_LIMIT || 100;
  const memoryPressure = memoryMonitor.getMemoryPressure();
  
  switch (memoryPressure) {
    case 'critical':
      return Math.max(10, Math.floor(baseLimit * 0.1)); // 10% of base limit
    case 'high':
      return Math.max(25, Math.floor(baseLimit * 0.3)); // 30% of base limit
    case 'medium':
      return Math.max(50, Math.floor(baseLimit * 0.6)); // 60% of base limit
    default:
      return Math.min(baseLimit, 1000); // Normal operation, cap at 1000
  }
};

/**
 * Initialize the LRU cache for AI advice with memory-aware sizing
 * 
 * The cache is configured with:
 * - max: Maximum number of entries (dynamically adjusted based on memory pressure)
 * - ttl: Time to live in milliseconds (0 = no expiration)
 * - Memory-aware disposal and size management
 */
let currentCacheSize = calculateMemoryAwareCacheSize();
const cacheTtl = Math.min((CACHE_TTL_SECONDS || 3600) * 1000, 24 * 60 * 60 * 1000); // Cap at 24 hours

const adviceCache = new LRUCache({
  max: currentCacheSize,
  ttl: cacheTtl,
  // Enhanced memory management options for scalability
  allowStale: false,        // Don't return stale entries
  updateAgeOnGet: true,    // Update age on access to extend TTL
  dispose: (key, value) => {
    // Enhanced cleanup callback for when items are evicted
    if (value && typeof value === 'object') {
      // Clear any object references to help GC
      Object.keys(value).forEach(prop => delete value[prop]);
    }
  },
  // Memory management callback
  sizeCalculation: (value, key) => {
    // Estimate memory size for better cache management
    try {
      return JSON.stringify(value).length + (key ? key.length : 0);
    } catch {
      return 1024; // Default 1KB estimate if serialization fails
    }
  }
});

// Background cleanup interval handle - stored for graceful shutdown
let cleanupHandle = null;

/**
 * Starts background cleanup of expired cache entries
 * 
 * This function initiates a periodic cleanup process that removes expired entries
 * from the cache. The cleanup runs in the background and doesn't block application
 * operations. The interval is set to match the TTL to ensure timely cleanup.
 * 
 * Cleanup Strategy:
 * - Runs at TTL intervals to remove expired entries promptly
 * - Uses unref() to allow Node.js to exit if this is the only timer
 * - Prevents multiple cleanup intervals from running simultaneously
 * - Only starts if TTL and cache limits are configured
 */
const startAdviceCleanup = () => {
  // Prevent starting cleanup if not configured or already running
  if (CACHE_TTL_SECONDS === 0 || ADVICE_CACHE_LIMIT === 0 || cleanupHandle) return;
  
  // Set interval to run cleanup at TTL frequency
  cleanupHandle = setInterval(purgeExpiredAdvice, CACHE_TTL_SECONDS * 1000);
  
  // Allow Node.js to exit even if cleanup timer is active
  // This prevents the cache from keeping the process alive
  cleanupHandle.unref();
};

/**
 * Stops background cleanup process
 * 
 * Gracefully stops the cleanup interval and resets the handle.
 * This is called during shutdown or when cache is disabled.
 */
const stopAdviceCleanup = () => {
  // Only stop if cleanup handle exists (prevents errors)
  cleanupHandle && (clearInterval(cleanupHandle), cleanupHandle = null);
};

/**
 * Clears all entries from the advice cache
 * 
 * This function completely empties the cache, which is useful for:
 * - Testing scenarios
 * - Force-refreshing cached advice
 * - Memory cleanup during shutdown
 * 
 * Side Effects:
 * - Stops background cleanup if cache becomes empty
 * - All cached advice is lost and will need to be regenerated
 */
const clearAdviceCache = () => {
  adviceCache.clear();
  
  // Stop cleanup if cache is empty to save resources
  adviceCache.size === 0 && stopAdviceCleanup();
};

/**
 * Manually removes expired entries from the cache
 * 
 * This function triggers the LRU cache's internal cleanup mechanism
 * to remove entries that have exceeded their TTL. It's called:
 * - Periodically by the background cleanup timer
 * - Manually when immediate cleanup is needed
 * 
 * Optimization:
 * - Stops cleanup timer if cache becomes empty to save resources
 * - Only runs if cache is configured with TTL and limits
 */
const purgeExpiredAdvice = () => {
  // Skip if cache is not configured for TTL or has no limits
  if (CACHE_TTL_SECONDS === 0 || ADVICE_CACHE_LIMIT === 0) return;
  
  // LRU cache handles the actual removal of stale entries
  adviceCache.purgeStale();
  
  // Stop cleanup if cache becomes empty after purging
  adviceCache.size === 0 && stopAdviceCleanup();
};

/**
 * Retrieves advice from the cache
 * 
 * Simple wrapper around the LRU cache get operation that provides
 * a clean interface for cache retrieval. Returns undefined if
 * the key doesn't exist or the entry has expired.
 * 
 * @param {string} key - Cache key for the advice
 * @returns {Object|undefined} Cached advice or undefined if not found
 */
const getAdviceFromCache = (key) => {
  return adviceCache.get(key);
};

/**
 * Adjust cache size based on current memory pressure
 * 
 * Dynamically resizes the cache if memory pressure changes to
 * prevent memory exhaustion while maintaining cache effectiveness.
 */
const adjustCacheSize = () => {
  const newCacheSize = calculateMemoryAwareCacheSize();
  
  if (newCacheSize !== currentCacheSize) {
    const oldSize = currentCacheSize;
    currentCacheSize = newCacheSize;
    
    // Resize the cache (LRU cache handles this efficiently)
    adviceCache.max = newCacheSize;
    
    if (newCacheSize < oldSize) {
      console.warn(`Memory pressure detected, reduced cache size from ${oldSize} to ${newCacheSize} entries`);
    } else if (newCacheSize > oldSize) {
      console.info(`Memory pressure low, increased cache size from ${oldSize} to ${newCacheSize} entries`);
    }
  }
};

/**
 * Stores advice in the cache with memory-aware size management
 * 
 * Stores AI-generated advice in the cache with enhanced memory management.
 * Adjusts cache size based on memory pressure and validates entry sizes.
 * 
 * @param {string} key - Cache key (typically SHA256 hash of error signature)
 * @param {Object} advice - AI-generated advice to cache
 */
const setAdviceInCache = (key, advice) => {
  // Only store if cache is configured with limits
  if (ADVICE_CACHE_LIMIT !== 0) {
    // Adjust cache size based on current memory pressure
    adjustCacheSize();
    
    // Validate entry size to prevent memory exhaustion
    let adviceSize;
    try {
      adviceSize = JSON.stringify(advice).length;
    } catch (err) {
      console.warn(`Failed to serialize advice for size check, skipping cache for key: ${key}`);
      return;
    }
    
    // Dynamic max entry size based on memory pressure
    const memoryPressure = memoryMonitor.getMemoryPressure();
    let maxEntrySize = 50 * 1024; // 50KB default
    
    switch (memoryPressure) {
      case 'critical':
        maxEntrySize = 10 * 1024; // 10KB under critical pressure
        break;
      case 'high':
        maxEntrySize = 25 * 1024; // 25KB under high pressure
        break;
      case 'medium':
        maxEntrySize = 35 * 1024; // 35KB under medium pressure
        break;
    }
    
    if (adviceSize > maxEntrySize) {
      console.warn(`Cache entry too large (${adviceSize} bytes > ${maxEntrySize} limit) under ${memoryPressure} memory pressure, skipping cache for key: ${key}`);
      return;
    }
    
    // Additional memory pressure check
    if (memoryPressure === 'critical' && adviceCache.size >= currentCacheSize * 0.8) {
      console.warn(`Cache near capacity under critical memory pressure, evicting oldest entries`);
      // Force eviction of oldest entries
      const evictCount = Math.floor(currentCacheSize * 0.3);
      for (let i = 0; i < evictCount; i++) {
        const oldestKey = adviceCache.findOldestKey();
        if (oldestKey) {
          adviceCache.delete(oldestKey);
        }
      }
    }
    
    adviceCache.set(key, advice);
    
    // Start cleanup timer when first item is added
    // This ensures cleanup only runs when cache is in use
    startAdviceCleanup();
  }
};

/**
 * Get cache statistics including memory-aware metrics
 * 
 * @returns {Object} Cache statistics with memory pressure information
 */
const getCacheStats = () => {
  return {
    size: adviceCache.size,
    maxSize: currentCacheSize,
    memoryPressure: memoryMonitor.getMemoryPressure(),
    memoryUsage: memoryMonitor.getMemoryUsage(),
    hitRate: adviceCache.calculatedSize ? (adviceCache.size / adviceCache.max) * 100 : 0
  };
};

/**
 * Module exports - Cache management API
 * 
 * Provides a comprehensive interface for managing the AI advice cache.
 * The exports are organized by functionality: cleanup operations,
 * cache manipulation, and data access. All operations are designed
 * to be safe and handle edge cases gracefully.
 * 
 * Export Categories:
 * - Cleanup management: start/stop background processes
 * - Cache manipulation: clear, purge operations
 * - Data access: get/set operations for cache entries
 * - Memory management: memory-aware cache operations
 */
module.exports = {
  // Cleanup management functions
  clearAdviceCache,      // Complete cache clearing
  purgeExpiredAdvice,    // Manual expired entry removal
  startAdviceCleanup,    // Start background cleanup
  stopAdviceCleanup,     // Stop background cleanup
  
  // Cache data operations
  getAdviceFromCache,    // Retrieve cached advice
  setAdviceInCache,      // Store advice in cache
  
  // Memory management operations
  adjustCacheSize,       // Adjust cache size based on memory pressure
  getCacheStats,         // Get cache statistics with memory metrics
  calculateMemoryAwareCacheSize // Calculate memory-aware cache size
};