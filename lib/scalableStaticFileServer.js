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
const { getCurrentMemoryPressure } = require('./shared/memoryMonitor');

class ScalableStaticFileServer {
  constructor(options = {}) {
    // Memory-aware configuration
    this.maxCacheSize = options.maxCacheSize || 10 * 1024 * 1024; // 10MB default
    this.maxFileSize = options.maxFileSize || 5 * 1024 * 1024; // 5MB per file
    this.maxEntries = options.maxEntries || 100; // Reduced for memory efficiency
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes TTL
    
    // LRU cache with O(1) memory management using Map only
    this.cache = new Map();
    this.accessOrder = new Map(); // LRU tracking using Map for O(1) operations
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
    
    // Start memory pressure monitoring
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryPressure();
    }, 30000); // Every 30 seconds
  }
  
  /**
   * Check memory pressure and adjust cache accordingly
   */
  checkMemoryPressure() {
    const memoryInfo = getCurrentMemoryPressure();
    const pressureLevel = memoryInfo.pressureLevel;
    
    if (pressureLevel === 'CRITICAL') {
      // Critical memory pressure - aggressive cleanup
      this.reduceCacheToSize(this.maxCacheSize * 0.5);
    } else if (pressureLevel === 'HIGH') {
      // High memory pressure - moderate cleanup
      this.reduceCacheToSize(this.maxCacheSize * 0.7);
    }
  }
  
  /**
   * Perform periodic cleanup of expired entries
   */
  performCleanup() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.cacheTTL) {
        keysToDelete.push(key);
      }
    }
    
    // Batch delete expired entries
    keysToDelete.forEach(key => {
      this.evictEntry(key);
    });
  }
  
  /**
   * Get oldest entry using efficient Map iteration
   */
  getOldestEntry() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, timestamp] of this.accessOrder) {
      if (timestamp < oldestTime) {
        oldestTime = timestamp;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }
  
  /**
   * Reduce cache to specific size using efficient LRU eviction
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
  
  /**
   * Add entry to end of LRU order (most recently used)
   */
  addToEnd(key) {
    // Remove from current position if exists
    if (this.accessOrder.has(key)) {
      this.accessOrder.delete(key);
    }
    // Add to end (most recently used)
    this.accessOrder.set(key, Date.now());
  }
  
  /**
   * Remove entry from LRU tracking
   */
  removeFromArray(key) {
    this.accessOrder.delete(key);
  }
  
  /**
   * Evict entry from cache with proper memory management
   */
  evictEntry(cacheKey) {
    const entry = this.cache.get(cacheKey);
    if (entry) {
      // Store size before deletion to avoid race condition
      const entrySize = entry.size || 0;
      this.currentCacheSize -= entrySize;
      this.cache.delete(cacheKey);
      this.accessOrder.delete(cacheKey);
    }
  }
  
  /**
   * Serve static file with non-blocking I/O
   */
  async serveFile(filePath, req, res) {
    try {
      // ENHANCED Security check - prevent directory traversal
      const resolvedPath = path.resolve(filePath);
      const cwd = path.resolve(process.cwd());
      
      // Multiple layers of path traversal protection
      // 1. Basic path check
      if (!resolvedPath.startsWith(cwd)) {
        console.warn('Security: Path traversal blocked in serveFile', {
          filePath,
          resolvedPath,
          cwd
        });
        return res.status(403).json({ error: 'Forbidden: Path traversal detected' });
      }
      
      // 2. Additional validation against dangerous patterns
      const relativePath = path.relative(cwd, resolvedPath);
      if (relativePath.startsWith('..') || relativePath.includes('..')) {
        console.warn('Security: Relative path traversal detected', {
          filePath,
          relativePath,
          resolvedPath
        });
        return res.status(403).json({ error: 'Forbidden: Invalid path' });
      }
      
      // 3. Check for null bytes and other dangerous characters
      if (filePath.includes('\0') || filePath.includes('\r') || filePath.includes('\n')) {
        return res.status(403).json({ error: 'Forbidden: Invalid characters in path' });
      }
      
      // Check cache first
      const cacheKey = resolvedPath;
      const cached = this.cache.get(cacheKey);
      
      if (cached && this.isCacheValid(cached, resolvedPath)) {
        // Update LRU order
        this.addToEnd(cacheKey);
        return this.sendCachedResponse(cached, res);
      }
      
      // Load file asynchronously
      const stats = await fs.promises.stat(resolvedPath);
      
      if (stats.size > this.maxFileSize) {
        return res.status(413).send('File too large');
      }
      
      const data = await fs.promises.readFile(resolvedPath);
      const etag = this.generateETag(data, stats);
      
      // Check conditional request
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      
      // Cache the file
      this.cacheFile(cacheKey, data, etag, stats);
      
      // Send response
      this.sendFileResponse(data, etag, stats, res);
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).send('File not found');
      } else {
        console.error('Error serving file:', error);
        res.status(500).send('Internal server error');
      }
    }
  }
   
  /**
   * Check if cache entry is valid - ASYNC VERSION
   * @param {Object} cached - Cached entry
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>} Whether cache is valid
   */
  async isCacheValid(cached, filePath) {
    try {
      const stats = this.fileStats.get(filePath);
      if (!stats) return false;
      
      const currentStats = await fs.promises.stat(filePath);
      return currentStats.mtime.getTime() === stats.mtime.getTime();
    } catch (error) {
      // Log error but don't crash
      console.error('Cache validation error:', error.message);
      return false;
    }
  }
   
  /**
   * Cache file with memory management
   */
  cacheFile(key, data, etag, stats) {
    const size = data.length;
    
    // Check if we need to evict entries - consider both size and entry limits
    const needsSizeEviction = this.currentCacheSize + size > this.maxCacheSize;
    const needsEntryEviction = this.cache.size >= this.maxEntries;
    
    if (needsSizeEviction || needsEntryEviction) {
      // Evict based on which limit is exceeded
      const targetSize = needsSizeEviction ? this.maxCacheSize * 0.8 : this.currentCacheSize;
      this.reduceCacheToSize(targetSize);
    }
    
    // Add to cache
    const entry = {
      data,
      etag,
      size,
      timestamp: Date.now(),
      stats
    };
    
    this.cache.set(key, entry);
    this.addToEnd(key);
    this.currentCacheSize += size;
    this.fileStats.set(key, stats);
  }
  
  /**
   * Generate ETag for file
   */
  generateETag(data, stats) {
    const hash = crypto.createHash('md5');
    hash.update(data);
    hash.update(stats.mtime.toString());
    return `"${hash.digest('hex')}"`;
  }
  
  /**
   * Send cached response
   */
  sendCachedResponse(cached, res) {
    res.set({
      'ETag': cached.etag,
      'Cache-Control': `public, max-age=${Math.floor(this.cacheTTL / 1000)}`
    });
    res.send(cached.data);
  }
  
  /**
   * Send file response
   */
  sendFileResponse(data, etag, stats, res) {
    res.set({
      'ETag': etag,
      'Cache-Control': `public, max-age=${Math.floor(this.cacheTTL / 1000)}`,
      'Content-Length': data.length
    });
    res.send(data);
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      entries: this.cache.size,
      currentSize: this.currentCacheSize,
      maxSize: this.maxCacheSize,
      hitRate: this.hitRate || 0,
      memoryUsage: process.memoryUsage()
    };
  }
  
  /**
   * Check if cache entry is valid - ASYNC VERSION
   * @param {Object} cached - Cached entry
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>} Whether cache is valid
   */
  async isCacheValid(cached, filePath) {
    try {
      const stats = this.fileStats.get(filePath);
      if (!stats) return false;
      
      const currentStats = await fs.promises.stat(filePath);
      return currentStats.mtime.getTime() === stats.mtime.getTime();
    } catch (error) {
      // Log error but don't crash
      console.error('Cache validation error:', error.message);
      return false;
    }
  }
  
  /**
   * Cleanup method to free resources
   */
  destroy() {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    
    // Clear all watchers
    for (const [path, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
    
    // Clear cache
    this.cache.clear();
    this.accessOrder.clear();
    this.fileStats.clear();
    this.currentCacheSize = 0;
  }
}

/**
 * Create Express middleware for static file serving with security
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
const createStaticFileMiddleware = (options = {}) => {
  const staticServer = new ScalableStaticFileServer(options);
  
  return (req, res, next) => {
    try {
      // Only handle GET and HEAD requests
      if (!['GET', 'HEAD'].includes(req.method)) {
        return next();
      }
      
      // Get the requested path and sanitize it
      let requestedPath = req.path || req.url;
      
      // Remove query parameters and hash
      requestedPath = requestedPath.split('?')[0].split('#')[0];
      
      // Decode URL-encoded characters
      requestedPath = decodeURIComponent(requestedPath);
      
      // SECURITY: Normalize path and prevent traversal
      // Remove leading slash and normalize
      const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.[\/\\])+/, '');
      
      // CRITICAL SECURITY: Double-check for path traversal attempts
      if (normalizedPath.includes('..') || normalizedPath.includes('\0') || normalizedPath.includes('//')) {
        return res.status(403).json({ error: 'Forbidden: Invalid path' });
      }
      
      // CRITICAL SECURITY: Additional validation to prevent encoding bypasses
      const dangerousPatterns = [
        /\.\.[\/\\]/,  // ../ or ..\
        /%2e%2e[\/\\]/i,  // URL encoded ../
        /\x2e\x2e[\/\\]/,  // Hex encoded ../
        /[\/\\]\x2e[\/\\]/,  // /./ in path traversal
        /[\/\\]\x2e\x2e[\/\\]/,  // /../ in path traversal
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(normalizedPath)) {
          return res.status(403).json({ error: 'Forbidden: Path traversal detected' });
        }
      }
      
      // Construct full file path (restrict to current working directory)
      const fullPath = path.join(process.cwd(), normalizedPath);
      const resolvedPath = path.resolve(fullPath);
      const cwd = path.resolve(process.cwd());
      
      // CRITICAL SECURITY: Final security check - ensure resolved path is within allowed directory
      if (!resolvedPath.startsWith(cwd)) {
        console.warn('Security: Path traversal attempt blocked', {
          originalPath: requestedPath,
          normalizedPath,
          resolvedPath,
          cwd
        });
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }
      
      // Serve the file through our secure static server
      staticServer.serveFile(resolvedPath, req, res).catch(error => {
        console.error('Static file serving error:', error);
        
        if (error.code === 'ENOENT') {
          return res.status(404).json({ error: 'File not found' });
        } else if (error.code === 'EACCES') {
          return res.status(403).json({ error: 'Access denied' });
        } else {
          return res.status(500).json({ error: 'Internal server error' });
        }
      });
      
    } catch (error) {
      console.error('Static file middleware error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Get a static file server instance
 * @param {Object} options - Configuration options  
 * @returns {ScalableStaticFileServer} Server instance
 */
const getStaticFileServer = (options = {}) => {
  return new ScalableStaticFileServer(options);
};

module.exports = ScalableStaticFileServer;
module.exports.createStaticFileMiddleware = createStaticFileMiddleware;
module.exports.getStaticFileServer = getStaticFileServer;