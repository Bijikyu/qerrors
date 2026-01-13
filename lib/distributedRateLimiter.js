/**
 * Distributed Rate Limiter with Redis Backend and Circuit Breaker
 * 
 * This module provides a production-ready distributed rate limiting solution using
 * Redis as a shared state backend, with fallback to local memory for resilience.
 * It includes circuit breaker functionality to prevent cascading failures.
 * 
 * Key Features:
 * - Redis-based distributed rate limiting with automatic failover
 * - Local memory fallback with bounded cache for resilience
 * - Circuit breaker pattern to prevent cascading failures
 * - Memory pressure-aware operation and adaptive scaling
 * - Comprehensive metrics and monitoring capabilities
 * - Graceful degradation under load and failure conditions
 */

const Redis = require('ioredis');
const { MemoryMonitor } = require('./memoryManagement');
const config = require('./config');
const qerrors = require('./qerrors');

class DistributedRateLimiter {
  constructor(options = {}) {
    // Redis connection configuration with extensive error handling
    this.redisConfig = {
      host: options.redisHost || config.getEnv('REDIS_HOST', 'localhost'),
      port: options.redisPort || config.getInt('REDIS_PORT', 6379),
      password: options.redisPassword || config.getEnv('REDIS_PASSWORD'),
      db: options.redisDb || config.getInt('REDIS_DB', 0),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
      family: 4,
      keepAlive: 3e4
    };
    
    // Rate limiting configuration with sensible defaults
    this.defaultConfig = {
      windowMs: 6e4,
      max: 1e3,
      keyPrefix: 'rl:',
      slidingWindow: true,
      skipSuccessfulRequests: false,
      ...options
    };
    
    // Circuit breaker configuration for resilience
    this.circuitBreaker = {
      failureThreshold: options.circuitBreakerThreshold || 5,
      resetTimeout: options.circuitBreakerResetTimeout || 6e4,
      open: false,
      failureCount: 0,
      lastFailureTime: null
    };
    
    // Memory monitor for adaptive behavior
    this.memoryMonitor = new MemoryMonitor({
      warningPercent: 70,
      criticalPercent: 85,
      checkInterval: 5e3
    });
    
    // Initialize state
    this.redis = null;
    this.fallbackMode = false;
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      redisErrors: 0,
      fallbackActivations: 0,
      circuitBreakerTrips: 0,
      startTime: Date.now()
    };
    
    // Initialize Redis connection
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection with comprehensive error handling
   */
  async initializeRedis() {
    try {
      this.redis = new Redis(this.redisConfig);
      
      // Redis event handlers
      this.redis.on('connect', () => {
        this.fallbackMode = false;
        console.log('Redis connected for distributed rate limiting');
      });
      
      this.redis.on('error', (error) => {
        this.stats.redisErrors++;
        this.activateFallbackMode(error);
      });
      
      this.redis.on('close', () => {
        console.warn('Redis connection closed, activating fallback mode');
        this.activateFallbackMode(new Error('Redis connection closed'));
      });
      
      // Test connection
      if (this.redisConfig.enableReadyCheck) {
        await this.redis.ping();
      }
      
    } catch (error) {
      this.activateFallbackMode(error);
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

    /**
     * Get value from cache with LRU tracking
     */
    get(key) {
      const entry = this.cache.get(key);
      if (entry) {
        // Update access time for LRU
        this.accessOrder.set(key, Date.now());
        return entry;
      }
      return null;
    }

    /**
     * Set value in cache with memory management
     */
    set(key, value) {
      const entrySize = this.estimateEntrySize(key, value);
      
      // Check memory pressure
      if (this.isMemoryPressure()) {
        this.performEmergencyCleanup();
      }
      
      // Enforce maximum limits
      if (this.cache.size >= this.maxEntries) {
        this.evictOldest(1);
      }
      
      if (this.currentMemoryBytes + entrySize > this.maxMemoryBytes) {
        this.evictOldest(Math.ceil(this.maxEntries * 0.2));
      }
      
      this.cache.set(key, value);
      this.accessOrder.set(key, Date.now());
      this.currentMemoryBytes += entrySize;
    }

    /**
     * Check if we are under memory pressure
     */
    isMemoryPressure() {
      return this.currentMemoryBytes / this.maxMemoryBytes > this.memoryPressureThreshold;
    }

    /**
     * Perform emergency cleanup under extreme memory pressure
     */
    performEmergencyCleanup() {
      const emergencyEvictions = Math.floor(this.maxEntries * 0.5);
      console.warn(`Emergency cache cleanup: evicting ${emergencyEvictions} entries`);
      this.evictOldest(emergencyEvictions);
    }

    /**
     * Estimate memory usage of cache entry
     */
    estimateEntrySize(key, value) {
      const keySize = (key || '').length * 2; // UTF-16 approximation
      const valueSize = value ? (JSON.stringify(value).length * 2) : 0;
      return Math.min(keySize + valueSize + 100, 10000); // Cap at 10KB
    }

    /**
     * Evict oldest entries using LRU
     */
    evictOldest(count = 1) {
      const sortedEntries = Array.from(this.accessOrder.entries())
        .sort((a, b) => a[1] - b[1]);
      
      for (let i = 0; i < count && sortedEntries.length > 0; i++) {
        const oldestKey = sortedEntries[i][0];
        const value = this.cache.get(oldestKey);
        
        if (value) {
          const entrySize = this.estimateEntrySize(oldestKey, value);
          this.currentMemoryBytes = Math.max(0, this.currentMemoryBytes - entrySize);
          this.evictions++;
        }
        
        this.cache.delete(oldestKey);
        this.accessOrder.delete(oldestKey);
      }
    }

    /**
     * Start periodic cleanup timer
     */
    startPeriodicCleanup() {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
      }
      
      this.cleanupTimer = setInterval(() => {
        this.performPeriodicCleanup();
      }, this.cleanupInterval).unref();
    }

    /**
     * Perform periodic cleanup of expired entries
     */
    performPeriodicCleanup() {
      const now = Date.now();
      const keysToEvict = [];
      
      for (const [key, accessTime] of this.accessOrder.entries()) {
        if (now - accessTime > this.maxAge) {
          keysToEvict.push(key);
        }
      }
      
      for (const key of keysToEvict) {
        const value = this.cache.get(key);
        if (value) {
          const entrySize = this.estimateEntrySize(key, value);
          this.currentMemoryBytes = Math.max(0, this.currentMemoryBytes - entrySize);
        }
        this.cache.delete(key);
        this.accessOrder.delete(key);
        this.evictions++;
      }
    }

    /**
     * Get cache statistics
     */
    getStats() {
      return {
        size: this.cache.size,
        maxEntries: this.maxEntries,
        currentMemoryBytes: this.currentMemoryBytes,
        maxMemoryBytes: this.maxMemoryBytes,
        evictions: this.evictions,
        rejections: this.rejections,
        memoryUtilization: this.currentMemoryBytes / this.maxMemoryBytes
      };
    }

    /**
     * Cleanup method
     */
    cleanup() {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }
      this.cache.clear();
      this.accessOrder.clear();
      this.currentMemoryBytes = 0;
    }
  }

  /**
   * Activate fallback mode when Redis is unavailable
   */
  activateFallbackMode(error) {
    if (!this.fallbackMode) {
      this.fallbackMode = true;
      this.stats.fallbackActivations++;
      this.fallbackCache = new BoundedFallbackCache(
        this.defaultConfig.max * 10, // 10x the rate limit for cache
        this.defaultConfig.max * 5,    // 5x for requests per window
        20 // 20MB cache size
      );
      
      qerrors(error, 'distributedRateLimiter.activateFallbackMode', {
        operation: 'fallback_activation',
        totalRequests: this.stats.totalRequests
      });
    }
  }

  /**
   * Check if circuit breaker should trip
   */
  shouldTripCircuitBreaker() {
    const now = Date.now();
    const timeSinceLastFailure = now - this.circuitBreaker.lastFailureTime;
    
    // Check failure count
    if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
      // Check if failures are within reset timeout
      if (timeSinceLastFailure < this.circuitBreaker.resetTimeout) {
        return true;
      } else {
        // Reset counter if enough time has passed
        this.circuitBreaker.failureCount = 0;
      }
    }
    
    return false;
  }

  /**
   * Trip the circuit breaker
   */
  tripCircuitBreaker() {
    this.circuitBreaker.open = true;
    this.circuitBreaker.lastFailureTime = Date.now();
    this.stats.circuitBreakerTrips++;
    
    qerrors(new Error('Circuit breaker tripped'), 'distributedRateLimiter.tripCircuitBreaker', {
      failureCount: this.circuitBreaker.failureCount,
      threshold: this.circuitBreaker.failureThreshold
    });
    
    // Schedule circuit breaker reset
    setTimeout(() => {
      this.resetCircuitBreaker();
    }, this.circuitBreaker.resetTimeout);
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker() {
    this.circuitBreaker.open = false;
    this.circuitBreaker.failureCount = 0;
    console.log('Circuit breaker reset - allowing requests again');
  }

  /**
   * Generate rate limit key
   */
  generateKey(identifier, config = {}) {
    const { keyPrefix = this.defaultConfig.keyPrefix } = config;
    return `${keyPrefix}${identifier}`;
  }

  /**
   * Check if request is allowed using Redis
   */
  async checkRedisLimit(key, max) {
    if (this.fallbackMode) {
      return null;
    }
    
    try {
      const now = Date.now();
      const windowMs = this.defaultConfig.windowMs;
      const pipeline = this.redis.pipeline();
      
      if (this.defaultConfig.slidingWindow) {
        // Sliding window implementation
        const windowStart = now - windowMs;
        
        // Remove expired entries
        pipeline.zremrangebyscore(key, 0, windowStart);
        
        // Add current request
        pipeline.zadd(key, now, `${now}-${Math.random()}`);
        
        // Count requests in window
        pipeline.zcard(key);
        
        // Set expiration
        pipeline.expire(key, Math.ceil(windowMs / 1000) + 1);
        
        const results = await pipeline.exec();
        const count = results[results.length - 1][1]; // ZCARD result
        
        return {
          allowed: count <= max,
          count,
          resetTime: now + windowMs
        };
      } else {
        // Fixed window implementation
        const windowKey = `${key}:${Math.floor(now / windowMs)}`;
        
        pipeline.incr(windowKey);
        pipeline.expire(windowKey, Math.ceil(windowMs / 1000) + 1);
        
        const results = await pipeline.exec();
        const count = results[0][1];
        
        return {
          allowed: count <= max,
          count,
          resetTime: now + windowMs
        };
      }
    } catch (error) {
      this.stats.redisErrors++;
      this.activateFallbackMode(error);
      return null;
    }
  }

  /**
   * Check if request is allowed using fallback cache
   */
  checkFallbackLimit(key, max) {
    if (!this.fallbackCache || !this.fallbackMode) {
      return { allowed: false, reason: 'fallback_mode_inactive' };
    }
    
    const entry = this.fallbackCache.get(key);
    const now = Date.now();
    const windowMs = this.defaultConfig.windowMs;
    
    if (!entry) {
      this.fallbackCache.set(key, { count: 1, windowStart: now });
      return { allowed: true, count: 1 };
    }
    
    if (now - entry.windowStart > windowMs) {
      // Reset window
      this.fallbackCache.set(key, { count: 1, windowStart: now });
      return { allowed: true, count: 1 };
    }
    
    // Check against limit
    if (entry.count >= max) {
      this.stats.blockedRequests++;
      return { allowed: false, count: entry.count, reason: 'rate_limit_exceeded' };
    }
    
    // Increment count
    entry.count++;
    this.fallbackCache.set(key, entry);
    this.stats.allowedRequests++;
    return { allowed: true, count: entry.count };
  }

  /**
   * Main rate limiting check method
   */
  async isAllowed(identifier, options = {}) {
    this.stats.totalRequests++;
    
    const { max = this.defaultConfig.max } = options;
    const key = this.generateKey(identifier, options);
    
    // Check circuit breaker
    if (this.circuitBreaker.open) {
      this.stats.blockedRequests++;
      return {
        allowed: false,
        count: 0,
        resetTime: this.circuitBreaker.lastFailureTime + this.circuitBreaker.resetTimeout,
        reason: 'circuit_breaker_open'
      };
    }
    
    let result;
    
    if (!this.fallbackMode) {
      // Try Redis first
      result = await this.checkRedisLimit(key, max);
      if (result !== null) {
        if (result.allowed) {
          this.stats.allowedRequests++;
        } else {
          this.stats.blockedRequests++;
        }
        return result;
      }
    }
    
    // Use fallback
    result = this.checkFallbackLimit(key, max);
    
    // Update circuit breaker
    if (!result.allowed) {
      this.circuitBreaker.failureCount++;
      if (this.shouldTripCircuitBreaker()) {
        this.tripCircuitBreaker();
      }
    }
    
    return result;
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    const memoryStats = this.memoryMonitor.getMemoryStats();
    const fallbackStats = this.fallbackCache ? this.fallbackCache.getStats() : null;
    
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime,
      fallbackMode: this.fallbackMode,
      circuitBreaker: {
        ...this.circuitBreaker,
        state: this.circuitBreaker.open ? 'open' : 'closed'
      },
      memory: memoryStats,
      fallbackCache: fallbackStats,
      redis: {
        connected: this.redis && this.redis.status === 'ready',
        errors: this.stats.redisErrors
      }
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      redisErrors: 0,
      fallbackActivations: 0,
      circuitBreakerTrips: 0,
      startTime: Date.now()
    };
    
    if (this.fallbackCache) {
      this.fallbackCache.cleanup();
    }
  }

  /**
   * Cleanup method
   */
  async cleanup() {
    try {
      if (this.fallbackCache) {
        this.fallbackCache.cleanup();
      }
      
      if (this.redis) {
        await this.redis.quit();
        this.redis = null;
      }
      
      console.log('Distributed rate limiter cleanup completed');
    } catch (error) {
      console.error('Error during distributed rate limiter cleanup:', error);
    }
  }
}

module.exports = {
  DistributedRateLimiter,
  createLimiter: (options = {}) => new DistributedRateLimiter(options)
};