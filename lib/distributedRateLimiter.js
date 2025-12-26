'use strict';

/**
 * Distributed Rate Limiting System with Redis Backend
 * 
 * Provides scalable, distributed rate limiting across multiple application instances
 * using Redis as the centralized storage backend. This enables horizontal scaling
 * while maintaining consistent rate limit enforcement.
 * 
 * Key Features:
 * - Distributed storage using Redis for multi-instance deployments
 * - Atomic operations for race-condition-free rate limiting
 * - Configurable sliding window algorithms
 * - Memory-efficient storage with automatic expiration
 * - Fallback to in-memory limiting if Redis is unavailable
 * - Health monitoring and circuit breaker patterns
 */

const Redis = require('ioredis');
const { MemoryMonitor } = require('./memoryManagement');
const config = require('./config');

class DistributedRateLimiter {
  constructor(options = {}) {
    // Redis configuration
    this.redisConfig = {
      host: options.redisHost || config.getEnv('REDIS_HOST', 'localhost'),
      port: options.redisPort || config.getInt('REDIS_PORT', 6379),
      password: options.redisPassword || config.getEnv('REDIS_PASSWORD'),
      db: options.redisDb || config.getInt('REDIS_DB', 0),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // Enable keyspace notifications for expiration events
      enableReadyCheck: true,
      // Connection pooling for better performance
      family: 4,
      keepAlive: 30000
    };
    
    // Rate limiting configuration
    this.defaultConfig = {
      windowMs: 60 * 1000, // 1 minute default window
      max: 1000, // 1000 requests per window
      keyPrefix: 'rl:', // Rate limit key prefix
      slidingWindow: true, // Use sliding window algorithm
      skipSuccessfulRequests: false,
      ...options
    };
    
    // Circuit breaker configuration
    this.circuitBreaker = {
      failureThreshold: options.circuitBreakerThreshold || 5,
      resetTimeout: options.circuitBreakerResetTimeout || 60000, // 1 minute
      open: false,
      failureCount: 0,
      lastFailureTime: null
    };
    
    // Memory monitor for adaptive behavior
    this.memoryMonitor = new MemoryMonitor({
      warningPercent: 70,
      criticalPercent: 85,
      checkInterval: 5000
    });
    
    // Initialize Redis client
    this.redis = null;
    this.fallbackMode = false;
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      redisErrors: 0,
      fallbackActivations: 0,
      circuitBreakerTrips: 0,
      startTime: Date.now()
    };
    
    // Initialize connection
    this.initializeRedis();
}
}

/**
 * Bounded Fallback Cache for Memory-Efficient Rate Limiting
 */
class BoundedFallbackCache {
  constructor(maxEntries = 1000, maxRequestsPerWindow = 1000, maxMemoryMB = 10) {
    this.cache = new Map();
    this.maxEntries = maxEntries;
    this.maxRequestsPerWindow = maxRequestsPerWindow;
    this.maxMemoryBytes = maxMemoryMB * 1024 * 1024;
    this.currentMemoryBytes = 0;
    this.accessOrder = new Map(); // Track access for LRU eviction
    this.evictions = 0;
    this.rejections = 0;
    
    // Periodic cleanup configuration
    this.cleanupInterval = 60000; // 1 minute cleanup interval
    this.maxAge = 300000; // 5 minutes max age for entries
    this.cleanupTimer = null;
    
    // Memory pressure thresholds
    this.memoryPressureThreshold = 0.8; // 80% memory usage triggers cleanup
    this.emergencyThreshold = 0.95; // 95% triggers emergency cleanup
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (entry) {
      // Update access time
      this.accessOrder.set(key, Date.now());
      return entry;
    }
    return undefined;
  }

  set(key, value) {
    const oldValue = this.cache.get(key);
    const valueSize = this.estimateEntrySize(key, value);
    
    // Check if we need to make space
    if (oldValue) {
      this.currentMemoryBytes -= this.estimateEntrySize(key, oldValue);
    } else if (this.cache.size >= this.maxEntries) {
      this.evictOldest(1);
    }
    
    // Enhanced memory limits enforcement
    if (this.currentMemoryBytes + valueSize > this.maxMemoryBytes) {
      this.enforceMemoryLimits();
    }
    
    // Add entry
    this.cache.set(key, value);
    this.accessOrder.set(key, Date.now());
    this.currentMemoryBytes += valueSize;
    
    return true;
  }

  delete(key) {
    const value = this.cache.get(key);
    if (value) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.currentMemoryBytes -= this.estimateEntrySize(key, value);
      return true;
    }
    return false;
  }

  has(key) {
    return this.cache.has(key);
  }

  get size() {
    return this.cache.size;
  }

  evictOldest(count = 1) {
    let evicted = 0;
    
    // Sort by access time and remove oldest
    const sortedEntries = Array.from(this.accessOrder.entries())
      .sort((a, b) => a[1] - b[1]);
    
    for (let i = 0; i < count && i < sortedEntries.length; i++) {
      const [key] = sortedEntries[i];
      const value = this.cache.get(key);
      if (value) {
        this.currentMemoryBytes -= this.estimateEntrySize(key, value);
        this.cache.delete(key);
        this.accessOrder.delete(key);
        evicted++;
      }
    }
    
    this.evictions += evicted;
    return evicted;
  }

  rejectIfFull() {
    if (this.cache.size >= this.maxEntries || 
        this.currentMemoryBytes > this.maxMemoryBytes * 0.9) {
      this.rejections++;
      return true;
    }
    return false;
  }

  cleanupExpired(windowStart) {
    let cleaned = 0;
    
    for (const [key, data] of this.cache.entries()) {
      // Clean up expired requests in window data
      const originalLength = data.requests.length;
      data.requests = data.requests.filter(timestamp => timestamp > windowStart);
      
      // Remove entry if no requests left
      if (data.requests.length === 0) {
        this.delete(key);
        cleaned++;
      } else if (data.requests.length < originalLength) {
        // Update memory estimate for cleaned requests
        this.currentMemoryBytes -= (originalLength - data.requests.length) * 8; // 8 bytes per timestamp
      }
    }
    
    return cleaned;
  }

  estimateEntrySize(key, value) {
    // Rough estimation: key size + base object + requests array
    const keySize = (key || '').length * 2; // UTF-16
    const requestsSize = (value.requests ? value.requests.length : 0) * 8; // 8 bytes per timestamp
    const baseSize = 128; // Base object overhead
    
    return keySize + requestsSize + baseSize;
  }

  clear() {
    this.cache.clear();
    this.accessOrder.clear();
    this.currentMemoryBytes = 0;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxEntries,
      currentMemoryBytes: this.currentMemoryBytes,
      maxMemoryBytes: this.maxMemoryBytes,
      evictions: this.evictions,
      rejections: this.rejections,
      memoryUtilization: this.currentMemoryBytes / this.maxMemoryBytes
    };
  }

  /**
   * Start periodic cleanup to prevent memory leaks
   */
  startPeriodicCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.performPeriodicCleanup();
    }, this.cleanupInterval);
    
    // Don't block process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Perform periodic cleanup with memory pressure awareness
   */
  performPeriodicCleanup() {
    const now = Date.now();
    const memoryUtilization = this.currentMemoryBytes / this.maxMemoryBytes;
    let totalCleaned = 0;
    
    // Clean up expired entries
    const windowStart = now - 60000; // 1 minute window
    totalCleaned += this.cleanupExpired(windowStart);
    
    // Clean up old entries based on age
    totalCleaned += this.cleanupByAge(now);
    
    // Memory pressure cleanup
    if (memoryUtilization > this.memoryPressureThreshold) {
      const cleanupRatio = memoryUtilization > this.emergencyThreshold ? 0.5 : 0.3;
      totalCleaned += this.cleanupByMemoryPressure(cleanupRatio);
    }
    
    // Log cleanup activity if significant
    if (totalCleaned > 0) {
      console.log(`BoundedFallbackCache periodic cleanup: removed ${totalCleaned} entries, memory utilization: ${(memoryUtilization * 100).toFixed(1)}%`);
    }
  }

  /**
   * Clean up entries older than maxAge
   */
  cleanupByAge(now) {
    let cleaned = 0;
    const cutoffTime = now - this.maxAge;
    
    for (const [key, accessTime] of this.accessOrder.entries()) {
      if (accessTime < cutoffTime) {
        this.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Clean up entries based on memory pressure
   */
  cleanupByMemoryPressure(cleanupRatio) {
    const targetCleanup = Math.floor(this.cache.size * cleanupRatio);
    return this.evictOldest(targetCleanup);
  }

  /**
   * Enhanced size-based eviction with memory awareness
   */
  enforceMemoryLimits() {
    const memoryUtilization = this.currentMemoryBytes / this.maxMemoryBytes;
    
    if (memoryUtilization > this.emergencyThreshold) {
      // Emergency cleanup - remove 50% of entries
      this.cleanupByMemoryPressure(0.5);
    } else if (memoryUtilization > this.memoryPressureThreshold) {
      // Standard cleanup - remove 30% of entries
      this.cleanupByMemoryPressure(0.3);
    }
    
    // Also enforce entry count limits
    if (this.cache.size > this.maxEntries) {
      const excess = this.cache.size - this.maxEntries;
      this.evictOldest(excess);
    }
  }

  /**
   * Stop periodic cleanup (for graceful shutdown)
   */
  stopPeriodicCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Destroy cache and clean up all resources
   */
  destroy() {
    this.stopPeriodicCleanup();
    this.clear();
  }
}

/**
 * Initialize Redis connection with connection pooling for scalability
 */
  async initializeRedis() {
    try {
      // Create Redis client with connection pooling configuration
      const redisOptions = {
        ...this.redisConfig,
        // Connection pooling settings
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableOfflineQueue: false, // Disable offline queue to prevent memory buildup
        lazyConnect: true, // Connect on first use
        // Connection pool settings
        family: 4,
        keepAlive: true,
        // Scaling settings
        connectTimeout: 10000,
        commandTimeout: 5000,
        // Memory management
        maxMemoryPolicy: 'allkeys-lru'
      };
      
      this.redis = new Redis(redisOptions);
      
      // Handle connection events with proper cleanup
      this.redis.on('connect', () => {
        console.log('Distributed rate limiter connected to Redis');
        this.fallbackMode = false;
        this.resetCircuitBreaker();
      });
      
      this.redis.on('error', (error) => {
        console.error('Redis connection error in rate limiter:', error);
        this.handleRedisError(error);
      });
      
      this.redis.on('close', () => {
        console.warn('Redis connection closed in rate limiter');
        this.fallbackMode = true;
      });
      
      this.redis.on('end', () => {
        console.log('Redis connection ended in rate limiter');
        this.fallbackMode = true;
      });
      
      // Test connection with timeout
      await Promise.race([
        this.redis.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
        )
      ]);
      
      console.log('Redis connection pool initialized for distributed rate limiting');
      
    } catch (error) {
      console.error('Failed to initialize Redis connection pool:', error);
      this.handleRedisError(error);
    }
  }
  }
  
  /**
   * Handle Redis errors with circuit breaker logic
   */
  handleRedisError(error) {
    this.stats.redisErrors++;
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    // Check if circuit breaker should trip
    if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
      this.tripCircuitBreaker();
    }
    
    // Enable fallback mode if Redis is unavailable
    if (!this.fallbackMode) {
      this.fallbackMode = true;
      this.stats.fallbackActivations++;
      console.warn('Rate limiter switching to fallback mode due to Redis errors');
    }
  }
  
  /**
   * Trip circuit breaker to prevent cascading failures
   */
  tripCircuitBreaker() {
    if (!this.circuitBreaker.open) {
      this.circuitBreaker.open = true;
      this.stats.circuitBreakerTrips++;
      console.error('Rate limiter circuit breaker tripped due to Redis failures');
    }
  }
  
  /**
   * Reset circuit breaker after timeout
   */
  resetCircuitBreaker() {
    if (this.circuitBreaker.open) {
      this.circuitBreaker.open = false;
      this.circuitBreaker.failureCount = 0;
      this.circuitBreaker.lastFailureTime = null;
      console.log('Rate limiter circuit breaker reset');
    }
  }
  
  /**
   * Check if circuit breaker should be reset
   */
  checkCircuitBreakerReset() {
    if (this.circuitBreaker.open && this.circuitBreaker.lastFailureTime) {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
      if (timeSinceLastFailure >= this.circuitBreaker.resetTimeout) {
        this.resetCircuitBreaker();
        // Attempt to reconnect to Redis
        this.initializeRedis();
      }
    }
  }
  
  /**
   * Generate rate limit key for Redis
   */
  generateKey(identifier, endpoint = 'global') {
    const sanitizedId = String(identifier).replace(/[^a-zA-Z0-9_:-]/g, '');
    const sanitizedEndpoint = String(endpoint).replace(/[^a-zA-Z0-9_:-]/g, '');
    return `${this.defaultConfig.keyPrefix}${sanitizedEndpoint}:${sanitizedId}`;
  }
  
  /**
   * Implement sliding window rate limiting using Redis
   */
  async checkSlidingWindow(key, limit, windowMs) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Use Lua script for atomic sliding window operations
    const luaScript = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local window_start = tonumber(ARGV[2])
      local limit = tonumber(ARGV[3])
      
      -- Remove expired entries
      redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
      
      -- Count current requests
      local current = redis.call('ZCARD', key)
      
      -- Check if limit exceeded
      if current >= limit then
        return {current, 1}
      end
      
      -- Add current request
      redis.call('ZADD', key, now, now)
      redis.call('EXPIRE', key, math.ceil(ARGV[2] / 1000) + 1)
      
      return {current + 1, 0}
    `;
    
    try {
      const result = await this.redis.eval(luaScript, 1, key, now, windowStart, limit);
      return {
        currentCount: result[0],
        limitExceeded: result[1] === 1,
        resetTime: now + windowMs
      };
    } catch (error) {
      throw new Error(`Redis sliding window error: ${error.message}`);
    }
  }
  
  /**
   * Implement fixed window rate limiting using Redis
   */
  async checkFixedWindow(key, limit, windowMs) {
    const now = Date.now();
    const windowKey = `${key}:${Math.floor(now / windowMs)}`;
    
    try {
      // Use atomic increment with expiration
      const pipeline = this.redis.pipeline();
      pipeline.incr(windowKey);
      pipeline.expire(windowKey, Math.ceil(windowMs / 1000) + 1);
      
      const results = await pipeline.exec();
      const currentCount = results[0][1];
      
      return {
        currentCount,
        limitExceeded: currentCount > limit,
        resetTime: (Math.floor(now / windowMs) + 1) * windowMs
      };
    } catch (error) {
      throw new Error(`Redis fixed window error: ${error.message}`);
    }
  }
  
  /**
   * Main rate limiting check method
   */
  async checkRateLimit(identifier, endpoint = 'global', options = {}) {
    this.stats.totalRequests++;
    
    // Check circuit breaker
    this.checkCircuitBreakerReset();
    if (this.circuitBreaker.open) {
      return this.fallbackCheck(identifier, endpoint, options);
    }
    
    const config = { ...this.defaultConfig, ...options };
    const key = this.generateKey(identifier, endpoint);
    
    try {
      let result;
      
      if (config.slidingWindow) {
        result = await this.checkSlidingWindow(key, config.max, config.windowMs);
      } else {
        result = await this.checkFixedWindow(key, config.max, config.windowMs);
      }
      
      if (result.limitExceeded) {
        this.stats.blockedRequests++;
      } else {
        this.stats.allowedRequests++;
      }
      
      return result;
      
    } catch (error) {
      console.error('Distributed rate limiting error, falling back:', error.message);
      return this.fallbackCheck(identifier, endpoint, options);
    }
  }
  
  /**
   * Fallback in-memory rate limiting when Redis is unavailable
   */
  fallbackCheck(identifier, endpoint = 'global', options = {}) {
    if (!this.fallbackCache) {
      this.fallbackCache = new BoundedFallbackCache(
        1000, // max entries
        1000, // max requests per window
        Math.max(5, Math.floor(require('os').freemem() / (100 * 1024 * 1024))) // Max 5% of free memory
      );
    }
    
    const config = { ...this.defaultConfig, ...options };
    const key = `${endpoint}:${identifier}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // Get or initialize window data
    let windowData = this.fallbackCache.get(key) || { requests: [], lastCleanup: now };
    
    // Clean up expired requests
    windowData.requests = windowData.requests.filter(timestamp => timestamp > windowStart);
    
    // Check limit
    const currentCount = windowData.requests.length;
    const limitExceeded = currentCount >= config.max;
    
    if (!limitExceeded) {
      windowData.requests.push(now);
    }
    
    // Store updated data
    this.fallbackCache.set(key, windowData);
    
    // Cleanup old entries periodically
    if (this.fallbackCache.size > 10000) {
      this.cleanupFallbackCache();
    }
    
    if (limitExceeded) {
      this.stats.blockedRequests++;
    } else {
      this.stats.allowedRequests++;
    }
    
    return {
      currentCount,
      limitExceeded,
      resetTime: now + config.windowMs,
      fallbackMode: true
    };
  }
  
  /**
   * Cleanup fallback cache to prevent memory leaks with bounded growth
   */
  cleanupFallbackCache() {
     if (!this.fallbackCache) return;
     
     const now = Date.now();
     const defaultWindow = this.defaultConfig.windowMs;
     const windowStart = now - defaultWindow;
     
     // Use BoundedFallbackCache's efficient cleanup method
     const cleanedCount = this.fallbackCache.cleanupExpired(windowStart);
     
     if (cleanedCount > 0) {
       console.log(`Cleaned up ${cleanedCount} expired entries from fallback rate limiter cache`);
     }
   }
  
  /**
   * Create Express middleware for rate limiting
   */
  createMiddleware(endpoint = 'global', options = {}) {
    return async (req, res, next) => {
      // Generate identifier from IP and optionally user agent
      const identifier = this.generateIdentifier(req);
      
      try {
        const result = await this.checkRateLimit(identifier, endpoint, options);
        
        if (result.limitExceeded) {
          const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
          
          res.set({
            'X-RateLimit-Limit': options.max || this.defaultConfig.max,
            'X-RateLimit-Remaining': Math.max(0, (options.max || this.defaultConfig.max) - result.currentCount),
            'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
            'Retry-After': retryAfter
          });
          
          return res.status(429).json({
            error: 'Rate limit exceeded',
            endpoint,
            retryAfter,
            limit: options.max || this.defaultConfig.max,
            current: result.currentCount,
            fallbackMode: result.fallbackMode || false
          });
        }
        
        // Add rate limit headers for successful requests
        res.set({
          'X-RateLimit-Limit': options.max || this.defaultConfig.max,
          'X-RateLimit-Remaining': Math.max(0, (options.max || this.defaultConfig.max) - result.currentCount),
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
        });
        
        next();
        
      } catch (error) {
        console.error('Rate limiting middleware error:', error);
        // Allow request through if rate limiting fails
        next();
      }
    };
  }
  
  /**
   * Generate unique identifier for rate limiting
   */
  generateIdentifier(req) {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    // Create hash from IP and user agent for better distribution
    let hash = 0;
    const identifier = `${ip}:${userAgent}`;
    
    for (let i = 0; i < identifier.length; i++) {
      const char = identifier.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `${ip}_${Math.abs(hash).toString(36)}`;
  }
  
  /**
   * Get comprehensive statistics
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    const memoryStats = this.memoryMonitor.getMemoryStats();
    
    return {
      ...this.stats,
      uptime,
      requestsPerSecond: this.stats.totalRequests / (uptime / 1000),
      blockRate: this.stats.totalRequests > 0 ? this.stats.blockedRequests / this.stats.totalRequests : 0,
      circuitBreaker: {
        open: this.circuitBreaker.open,
        failureCount: this.circuitBreaker.failureCount,
        lastFailureTime: this.circuitBreaker.lastFailureTime
      },
      fallbackMode: this.fallbackMode,
      fallbackCacheSize: this.fallbackCache ? this.fallbackCache.size : 0,
      memory: memoryStats,
      redis: {
        connected: this.redis ? this.redis.status === 'ready' : false,
        status: this.redis ? this.redis.status : 'disconnected'
      }
    };
  }
  
  /**
   * Reset rate limit for specific identifier
   */
  async resetRateLimit(identifier, endpoint = 'global') {
    const key = this.generateKey(identifier, endpoint);
    
    if (this.redis && !this.fallbackMode) {
      try {
        await this.redis.del(key);
        return true;
      } catch (error) {
        console.error('Failed to reset rate limit in Redis:', error);
        return false;
      }
    }
    
    // Fallback cache reset
    if (this.fallbackCache) {
      this.fallbackCache.delete(`${endpoint}:${identifier}`);
    }
    
    return true;
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('Shutting down distributed rate limiter...');
    
    if (this.redis) {
      await this.redis.quit();
    }
    
    if (this.memoryMonitor) {
      this.memoryMonitor.stop();
    }
    
    console.log('Distributed rate limiter shutdown complete');
  }
}

// Singleton instance
let distributedRateLimiter = null;

/**
 * Get or create distributed rate limiter instance
 */
function getDistributedRateLimiter(options = {}) {
  if (!distributedRateLimiter) {
    distributedRateLimiter = new DistributedRateLimiter(options);
  }
  return distributedRateLimiter;
}

/**
 * Create distributed rate limiting middleware
 */
function createDistributedRateLimitMiddleware(endpoint, options = {}) {
  const limiter = getDistributedRateLimiter(options);
  return limiter.createMiddleware(endpoint, options);
}

module.exports = {
  DistributedRateLimiter,
  getDistributedRateLimiter,
  createDistributedRateLimitMiddleware
};