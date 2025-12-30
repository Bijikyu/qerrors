'use strict';

/**
 * Enhanced Rate Limiting System for Scalability
 * 
 * Provides per-endpoint rate limiting with dynamic thresholds,
 * memory-efficient storage, and distributed capabilities.
 */

const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const os = require('os');
const qerrors = require('./qerrors');

class EnhancedRateLimiter {
  constructor(options = {}) {
    // Memory-aware cache configuration
    this.memoryCheckInterval = setInterval(() => this.adjustCacheForMemory(), 30000);
    this.memoryCheckInterval.unref();
    
    // Initial cache configuration
    this.cacheConfig = {
      stdTTL: 900, // 15 minutes default TTL
      checkperiod: 60, // Check for expired keys every minute
      useClones: false // Performance optimization
    };
    
    // Memory-efficient cache with TTL
    this.cache = new NodeCache(this.cacheConfig);
    
    // Dynamic configuration based on system resources
    const cpus = os.cpus().length;
    const memoryMB = os.totalmem() / (1024 * 1024);
    
    // Base limits scaled by system capacity
    this.systemMultiplier = Math.max(1, Math.min(5, Math.floor(cpus / 2)));
    this.memoryMultiplier = Math.max(1, Math.min(3, Math.floor(memoryMB / 1024))); // Scale by GB
    
    // Per-endpoint configuration
    this.endpointLimits = {
      // High-frequency, low-cost endpoints
      '/health': { max: 10000, windowMs: 60000 }, // 10k/minute
      '/metrics': { max: 5000, windowMs: 60000 },  // 5k/minute
      '/api/status': { max: 3000, windowMs: 60000 }, // 3k/minute
      
      // Standard API endpoints
      '/api/logs': { max: 1000, windowMs: 60000 },    // 1k/minute
      '/api/errors': { max: 500, windowMs: 60000 },   // 500/minute
      '/api/config': { max: 200, windowMs: 60000 },    // 200/minute
      
      // Expensive AI analysis endpoints
      '/api/analyze': { max: 100, windowMs: 60000 },   // 100/minute
      '/api/ai/batch': { max: 50, windowMs: 300000 },  // 50/5min
      '/api/ai/stream': { max: 20, windowMs: 60000 },  // 20/minute
      
      // Admin endpoints - very restrictive
      '/api/admin': { max: 50, windowMs: 300000 },    // 50/5min
      '/api/debug': { max: 10, windowMs: 300000 },     // 10/5min
    };
    
    // Global fallback limits
    this.defaultLimits = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000 * this.systemMultiplier // Scale by system capacity
    };
    
    // Simplified statistics for monitoring
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      lastReset: Date.now()
    };
    
    // Cache for user agent hashes to avoid repeated computation
    this.maxUserAgentCacheSize = 25; // Reduced size for memory efficiency
    
    // Simplified LRU for user agent hashes only
    class SimpleLRU {
      constructor(maxSize = 25) {
        this.maxSize = maxSize;
        this.cache = new Map();
      }
      
      get(key) {
        if (this.cache.has(key)) {
          const value = this.cache.get(key);
          this.cache.delete(key);
          this.cache.set(key, value);
          return value;
        }
        return undefined;
      }
      
      set(key, value) {
        if (this.cache.has(key)) {
          this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
      }
    }
    
    this.userAgentLRU = new SimpleLRU(this.maxUserAgentCacheSize);
    
    // Memory pressure cache to avoid redundant computations
    this.memoryPressureCache = {
      value: 'medium',
      timestamp: 0,
      ttl: 5000 // 5 seconds cache
    };
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
  }
  
  /**
   * Get current memory pressure level with caching
   */
  getMemoryPressure() {
    const now = Date.now();
    
    // Return cached value if still valid
    if (now - this.memoryPressureCache.timestamp < this.memoryPressureCache.ttl) {
      return this.memoryPressureCache.value;
    }
    
    const usage = process.memoryUsage();
    
    // Prevent division by zero
    if (!usage.heapTotal || usage.heapTotal <= 0) {
      this.memoryPressureCache.value = 'medium';
      this.memoryPressureCache.timestamp = now;
      return 'medium'; // Default fallback
    }
    
    const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
    
    let pressure;
    if (heapUsedPercent > 85) pressure = 'critical';
    else if (heapUsedPercent > 70) pressure = 'high';
    else if (heapUsedPercent > 50) pressure = 'medium';
    else pressure = 'low';
    
    // Update cache
    this.memoryPressureCache.value = pressure;
    this.memoryPressureCache.timestamp = now;
    
    return pressure;
  }
  
  /**
   * Adjust cache configuration based on memory pressure
   */
  adjustCacheForMemory() {
    try {
      const memoryPressure = this.getMemoryPressure();
      const cacheStats = this.cache.getStats();
      
      let newConfig = { ...this.cacheConfig };
      
      switch (memoryPressure) {
        case 'critical':
          newConfig.stdTTL = 300; // Reduce TTL to 5 minutes
          newConfig.checkperiod = 30; // Check every 30 seconds
          // Force cleanup of oldest entries
          if (cacheStats.keys > 1000) {
            this.cache.flushAll();
            console.warn('Critical memory pressure: flushed rate limiter cache');
          }
          break;
          
        case 'high':
          newConfig.stdTTL = 600; // Reduce TTL to 10 minutes
          newConfig.checkperiod = 45; // Check every 45 seconds
          // Aggressive cleanup - use bounded deletion to avoid large array operations
          if (cacheStats.keys > 2000) {
            const keys = this.cache.keys();
            const maxDelete = Math.min(1000, Math.floor(keys.length * 0.5)); // Cap at 1000 deletions
            const toDelete = keys.slice(0, maxDelete);
            this.cache.delMultiple(toDelete);
            console.warn('High memory pressure: cleaned up rate limiter cache');
          }
          break;
          
        case 'medium':
          newConfig.stdTTL = 900; // Normal TTL
          newConfig.checkperiod = 60; // Normal check period
          break;
          
        default:
          newConfig.stdTTL = 1200; // Extend TTL to 20 minutes
          newConfig.checkperiod = 90; // Less frequent checks
          break;
      }
      
      // Update cache if configuration changed
      if (newConfig.stdTTL !== this.cacheConfig.stdTTL || 
          newConfig.checkperiod !== this.cacheConfig.checkperiod) {
        // Create new cache with updated configuration
        const oldCache = this.cache;
        this.cache = new NodeCache(newConfig);
        this.cacheConfig = newConfig;
        
        // Close old cache safely
        try {
          if (oldCache && typeof oldCache.close === 'function') {
            oldCache.close();
          }
        } catch (error) {
          console.error('Error closing old cache:', error.message);
        }
        
        console.info(`Rate limiter cache adjusted for ${memoryPressure} memory pressure`);
      }
    } catch (error) {
      // Log memory adjustment error asynchronously
      setImmediate(() => {
        qerrors(error, 'enhancedRateLimiter.adjustCacheForMemory', {
          memoryPressure: this.getMemoryPressure(),
          cacheKeys: this.cache.getStats().keys,
          operation: 'memory_pressure_adjustment'
        }).catch(qerror => {
          console.error('qerrors logging failed in adjustCacheForMemory', qerror);
        });
      });
      throw error;
    }
  }
  
  /**
   * Create rate limiter middleware for specific endpoint
   */
  createLimiter(endpointPath) {
    const config = this.endpointLimits[endpointPath] || this.defaultLimits;
    
    return rateLimit({
      windowMs: config.windowMs,
      max: config.max * this.systemMultiplier, // Scale by system capacity
      message: {
        error: 'Rate limit exceeded',
        endpoint: endpointPath,
        limit: config.max * this.systemMultiplier,
        windowMs: config.windowMs,
        retryAfter: Math.ceil(config.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      
      // Memory-efficient key generation
      keyGenerator: (req) => {
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || 'unknown';
        // Include endpoint in key for per-endpoint limiting
        return `${endpointPath}:${ip}:${this.hashUserAgent(userAgent)}`;
      },
      
      // Skip successful requests from counting against limit
      skipSuccessfulRequests: config.skipSuccessful || false,
      
      // Simplified store using NodeCache for better memory management
      store: {
        increment: async (key) => {
          try {
            this.stats.totalRequests++;
            
            // Get current count
            let current = this.cache.get(key) || 0;
            current++;
            
            // Set with TTL
            this.cache.set(key, current, config.windowMs / 1000);
            
            // Check if limit exceeded
            const limit = config.max * this.systemMultiplier;
            if (current > limit) {
              this.stats.blockedRequests++;
              return { totalHits: current, limitExceeded: true };
            }
            
            return { totalHits: current, limitExceeded: false };
          } catch (error) {
            // Log increment error asynchronously
            setImmediate(() => {
              qerrors(error, 'enhancedRateLimiter.store.increment', {
                key,
                endpointPath,
                operation: 'rate_limit_increment',
                totalRequests: this.stats.totalRequests
              }).catch(qerror => {
                console.error('qerrors logging failed in store increment', qerror);
              });
            });
            throw error;
          }
        },
        
        decrement: async (key) => {
          try {
            const current = this.cache.get(key) || 0;
            if (current > 0) {
              this.cache.set(key, current - 1, config.windowMs / 1000);
            }
          } catch (error) {
            // Log decrement error asynchronously
            setImmediate(() => {
              qerrors(error, 'enhancedRateLimiter.store.decrement', {
                key,
                endpointPath,
                operation: 'rate_limit_decrement'
              }).catch(qerror => {
                console.error('qerrors logging failed in store decrement', qerror);
              });
            });
            throw error;
          }
        },
        
        resetKey: async (key) => {
          try {
            this.cache.del(key);
          } catch (error) {
            // Log reset key error asynchronously
            setImmediate(() => {
              qerrors(error, 'enhancedRateLimiter.store.resetKey', {
                key,
                endpointPath,
                operation: 'rate_limit_key_reset'
              }).catch(qerror => {
                console.error('qerrors logging failed in store resetKey', qerror);
              });
            });
            throw error;
          }
        },
        
        resetAll: async () => {
          try {
            this.cache.flushAll();
            this.stats.lastReset = Date.now();
          } catch (error) {
            // Log reset all error asynchronously
            setImmediate(() => {
              qerrors(error, 'enhancedRateLimiter.store.resetAll', {
                endpointPath,
                operation: 'rate_limit_reset_all',
                statsBeforeReset: { ...this.stats }
              }).catch(qerror => {
                console.error('qerrors logging failed in store resetAll', qerror);
              });
            });
            throw error;
          }
        }
      },
      
      // Custom handler for rate limit exceeded
      handler: (req, res, next) => {
        try {
          this.stats.blockedRequests++;
          
          // Log rate limit violation for monitoring
          console.warn(`Rate limit exceeded for ${req.ip} on ${endpointPath}`);
          
          // Use qerrors for sophisticated rate limit error reporting
          setImmediate(() => {
            qerrors(new Error('Rate limit exceeded'), 'enhancedRateLimiter.handler', {
              ip: req.ip,
              endpointPath,
              userAgent: req.get('User-Agent'),
              limit: config.max * this.systemMultiplier,
              windowMs: config.windowMs,
              operation: 'rate_limit_exceeded',
              stats: {
                totalRequests: this.stats.totalRequests,
                blockedRequests: this.stats.blockedRequests
              }
            }).catch(qerror => {
              console.error('qerrors logging failed in rate limit handler', qerror);
            });
          });
          
          res.status(429).json({
            error: 'Rate limit exceeded',
            endpoint: endpointPath,
            retryAfter: Math.ceil(config.windowMs / 1000),
            limit: config.max * this.systemMultiplier
          });
        } catch (error) {
          // Use qerrors for sophisticated error reporting in handler
          setImmediate(() => {
            qerrors(error, 'enhancedRateLimiter.handler.error', {
              ip: req.ip,
              endpointPath,
              operation: 'rate_limit_handler_error'
            }).catch(qerror => {
              console.error('qerrors logging failed in rate limit handler error', qerror);
            });
          });
          
          // Pass to next error handler
          return next(error);
        }
      }
    });
  }
  
  /**
   * Create middleware for dynamic endpoint rate limiting
   */
  createDynamicLimiter() {
    return (req, res, next) => {
      const endpointPath = req.path;
      const limiter = this.createLimiter(endpointPath);
      return limiter(req, res, next);
    };
  }
  
  /**
   * Hash user agent for better key distribution with proper LRU caching
   * Uses lightweight string hashing to avoid blocking in request path
   */
  hashUserAgent(userAgent) {
    // Check LRU cache first
    const cached = this.userAgentLRU.get(userAgent);
    if (cached !== undefined) {
      return cached;
    }
    
    // Use lightweight string hashing instead of crypto
    const MAX_UA_LENGTH = 200; // Reduced length for performance
    const truncatedUA = userAgent.length > MAX_UA_LENGTH ? 
      userAgent.substring(0, MAX_UA_LENGTH) : userAgent;
    
    // Simple but effective hash function (FNV-1a variant)
    let hash = 2166136261;
    for (let i = 0; i < truncatedUA.length; i++) {
      hash ^= truncatedUA.charCodeAt(i);
      hash = (hash * 16777619) | 0; // Force to 32-bit integer
    }
    
    // Convert to hex string and truncate
    const hashResult = Math.abs(hash).toString(16).substring(0, 8);
    
    // Cache result
    this.userAgentLRU.set(userAgent, hashResult);
    
    return hashResult;
  }
  
  /**
   * Get rate limiting statistics
   */
  getStats() {
    const cacheStats = this.cache.getStats();
    
    return {
      ...this.stats,
      cache: {
        keys: cacheStats.keys,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        ksize: cacheStats.ksize,
        vsize: cacheStats.vsize
      },
      systemMultiplier: this.systemMultiplier,
      memoryMultiplier: this.memoryMultiplier,
      uptime: Date.now() - this.stats.lastReset
    };
  }
  
  /**
   * Update endpoint limits dynamically
   */
  updateEndpointLimit(endpointPath, newConfig) {
    this.endpointLimits[endpointPath] = {
      ...this.endpointLimits[endpointPath],
      ...newConfig
    };
  }
  
  /**
   * Add burst capacity for specific endpoints
   */
  addBurstCapacity(endpointPath, burstMultiplier = 2) {
    const current = this.endpointLimits[endpointPath] || this.defaultLimits;
    this.updateEndpointLimit(endpointPath, {
      burstMax: current.max * burstMultiplier,
      burstWindowMs: current.windowMs / 4 // Shorter burst window
    });
  }
  
  /**
   * Start periodic cleanup of expired entries
   */
  startPeriodicCleanup() {
    setInterval(() => {
      try {
        // Cache automatically handles cleanup, but we can force it
        this.cache.getStats(); // This triggers cleanup
        
        // Clean up endpoint statistics using LRU approach
        this.cleanupEndpointStats();
        
        // Clean up user agent cache with LRU eviction
        this.cleanupUserAgentCache();
        
        // Reset statistics if they get too large (reduced threshold)
        if (this.stats.totalRequests > 50000) {
          this.stats.totalRequests = 0;
          this.stats.blockedRequests = 0;
          this.stats.endpointHits = {};
          this.endpointHitTimes.clear();
          this.userAgentHashCache.clear();
          if (this.userAgentLRU) this.userAgentLRU.clear();
          if (this.endpointLRU) this.endpointLRU.clear();
          if (this.userAgentAccessOrder) this.userAgentAccessOrder.length = 0; // Clear array efficiently
          this.stats.lastReset = Date.now();
          console.info('Reset rate limiter statistics to prevent memory bloat');
        }
      } catch (error) {
        console.error('Error during periodic cleanup:', error.message);
      }
    }, 300000); // Every 5 minutes
  }
  
  /**
   * Clean up endpoint statistics using proper LRU (simplified)
   */
  cleanupEndpointStats() {
    try {
      const endpointCount = Object.keys(this.stats.endpointHits).length;
      
      if (endpointCount <= this.maxEndpointStats) {
        return; // No cleanup needed
      }
      
      // Use setImmediate to prevent blocking event loop
      setImmediate(() => {
        try {
          // Get oldest endpoints from LRU
          const lruEntries = Array.from(this.endpointLRU.cache.entries());
          const toRemove = endpointCount - this.maxEndpointStats;
          let removed = 0;
          
          for (let i = 0; i < Math.min(toRemove, lruEntries.length); i++) {
            const [oldestEndpoint] = lruEntries[i];
            if (oldestEndpoint) {
              delete this.stats.endpointHits[oldestEndpoint];
              this.endpointHitTimes.delete(oldestEndpoint);
              this.endpointLRU.delete(oldestEndpoint);
              removed++;
            }
          }
          
          if (removed > 0) {
            console.info(`Cleaned up ${removed} old endpoint statistics using LRU`);
          }
        } catch (error) {
          console.error('Error during async endpoint cleanup:', error.message);
        }
      });
    } catch (error) {
      // Log cleanup error asynchronously
      setImmediate(() => {
        qerrors(error, 'enhancedRateLimiter.cleanupEndpointStats', {
          endpointCount: Object.keys(this.stats.endpointHits).length,
          maxEndpoints: this.maxEndpointStats,
          operation: 'endpoint_stats_cleanup'
        }).catch(qerror => {
          console.error('qerrors logging failed in cleanupEndpointStats', qerror);
        });
      });
      throw error;
    }
  }
  
  /**
   * Clean up user agent cache using proper LRU (no cleanup needed - self-managing)
   */
  cleanupUserAgentCache() {
    // LRU cache manages its own size, no explicit cleanup needed
    // Just log current size for monitoring
    const currentSize = this.userAgentLRU.size;
    if (currentSize > this.maxUserAgentCacheSize * 0.9) {
      console.debug(`User agent LRU cache approaching limit: ${currentSize}/${this.maxUserAgentCacheSize}`);
    }
  }
  
  /**
   * Create rate limiter for expensive operations with queue management
   */
  createExpensiveOpLimiter(options = {}) {
    const config = {
      max: 10, // Very low limit for expensive ops
      windowMs: 60000, // 1 minute window
      queueSize: 100, // Allow queueing
      ...options
    };
    
    return rateLimit({
      windowMs: config.windowMs,
      max: config.max,
      message: {
        error: 'Rate limit exceeded for expensive operation',
        queueSize: config.queueSize,
        retryAfter: Math.ceil(config.windowMs / 1000)
      },
      // Add queue management for expensive operations
      onLimitReached: (req, res, options) => {
        console.warn(`Expensive operation rate limit reached for ${req.ip}`);
      }
    });
  }
  
  /**
   * Shutdown rate limiter and cleanup resources
   */
  shutdown() {
    try {
      if (this.memoryCheckInterval) {
        clearInterval(this.memoryCheckInterval);
        this.memoryCheckInterval = null;
      }
      
      this.cache.flushAll();
      // Some cache implementations may not have close() method
      if (typeof this.cache.close === 'function') {
        this.cache.close();
      }
      
      // Clear all collections to prevent memory leaks
      this.endpointHitTimes.clear();
      this.userAgentHashCache.clear();
      if (this.userAgentLRU) this.userAgentLRU.clear();
      if (this.endpointLRU) this.endpointLRU.clear();
      if (this.userAgentAccessOrder) this.userAgentAccessOrder.length = 0; // Clear array efficiently
      this.stats.endpointHits = {};
    } catch (error) {
      // Log shutdown error asynchronously
      setImmediate(() => {
        qerrors(error, 'enhancedRateLimiter.shutdown', {
          operation: 'rate_limiter_shutdown',
          finalStats: this.getStats()
        }).catch(qerror => {
          console.error('qerrors logging failed in shutdown', qerror);
        });
      });
      throw error;
    }
  }
}

// Singleton instance
let enhancedRateLimiter = null;

/**
 * Get or create enhanced rate limiter instance
 */
function getEnhancedRateLimiter(options = {}) {
  if (!enhancedRateLimiter) {
    enhancedRateLimiter = new EnhancedRateLimiter(options);
  }
  return enhancedRateLimiter;
}

/**
 * Middleware factory for per-endpoint rate limiting
 */
function createRateLimitMiddleware(endpointPath) {
  const limiter = getEnhancedRateLimiter();
  return limiter.createLimiter(endpointPath);
}

/**
 * Dynamic rate limiting middleware
 */
function dynamicRateLimiter(req, res, next) {
  const limiter = getEnhancedRateLimiter();
  const middleware = limiter.createDynamicLimiter();
  return middleware(req, res, next);
}

module.exports = {
  EnhancedRateLimiter,
  getEnhancedRateLimiter,
  createRateLimitMiddleware,
  dynamicRateLimiter
};