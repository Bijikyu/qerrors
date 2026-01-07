'use strict';

/**
 * Qerrors Cache Module
 * 
 * Provides memory-aware LRU caching for AI-generated error advice.
 * Implements dynamic cache sizing based on system memory pressure
 * and automatic cleanup to prevent memory leaks.
 */

const { LRUCache } = require('lru-cache');
const { ADVICE_CACHE_LIMIT, CACHE_TTL_SECONDS } = require('./qerrorsConfig');
const { getCurrentMemoryPressure } = require('./shared/memoryMonitor');
const { clearIntervalAndNull } = require('./shared/timerManager');
const { calculateCacheSize } = require('./shared/adaptiveSizing');

/**
 * Calculates cache size based on current memory pressure
 * @returns {number} Optimal cache size for current conditions
 */
const calculateMemoryAwareCacheSize = () => {
  const baseLimit = Math.min(ADVICE_CACHE_LIMIT || 50, 200);
  return calculateCacheSize(baseLimit);
};

let currentCacheSize = calculateMemoryAwareCacheSize();
const cacheTtl = Math.min((CACHE_TTL_SECONDS || 3600) * 1000, 24 * 60 * 60 * 1000);

const adviceCache = new LRUCache({
  max: currentCacheSize,
  maxEntrySize: 100 * 1024,
  ttl: cacheTtl,
  allowStale: false,
  updateAgeOnGet: true,
  dispose: (key, value) => {
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(prop => delete value[prop]);
    }
  },
  sizeCalculation: (value, key) => {
    try {
      let size = (key ? key.length : 0);
      
      if (value === null || value === undefined) {
        size += 4;
      } else if (typeof value === 'string') {
        size += value.length + 2;
      } else if (typeof value === 'number') {
        size += 8;
      } else if (typeof value === 'boolean') {
        size += 5;
      } else if (Array.isArray(value)) {
        size += 2;
        size += value.length * 20;
      } else if (typeof value === 'object') {
        size += 2;
        const keys = Object.keys(value);
        size += keys.length * 15;
      } else {
        size += 50;
      }
      
      return Math.min(size, 100 * 1024);
    } catch {
      return 512;
    }
  }
});

const timerHandles = {
  cleanupHandle: null,
  autoTuningHandle: null
};

let lastPressureLevel = null;

/**
 * Gets current memory pressure level as lowercase string
 * @returns {string} Memory pressure level ('low', 'medium', 'high', 'critical')
 */
const getPressureLevelLower = () => {
  try {
    const info = getCurrentMemoryPressure();
    const level = info?.pressureLevel || 'LOW';
    return String(level).toLowerCase();
  } catch {
    return 'low';
  }
};

/**
 * Starts automatic cache cleanup and memory monitoring
 * Initializes timers for expired entry cleanup and cache auto-tuning
 */
const startAdviceCleanup = () => {
  if (CACHE_TTL_SECONDS === 0 || ADVICE_CACHE_LIMIT === 0 || timerHandles.cleanupHandle) return;
  
  timerHandles.cleanupHandle = setInterval(purgeExpiredAdvice, CACHE_TTL_SECONDS * 1000);
  timerHandles.cleanupHandle.unref();
  
  if (!timerHandles.autoTuningHandle) {
    timerHandles.autoTuningHandle = setInterval(() => {
      try {
        const memoryPressure = getPressureLevelLower();
        if (lastPressureLevel !== memoryPressure) {
          lastPressureLevel = memoryPressure;
          adjustCacheSize();
        }
        
        if (memoryPressure === 'critical') {
          adviceCache.purgeStale();
          
          if (global.gc) {
            setImmediate(() => global.gc());
          }
        }
      } catch (error) {
        console.error('Error during cache auto-tuning:', error.message);
      }
    }, 300000);
    timerHandles.autoTuningHandle.unref();
  }
};

/**
 * Stops all cache cleanup timers and clears timer handles
 */
const stopAdviceCleanup = () => {
  // Clear timers and null out the timer handles object
  clearIntervalAndNull(timerHandles, 'cleanupHandle');
  clearIntervalAndNull(timerHandles, 'autoTuningHandle');
};

/**
 * Clears all entries from the advice cache
 * Stops cleanup timers if cache becomes empty
 */
const clearAdviceCache = () => {
  adviceCache.clear();
  adviceCache.size === 0 && stopAdviceCleanup();
};

/**
 * Removes expired entries from the cache
 * Stops cleanup timers if cache becomes empty
 */
const purgeExpiredAdvice = () => {
  if (CACHE_TTL_SECONDS === 0 || ADVICE_CACHE_LIMIT === 0) return;
  
  adviceCache.purgeStale();
  adviceCache.size === 0 && stopAdviceCleanup();
};

/**
 * Retrieves advice from cache by key
 * @param {string} key - Cache key
 * @returns {*} Cached advice or undefined
 */
const getAdviceFromCache = (key) => adviceCache.get(key);

/**
 * Adjusts cache size and TTL based on current memory pressure
 * Implements dynamic sizing to prevent memory exhaustion
 */
const adjustCacheSize = () => {
  const newCacheSize = calculateMemoryAwareCacheSize();
  const memoryPressure = getPressureLevelLower();
  
  if (memoryPressure === 'critical') {
    adviceCache.ttl = Math.max(cacheTtl * 0.25, 30000);
  } else if (memoryPressure === 'high') {
    adviceCache.ttl = Math.max(cacheTtl * 0.5, 60000);
  } else {
    adviceCache.ttl = cacheTtl;
  }

  if (newCacheSize !== currentCacheSize) {
    const oldSize = currentCacheSize;
    currentCacheSize = newCacheSize;
    
    adviceCache.max = newCacheSize;
    
    if (newCacheSize < oldSize) {
      console.warn(`Memory pressure detected, reduced cache size from ${oldSize} to ${newCacheSize} entries`);
    }
  }
};

/**
 * Calculates memory size of advice object for cache management
 * @param {*} advice - Advice object to size
 * @returns {number} Estimated size in bytes
 */
const getAdviceSize = (advice) => {
  const MAX_ADVICE_SIZE = 25 * 1024;
  
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
    let size = 2;
    for (let i = 0; i < Math.min(advice.length, 100); i++) {
      size += getAdviceSize(advice[i]) + 2;
      if (size > MAX_ADVICE_SIZE) break;
    }
    return Math.min(size, MAX_ADVICE_SIZE);
  }
  
  if (typeof advice === 'object') {
    let size = 2;
    const keys = Object.keys(advice);
    for (let i = 0; i < Math.min(keys.length, 50); i++) {
      const key = keys[i];
      size += key.length + 5;
      size += getAdviceSize(advice[key]);
      if (size > MAX_ADVICE_SIZE) break;
    }
    return Math.min(size, MAX_ADVICE_SIZE);
  }
  
  return 50;
};

/**
 * Stores advice in cache with memory-aware size limits
 * @param {string} key - Cache key
 * @param {*} advice - Advice object to cache
 */
const setAdviceInCache = (key, advice) => {
  if (ADVICE_CACHE_LIMIT !== 0) {
    adjustCacheSize();
    
    const adviceSize = getAdviceSize(advice);
    
    const memoryPressure = getPressureLevelLower();
    let maxEntrySize = 25 * 1024;
    
    switch (memoryPressure) {
      case 'critical': maxEntrySize = 5 * 1024; break;
      case 'high': maxEntrySize = 10 * 1024; break;
      case 'medium': maxEntrySize = 15 * 1024; break;
    }
    
    if (adviceSize > maxEntrySize) {
      console.warn(`Cache entry too large (${adviceSize} bytes > ${maxEntrySize} limit) under ${memoryPressure} memory pressure, skipping cache for key: ${key}`);
      return;
    }
    
    if (memoryPressure === 'critical' && adviceCache.size >= currentCacheSize * 0.8) {
      console.warn(`Cache near capacity under critical memory pressure, evicting oldest entries`);
      const evictCount = Math.floor(currentCacheSize * 0.3);
      for (let i = 0; i < evictCount; i++) {
        if (adviceCache.size === 0) break;
        adviceCache.pop(); // Removes least-recently-used
      }
    }
    
    adviceCache.set(key, advice);
    startAdviceCleanup();
  }
};

/**
 * Returns comprehensive cache statistics
 * @returns {Object} Cache performance and memory stats
 */
const getCacheStats = () => ({
  size: adviceCache.size,
  maxSize: currentCacheSize,
  memoryPressure: getPressureLevelLower(),
  memoryUsage: getCurrentMemoryPressure(),
  hitRate: adviceCache.calculatedSize ? (adviceCache.size / adviceCache.max) * 100 : 0
});

module.exports = {
  clearAdviceCache,
  purgeExpiredAdvice,
  startAdviceCleanup,
  stopAdviceCleanup,
  getAdviceFromCache,
  setAdviceInCache,
  adjustCacheSize,
  getCacheStats,
  calculateMemoryAwareCacheSize
};
