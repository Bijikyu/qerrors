'use strict';

/**
 * HTTP Client for AI API Requests with Advanced Retry Logic
 * 
 * This module provides a specialized HTTP client optimized for AI API requests
 * with sophisticated retry mechanisms, connection pooling, and rate limit handling.
 * It's designed to handle the specific challenges of AI API interactions including
 * transient failures, rate limiting, and cost optimization.
 * 
 * Key Features:
 * - Intelligent Retry Logic: Exponential backoff with jitter and custom retry headers
 * - Connection Pooling: Optimized for AI API request patterns
 * - Rate Limit Awareness: Respects provider-specific rate limit headers
 * - Size Limits: Prevents excessive data transfer costs
 * - Provider Headers: Proper User-Agent and Content-Type for API compatibility
 * 
 * Economic Considerations:
 * - Retry logic prevents unnecessary API failures that waste analysis opportunities
 * - Connection pooling reduces overhead for frequent API calls
 * - Size limits prevent runaway costs from large payloads
 * - Rate limit handling prevents expensive API quota overages
 */

// Core HTTP dependencies for AI API communication
const axios = require('axios');     // HTTP client with interceptors and error handling
const http = require('http');        // Node.js HTTP module for connection pooling
const https = require('https');      // Node.js HTTPS module for secure connections
const config = require('./config');  // Environment configuration management
const localVars = require('../config/localVars'); // Local configuration variables
const qerrors = require('./qerrors'); // Error reporting and analysis
const { MAX_SOCKETS, MAX_FREE_SOCKETS } = localVars; // Connection pool limits

/**
 * Token bucket rate limiter for AI API calls
 * 
 * Purpose: Prevents API rate limit violations and cost overruns by
 * implementing token bucket algorithm with configurable limits and
 * automatic refill rate.
 * 
 * Benefits:
 * - Prevents API quota exhaustion
 * - Smooths request bursts
 * - Configurable for different providers
 * - Memory efficient implementation
 */
class TokenBucketRateLimiter {
  constructor(maxTokens = 60, refillRate = 1) {
    this.maxTokens = maxTokens;      // Maximum tokens in bucket
    this.tokens = maxTokens;         // Current tokens (start full)
    this.refillRate = refillRate;    // Tokens added per second
    this.lastRefill = Date.now();    // Last refill timestamp
  }

  /**
   * Try to consume a token for API call
   * @param {number} tokens - Number of tokens to consume (default: 1)
   * @returns {boolean} True if token available and consumed, false otherwise
   */
  tryConsume(tokens = 1) {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  /**
   * Get wait time for next available token
   * @returns {number} Milliseconds until next token available
   */
  getNextAvailableTime() {
    this.refill();
    
    if (this.tokens >= 1) {
      return 0;
    }
    
    const tokensNeeded = 1 - this.tokens;
    return Math.ceil(tokensNeeded / this.refillRate * 1000);
  }

  /**
   * Refill tokens based on elapsed time
   */
  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // Convert to seconds
    
    if (elapsed > 0) {
      const newTokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
      this.tokens = newTokens;
      this.lastRefill = now;
    }
  }
}

/**
 * Global rate limiters for different API providers
 */
const rateLimiters = {
  openai: new TokenBucketRateLimiter(
    config.getInt('QERRORS_RATE_LIMIT_OPENAI_TOKENS', 60),
    config.getInt('QERRORS_RATE_LIMIT_OPENAI_REFILL', 1)
  ),
  generic: new TokenBucketRateLimiter(
    config.getInt('QERRORS_RATE_LIMIT_GENERIC_TOKENS', 30),
    config.getInt('QERRORS_RATE_LIMIT_GENERIC_REFILL', 0.5)
  )
};

/**
 * Configured axios instance optimized for AI API requests
 * 
 * This instance is pre-configured with settings optimized for AI API interactions:
 * - Connection pooling for performance with frequent API calls
 * - Keep-alive connections to reduce TCP handshake overhead
 * - Size limits to prevent cost overruns from large payloads
 * - Proper headers for API compatibility and identification
 * - Reasonable timeout to prevent hanging requests
 */
const axiosInstance = axios.create({
// HTTP connection agent for connection pooling and reuse - optimized for high load
  httpAgent: new http.Agent({
    keepAlive: true,              // Reuse connections for multiple requests
    maxSockets: Math.min(100, MAX_SOCKETS || 50),  // Dynamic sizing for high load
    maxFreeSockets: 20,           // Increased idle connections for better reuse
    timeout: 10000,               // Reduced timeout for faster failure detection
    scheduling: 'fifo',           // FIFO scheduling for better fairness under load
    keepAliveMsecs: 30000,        // Keep connections alive for 30 seconds
    freeSocketTimeout: 15000      // Free idle sockets after 15 seconds
  }),
  
  // HTTPS connection agent with optimized pooling strategy for secure requests
  httpsAgent: new https.Agent({
    keepAlive: true,              // Reuse SSL connections (avoids handshake overhead)
    maxSockets: Math.min(100, MAX_SOCKETS || 50),  // Dynamic sizing for high load
    maxFreeSockets: 20,           // Increased idle secure connections for better reuse
    timeout: 10000,               // Reduced timeout for faster failure detection
    scheduling: 'fifo',           // FIFO scheduling for better fairness under load
    keepAliveMsecs: 30000,        // Keep SSL connections alive for 30 seconds
    freeSocketTimeout: 15000,     // Free idle SSL sockets after 15 seconds
    rejectUnauthorized: true      // Ensure SSL security
  }),
  
  // Request timeout to prevent hanging on unresponsive APIs
  timeout: config.getInt('QERRORS_TIMEOUT', 10000), // Default 10 seconds
  
  // Headers required for AI API compatibility
  headers: {
    'User-Agent': 'qerrors/1.2.7',  // Identify client for provider tracking
    'Content-Type': 'application/json' // Standard JSON content type for AI APIs
  },
  
  // Size limits to prevent cost overruns and resource exhaustion
  maxContentLength: 1024 * 1024, // 1MB max response size
  maxBodyLength: 1024 * 1024    // 1MB max request body size
});

/**
   * HTTP POST request with intelligent retry logic and request batching for AI API interactions
   * 
   * This function implements sophisticated retry strategies optimized for AI API patterns:
   * - Exponential backoff with jitter to prevent thundering herd problems
   * - Custom retry header handling for provider-specific rate limits
   * - Flexible retry configuration for different deployment scenarios
   * - Graceful handling of various retry-after header formats
   * - Request deduplication to prevent duplicate API calls
   * - Response caching for identical requests
   * 
   * The function is specifically designed to handle the retry patterns common in AI APIs
   * including OpenAI's custom retry-after-ms header and standard HTTP retry-after headers.
   * 
   * @param {string} url - API endpoint URL
   * @param {Object} data - Request payload to send
   * @param {Object} opts - Additional axios options
   * @param {number} capMs - Optional override for maximum retry delay
   * @returns {Promise<Object>} HTTP response from successful request
   * @throws {Error} Last error if all retries are exhausted
   */
  async function postWithRetry(url, data, opts, capMs) {
    try {
      // Create request key for deduplication (async for large objects)
      const requestKey = await createRequestKeyAsync(url, data);
      
      // Check if identical request is already in progress
      if (pendingRequests.has(requestKey)) {
        return pendingRequests.get(requestKey);
      }
      
      // Enforce pending requests size limit
      if (pendingRequests.size >= MAX_PENDING_REQUESTS) {
        // Remove oldest pending request (simple FIFO)
        const firstKey = pendingRequests.keys().next().value;
        if (firstKey) {
          pendingRequests.delete(firstKey);
        }
      }
      
      // Create request promise
      const requestPromise = executeRequestWithRetry(url, data, opts, capMs);
      
      // Add to pending requests
      pendingRequests.set(requestKey, requestPromise);
      
      try {
        const result = await requestPromise;
        
        // Cache successful responses with LRU eviction
        if (responseCache.size >= MAX_RESPONSE_CACHE_SIZE) {
          // Remove least recently used entry
          const lruKey = responseCacheAccess.keys().next().value;
          if (lruKey) {
            responseCache.delete(lruKey);
            responseCacheAccess.delete(lruKey);
          }
        }
        
        const cacheEntry = {
          data: result,
          timestamp: Date.now(),
          ttl: config.getInt('QERRORS_RESPONSE_CACHE_TTL', 300000) // 5 minutes default
        };
        
        responseCache.set(requestKey, cacheEntry);
        responseCacheAccess.set(requestKey, Date.now());
        
        return result;
      } catch (requestError) {
        qerrors(requestError, 'qerrorsHttpClient.postWithRetry.request', {
          operation: 'http_request_execution',
          url: url,
          hasData: !!data,
          pendingRequestsCount: pendingRequests.size
        });
        throw requestError;
      } finally {
        // Clean up pending request
        pendingRequests.delete(requestKey);
      }
    } catch (error) {
      qerrors(error, 'qerrorsHttpClient.postWithRetry', {
        operation: 'http_post_with_retry',
        url: url,
        hasData: !!data,
        hasOpts: !!opts
      });
      throw error;
    }
  }

/**
   * Async request key creation to prevent blocking on large JSON objects
   * 
   * Uses setImmediate for large objects to prevent blocking the event loop,
   * while using synchronous JSON.stringify for small objects for better performance.
   * 
   * @param {string} url - API endpoint URL
   * @param {Object} data - Request payload to serialize
   * @returns {Promise<string>} Request key for deduplication
   */
  async function createRequestKeyAsync(url, data) {
    try {
      // Estimate object size to determine if async processing is needed
      const estimatedSize = JSON.stringify(data).length;
      
      // Use async processing for large objects (>10KB) to prevent blocking
      if (estimatedSize > 10240) {
        return new Promise((resolve, reject) => {
          setImmediate(() => {
            try {
              const jsonString = JSON.stringify(data);
              resolve(`${url}:${jsonString}`);
            } catch (error) {
              qerrors(error, 'qerrorsHttpClient.createRequestKeyAsync.async', {
                operation: 'async_request_key_creation',
                url: url,
                estimatedSize: estimatedSize
              });
              reject(error);
            }
          });
        });
      }
      
      // Use synchronous processing for small objects
      return `${url}:${JSON.stringify(data)}`;
    } catch (error) {
      qerrors(error, 'qerrorsHttpClient.createRequestKeyAsync', {
        operation: 'request_key_creation',
        url: url,
        hasData: !!data
      });
      throw error;
    }
  }

/**
   * HTTP POST with retry logic and circuit breaker integration
   * 
   * Features comprehensive error handling for AI API interactions:
   * - Exponential backoff with jitter for retry storms
   * - Custom retry-after-ms header support (OpenAI specific)
   * - Standard HTTP retry-after header parsing
   * - Circuit breaker integration for fail-fast patterns
   * - Response caching for identical requests
   * 
   * The function is specifically designed to handle the retry patterns common in AI APIs
   * including OpenAI's custom retry-after-ms header and standard HTTP retry-after headers.
   * 
   * @param {string} url - API endpoint URL
   * @param {Object} data - Request payload to send
   * @param {Object} opts - Additional axios options
   * @param {number} capMs - Optional override for maximum retry delay
   * @returns {Promise<Object>} HTTP response from successful request
   * @throws {Error} Last error if all retries are exhausted
   */
  async function executeRequestWithRetry(url, data, opts, capMs) {
    try {
      // Load retry configuration with safe defaults
      const retries = config.getInt('QERRORS_RETRY_ATTEMPTS', 2);  // Total retry attempts
      const base = config.getInt('QERRORS_RETRY_BASE_MS', 100);   // Base delay in milliseconds
      const cap = capMs !== undefined 
        ? capMs 
        : config.getInt('QERRORS_RETRY_MAX_MS', 0);               // Maximum delay cap
      
      // Apply rate limiting before making request
      const rateLimitEnabled = config.getBool('QERRORS_RATE_LIMIT_ENABLED', true);
      if (rateLimitEnabled) {
        try {
          // Determine which rate limiter to use based on URL
          const limiter = url.includes('openai.com') ? rateLimiters.openai : rateLimiters.generic;
          
          // Wait for rate limit if needed
          const waitTime = limiter.getNextAvailableTime();
          if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
          // Try to consume token, if failed, throw rate limit error
          if (!limiter.tryConsume()) {
            const error = new Error('Rate limit exceeded - no tokens available');
            error.code = 'RATE_LIMIT_EXCEEDED';
            error.status = 429;
            qerrors(error, 'qerrorsHttpClient.executeRequestWithRetry.rateLimit', {
              operation: 'rate_limit_check',
              url: url,
              limiterType: url.includes('openai.com') ? 'openai' : 'generic'
            });
            throw error;
          }
        } catch (rateLimitError) {
          // Only log if it's not our rate limit error
          if (rateLimitError.code !== 'RATE_LIMIT_EXCEEDED') {
            qerrors(rateLimitError, 'qerrorsHttpClient.executeRequestWithRetry.rateLimitError', {
              operation: 'rate_limiting',
              url: url
            });
          }
          throw rateLimitError;
        }
      }
      
      // Execute request through circuit breaker to prevent cascading failures
      return await circuitBreaker.execute(async () => {
        // Attempt request with retries
        for (let i = 0; i <= retries; i++) {
          try {
            // Make the actual HTTP request
            return await axiosInstance.post(url, data, opts);
          } catch (err) {
            // If this was the last attempt, rethrow the error
            if (i >= retries) {
              qerrors(err, 'qerrorsHttpClient.executeRequestWithRetry.exhausted', {
                operation: 'http_request_retries_exhausted',
                url: url,
                attempt: i + 1,
                maxAttempts: retries + 1,
                httpStatus: err.response?.status,
                errorCode: err.code
              });
              throw err;
            }
            
            // Calculate exponential backoff with jitter to prevent synchronized retries
            const jitter = Math.random() * base;  // Add randomness to prevent thundering herd
            let wait = base * 2 ** i + jitter;   // Exponential backoff: base * 2^attempt
            
            // Handle provider-specific rate limit responses
            if (err.response && (err.response.status === 429 || err.response.status === 503)) {
              // Priority 1: Check for OpenAI's custom retry_after_ms header
              const retryAfterMs = err.response.headers?.['retry-after-ms'];
              if (retryAfterMs) {
                const ms = Number(retryAfterMs);
                if (!Number.isNaN(ms) && ms > 0) {
                  wait = ms;  // Use provider-specified delay exactly
                }
              } else {
                // Priority 2: Fall back to standard HTTP retry-after header
                const retryAfter = err.response.headers?.['retry-after'];
                if (retryAfter) {
                  // Handle numeric retry-after (seconds)
                  const secs = Number(retryAfter);
                  if (!Number.isNaN(secs)) {
                    wait = secs * 1000;  // Convert seconds to milliseconds
                  } else {
                    // Handle HTTP-date format retry-after
                    const date = Date.parse(retryAfter);
                    if (!Number.isNaN(date)) {
                      wait = date - Date.now();  // Calculate milliseconds until specified time
                    }
                  }
                } else {
                  // Fallback: Double the wait time for standard rate limiting
                  wait *= 2;
                }
              }
            }
            
            // Apply maximum delay cap if configured
            if (cap > 0 && wait > cap) {
              wait = cap;
            }
            
            // Log retry attempt
            qerrors(err, 'qerrorsHttpClient.executeRequestWithRetry.retry', {
              operation: 'http_request_retry',
              url: url,
              attempt: i + 1,
              maxAttempts: retries + 1,
              waitTime: wait,
              httpStatus: err.response?.status
            });
            
            // Wait before next retry attempt
            await new Promise(r => setTimeout(r, wait));
          }
        }
      });
    } catch (error) {
      qerrors(error, 'qerrorsHttpClient.executeRequestWithRetry', {
        operation: 'http_request_with_retry',
        url: url,
        hasData: !!data,
        hasOpts: !!opts
      });
      throw error;
    }
  }

/**
 * Enhanced circuit breaker with adaptive thresholds and intelligent scaling
 */
class CircuitBreaker {
  constructor(options = {}) {
    // Dynamic configuration based on system resources and endpoint characteristics
    const os = require('os');
    const cpuCount = os.cpus().length;
    
    // Adaptive failure threshold based on system capacity
    this.baseFailureThreshold = options.failureThreshold || 5;
    this.failureThreshold = Math.max(3, Math.min(20, this.baseFailureThreshold + Math.floor(cpuCount / 2)));
    
    // Adaptive recovery timeout based on expected API response times
    this.baseRecoveryTimeout = options.recoveryTimeout || 60000; // 1 minute
    this.recoveryTimeout = this.baseRecoveryTimeout;
    
    // Enhanced monitoring with adaptive periods
    this.monitoringPeriod = options.monitoringPeriod || 300000; // 5 minutes
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.windowStart = Date.now();
    
    // Enhanced tracking for intelligent scaling
    this.responseTimeHistory = [];
    this.errorRateHistory = [];
    this.lastStateChange = Date.now();
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures = 0;
    
    // Adaptive thresholds
    this.adaptiveThresholds = {
      enabled: options.adaptiveThresholds !== false,
      errorRateThreshold: 0.1, // 10% error rate
      responseTimeThreshold: 5000, // 5 seconds
      minFailureThreshold: 3,
      maxFailureThreshold: 50
    };
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      stateChanges: 0,
      lastStateChange: null
    };
  }

  async execute(operation) {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    
    try {
      // Check state and handle transitions
      if (this.state === 'OPEN') {
        const timeSinceLastFailure = Date.now() - this.lastFailureTime;
        
        // Adaptive recovery timeout based on failure patterns
        const adaptiveRecoveryTime = this.calculateAdaptiveRecoveryTime();
        
        if (timeSinceLastFailure > adaptiveRecoveryTime) {
          this.transitionToHalfOpen();
        } else {
          const error = new Error(`Circuit breaker is OPEN - preventing cascading failures. Recovery in ${Math.ceil((adaptiveRecoveryTime - timeSinceLastFailure) / 1000)}s`);
          qerrors(error, 'qerrorsHttpClient.CircuitBreaker.execute.open', {
            operation: 'circuit_breaker_open',
            state: this.state,
            timeSinceLastFailure,
            adaptiveRecoveryTime,
            failureCount: this.failureCount
          });
          throw error;
        }
      }

      try {
        const result = await operation();
        const responseTime = Date.now() - startTime;
        
        this.onSuccess(responseTime);
        return result;
      } catch (operationError) {
        this.onFailure(operationError, Date.now() - startTime);
        throw operationError;
      }
    } catch (error) {
      qerrors(error, 'qerrorsHttpClient.CircuitBreaker.execute', {
        operation: 'circuit_breaker_execution',
        state: this.state,
        failureCount: this.failureCount,
        totalRequests: this.metrics.totalRequests
      });
      throw error;
    }
  }

  onSuccess(responseTime) {
    this.metrics.successfulRequests++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    
    // Track response time for adaptive thresholds
    this.updateResponseTimeHistory(responseTime);
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      
      // Adaptive success requirement based on performance
      const requiredSuccesses = this.calculateRequiredSuccesses();
      
      if (this.successCount >= requiredSuccesses) {
        this.transitionToClosed();
      }
    } else {
      // Adaptive threshold adjustment in closed state
      this.adjustThresholds();
      
      // Reset failure count on success in closed state
      const now = Date.now();
      if (now - this.windowStart > this.monitoringPeriod) {
        this.failureCount = 0;
        this.windowStart = now;
      }
    }
  }

  onFailure(error, responseTime) {
    this.metrics.failedRequests++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    
    // Track error patterns for adaptive behavior
    this.updateErrorRateHistory(error);
    this.updateResponseTimeHistory(responseTime);
    
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.transitionToOpen();
    } else if (this.shouldTripOpen()) {
      this.transitionToOpen();
    }
  }

  /**
   * Calculate adaptive recovery time based on failure patterns
   */
  calculateAdaptiveRecoveryTime() {
    // Exponential backoff based on consecutive failures
    const baseTime = this.baseRecoveryTimeout;
    const backoffMultiplier = Math.min(5, Math.pow(1.5, Math.floor(this.consecutiveFailures / 3)));
    
    return Math.floor(baseTime * backoffMultiplier);
  }

  /**
   * Calculate required successes for half-open state
   */
  calculateRequiredSuccesses() {
    // More successes required if failures were severe
    const baseRequired = 3;
    const severityMultiplier = Math.min(3, Math.ceil(this.failureCount / this.failureThreshold));
    
    return baseRequired * severityMultiplier;
  }

  /**
   * Determine if circuit should trip to open state
   */
  shouldTripOpen() {
    // Standard threshold check
    if (this.failureCount >= this.failureThreshold) {
      return true;
    }
    
    // Adaptive threshold check based on error rate
    if (this.adaptiveThresholds.enabled) {
      const recentErrorRate = this.calculateRecentErrorRate();
      if (recentErrorRate > this.adaptiveThresholds.errorRateThreshold) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Update response time history for adaptive thresholds with bounded memory usage
   */
  updateResponseTimeHistory(responseTime) {
     // Enforce maximum history size to prevent memory growth
     const MAX_HISTORY_SIZE = 100;
     
     this.responseTimeHistory.push({
       time: responseTime,
       timestamp: Date.now()
     });
     
     // Keep only recent history (bounded size)
     if (this.responseTimeHistory.length > MAX_HISTORY_SIZE) {
       this.responseTimeHistory = this.responseTimeHistory.slice(-MAX_HISTORY_SIZE);
     }
     
     // Update average response time metric with memory-safe calculation
     const recentHistory = this.responseTimeHistory.slice(-20); // Use only recent 20 for avg
     const avgTime = recentHistory.reduce((sum, entry) => sum + entry.time, 0) / recentHistory.length;
     this.metrics.avgResponseTime = Math.round(avgTime);
   }

  /**
   * Update error rate history with bounded memory usage
   */
  updateErrorRateHistory(error) {
     // Enforce maximum history size to prevent memory growth
     const MAX_ERROR_HISTORY = 50;
     
     this.errorRateHistory.push({
       error: error.message || 'Unknown error',
       timestamp: Date.now()
     });
     
// Keep only recent history (bounded size)
      if (this.errorRateHistory.length > MAX_ERROR_HISTORY) {
        this.errorRateHistory = this.errorRateHistory.slice(-MAX_ERROR_HISTORY);
      }
    }

  /**
   * Calculate recent error rate
   */
  calculateRecentErrorRate() {
    if (this.metrics.totalRequests === 0) return 0;
    
    const recentRequests = Math.min(20, this.metrics.totalRequests);
    const recentFailures = this.errorRateHistory.slice(-recentRequests).length;
    
    return recentFailures / recentRequests;
  }

  /**
   * Adjust thresholds based on performance patterns
   */
  adjustThresholds() {
    if (!this.adaptiveThresholds.enabled) return;
    
    const errorRate = this.calculateRecentErrorRate();
    const avgResponseTime = this.metrics.avgResponseTime;
    
    // Adjust failure threshold based on performance
    if (errorRate < 0.05 && avgResponseTime < this.adaptiveThresholds.responseTimeThreshold) {
      // Good performance - can be more lenient
      this.failureThreshold = Math.min(
        this.adaptiveThresholds.maxFailureThreshold,
        this.failureThreshold + 1
      );
    } else if (errorRate > 0.15 || avgResponseTime > this.adaptiveThresholds.responseTimeThreshold * 2) {
      // Poor performance - be more strict
      this.failureThreshold = Math.max(
        this.adaptiveThresholds.minFailureThreshold,
        this.failureThreshold - 1
      );
    }
  }

  /**
   * State transition methods
   */
  transitionToOpen() {
    this.state = 'OPEN';
    this.lastStateChange = Date.now();
    this.metrics.stateChanges++;
    console.warn(`Circuit breaker opened due to ${this.failureCount} failures`);
  }

  transitionToHalfOpen() {
    this.state = 'HALF_OPEN';
    this.lastStateChange = Date.now();
    this.successCount = 0;
    this.metrics.stateChanges++;
    console.info('Circuit breaker entering half-open state for testing');
  }

  transitionToClosed() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastStateChange = Date.now();
    this.metrics.stateChanges++;
    console.info('Circuit breaker closed - service recovered');
  }

  /**
   * Enhanced state information
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
      failureThreshold: this.failureThreshold,
      recoveryTimeout: this.recoveryTimeout,
      metrics: this.metrics,
      adaptiveThresholds: this.adaptiveThresholds.enabled ? {
        errorRate: this.calculateRecentErrorRate(),
        avgResponseTime: this.metrics.avgResponseTime
      } : null
    };
  }
}

// Global circuit breaker instance
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  recoveryTimeout: 60000,
  monitoringPeriod: 300000
});

/**
 * Request deduplication cache - prevents duplicate in-flight requests
 */
const pendingRequests = new Map();

/**
 * Response cache for identical requests with LRU eviction
 */
const responseCache = new Map();

// Track access order for LRU eviction
const responseCacheAccess = new Map();

// Cache size limits
const MAX_PENDING_REQUESTS = 1000;
const MAX_RESPONSE_CACHE_SIZE = 5000;

  /**
   * Enhanced batch processing with dynamic sizing and intelligent grouping
   */
  async function batchRequests(requests) {
    try {
      if (requests.length === 0) return [];
      
      // Dynamic batch sizing based on system load and request characteristics
      const os = require('os');
      const cpuCount = os.cpus().length;
      const memoryUsage = process.memoryUsage();
      const memoryPressure = memoryUsage.heapUsed / memoryUsage.heapTotal;
      
      // Calculate optimal batch size based on system resources
      let baseBatchSize = config.getInt('QERRORS_BATCH_SIZE', 5);
      
      // Scale batch size by CPU cores
      const cpuScaledSize = Math.max(baseBatchSize, Math.min(20, cpuCount * 2));
      
      // Reduce batch size under memory pressure
      const memoryAdjustedSize = memoryPressure > 0.8 ? 
        Math.max(1, Math.floor(cpuScaledSize * 0.5)) :
        memoryPressure > 0.6 ? Math.max(2, Math.floor(cpuScaledSize * 0.75)) :
        cpuScaledSize;
      
      const optimalBatchSize = memoryAdjustedSize;
      
      // Group requests by endpoint and similarity for better batching
      const groupedRequests = groupRequestsBySimilarity(requests);
      const results = [];
      
      try {
        // Process each group with optimal batch size
        for (const group of groupedRequests) {
          for (let i = 0; i < group.length; i += optimalBatchSize) {
            const batch = group.slice(i, i + optimalBatchSize);
            
            try {
              // Process batch with concurrent execution and error isolation
              const batchResults = await processBatchWithRetry(batch);
              results.push(...batchResults);
              
              // Add small delay between batches to prevent overwhelming the API
              if (i + optimalBatchSize < group.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
              }
            } catch (batchError) {
              qerrors(batchError, 'qerrorsHttpClient.batchRequests.batch', {
                operation: 'batch_processing',
                batchSize: batch.length,
                batchIndex: Math.floor(i / optimalBatchSize),
                groupSize: group.length
              });
              // Continue with other batches even if one fails
            }
          }
        }
        
        return results;
      } catch (processingError) {
        qerrors(processingError, 'qerrorsHttpClient.batchRequests.processing', {
          operation: 'batch_request_processing',
          totalRequests: requests.length,
          groupCount: groupedRequests.length,
          optimalBatchSize
        });
        throw processingError;
      }
    } catch (error) {
      qerrors(error, 'qerrorsHttpClient.batchRequests', {
        operation: 'batch_requests',
        requestCount: requests.length
      });
      throw error;
    }
  }
  
  /**
   * Group requests by endpoint and data similarity for optimal batching
   */
  function groupRequestsBySimilarity(requests) {
    const groups = new Map();
    
    for (const request of requests) {
      // Group by URL and request type
      const groupKey = `${request.url}:${request.data?.type || 'default'}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      
      groups.get(groupKey).push(request);
    }
    
    return Array.from(groups.values());
  }
  
  /**
   * Process a batch of requests with intelligent retry and error isolation
   */
  async function processBatchWithRetry(batch) {
    // Create promises for each request with individual error handling
    const batchPromises = batch.map(async ({ url, data, opts, capMs }, index) => {
      try {
        const result = await postWithRetry(url, data, opts, capMs);
        return { status: 'fulfilled', value: result, index };
      } catch (error) {
        // Isolate errors to prevent batch failure
        console.warn(`Request ${index} in batch failed:`, error.message);
        return { status: 'rejected', reason: error, index };
      }
    });
    
    // Wait for all requests with individual timeout handling
    const timeoutPromises = batchPromises.map((promise, index) => 
      Promise.race([
        promise,
        new Promise(resolve => 
          setTimeout(() => resolve({ 
            status: 'rejected', 
            reason: new Error(`Request ${index} timed out`), 
            index 
          }), 30000) // 30 second timeout per request
        )
      ])
    );
    
    return Promise.all(timeoutPromises);
  }

  /**
   * Clean up expired cache entries
   */
  function cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of responseCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        responseCache.delete(key);
        responseCacheAccess.delete(key);
      }
    }
  }

  // Start periodic cache cleanup
  setInterval(cleanupCache, 60000); // Clean up every minute

/**
 * Module exports - HTTP client utilities for AI API interactions
 * 
 * Exports the configured axios instance and the intelligent retry function.
 * The axios instance can be used directly for simple requests, while
 * postWithRetry provides the full retry logic needed for reliable
 * AI API interactions.
 * 
 * Usage Patterns:
 * - Direct axios usage: For simple, non-critical requests
 * - postWithRetry: For critical AI API requests requiring reliability
 * - batchRequests: For efficient batch processing of multiple requests
 * - Configuration: Both exports use the same optimized settings
 */
module.exports = {
  axiosInstance,     // Pre-configured axios instance with connection pooling
  postWithRetry,     // Intelligent retry function for AI API requests
  batchRequests,     // Batch processing for multiple requests
  cleanupCache       // Cache cleanup function
};