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

class EnhancedRateLimiter {
  constructor(options = {}) {
    // Memory-efficient cache with TTL
    this.cache = new NodeCache({
      stdTTL: 900, // 15 minutes default TTL
      checkperiod: 60, // Check for expired keys every minute
      useClones: false // Performance optimization
    });
    
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
    
    // Statistics for monitoring
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      endpointHits: {},
      lastReset: Date.now()
    };
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
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
      
      // Custom store using NodeCache for better memory management
      store: {
        increment: async (key) => {
          this.stats.totalRequests++;
          
          // Update endpoint statistics
          if (!this.stats.endpointHits[endpointPath]) {
            this.stats.endpointHits[endpointPath] = 0;
          }
          this.stats.endpointHits[endpointPath]++;
          
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
        },
        
        decrement: async (key) => {
          const current = this.cache.get(key) || 0;
          if (current > 0) {
            this.cache.set(key, current - 1, config.windowMs / 1000);
          }
        },
        
        resetKey: async (key) => {
          this.cache.del(key);
        },
        
        resetAll: async () => {
          this.cache.flushAll();
          this.stats.lastReset = Date.now();
        }
      },
      
      // Custom handler for rate limit exceeded
      handler: (req, res) => {
        this.stats.blockedRequests++;
        
        // Log rate limit violation for monitoring
        console.warn(`Rate limit exceeded for ${req.ip} on ${endpointPath}`);
        
        res.status(429).json({
          error: 'Rate limit exceeded',
          endpoint: endpointPath,
          retryAfter: Math.ceil(config.windowMs / 1000),
          limit: config.max * this.systemMultiplier
        });
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
   * Hash user agent for better key distribution
   */
  hashUserAgent(userAgent) {
    let hash = 0;
    for (let i = 0; i < userAgent.length; i++) {
      const char = userAgent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
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
      // Cache automatically handles cleanup, but we can force it
      this.cache.getStats(); // This triggers cleanup
      
      // Reset statistics if they get too large
      if (this.stats.totalRequests > 1000000) {
        this.stats.totalRequests = 0;
        this.stats.blockedRequests = 0;
        this.stats.endpointHits = {};
        this.stats.lastReset = Date.now();
      }
    }, 300000); // Every 5 minutes
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
    this.cache.flushAll();
    this.cache.close();
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