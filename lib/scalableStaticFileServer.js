/**
 * Scalable Static File Server - Non-blocking I/O with Memory Management
 * 
 * This module provides high-performance static file serving with:
 * - Non-blocking file operations
 * - Memory-efficient caching with LRU eviction
 * - Background file watching for cache invalidation
 * - Proper error handling and graceful degradation
 * - Memory pressure awareness
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ScalableStaticFileServer {
  constructor(options = {}) {
    // Memory-aware configuration
    this.maxCacheSize = options.maxCacheSize || 10 * 1024 * 1024; // 10MB default
    this.maxFileSize = options.maxFileSize || 5 * 1024 * 1024; // 5MB per file
    this.maxEntries = options.maxEntries || 100; // Reduced for memory efficiency
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes TTL
    
    // LRU cache with O(1) memory management
    this.cache = new Map();
    this.accessOrder = new Map(); // Fallback tracking for LRU
    this.accessOrderArray = []; // O(1) LRU tracking - [oldest, ..., newest]
    this.fileStats = new Map(); // Track file stats for change detection
    this.currentCacheSize = 0;
    
    // Background file watching
    this.watchers = new Map();
    this.cleanupInterval = null;
    
    // Memory pressure monitoring
    this.memoryCheckInterval = null;
    this.lastMemoryCheck = 0;
    
    // Start background processes
    this.startBackgroundProcesses();
  }
  
  /**
   * Start background file watching and cleanup processes
   */
  startBackgroundProcesses() {
    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60000); // Every minute
    this.cleanupInterval.unref();
    
    // Start memory pressure monitoring
    // Initialize cached memory pressure detection
    this.cachedMemoryPressure = 'medium';
    this.lastMemoryCheck = 0;
    this.memoryCheckInProgress = false;
    
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryPressure();
    }, 30000); // Every 30 seconds
    this.memoryCheckInterval.unref();
  }
  
  /**
   * Get current memory pressure level with caching to prevent blocking
   */
  getMemoryPressure() {
    const now = Date.now();
    
    // Return cached value if recent (to prevent blocking calls)
    if (this.cachedMemoryPressure && (now - this.lastMemoryCheck) < 5000) {
      return this.cachedMemoryPressure;
    }
    
    // Schedule memory pressure check in background if cache is stale
    if (!this.memoryCheckInProgress) {
      this.memoryCheckInProgress = true;
      setImmediate(() => {
        try {
          const usage = process.memoryUsage();
          const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
          
          let pressure;
          if (heapUsedPercent > 85) pressure = 'critical';
          else if (heapUsedPercent > 70) pressure = 'high';
          else if (heapUsedPercent > 50) pressure = 'medium';
          else pressure = 'low';
          
          this.cachedMemoryPressure = pressure;
          this.lastMemoryCheck = Date.now();
        } catch (error) {
          console.warn('Error checking memory pressure:', error.message);
          // Use previous value on error
        } finally {
          this.memoryCheckInProgress = false;
        }
      });
    }
    
    // Return cached value or default
    return this.cachedMemoryPressure || 'medium';
  }
  
  /**
   * Adjust cache based on memory pressure
   */
  checkMemoryPressure() {
    const now = Date.now();
    if (now - this.lastMemoryCheck < 25000) return; // Minimum 25 seconds between checks
    
    this.lastMemoryCheck = now;
    const pressure = this.getMemoryPressure();
    
    switch (pressure) {
      case 'critical':
        // Aggressive cleanup - reduce cache to 25%
        this.reduceCacheToSize(this.maxCacheSize * 0.25);
        break;
      case 'high':
        // Moderate cleanup - reduce cache to 50%
        this.reduceCacheToSize(this.maxCacheSize * 0.5);
        break;
      case 'medium':
        // Light cleanup - reduce cache to 75%
        this.reduceCacheToSize(this.maxCacheSize * 0.75);
        break;
    }
  }
  
  /**
   * Reduce cache to specific size using LRU eviction
   */
reduceCacheToSize(targetSize) {
    let evictionCount = 0;
    const maxEvictions = Math.min(10, Math.floor(this.cache.size / 10));
    
    while (this.currentCacheSize > targetSize && this.cache.size > 0 && evictionCount < maxEvictions) {
      const oldestKey = this.getOldestEntry();
      if (oldestKey) {
        this.evictEntry(oldestKey);
        evictionCount++;
      } else {
        break;
      }
    }
    
    if (this.currentCacheSize > targetSize) {
      console.warn(`Could not reduce cache to target size ${targetSize}, current size: ${this.currentCacheSize}`);
    }
  }
    }
    
    if (this.currentCacheSize > targetSize) {
      console.warn(`Could not reduce cache to target size ${targetSize}, current size: ${this.currentCacheSize}`);
    }
  }
    }
    
    if (this.currentCacheSize > targetSize) {
      console.warn(`Could not reduce cache to target size ${targetSize}, current size: ${this.currentCacheSize}`);
    }
  }
  

      
      count++;
      
      // Early exit if we've processed enough entries
      if (count >= 50 && oldestTime < (Date.now() - 60000)) {
        break;
      }
    }
    
    return oldestKey;
  }
      
      count++;
      if (count >= maxIterations) {
        // For very large caches, use sampling to find approximate oldest
        break;
      }
    }
    
    return oldestKey;
  }
  
// Helper methods for array-based LRU cache
   addToEnd(key) {
     const existingIndex = this.accessOrderArray.indexOf(key);
     if (existingIndex === -1) {
       this.accessOrderArray.push(key);
     } else {
       this.accessOrderArray.splice(existingIndex, 1);
       this.accessOrderArray.push(key);
     }
   }
   
   removeFromArray(key) {
     const index = this.accessOrderArray.indexOf(key);
     if (index > -1) {
       this.accessOrderArray.splice(index, 1);
     }
   }
   
   evictEntry(cacheKey) {
     this.cache.delete(cacheKey);
     this.accessOrder.delete(cacheKey);
     const size = this.cache.get(cacheKey)?.size || 0;
     this.currentCacheSize -= size;
   }
  
// Helper methods for array-based LRU cache
   addToEnd(key) {
     const existingIndex = this.accessOrderArray.indexOf(key);
     if (existingIndex === -1) {
       this.accessOrderArray.push(key);
     } else {
       this.accessOrderArray.splice(existingIndex, 1);
       this.accessOrderArray.push(key);
     }
   }
   
   removeFromArray(key) {
     const index = this.accessOrderArray.indexOf(key);
     if (index > -1) {
       this.accessOrderArray.splice(index, 1);
     }
   }
   
   evictEntry(cacheKey) {
     this.cache.delete(cacheKey);
     this.accessOrder.delete(cacheKey);
     const size = this.cache.get(cacheKey)?.size || 0;
     this.currentCacheSize -= size;
   }
   
// Main LRU cache functions
   getOldestEntry() {
     let oldestKey = null;
     let oldestTime = Date.now();
    
    // Use efficient iteration with early exit for large caches
    const entries = this.accessOrder.entries();
    let count = 0;
    
    for (const [key, time] of entries) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
      
      count++;
      
      // Early exit if we've processed enough entries
      if (count >= 50 && oldestTime < (Date.now() - 60000)) {
        break;
      }
    }
    
    return oldestKey;
  }
   
   // Add key to end of access order array (most recently used)
   addToEnd(key) {
     const existingIndex = this.accessOrderArray.indexOf(key);
     if (existingIndex === -1) {
       this.accessOrderArray.push(key);
     } else {
       this.accessOrderArray.splice(existingIndex, 1);
       this.accessOrderArray.push(key);
     }
   }
   
   // Remove key from access order array
   removeFromArray(key) {
     const index = this.accessOrderArray.indexOf(key);
     if (index > -1) {
       this.accessOrderArray.splice(index, 1);
     }
   }
   
   // Evict entry from cache
   evictEntry(cacheKey) {
     this.cache.delete(cacheKey);
     this.accessOrder.delete(cacheKey);
     const size = this.cache.get(cacheKey)?.size || 0;
     this.currentCacheSize -= size;
   }
      
       count++;
       iterations++;
       
       // Early exit to prevent excessive iteration
       if (count >= maxIterations || iterations >= 50) {
         break;
       }
     }
    
     return oldestKey;
   }
  
  /**
   * Remove key from access order array
   */
  removeFromArray(key) {
    const index = this.accessOrderArray.indexOf(key);
    if (index > -1) {
      this.accessOrderArray.splice(index, 1);
    }
  }

  /**
   * Evict entry from cache
   */
  evictEntry(key) {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentCacheSize -= entry.size;
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.fileStats.delete(key);
      this.removeFromArray(key);
      
      // Stop watching file
      const watcher = this.watchers.get(key);
      if (watcher) {
        watcher.close();
        this.watchers.delete(key);
      }
    }
  }
  
  /**
   * Perform periodic cleanup of expired entries
   */
  performCleanup() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTTL) {
        expiredKeys.push(key);
      }
    }
    
    // Remove expired entries
    expiredKeys.forEach(key => this.evictEntry(key));
    
    if (expiredKeys.length > 0) {
      console.info(`Cleaned up ${expiredKeys.length} expired static file cache entries`);
    }
  }
  
// Helper methods for array-based LRU cache
   addToEnd(key) {
     const existingIndex = this.accessOrderArray.indexOf(key);
     if (existingIndex === -1) {
       this.accessOrderArray.push(key);
     } else {
       this.accessOrderArray.splice(existingIndex, 1);
       this.accessOrderArray.push(key);
     }
   }
   
   removeFromArray(key) {
     const index = this.accessOrderArray.indexOf(key);
     if (index > -1) {
       this.accessOrderArray.splice(index, 1);
     }
   }
   
   evictEntry(cacheKey) {
     this.cache.delete(cacheKey);
     this.accessOrder.delete(cacheKey);
     const size = this.cache.get(cacheKey)?.size || 0;
     this.currentCacheSize -= size;
   }
  
  /**
   * Check if file should be cached based on size and type
   */
  shouldCacheFile(filePath, stats) {
    // Check file size
    if (stats.size > this.maxFileSize) {
      return false;
    }
    
    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    const cacheableExtensions = ['.html', '.css', '.js', '.json', '.txt', '.md'];
    
    return cacheableExtensions.includes(ext);
  }
  
  /**
   * Start watching file for changes
   */
  startFileWatcher(filePath, cacheKey) {
    try {
      // Stop existing watcher if any
      const existingWatcher = this.watchers.get(cacheKey);
      if (existingWatcher) {
        existingWatcher.close();
      }
      
      // Create new watcher
      const watcher = fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
          // File changed, invalidate cache
          setImmediate(() => {
            this.evictEntry(cacheKey);
            console.info(`Static file changed, removed from cache: ${filePath}`);
          });
        }
      });
      
      this.watchers.set(cacheKey, watcher);
      watcher.unref(); // Don't prevent process exit
    } catch (error) {
      console.warn(`Failed to watch file ${filePath}:`, error.message);
    }
  }
  
  /**
   * Load file asynchronously with proper error handling
   */
  async loadFile(filePath) {
    try {
      // Get file stats
      const stats = await fs.promises.stat(filePath);
      
      // Check if file should be cached
      if (!this.shouldCacheFile(filePath, stats)) {
        // For large files, read directly without caching
        return await fs.promises.readFile(filePath);
      }
      
      const cacheKey = this.generateCacheKey(filePath);
      
      // Check cache first
      const cachedEntry = this.cache.get(cacheKey);
      if (cachedEntry) {
        // Update access order - O(1) array operation
        this.accessOrder.set(cacheKey, Date.now());
        this.moveToEnd(cacheKey);
        
        // Check if file changed
        const cachedStats = this.fileStats.get(cacheKey);
        if (cachedStats && 
            cachedStats.mtime.getTime() === stats.mtime.getTime() &&
            cachedStats.size === stats.size) {
          // Return cached content
          return cachedEntry.content;
        } else {
          // File changed, evict old entry
          this.evictEntry(cacheKey);
        }
      }
      
      // Check memory limits before loading
      const estimatedSize = stats.size;
      if (estimatedSize > this.maxFileSize) {
        throw new Error(`File too large: ${estimatedSize} bytes`);
      }
      
      // Make space in cache if needed (non-blocking for large evictions)
      const needsEviction = (this.currentCacheSize + estimatedSize > this.maxCacheSize) || 
                           (this.cache.size >= this.maxEntries);
      
      if (needsEviction) {
        const evictionsNeeded = Math.max(
          Math.ceil((this.currentCacheSize + estimatedSize - this.maxCacheSize) / (estimatedSize || 1024)),
          this.cache.size - this.maxEntries + 1
        );
        
        // For small number of evictions, do it synchronously
        if (evictionsNeeded <= 5) {
          for (let i = 0; i < evictionsNeeded; i++) {
            const oldestKey = this.getOldestEntry();
            if (oldestKey) {
              this.evictEntry(oldestKey);
            } else {
              break;
            }
          }
        } else {
          // For large evictions, warn and do batch eviction in background
          console.warn(`Large cache eviction needed: ${evictionsNeeded} entries. This may impact performance.`);
          
          // Do immediate eviction of critical entries
          const criticalEvictions = Math.min(3, evictionsNeeded);
          for (let i = 0; i < criticalEvictions; i++) {
            const oldestKey = this.getOldestEntry();
            if (oldestKey) {
              this.evictEntry(oldestKey);
            } else {
              break;
            }
          }
          
          // Schedule remaining evictions in background
          setImmediate(() => {
            const remainingEvictions = evictionsNeeded - criticalEvictions;
            for (let i = 0; i < remainingEvictions; i++) {
              const oldestKey = this.getOldestEntry();
              if (oldestKey) {
                this.evictEntry(oldestKey);
              } else {
                break;
              }
            }
          });
        }
      }
      
      // Load file content
      const content = await fs.promises.readFile(filePath);
      const actualSize = content.length;
      
      // Cache the content
      const entry = {
        content: content,
        size: actualSize,
        timestamp: Date.now(),
        filePath: filePath
      };
      
this.cache.set(cacheKey, entry);
        this.accessOrder.set(cacheKey, Date.now());
        this.addToEnd(cacheKey);
      this.fileStats.set(cacheKey, {
        mtime: stats.mtime,
        size: stats.size
      });
      this.currentCacheSize += actualSize;
      
      // Start watching file for changes
      this.startFileWatcher(filePath, cacheKey);
      
      return content;
      
    } catch (error) {
      console.error(`Failed to load static file ${filePath}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get file content with caching
   */
  async getFile(filePath) {
    try {
      return await this.loadFile(filePath);
    } catch (error) {
      // Return null for missing files instead of throwing
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      entries: this.cache.size,
      maxEntries: this.maxEntries,
      currentCacheSize: this.currentCacheSize,
      maxCacheSize: this.maxCacheSize,
      memoryPressure: this.getMemoryPressure(),
      watchers: this.watchers.size
    };
  }
  
  /**
   * Clear all cache and stop watching
   */
  clear() {
    // Clear cache
    this.cache.clear();
    this.accessOrder.clear();
    this.fileStats.clear();
    this.currentCacheSize = 0;
    
    // Stop all file watchers
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }
  
  /**
   * Shutdown and cleanup resources
   */
  shutdown() {
    // Clear intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    
    // Clear cache and watchers
    this.clear();
  }
}

// Singleton instance
let staticFileServer = null;

/**
 * Get or create static file server instance
 */
function getStaticFileServer(options = {}) {
  if (!staticFileServer) {
    staticFileServer = new ScalableStaticFileServer(options);
    
    // Add shutdown listeners
    const gracefulShutdown = () => {
      if (staticFileServer) {
        staticFileServer.shutdown();
        staticFileServer = null;
      }
    };
    
    process.once('SIGTERM', gracefulShutdown);
    process.once('SIGINT', gracefulShutdown);
    process.once('beforeExit', gracefulShutdown);
  }
  return staticFileServer;
}

/**
 * Express middleware for serving static files
 */
function createStaticFileMiddleware() {
  const server = getStaticFileServer();
  
  return async (req, res, next) => {
    try {
      // Only handle GET requests
      if (req.method !== 'GET') {
        return next();
      }
      
      // Construct and validate file path
      const requestedPath = req.path;
      
      // Security check - prevent directory traversal and path injection
      if (!requestedPath || typeof requestedPath !== 'string') {
        return next();
      }
      
      // Normalize and validate the path
      const normalizedPath = path.normalize(requestedPath);
      
      // Prevent directory traversal attempts
      if (normalizedPath.includes('..') || normalizedPath.includes('~') || normalizedPath.startsWith('/')) {
        console.warn(`Suspicious path requested: ${requestedPath}`);
        return next();
      }
      
      // Construct safe file path within document root
      const filePath = path.join(process.cwd(), normalizedPath.replace(/^\/+/, ''));
      
      // Final security validation
      if (!filePath.startsWith(process.cwd())) {
        console.warn(`Path traversal attempt blocked: ${requestedPath}`);
        return next();
      }
      
      // Try to get file content
      const content = await server.getFile(filePath);
      
      if (content === null) {
        // File not found
        return next();
      }
      
      // Set content type based on file extension
      const ext = path.extname(filePath).toLowerCase();
      const contentTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.txt': 'text/plain',
        '.md': 'text/markdown'
      };
      
      const contentType = contentTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      
      // Set cache headers
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
      res.setHeader('ETag', `"${Date.now()}"`);
      
      // Send content
      res.send(content);
      
    } catch (error) {
      console.error(`Static file middleware error for ${req.path}:`, error.message);
      next(error);
    }
  };
}

module.exports = {
  ScalableStaticFileServer,
  getStaticFileServer,
  createStaticFileMiddleware
};