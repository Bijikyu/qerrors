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

/**
 * Initialize the LRU cache for AI advice
 * 
 * The cache is configured with:
 * - max: Maximum number of entries (0 = unlimited, but controlled by config limits)
 * - ttl: Time to live in milliseconds (0 = no expiration)
 * - Both parameters are conditional based on configuration to allow complete disable
 */
// Enforce strict cache limits to prevent memory exhaustion
const maxCacheSize = Math.min(ADVICE_CACHE_LIMIT || 100, 1000); // Cap at 1000 entries
const cacheTtl = Math.min((CACHE_TTL_SECONDS || 3600) * 1000, 24 * 60 * 60 * 1000); // Cap at 24 hours

const adviceCache = new LRUCache({
  max: maxCacheSize,
  ttl: cacheTtl,
  // Add memory management options
  allowStale: false,        // Don't return stale entries
  updateAgeOnGet: true,    // Update age on access to extend TTL
  dispose: (key, value) => {
    // Cleanup callback for when items are evicted
    if (value && typeof value === 'object') {
      // Clear any object references to help GC
      Object.keys(value).forEach(prop => delete value[prop]);
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
 * Stores advice in the cache with automatic cleanup start
 * 
 * Stores AI-generated advice in the cache and automatically starts
 * the background cleanup process if needed. This ensures that
 * cache entries are properly managed over time.
 * 
 * @param {string} key - Cache key (typically SHA256 hash of error signature)
 * @param {Object} advice - AI-generated advice to cache
 */
const setAdviceInCache = (key, advice) => {
  // Only store if cache is configured with limits
  if (ADVICE_CACHE_LIMIT !== 0) {
    adviceCache.set(key, advice);
    
    // Start cleanup timer when first item is added
    // This ensures cleanup only runs when cache is in use
    startAdviceCleanup();
  }
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
 */
module.exports = {
  // Cleanup management functions
  clearAdviceCache,      // Complete cache clearing
  purgeExpiredAdvice,    // Manual expired entry removal
  startAdviceCleanup,    // Start background cleanup
  stopAdviceCleanup,     // Stop background cleanup
  
  // Cache data operations
  getAdviceFromCache,    // Retrieve cached advice
  setAdviceInCache       // Store advice in cache
};