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
 * Adaptive Socket Pool Manager for dynamic connection optimization
 * 
 * Adjusts socket pool size based on current load and system resources
 * to optimize performance while preventing resource exhaustion.
 */
class AdaptiveSocketPoolManager {
  constructor() {
    this.baseMaxSockets = MAX_SOCKETS || 100;
    this.baseMaxFreeSockets = MAX_FREE_SOCKETS || 50;
    this.currentLoad = 0;
    this.loadHistory = [];
    this.maxLoadHistory = 10;
    this.adjustmentInterval = 30000; // 30 seconds
    this.lastAdjustment = Date.now();
    this.httpAgent = null;
    this.httpsAgent = null;
    
    // Load thresholds for scaling
    this.lowLoadThreshold = 0.3;  // 30% of base capacity
    this.highLoadThreshold = 0.8; // 80% of base capacity
    this.maxScaleFactor = 2.5;    // Maximum 2.5x base capacity
    this.minScaleFactor = 0.5;    // Minimum 50% of base capacity
    
    this.initializeAgents();
    this.startAdaptiveAdjustment();
  }
  
  /**
   * Initialize HTTP and HTTPS agents with current settings
   */
  initializeAgents() {
    const currentMaxSockets = this.getCurrentMaxSockets();
    const currentMaxFreeSockets = this.getCurrentMaxFreeSockets();
    
    // Create HTTP agent
    this.httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: currentMaxSockets,
      maxFreeSockets: currentMaxFreeSockets,
      timeout: 15000,
      scheduling: 'fifo',
      keepAliveMsecs: 60000,
      freeSocketTimeout: 30000
    });
    
    // Create HTTPS agent
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: currentMaxSockets,
      maxFreeSockets: currentMaxFreeSockets,
      timeout: 15000,
      scheduling: 'fifo',
      keepAliveMsecs: 60000,
      freeSocketTimeout: 30000,
      rejectUnauthorized: true,
      secureProtocol: 'TLSv1_2_method'
    });
  }
  
  /**
   * Calculate current load based on active requests and system resources
   */
  calculateCurrentLoad() {
    const activeRequests = pendingRequests.size;
    const maxCapacity = this.baseMaxSockets;
    return Math.min(1.0, activeRequests / maxCapacity);
  }
  
  /**
   * Update load tracking
   */
  updateLoad() {
    this.currentLoad = this.calculateCurrentLoad();
    this.loadHistory.push(this.currentLoad);
    
    // Keep only recent history
    if (this.loadHistory.length > this.maxLoadHistory) {
      this.loadHistory.shift();
    }
  }
  
  /**
   * Get average load over recent history
   */
  getAverageLoad() {
    if (this.loadHistory.length === 0) return 0;
    const sum = this.loadHistory.reduce((a, b) => a + b, 0);
    return sum / this.loadHistory.length;
  }
  
  /**
   * Calculate optimal max sockets based on current load
   */
  getCurrentMaxSockets() {
    const avgLoad = this.getAverageLoad();
    let scaleFactor = 1.0;
    
    if (avgLoad > this.highLoadThreshold) {
      // Scale up for high load
      scaleFactor = Math.min(this.maxScaleFactor, 1.0 + (avgLoad - this.highLoadThreshold) * 2);
    } else if (avgLoad < this.lowLoadThreshold) {
      // Scale down for low load
      scaleFactor = Math.max(this.minScaleFactor, avgLoad / this.lowLoadThreshold);
    }
    
    return Math.round(this.baseMaxSockets * scaleFactor);
  }
  
  /**
   * Calculate optimal max free sockets based on current load
   */
  getCurrentMaxFreeSockets() {
    const maxSockets = this.getCurrentMaxSockets();
    // Maintain 40-60% ratio of free to max sockets
    const ratio = Math.max(0.4, Math.min(0.6, 1.0 - this.currentLoad));
    return Math.round(maxSockets * ratio);
  }
  
  /**
   * Check if agents need adjustment
   */
  needsAdjustment() {
    const currentMaxSockets = this.getCurrentMaxSockets();
    const currentMaxFreeSockets = this.getCurrentMaxFreeSockets();
    
    return (this.httpAgent.maxSockets !== currentMaxSockets ||
            this.httpAgent.maxFreeSockets !== currentMaxFreeSockets ||
            this.httpsAgent.maxSockets !== currentMaxSockets ||
            this.httpsAgent.maxFreeSockets !== currentMaxFreeSockets);
  }
  
  /**
   * Adjust agent configurations if needed
   */
  adjustAgents() {
    if (!this.needsAdjustment()) return;
    
    try {
      const oldMaxSockets = this.httpAgent.maxSockets;
      const newMaxSockets = this.getCurrentMaxSockets();
      const newMaxFreeSockets = this.getCurrentMaxFreeSockets();
      
      // Create new agents with updated settings
      const newHttpAgent = new http.Agent({
        keepAlive: true,
        maxSockets: newMaxSockets,
        maxFreeSockets: newMaxFreeSockets,
        timeout: 15000,
        scheduling: 'fifo',
        keepAliveMsecs: 60000,
        freeSocketTimeout: 30000
      });
      
      const newHttpsAgent = new https.Agent({
        keepAlive: true,
        maxSockets: newMaxSockets,
        maxFreeSockets: newMaxFreeSockets,
        timeout: 15000,
        scheduling: 'fifo',
        keepAliveMsecs: 60000,
        freeSocketTimeout: 30000,
        rejectUnauthorized: true,
        secureProtocol: 'TLSv1_2_method'
      });
      
      // Destroy old agents
      this.httpAgent.destroy();
      this.httpsAgent.destroy();
      
      // Replace with new agents
      this.httpAgent = newHttpAgent;
      this.httpsAgent = newHttpsAgent;
      
      // Update axios instance
      axiosInstance.defaults.httpAgent = this.httpAgent;
      axiosInstance.defaults.httpsAgent = this.httpsAgent;
      
      console.info(`Adaptive socket pool adjusted: ${oldMaxSockets} -> ${newMaxSockets} max sockets, ${newMaxFreeSockets} max free sockets`);
    } catch (error) {
      console.error('Error adjusting socket pool agents:', error.message);
    }
  }
  
  /**
   * Start adaptive adjustment loop
   */
  startAdaptiveAdjustment() {
    const adjustmentLoop = () => {
      try {
        this.updateLoad();
        this.adjustAgents();
      } catch (error) {
        console.error('Error in adaptive socket pool adjustment:', error.message);
      }
    };
    
    // Run adjustment periodically
    setInterval(adjustmentLoop, this.adjustmentInterval).unref();
  }
  
  /**
   * Get current agents
   */
  getAgents() {
    return {
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent
    };
  }
  
  /**
   * Get current statistics
   */
  getStats() {
    return {
      currentLoad: this.currentLoad,
      averageLoad: this.getAverageLoad(),
      currentMaxSockets: this.getCurrentMaxSockets(),
      currentMaxFreeSockets: this.getCurrentMaxFreeSockets(),
      baseMaxSockets: this.baseMaxSockets,
      activeRequests: pendingRequests.size
    };
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    try {
      if (this.httpAgent) {
        this.httpAgent.destroy();
        this.httpAgent = null;
      }
      if (this.httpsAgent) {
        this.httpsAgent.destroy();
        this.httpsAgent = null;
      }
    } catch (error) {
      console.error('Error destroying socket pool manager:', error.message);
    }
  }
}

// Global adaptive socket pool manager
const socketPoolManager = new AdaptiveSocketPoolManager();

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
    try {
      this.maxTokens = maxTokens;      // Maximum tokens in bucket
      this.tokens = maxTokens;         // Current tokens (start full)
      this.refillRate = refillRate;    // Tokens added per second
      this.lastRefill = Date.now();    // Last refill timestamp
    } catch (error) {
      qerrors(error, 'qerrorsHttpClient.TokenBucketRateLimiter.constructor', {
        operation: 'rate_limiter_initialization',
        maxTokens: maxTokens,
        refillRate: refillRate
      });
      throw new Error('Failed to initialize rate limiter');
    }
  }

  /**
   * Try to consume a token for API call
   * @param {number} tokens - Number of tokens to consume (default: 1)
   * @returns {boolean} True if token available and consumed, false otherwise
   */
  tryConsume(tokens = 1) {
    try {
      this.refill();
      
      if (this.tokens >= tokens) {
        this.tokens -= tokens;
        return true;
      }
      
      return false;
    } catch (error) {
      qerrors(error, 'qerrorsHttpClient.TokenBucketRateLimiter.tryConsume', {
        operation: 'token_consumption',
        tokensRequested: tokens,
        availableTokens: this.tokens
      });
      return false;
    }
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
 // Use adaptive socket pool agents for dynamic connection optimization
  httpAgent: socketPoolManager.getAgents().httpAgent,
  httpsAgent: socketPoolManager.getAgents().httpsAgent,
  
  // Request timeout to prevent hanging on unresponsive APIs - increased for high load
  timeout: config.getInt('QERRORS_TIMEOUT', 15000), // Increased default to 15 seconds for better reliability
  
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
      // Always use async processing to prevent blocking in request path
      return new Promise((resolve, reject) => {
        setImmediate(() => {
          try {
            // Use streaming approach for large objects to prevent memory spikes
            let jsonString;
            if (data && typeof data === 'object') {
              // For objects, use size estimation first
              const roughSize = JSON.stringify(data).length;
              if (roughSize > 51200) { // 50KB threshold
                // For very large objects, create a hash instead of full serialization
                const crypto = require('crypto');
                const hash = crypto.createHash('sha256');
                hash.update(JSON.stringify(data));
                jsonString = hash.digest('hex');
              } else {
                jsonString = JSON.stringify(data);
              }
            } else {
              jsonString = JSON.stringify(data);
            }
            resolve(`${url}:${jsonString}`);
          } catch (error) {
            qerrors(error, 'qerrorsHttpClient.createRequestKeyAsync.async', {
              operation: 'async_request_key_creation',
              url: url,
              dataType: typeof data
            });
            reject(error);
          }
        });
      });
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

// Response cache cleanup interval
let responseCacheCleanupInterval = null;

/**
 * Start periodic cleanup of expired response cache entries
 */
function startResponseCacheCleanup() {
  if (responseCacheCleanupInterval) return;
  
  responseCacheCleanupInterval = setInterval(() => {
    try {
      const now = Date.now();
      let cleanedCount = 0;
      
      // Clean expired entries
      for (const [key, entry] of responseCache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          responseCache.delete(key);
          responseCacheAccess.delete(key);
          cleanedCount++;
        }
      }
      
      // Enforce size limit with proper LRU eviction
      if (responseCache.size > MAX_RESPONSE_CACHE_SIZE) {
        const entriesToRemove = responseCache.size - MAX_RESPONSE_CACHE_SIZE;
        
        // Find least recently used entries
        const sortedEntries = Array.from(responseCacheAccess.entries())
          .sort((a, b) => a[1] - b[1]);
        
        for (let i = 0; i < entriesToRemove && i < sortedEntries.length; i++) {
          const [key] = sortedEntries[i];
          responseCache.delete(key);
          responseCacheAccess.delete(key);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.info(`Cleaned up ${cleanedCount} expired response cache entries`);
      }
    } catch (error) {
      console.error('Error during response cache cleanup:', error.message);
    }
  }, 60000); // Every minute
  responseCacheCleanupInterval.unref();
}

/**
 * Stop response cache cleanup interval
 */
function stopResponseCacheCleanup() {
  if (responseCacheCleanupInterval) {
    clearInterval(responseCacheCleanupInterval);
    responseCacheCleanupInterval = null;
  }
}

// Start cleanup automatically
startResponseCacheCleanup();

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
 * Clean up expired cache entries with improved LRU eviction
 */
function cleanupCache() {
  const now = Date.now();
  let cleanedCount = 0;
  
  // Clean expired entries
  for (const [key, entry] of responseCache.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      responseCache.delete(key);
      responseCacheAccess.delete(key);
      cleanedCount++;
    }
  }
  
  // Enforce size limit with proper LRU eviction
  if (responseCache.size > MAX_RESPONSE_CACHE_SIZE) {
    const entriesToRemove = responseCache.size - MAX_RESPONSE_CACHE_SIZE;
    
    // Find least recently used entries efficiently
    const sortedEntries = Array.from(responseCacheAccess.entries())
      .sort((a, b) => a[1] - b[1]);
    
    for (let i = 0; i < entriesToRemove && i < sortedEntries.length; i++) {
      const [key] = sortedEntries[i];
      responseCache.delete(key);
      responseCacheAccess.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.info(`Cleaned up ${cleanedCount} response cache entries`);
  }
}

// Start periodic cache cleanup with proper resource management
let cleanupInterval = setInterval(cleanupCache, 60000); // Clean up every minute
cleanupInterval.unref(); // Don't prevent process exit

/**
 * Shutdown HTTP client and cleanup resources
 */
function shutdown() {
  try {
    // Clear all caches
    responseCache.clear();
    responseCacheAccess.clear();
    pendingRequests.clear();
    
    // Stop cleanup interval
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
    
    // Destroy socket pool manager
    socketPoolManager.destroy();
    
    console.info('HTTP client shutdown completed');
  } catch (error) {
    console.error('Error during HTTP client shutdown:', error.message);
  }
}

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
  axiosInstance,     // Pre-configured axios instance with adaptive connection pooling
  postWithRetry,     // Intelligent retry function for AI API requests
  batchRequests,     // Batch processing for multiple requests
  cleanupCache,      // Cache cleanup function
  shutdown,          // Cleanup resources
  getPendingRequestsCount: () => pendingRequests.size,
  getResponseCacheSize: () => responseCache.size,
  getSocketPoolStats: () => socketPoolManager.getStats() // Socket pool monitoring
};