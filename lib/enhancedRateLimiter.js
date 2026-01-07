'use strict';

// Import unified error handling to eliminate duplicate error patterns
const { withQerrorsErrorHandling } = require('./shared/errorWrapper');
/**
 * Enhanced Rate Limiting System for Scalability
 * 
 * Provides per-endpoint rate limiting with dynamic thresholds,
 * memory-efficient storage, and distributed capabilities.
 */
// Import required dependencies
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const os = require('os');
const qerrors = require('./qerrors');
const { LRUCache } = require('lru-cache');

/**
 * Enhanced Rate Limiter Class - Scalable Rate Limiting with Memory Management
 * 
 * This class provides sophisticated rate limiting capabilities that adapt to
 * system resources, memory pressure, and endpoint-specific requirements. It
 * uses efficient caching strategies and provides comprehensive monitoring.
 */
class EnhancedRateLimiter {
  /**
   * Create an enhanced rate limiter with dynamic resource management
   * 
   * @param {Object} options - Configuration options for the rate limiter
   */
  constructor(options = {}) {
    // Start memory pressure monitoring with 30-second intervals
    this.memoryCheckInterval = setInterval(() => this.adjustCacheForMemory(), 30000);
    this.memoryCheckInterval.unref(); // Prevent blocking process exit
    
    // Configure NodeCache for efficient rate limit storage
    this.cacheConfig = {
      stdTTL: 900,        // 15 minutes default TTL
      checkperiod: 60,    // Check for expired items every minute
      useClones: false    // Disable cloning for better performance
    };
    this.cache = new NodeCache(this.cacheConfig);
    
    // Calculate system resource multipliers for dynamic scaling
    const cpus = os.cpus().length;
    const memoryMB = os.totalmem() / 1024 / 1024;
    
    // Scale limits based on CPU cores (1-5x multiplier)
    this.systemMultiplier = Math.max(1, Math.min(5, Math.floor(cpus / 2)));
    
    // Scale limits based on available memory (1-3x multiplier)
    this.memoryMultiplier = Math.max(1, Math.min(3, Math.floor(memoryMB / 1024)));
    
    // Endpoint-specific rate limits for different API categories
    this.endpointLimits = {
      '/health': { max: 10000, windowMs: 60000 },           // Health checks - high limit
      '/metrics': { max: 5000, windowMs: 60000 },            // Metrics - medium-high limit
      '/api/status': { max: 3000, windowMs: 60000 },         // Status endpoints - medium limit
      '/api/logs': { max: 1000, windowMs: 60000 },           // Log access - lower limit
      '/api/errors': { max: 500, windowMs: 60000 },          // Error details - low limit
      '/api/config': { max: 200, windowMs: 60000 },          // Configuration - very low limit
      '/api/analyze': { max: 100, windowMs: 60000 },         // AI analysis - very low limit
      '/api/ai/batch': { max: 50, windowMs: 300000 },        // Batch AI - low limit, longer window
      '/api/ai/stream': { max: 20, windowMs: 60000 },        // Streaming AI - very low limit
      '/api/admin': { max: 50, windowMs: 300000 },           // Admin endpoints - low limit, longer window
      '/api/debug': { max: 10, windowMs: 300000 }            // Debug endpoints - very low limit, longer window
    };
    
    // Default limits for unspecified endpoints
    this.defaultLimits = {
      windowMs: 900000,  // 15 minutes
      max: 1000 * this.systemMultiplier  // Scale by system capacity
    };
    
    // Statistics tracking for monitoring and analysis
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      lastReset: Date.now()
    };
    
    // User agent caching for efficient key generation
    this.maxUserAgentCacheSize = 25;
    this.userAgentLRU = new LRUCache({ 
      max: this.maxUserAgentCacheSize, 
      updateAgeOnGet: true 
    });
    
    // Memory pressure caching with TTL
    this.memoryPressureCache = {
      value: 'medium',
      timestamp: 0,
      ttl: 5000  // 5 seconds TTL
    };
    
    // Start periodic cleanup processes
    this.startPeriodicCleanup();
  }
  
  /**
 * Get current memory pressure level with caching
 * 
 * This function analyzes the current memory usage and returns a pressure
 * level that influences cache behavior and rate limiting strategies.
 * The result is cached to avoid frequent memory usage checks.
 * 
 * @returns {string} Memory pressure level ('low', 'medium', 'high', 'critical')
 */
getMemoryPressure() {
  const now = Date.now();
  
  // Return cached value if still valid
  if (now - this.memoryPressureCache.timestamp < this.memoryPressureCache.ttl) {
    return this.memoryPressureCache.value;
  }
  
  // Get current memory usage
  const usage = process.memoryUsage();
  
  // Handle edge cases where memory info is unavailable
  if (!usage.heapTotal || usage.heapTotal <= 0) {
    this.memoryPressureCache.value = 'medium';
    this.memoryPressureCache.timestamp = now;
    return 'medium';
  }
  
  // Calculate heap usage percentage
  const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
  
  // Determine pressure level based on usage percentage
  let pressure = heapUsedPercent > 85 ? 'critical' :
                 heapUsedPercent > 70 ? 'high' :
                 heapUsedPercent > 50 ? 'medium' : 'low';
  
  // Update cache with new value
  this.memoryPressureCache.value = pressure;
  this.memoryPressureCache.timestamp = now;
  
  return pressure;
}
  
  /**
 * Adjust cache configuration based on current memory pressure
 * 
 * This function dynamically modifies cache behavior to respond to memory
 * pressure by reducing TTLs, increasing cleanup frequency, and potentially
 * flushing cache entries when memory is critically low.
 * 
 * Design Rationale:
 * - Memory safety: Prevents cache from causing memory exhaustion
 * - Adaptive performance: Maintains reasonable performance under pressure
 * - Graceful degradation: Reduces cache functionality rather than crashing
 * - Automatic recovery: Restores full caching when memory pressure subsides
 * 
 * @throws {Error} If cache adjustment fails
 */
adjustCacheForMemory() {
  try {
    const memoryPressure = this.getMemoryPressure();
    const cacheStats = this.cache.getStats();
    let newConfig = { ...this.cacheConfig };
    
    // Adjust cache settings based on memory pressure level
    switch (memoryPressure) {
      case 'critical':
        // Critical pressure: aggressive cache reduction
        newConfig.stdTTL = 300;        // 5 minutes TTL
        newConfig.checkperiod = 30;   // Check every 30 seconds
        
        // Flush cache if too many entries during critical pressure
        if (cacheStats.keys > 1000) {
          this.cache.flushAll();
          console.warn('Critical memory pressure: flushed rate limiter cache');
        }
        break;
        
      case 'high':
        // High pressure: moderate cache reduction
        newConfig.stdTTL = 600;        // 10 minutes TTL
        newConfig.checkperiod = 45;   // Check every 45 seconds
        
        // Remove oldest entries if cache is too large
        if (cacheStats.keys > 2000) {
          const keys = this.cache.keys();
          const maxDelete = Math.min(1000, Math.floor(keys.length * 0.5));
          const toDelete = keys.slice(0, maxDelete);
          this.cache.delMultiple(toDelete);
          console.warn('High memory pressure: cleaned up rate limiter cache');
        }
        break;
        
      case 'medium':
        // Medium pressure: conservative settings
        newConfig.stdTTL = 900;        // 15 minutes TTL
        newConfig.checkperiod = 60;   // Check every minute
        break;
        
      default:
        // Low pressure: optimal settings
        newConfig.stdTTL = 1200;       // 20 minutes TTL
        newConfig.checkperiod = 90;   // Check every 90 seconds
    }
    
    // Apply new configuration if it changed
    if (newConfig.stdTTL !== this.cacheConfig.stdTTL || 
        newConfig.checkperiod !== this.cacheConfig.checkperiod) {
      const oldCache = this.cache;
      this.cache = new NodeCache(newConfig);
      this.cacheConfig = newConfig;
      
      // Close old cache gracefully
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
    // Log adjustment error asynchronously to avoid blocking
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
  /**
 * Hash user agent string for efficient rate limit key generation
 * 
 * This function creates a consistent hash from user agent strings to
 * improve key distribution in rate limiting while using LRU caching
 * to avoid repeated hashing of the same user agents.
 * 
 * Design Rationale:
 * - Performance: Uses lightweight FNV-1a hash algorithm
 * - Memory efficiency: Limits user agent string length before hashing
 * - Caching: LRU cache prevents repeated hashing operations
 * - Consistency: Same user agent always produces same hash
 * - Collision resistance: 8-character hex hash provides good distribution
 * 
 * @param {string} userAgent - User agent string to hash
 * @returns {string} 8-character hexadecimal hash
 */
hashUserAgent(userAgent) {
  // Check LRU cache first for performance
  const cached = this.userAgentLRU.get(userAgent);
  if (cached !== undefined) {
    return cached;
  }
  
  // Truncate very long user agents to prevent performance issues
  const MAX_UA_LENGTH = 200;
  const truncatedUA = userAgent.length > MAX_UA_LENGTH ? 
                      userAgent.substring(0, MAX_UA_LENGTH) : 
                      userAgent;
  
  // FNV-1a hash algorithm for string hashing
  let hash = 2166136261; // FNV offset basis
  
  for (let i = 0; i < truncatedUA.length; i++) {
    hash ^= truncatedUA.charCodeAt(i);
    hash = (hash * 16777619) | 0; // FNV prime, ensure 32-bit integer
  }
  
  // Convert to 8-character hex string
  const hashResult = Math.abs(hash).toString(16).substring(0, 8);
  
  // Cache result for future use
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