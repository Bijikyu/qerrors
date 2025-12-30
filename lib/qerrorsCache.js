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

// Simplified memory monitoring with cached results
let cachedMemoryPressure = 'medium';
let lastMemoryCheck = 0;
const MEMORY_CHECK_INTERVAL = 10000; // Check memory every 10 seconds

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
    const now = Date.now();
    
    // Return cached result if within interval
    if (cachedMemoryPressure && (now - lastMemoryCheck) < MEMORY_CHECK_INTERVAL) {
      return cachedMemoryPressure;
    }
    
    // Calculate new memory pressure
    const usage = process.memoryUsage();
    const heapUsedPercent = usage.heapTotal > 0 ? (usage.heapUsed / usage.heapTotal) * 100 : 0;
    
    if (heapUsedPercent > 85) {
      cachedMemoryPressure = 'critical';
    } else if (heapUsedPercent > 70) {
      cachedMemoryPressure = 'high';
    } else if (heapUsedPercent > 50) {
      cachedMemoryPressure = 'medium';
    } else {
      cachedMemoryPressure = 'low';
    }
    
    lastMemoryCheck = now;
    return cachedMemoryPressure;
  }
};

/**
 * Memory-aware cache size calculator
 * 
 * Adjusts cache size based on current memory pressure to prevent
 * memory exhaustion while maintaining cache effectiveness.
 */
const calculateMemoryAwareCacheSize = () => {
  const baseLimit = Math.min(ADVICE_CACHE_LIMIT || 50, 200); // Reduced base limit and cap
  const memoryPressure = memoryMonitor.getMemoryPressure();
  
  switch (memoryPressure) {
    case 'critical':
      return Math.max(5, Math.floor(baseLimit * 0.1)); // 10% of base limit, minimum 5
    case 'high':
      return Math.max(10, Math.floor(baseLimit * 0.25)); // 25% of base limit, minimum 10
    case 'medium':
      return Math.max(20, Math.floor(baseLimit * 0.5)); // 50% of base limit, minimum 20
    default:
      return Math.min(baseLimit, 100); // Normal operation, cap at 100
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
  maxEntrySize: 100 * 1024, // Reduced to 100KB max per entry
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
    // Efficient memory size estimation without full JSON serialization
    try {
      let size = (key ? key.length : 0);
      
      // Estimate size based on value type
      if (value === null || value === undefined) {
        size += 4; // "null"
      } else if (typeof value === 'string') {
        size += value.length + 2; // +2 for quotes
      } else if (typeof value === 'number') {
        size += 8; // Average number size
      } else if (typeof value === 'boolean') {
        size += 5; // "true" or "false"
      } else if (Array.isArray(value)) {
        size += 2; // "[]"
        size += value.length * 20; // Estimate 20 bytes per array element
      } else if (typeof value === 'object') {
        size += 2; // "{}"
        const keys = Object.keys(value);
        size += keys.length * 15; // Estimate 15 bytes per key-value pair
      } else {
        size += 50; // Default estimate for unknown types
      }
      
      return Math.min(size, 100 * 1024); // Cap at 100KB for safety
    } catch {
      return 512; // Default estimate if estimation fails
    }
  }
});

// Background cleanup interval handle - stored for graceful shutdown
let cleanupHandle = null;

// Auto-tuning interval handle
let autoTuningHandle = null;

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
  
  // Start automatic cache tuning with reduced frequency
  if (!autoTuningHandle) {
    autoTuningHandle = setInterval(() => {
      try {
        const memoryPressure = memoryMonitor.getMemoryPressure();
        
        // Only adjust cache size if memory pressure changed
        const oldPressure = cachedMemoryPressure;
        if (oldPressure !== memoryPressure) {
          adjustCacheSize();
        }
        
        // Proactive cleanup under high pressure only
        if (memoryPressure === 'critical') {
          adviceCache.purgeStale();
          
          // Force garbage collection hint if available
          if (global.gc) {
            setImmediate(() => global.gc());
          }
        }
      } catch (error) {
        console.error('Error during cache auto-tuning:', error.message);
      }
    }, 300000); // Every 5 minutes (reduced frequency)
    autoTuningHandle.unref();
  }
};

/**
 * Stops background cleanup process
 */
const stopAdviceCleanup = () => {
  // Only stop if cleanup handle exists (prevents errors)
  cleanupHandle && (clearInterval(cleanupHandle), cleanupHandle = null);
  
  // Stop auto-tuning as well
  autoTuningHandle && (clearInterval(autoTuningHandle), autoTuningHandle = null);
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
 * Simplified cache size adjustment with reduced complexity
 * 
 * Dynamically resizes the cache if memory pressure changes to
 * prevent memory exhaustion while maintaining cache effectiveness.
 */
const adjustCacheSize = () => {
  const newCacheSize = calculateMemoryAwareCacheSize();
  const memoryPressure = memoryMonitor.getMemoryPressure();
  
  // Only adjust if size actually changed
  if (newCacheSize !== currentCacheSize) {
    const oldSize = currentCacheSize;
    currentCacheSize = newCacheSize;
    
    // Resize the cache (LRU cache handles this efficiently)
    adviceCache.max = newCacheSize;
    
    // Simple TTL adjustment based on memory pressure only
    if (memoryPressure === 'critical') {
      adviceCache.ttl = Math.max(cacheTtl * 0.25, 30000); // Minimum 30 seconds
    } else if (memoryPressure === 'high') {
      adviceCache.ttl = Math.max(cacheTtl * 0.5, 60000); // Minimum 1 minute
    }
    
    if (newCacheSize < oldSize) {
      console.warn(`Memory pressure detected, reduced cache size from ${oldSize} to ${newCacheSize} entries`);
    }
  }
};

/**
 * Get advice size using lightweight estimation to avoid JSON.stringify
 * 
 * @param {Object} advice - AI-generated advice to size check
 * @returns {number} Estimated size in bytes
 */
const getAdviceSize = (advice) => {
  // Quick size estimation without JSON.stringify
  const MAX_ADVICE_SIZE = 25 * 1024; // 25KB limit per advice object
  
  if (advice === null || advice === undefined) {
    return 4;
  }
  
  if (typeof advice === 'string') {
    return Math.min(advice.length, MAX_ADVICE_SIZE);
  }
  
  if (typeof advice === 'number') {
    return 8;
  }
  
  if (typeof advice === 'boolean') {
    return 5;
  }
  
  if (Array.isArray(advice)) {
    let size = 2; // "[]"
    for (let i = 0; i < Math.min(advice.length, 100); i++) {
      size += getAdviceSize(advice[i]) + 2; // +2 for comma/space
      if (size > MAX_ADVICE_SIZE) break;
    }
    return Math.min(size, MAX_ADVICE_SIZE);
  }
  
  if (typeof advice === 'object') {
    let size = 2; // "{}"
    const keys = Object.keys(advice);
    for (let i = 0; i < Math.min(keys.length, 50); i++) {
      const key = keys[i];
      size += key.length + 5; // key + ":" + ","
      size += getAdviceSize(advice[key]);
      if (size > MAX_ADVICE_SIZE) break;
    }
    return Math.min(size, MAX_ADVICE_SIZE);
  }
  
  return 50; // Default estimate
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
    
    // Validate entry size using lightweight estimation
    const adviceSize = getAdviceSize(advice);
    
    // Dynamic max entry size based on memory pressure
    const memoryPressure = memoryMonitor.getMemoryPressure();
    let maxEntrySize = 25 * 1024; // Reduced to 25KB default
    
    switch (memoryPressure) {
      case 'critical':
        maxEntrySize = 5 * 1024; // 5KB under critical pressure
        break;
      case 'high':
        maxEntrySize = 10 * 1024; // 10KB under high pressure
        break;
      case 'medium':
        maxEntrySize = 15 * 1024; // 15KB under medium pressure
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