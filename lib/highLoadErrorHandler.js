'use strict';

/**
 * High-Load Error Handler - Optimized for extreme scalability
 * 
 * This module provides error handling optimized for high-load scenarios
 * with circuit breakers, rate limiting, and resource protection.
 */

const { EventEmitter } = require('events');
const { performance } = require('perf_hooks');
const qerrors = require('./qerrors');

/**
 * Circuit breaker for error handling to prevent cascade failures
 */
class ErrorCircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.failureThreshold = options.failureThreshold || 10;
    this.recoveryTimeout = options.recoveryTimeout || 60000;
    this.monitoringPeriod = options.monitoringPeriod || 300000;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.requestCount = 0;
    
    this.resetMonitoring();
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute(operation) {
    this.requestCount++;
    
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        this.emit('half_open');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      // Use qerrors for sophisticated error reporting
      try {
        await qerrors(error, 'highLoadErrorHandler.ErrorCircuitBreaker.execute', {
          operation: 'circuit_breaker_execution',
          state: this.state,
          failureCount: this.failureCount,
          requestCount: this.requestCount
        });
      } catch (qerror) {
        console.error('qerrors logging failed in circuit breaker execute', qerror);
      }
      
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  onSuccess() {
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failureCount = 0;
      this.emit('recovered');
    }
  }

  /**
   * Handle failed operation
   */
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.emit('open', { failureCount: this.failureCount });
    }
  }

  /**
   * Reset monitoring counters
   */
  resetMonitoring() {
    setTimeout(() => {
      const oldRequestCount = this.requestCount;
      const oldSuccessCount = this.successCount;
      const oldFailureCount = this.failureCount;
      
      // Reset counters for new monitoring period
      this.requestCount = 0;
      this.successCount = 0;
      this.failureCount = 0;
      
      // Emit metrics
      this.emit('metrics', {
        period: this.monitoringPeriod,
        requests: oldRequestCount,
        successes: oldSuccessCount,
        failures: oldFailureCount,
        state: this.state
      });
      
      // Continue monitoring
      this.resetMonitoring();
    }, this.monitoringPeriod);
  }

  /**
   * Get circuit breaker state
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Rate limiter for error processing to prevent resource exhaustion
 */
class ErrorRateLimiter {
  constructor(options = {}) {
    this.maxRequestsPerSecond = options.maxRequestsPerSecond || 100;
    this.maxBurstSize = options.maxBurstSize || 200;
    this.windowSize = 1000; // 1 second window
    
    this.requests = [];
    this.rejectedCount = 0;
  }

  /**
   * Check if request is allowed
   */
  isAllowed() {
    const now = Date.now();
    
    // Clean old requests outside the window
    this.requests = this.requests.filter(timestamp => 
      now - timestamp < this.windowSize
    );
    
    // Check if under limits
    if (this.requests.length < this.maxRequestsPerSecond) {
      this.requests.push(now);
      return true;
    }
    
    // Allow burst if under burst limit
    if (this.requests.length < this.maxBurstSize) {
      this.requests.push(now);
      return true;
    }
    
    this.rejectedCount++;
    return false;
  }

  /**
   * Get rate limiter statistics
   */
  getStats() {
    const now = Date.now();
    const currentRequests = this.requests.filter(timestamp => 
      now - timestamp < this.windowSize
    ).length;
    
    return {
      currentRequests,
      maxRequestsPerSecond: this.maxRequestsPerSecond,
      maxBurstSize: this.maxBurstSize,
      rejectedCount: this.rejectedCount
    };
  }
}

/**
 * High-load optimized error handler
 */
class HighLoadErrorHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Circuit breaker for error processing
    this.circuitBreaker = new ErrorCircuitBreaker({
      failureThreshold: options.circuitBreakerFailureThreshold || 20,
      recoveryTimeout: options.circuitBreakerRecoveryTimeout || 120000,
      monitoringPeriod: options.circuitBreakerMonitoringPeriod || 300000
    });
    
    // Rate limiter for error processing
    this.rateLimiter = new ErrorRateLimiter({
      maxRequestsPerSecond: options.maxErrorsPerSecond || 50,
      maxBurstSize: options.maxBurstErrors || 100
    });
    
    // Error aggregation for high-frequency errors
    this.errorAggregation = new Map();
    this.aggregationInterval = options.aggregationInterval || 60000;
    
    // Performance tracking
    this.performanceMetrics = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      maxProcessingTime: 0,
      minProcessingTime: Infinity
    };
    
    // Start aggregation cleanup
    this.startAggregationCleanup();
    
    // Forward circuit breaker events
    this.circuitBreaker.on('open', (data) => this.emit('circuit_open', data));
    this.circuitBreaker.on('recovered', () => this.emit('circuit_recovered'));
    this.circuitBreaker.on('half_open', () => this.emit('circuit_half_open'));
    this.circuitBreaker.on('metrics', (data) => this.emit('metrics', data));
  }

  /**
   * Handle error with high-load optimizations
   */
  async handleError(error, context = {}) {
    const startTime = performance.now();
    
    try {
      // Check rate limiting
      if (!this.rateLimiter.isAllowed()) {
        this.emit('rate_limited', { error: error.name, context });
        return {
          error: 'RATE_LIMITED',
          message: 'Error processing rate limited',
          timestamp: Date.now()
        };
      }

      // Process through circuit breaker
      return await this.circuitBreaker.execute(async () => {
        return await this.processError(error, context);
      });
      
    } catch (circuitError) {
      this.emit('circuit_error', { error: circuitError.message, originalError: error.name });
      return {
        error: 'CIRCUIT_OPEN',
        message: 'Error processing temporarily unavailable',
        timestamp: Date.now()
      };
    } finally {
      // Update performance metrics
      const processingTime = performance.now() - startTime;
      this.updatePerformanceMetrics(processingTime);
    }
  }

  /**
   * Process individual error with aggregation
   */
  async processError(error, context) {
    const errorKey = this.generateErrorKey(error, context);
    
    // Check if this is a high-frequency error
    if (this.errorAggregation.has(errorKey)) {
      const aggregated = this.errorAggregation.get(errorKey);
      aggregated.count++;
      aggregated.lastSeen = Date.now();
      aggregated.contexts.push(context);
      
      // Limit context storage to prevent memory bloat
      if (aggregated.contexts.length > 10) {
        aggregated.contexts = aggregated.contexts.slice(-10);
      }
      
      // Return aggregated response for high-frequency errors
      if (aggregated.count > 5) {
        return {
          error: 'AGGREGATED',
          message: `High-frequency error: ${error.name}`,
          count: aggregated.count,
          firstSeen: aggregated.firstSeen,
          timestamp: Date.now()
        };
      }
    } else {
      // New error - create aggregation entry
      this.errorAggregation.set(errorKey, {
        error: error.name,
        message: error.message,
        count: 1,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        contexts: [context]
      });
    }

    // Process error normally
    return {
      error: error.name,
      message: error.message,
      context: this.sanitizeContext(context),
      timestamp: Date.now(),
      processed: true
    };
  }

  /**
   * Generate error key for aggregation
   */
  generateErrorKey(error, context) {
    const errorName = error.name || 'Unknown';
    const errorMessage = (error.message || '').substring(0, 50);
    const contextKey = context.function || context.endpoint || 'unknown';
    return `${errorName}:${errorMessage}:${contextKey}`;
  }

  /**
   * Sanitize context to prevent memory bloat
   */
  sanitizeContext(context) {
    const sanitized = {};
    const maxKeys = 10;
    let keyCount = 0;
    
    for (const [key, value] of Object.entries(context)) {
      if (keyCount >= maxKeys) break;
      
      if (typeof value === 'string') {
        sanitized[key] = value.substring(0, 100);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = JSON.stringify(value).substring(0, 200);
      } else {
        sanitized[key] = String(value).substring(0, 50);
      }
      
      keyCount++;
    }
    
    return sanitized;
  }

  /**
   * Update performance metrics with rolling average
   */
  updatePerformanceMetrics(processingTime) {
    this.performanceMetrics.totalProcessed++;
    
    // Update min/max
    this.performanceMetrics.maxProcessingTime = Math.max(
      this.performanceMetrics.maxProcessingTime, 
      processingTime
    );
    this.performanceMetrics.minProcessingTime = Math.min(
      this.performanceMetrics.minProcessingTime, 
      processingTime
    );
    
    // Update rolling average
    const alpha = 0.1;
    this.performanceMetrics.averageProcessingTime = 
      this.performanceMetrics.averageProcessingTime === 0 ? 
      processingTime : 
      alpha * processingTime + (1 - alpha) * this.performanceMetrics.averageProcessingTime;
  }

  /**
   * Start aggregation cleanup
   */
  startAggregationCleanup() {
    setInterval(() => {
      const now = Date.now();
      const cutoffTime = now - this.aggregationInterval;
      let cleanedCount = 0;
      
      for (const [key, aggregated] of this.errorAggregation.entries()) {
        if (aggregated.lastSeen < cutoffTime) {
          this.errorAggregation.delete(key);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        this.emit('aggregation_cleanup', { cleanedCount });
      }
    }, this.aggregationInterval);
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      circuitBreaker: this.circuitBreaker.getState(),
      rateLimiter: this.rateLimiter.getStats(),
      aggregation: {
        totalAggregated: this.errorAggregation.size,
        topErrors: Array.from(this.errorAggregation.entries())
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 10)
          .map(([key, data]) => ({ key, count: data.count }))
      },
      performance: this.performanceMetrics
    };
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    this.errorAggregation.clear();
    this.removeAllListeners();
  }
}

module.exports = {
  ErrorCircuitBreaker,
  ErrorRateLimiter,
  HighLoadErrorHandler
};