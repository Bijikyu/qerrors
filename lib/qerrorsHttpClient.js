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
// HTTP connection agent for connection pooling and reuse
  httpAgent: new http.Agent({
    keepAlive: true,              // Reuse connections for multiple requests
    maxSockets: MAX_SOCKETS || 50,      // Limit concurrent connections - increased for scalability
    maxFreeSockets: MAX_FREE_SOCKETS || 10, // Limit idle connections - increased for better reuse
    timeout: 30000                // Socket timeout for better resource management
  }),
  
  // HTTPS connection agent with optimized pooling strategy for secure requests
  httpsAgent: new https.Agent({
    keepAlive: true,              // Reuse SSL connections (avoids handshake overhead)
    maxSockets: MAX_SOCKETS || 50,      // Limit concurrent secure connections - increased for scalability
    maxFreeSockets: MAX_FREE_SOCKETS || 10, // Limit idle secure connections - increased for better reuse
    timeout: 30000,               // Socket timeout for better resource management
    scheduling: 'lifo',           // Use LIFO scheduling for better performance
    rejectUnauthorized: true       // Ensure SSL security
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
 * HTTP POST request with intelligent retry logic for AI API interactions
 * 
 * This function implements sophisticated retry strategies optimized for AI API patterns:
 * - Exponential backoff with jitter to prevent thundering herd problems
 * - Custom retry header handling for provider-specific rate limits
 * - Flexible retry configuration for different deployment scenarios
 * - Graceful handling of various retry-after header formats
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
  // Load retry configuration with safe defaults
  const retries = config.getInt('QERRORS_RETRY_ATTEMPTS', 2);  // Total retry attempts
  const base = config.getInt('QERRORS_RETRY_BASE_MS', 100);   // Base delay in milliseconds
  const cap = capMs !== undefined 
    ? capMs 
    : config.getInt('QERRORS_RETRY_MAX_MS', 0);               // Maximum delay cap
  
  // Apply rate limiting before making request
  const rateLimitEnabled = config.getBool('QERRORS_RATE_LIMIT_ENABLED', true);
  if (rateLimitEnabled) {
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
      throw error;
    }
  }
  
  // Attempt request with retries
  for (let i = 0; i <= retries; i++) {
    try {
      // Make the actual HTTP request
      return await axiosInstance.post(url, data, opts);
    } catch (err) {
      // If this was the last attempt, rethrow the error
      if (i >= retries) throw err;
      
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
      
      // Wait before next retry attempt
      await new Promise(r => setTimeout(r, wait));
    }
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
 * - Configuration: Both exports use the same optimized settings
 */
module.exports = {
  axiosInstance,  // Pre-configured axios instance with connection pooling
  postWithRetry   // Intelligent retry function for AI API requests
};