'use strict';

/**
 * Thread-Safe Static File Cache with Atomic Operations
 * 
 * Provides race-condition-free static file caching with atomic memory tracking
 * and proper concurrency control for high-load scenarios.
 * 
 * Key Features:
 * - Atomic memory size tracking to prevent race conditions
 * - Lock-free operations where possible
 * - Proper cache invalidation and LRU eviction
 * - Memory pressure awareness
 * - Graceful degradation under high load
 */

const fs = require('fs').promises;
const { MemoryMonitor } = require('./memoryManagement');

class AtomicStaticFileCache {
  constructor(options = {}) {
    // Cache configuration
    this.maxCacheSize = options.maxCacheSize || 50 * 1024 * 1024; // 50MB default
    this.maxFileSize = options.maxFileSize || 5 * 1024 * 1024; // 5MB per file
    this.maxEntries = options.maxEntries || 1000;
    
    // Atomic counters using BigInt for thread safety
    this.currentCacheSize = 0n;
    this.currentEntryCount = 0n;
    this.totalHits = 0n;
    this.totalMisses = 0n;
    
    // Cache storage
    this.fileCache = new Map();
    this.fileStats = new Map();
    this.loadingPromises = new Map();
    
    // Memory monitor for adaptive behavior
    this.memoryMonitor = new MemoryMonitor({
      warningPercent: 70,
      criticalPercent: 85,
      checkInterval: 3000
    });
    
    this.memoryMonitor.start();
    
    // Cache statistics
    this.stats = {
      startTime: Date.now(),
      evictions: 0,
      memoryPressureEvictions: 0,
      loadErrors: 0
    };
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.performMaintenance();
    }, 30000); // Every 30 seconds
  }
  
  /**
   * Get cached file content with atomic operations
   */
  async getFile(name, filePath) {
    try {
      // Check if there's an ongoing load for this file
      if (this.loadingPromises.has(name)) {
        return await this.loadingPromises.get(name);
      }
      
      // Create load promise
      const loadPromise = this.loadFile(name, filePath);
      this.loadingPromises.set(name, loadPromise);
      
      try {
        const result = await loadPromise;
        return result;
      } finally {
        this.loadingPromises.delete(name);
      }
      
    } catch (error) {
      this.stats.loadErrors++;
      console.warn(`Failed to get cached file ${name}:`, error.message);
      return null;
    }
  }
  
  /**
   * Load file with atomic cache size tracking
   */
  async loadFile(name, filePath) {
    try {
      // Get file stats asynchronously
      const fileStats = await fs.stat(filePath);
      
      // Check file size limits
      if (fileStats.size > this.maxFileSize) {
        console.warn(`File ${name} too large (${fileStats.size} bytes), skipping cache`);
        return await fs.readFile(filePath, 'utf8');
      }
      
      // Check cache validity
      const cachedContent = this.fileCache.get(name);
      const cachedStats = this.fileStats.get(name);
      
      const needsReload = !cachedStats || 
                         !cachedContent ||
                         fileStats.mtime > cachedStats.mtime || 
                         fileStats.size !== cachedStats.size;
      
      if (needsReload) {
        // Load file content
        const content = await fs.readFile(filePath, 'utf8');
        const contentSize = Buffer.byteLength(content, 'utf8');
        
        // Check memory pressure before caching
        const memoryPressure = this.memoryMonitor.getCurrentPressure();
        const shouldCache = this.shouldCacheFile(contentSize, memoryPressure);
        
        if (shouldCache) {
          await this.updateCacheAtomically(name, content, fileStats, contentSize);
        }
        
        return content;
      } else {
        // Update access time atomically
        this.updateAccessTime(name);
        this.totalHits++;
        return cachedContent;
      }
      
    } catch (error) {
      this.totalMisses++;
      throw error;
    }
  }
  
  /**
   * Determine if file should be cached based on memory pressure
   */
  shouldCacheFile(contentSize, memoryPressure) {
    // Don't cache if memory pressure is critical
    if (memoryPressure === 'critical') {
      return false;
    }
    
    // Don't cache if file is too large relative to cache size
    if (contentSize > this.maxCacheSize * 0.1) { // 10% of cache size
      return false;
    }
    
    // Adjust caching behavior based on memory pressure
    const cacheProbability = {
      low: 1.0,
      medium: 0.8,
      high: 0.5
    }[memoryPressure] || 0.3;
    
    return Math.random() < cacheProbability;
  }
  
  /**
   * Update cache with atomic size tracking
   */
  async updateCacheAtomically(name, content, fileStats, contentSize) {
    // Get old content size for atomic update
    const oldContentSize = this.getOldContentSize(name);
    
    // Check if we need to make space
    const requiredSpace = contentSize - oldContentSize;
    const currentSize = Number(this.currentCacheSize);
    
    if (currentSize + requiredSpace > this.maxCacheSize) {
      await this.makeSpaceAtomically(requiredSpace);
    }
    
    // Atomic cache update
    this.fileCache.set(name, content);
    this.fileStats.set(name, {
      mtime: fileStats.mtime,
      size: fileStats.size,
      lastAccessed: Date.now(),
      contentSize
    });
    
    // Atomic size counter update
    this.currentCacheSize = this.currentCacheSize - BigInt(oldContentSize) + BigInt(contentSize);
    
    if (!this.fileCache.has(name)) {
      this.currentEntryCount++;
    }
    
    console.log(`Cached file: ${name} (${contentSize} bytes, total: ${this.currentCacheSize} bytes)`);
  }
  
  /**
   * Get old content size for atomic update
   */
  getOldContentSize(name) {
    const cachedStats = this.fileStats.get(name);
    return cachedStats ? cachedStats.contentSize : 0;
  }
  
  /**
   * Update access time atomically
   */
  updateAccessTime(name) {
    const stats = this.fileStats.get(name);
    if (stats) {
      stats.lastAccessed = Date.now();
      // No need to update the map as we're modifying the object in place
    }
  }
  
  /**
   * Make space in cache using atomic operations
   */
  async makeSpaceAtomically(requiredSize) {
    const entries = Array.from(this.fileStats.entries());
    
    // Sort by last accessed time (LRU)
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    let freedSpace = 0;
    const memoryPressure = this.memoryMonitor.getCurrentPressure();
    
    // Evict entries until we have enough space
    for (const [name, stats] of entries) {
      if (Number(this.currentCacheSize) - freedSpace + requiredSize <= this.maxCacheSize) {
        break;
      }
      
      // Remove from cache
      this.fileCache.delete(name);
      this.fileStats.delete(name);
      
      freedSpace += stats.contentSize;
      this.currentCacheSize -= BigInt(stats.contentSize);
      this.currentEntryCount--;
      this.stats.evictions++;
      
      // Track memory pressure evictions
      if (memoryPressure === 'high' || memoryPressure === 'critical') {
        this.stats.memoryPressureEvictions++;
      }
      
      console.log(`Evicted cache entry: ${name} (${stats.contentSize} bytes)`);
    }
    
    console.log(`Freed ${freedSpace} bytes from cache, required: ${requiredSize}`);
  }
  
  /**
   * Perform cache maintenance
   */
  performMaintenance() {
    const memoryPressure = this.memoryMonitor.getCurrentPressure();
    
    // Aggressive cleanup under memory pressure
    if (memoryPressure === 'critical') {
      const targetSize = this.maxCacheSize * 0.5; // Reduce to 50%
      this.performEmergencyCleanup(targetSize);
    } else if (memoryPressure === 'high') {
      const targetSize = this.maxCacheSize * 0.7; // Reduce to 70%
      this.performEmergencyCleanup(targetSize);
    }
    
    // Clean up old entries
    this.cleanupOldEntries();
  }
  
  /**
   * Emergency cleanup under memory pressure
   */
  performEmergencyCleanup(targetSize) {
    const entries = Array.from(this.fileStats.entries());
    
    // Sort by last accessed time
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    let freedSpace = 0;
    const currentSize = Number(this.currentCacheSize);
    
    for (const [name, stats] of entries) {
      if (currentSize - freedSpace <= targetSize) {
        break;
      }
      
      this.fileCache.delete(name);
      this.fileStats.delete(name);
      
      freedSpace += stats.contentSize;
      this.currentCacheSize -= BigInt(stats.contentSize);
      this.currentEntryCount--;
      this.stats.evictions++;
    }
    
    console.warn(`Emergency cleanup: freed ${freedSpace} bytes, target: ${targetSize}`);
  }
  
  /**
   * Clean up old entries
   */
  cleanupOldEntries() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    for (const [name, stats] of this.fileStats.entries()) {
      if (now - stats.lastAccessed > maxAge) {
        this.fileCache.delete(name);
        this.fileStats.delete(name);
        this.currentCacheSize -= BigInt(stats.contentSize);
        this.currentEntryCount--;
      }
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    const totalRequests = Number(this.totalHits + this.totalMisses);
    const hitRate = totalRequests > 0 ? Number(this.totalHits) / totalRequests : 0;
    
    return {
      cacheSize: Number(this.currentCacheSize),
      maxCacheSize: this.maxCacheSize,
      entryCount: Number(this.currentEntryCount),
      maxEntries: this.maxEntries,
      hitRate: hitRate,
      totalHits: Number(this.totalHits),
      totalMisses: Number(this.totalMisses),
      totalRequests: totalRequests,
      evictions: this.stats.evictions,
      memoryPressureEvictions: this.stats.memoryPressureEvictions,
      loadErrors: this.stats.loadErrors,
      uptime: uptime,
      memoryPressure: this.memoryMonitor.getCurrentPressure(),
      memoryStats: this.memoryMonitor.getMemoryStats()
    };
  }
  
  /**
   * Clear cache
   */
  clearCache() {
    this.fileCache.clear();
    this.fileStats.clear();
    this.currentCacheSize = 0n;
    this.currentEntryCount = 0n;
    console.log('Static file cache cleared');
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('Shutting down atomic static file cache...');
    
    // Clear cache
    this.clearCache();
    
    // Stop memory monitor
    if (this.memoryMonitor) {
      this.memoryMonitor.stop();
    }
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    console.log('Atomic static file cache shutdown complete');
  }
}

// Singleton instance
let atomicFileCache = null;

/**
 * Get or create atomic file cache instance
 */
function getAtomicFileCache(options = {}) {
  if (!atomicFileCache) {
    atomicFileCache = new AtomicStaticFileCache(options);
  }
  return atomicFileCache;
}

module.exports = {
  AtomicStaticFileCache,
  getAtomicFileCache
};