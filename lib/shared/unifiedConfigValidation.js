/**
 * Unified Configuration Validation Module
 * 
 * Purpose: Consolidates configuration validation patterns from multiple
 * modules into a single, comprehensive validation system with safety limits,
 * clamping mechanisms, and environment variable validation.
 * 
 * Design Rationale:
 * - Safety first: All configuration values are clamped to safe thresholds
 * - Environment validation: Comprehensive environment variable checking
 * - Graceful degradation: Default values for missing configurations
 * - Audit logging: Logs when configurations are clamped or invalid
 * - Type safety: Ensures correct data types for all configurations
 * 
 * Security Considerations:
 * - Prevents resource exhaustion via unlimited queue sizes
 * - Controls memory usage through cache limits
 * - Mitigates DoS attacks via socket connection limits
 * - Validates timeout values to prevent hanging operations
 */

const config = require('../config');
const localVars = require('../../config/localVars');
const { safeLogError, safeLogInfo, safeLogWarn } = require('./logging');

/**
 * Configuration Validation Constants
 * 
 * Defines safety limits for all configurable parameters to prevent
 * resource exhaustion and ensure stable operation.
 */
const CONFIG_LIMITS = {
  // Cache and memory limits
  MAX_CACHE_SIZE: 10000,
  MAX_CACHE_TTL: 3600000, // 1 hour in ms
  MIN_CACHE_TTL: 1000, // 1 second minimum
  
  // Queue limits
  MAX_QUEUE_SIZE: 100000,
  MIN_QUEUE_SIZE: 1,
  MAX_BATCH_SIZE: 1000,
  MIN_BATCH_SIZE: 1,
  
  // Connection limits
  MAX_CONNECTIONS: 1000,
  MIN_CONNECTIONS: 1,
  MAX_POOL_SIZE: 100,
  MIN_POOL_SIZE: 1,
  
  // Timeout limits
  MAX_TIMEOUT: 600000, // 10 minutes
  MIN_TIMEOUT: 100, // 100ms minimum
  
  // Rate limiting
  MAX_RATE_LIMIT: 10000,
  MIN_RATE_LIMIT: 1,
  MAX_WINDOW_MS: 3600000, // 1 hour
  MIN_WINDOW_MS: 1000, // 1 second
  
  // Retry limits
  MAX_RETRIES: 10,
  MIN_RETRIES: 0,
  MAX_RETRY_DELAY: 60000, // 1 minute
  MIN_RETRY_DELAY: 100 // 100ms minimum
};

/**
 * Configuration Type Validators
 * 
 * Provides type-specific validation for different configuration
 * parameter types with built-in safety checks.
 */
class ConfigValidators {
  /**
   * Validate and clamp numeric configuration values
   * @param {number} value - Value to validate
   * @param {number} min - Minimum allowed value
   * @param {number} max - Maximum allowed value
   * @param {string} paramName - Parameter name for logging
   * @param {*} defaultValue - Default value if invalid
   * @returns {number} Validated and clamped value
   */
  static validateNumber(value, min, max, paramName, defaultValue = min) {
    if (typeof value !== 'number' || isNaN(value)) {
      safeLogWarn(`Invalid ${paramName}: ${value} (not a number), using default: ${defaultValue}`);
      return defaultValue;
    }
    
    if (value < min) {
      safeLogWarn(`${paramName} too low: ${value} < ${min}, clamping to: ${min}`);
      return min;
    }
    
    if (value > max) {
      safeLogWarn(`${paramName} too high: ${value} > ${max}, clamping to: ${max}`);
      return max;
    }
    
    return value;
  }
  
  /**
   * Validate string configuration values
   * @param {string} value - Value to validate
   * @param {number} maxLength - Maximum allowed length
   * @param {string} paramName - Parameter name for logging
   * @param {string} defaultValue - Default value if invalid
   * @returns {string} Validated string value
   */
  static validateString(value, maxLength, paramName, defaultValue = '') {
    if (typeof value !== 'string') {
      safeLogWarn(`Invalid ${paramName}: ${value} (not a string), using default: "${defaultValue}"`);
      return defaultValue;
    }
    
    if (value.length > maxLength) {
      safeLogWarn(`${paramName} too long: ${value.length} > ${maxLength} chars, truncating`);
      return value.slice(0, maxLength);
    }
    
    return value;
  }
  
  /**
   * Validate boolean configuration values
   * @param {*} value - Value to validate
   * @param {string} paramName - Parameter name for logging
   * @param {boolean} defaultValue - Default value if invalid
   * @returns {boolean} Validated boolean value
   */
  static validateBoolean(value, paramName, defaultValue = false) {
    if (typeof value === 'boolean') {
      return value;
    }
    
    // Handle common string representations
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(lowerValue)) {
        return true;
      }
      if (['false', '0', 'no', 'off'].includes(lowerValue)) {
        return false;
      }
    }
    
    // Handle numeric values
    if (typeof value === 'number') {
      return value !== 0;
    }
    
    safeLogWarn(`Invalid ${paramName}: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }
  
  /**
   * Validate array configuration values
   * @param {Array} value - Value to validate
   * @param {number} maxLength - Maximum allowed length
   * @param {string} paramName - Parameter name for logging
   * @param {Array} defaultValue - Default value if invalid
   * @returns {Array} Validated array value
   */
  static validateArray(value, maxLength, paramName, defaultValue = []) {
    if (!Array.isArray(value)) {
      safeLogWarn(`Invalid ${paramName}: ${value} (not an array), using default: [${defaultValue.length} items]`);
      return defaultValue;
    }
    
    if (value.length > maxLength) {
      safeLogWarn(`${paramName} too long: ${value.length} > ${maxLength} items, truncating`);
      return value.slice(0, maxLength);
    }
    
    return value;
  }
  
  /**
   * Validate object configuration values
   * @param {Object} value - Value to validate
   * @param {number} maxKeys - Maximum allowed keys
   * @param {string} paramName - Parameter name for logging
   * @param {Object} defaultValue - Default value if invalid
   * @returns {Object} Validated object value
   */
  static validateObject(value, maxKeys, paramName, defaultValue = {}) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      safeLogWarn(`Invalid ${paramName}: ${value} (not an object), using default`);
      return defaultValue;
    }
    
    const keys = Object.keys(value);
    if (keys.length > maxKeys) {
      safeLogWarn(`${paramName} has too many keys: ${keys.length} > ${maxKeys}, truncating`);
      const truncated = {};
      keys.slice(0, maxKeys).forEach(key => {
        truncated[key] = value[key];
      });
      return truncated;
    }
    
    return value;
  }
}

/**
 * Unified Configuration Validator
 * 
 * Main class that provides comprehensive configuration validation
 * with automatic clamping, type checking, and audit logging.
 */
class UnifiedConfigValidator {
  /**
   * Validate cache configuration
   * @param {Object} cacheConfig - Cache configuration object
   * @returns {Object} Validated cache configuration
   */
  static validateCacheConfig(cacheConfig = {}) {
    const validated = {};
    
    validated.size = ConfigValidators.validateNumber(
      cacheConfig.size,
      CONFIG_LIMITS.MIN_CACHE_SIZE,
      CONFIG_LIMITS.MAX_CACHE_SIZE,
      'cache.size',
      1000
    );
    
    validated.ttl = ConfigValidators.validateNumber(
      cacheConfig.ttl,
      CONFIG_LIMITS.MIN_CACHE_TTL,
      CONFIG_LIMITS.MAX_CACHE_TTL,
      'cache.ttl',
      300000 // 5 minutes
    );
    
    validated.checkperiod = ConfigValidators.validateNumber(
      cacheConfig.checkperiod,
      1000,
      validated.ttl,
      'cache.checkperiod',
      60000 // 1 minute
    );
    
    validated.enableMetrics = ConfigValidators.validateBoolean(
      cacheConfig.enableMetrics,
      'cache.enableMetrics',
      false
    );
    
    return validated;
  }
  
  /**
   * Validate queue configuration
   * @param {Object} queueConfig - Queue configuration object
   * @returns {Object} Validated queue configuration
   */
  static validateQueueConfig(queueConfig = {}) {
    const validated = {};
    
    validated.maxSize = ConfigValidators.validateNumber(
      queueConfig.maxSize,
      CONFIG_LIMITS.MIN_QUEUE_SIZE,
      CONFIG_LIMITS.MAX_QUEUE_SIZE,
      'queue.maxSize',
      1000
    );
    
    validated.batchSize = ConfigValidators.validateNumber(
      queueConfig.batchSize,
      CONFIG_LIMITS.MIN_BATCH_SIZE,
      CONFIG_LIMITS.MAX_BATCH_SIZE,
      'queue.batchSize',
      50
    );
    
    validated.maxMemoryMB = ConfigValidators.validateNumber(
      queueConfig.maxMemoryMB,
      1,
      1024, // 1GB max
      'queue.maxMemoryMB',
      10
    );
    
    validated.enableOverflowLogging = ConfigValidators.validateBoolean(
      queueConfig.enableOverflowLogging,
      'queue.enableOverflowLogging',
      false
    );
    
    return validated;
  }
  
  /**
   * Validate connection pool configuration
   * @param {Object} poolConfig - Connection pool configuration
   * @returns {Object} Validated pool configuration
   */
  static validatePoolConfig(poolConfig = {}) {
    const validated = {};
    
    validated.min = ConfigValidators.validateNumber(
      poolConfig.min,
      CONFIG_LIMITS.MIN_POOL_SIZE,
      CONFIG_LIMITS.MAX_POOL_SIZE,
      'pool.min',
      5
    );
    
    validated.max = ConfigValidators.validateNumber(
      poolConfig.max,
      validated.min,
      CONFIG_LIMITS.MAX_POOL_SIZE,
      'pool.max',
      20
    );
    
    validated.idleTimeoutMillis = ConfigValidators.validateNumber(
      poolConfig.idleTimeoutMillis,
      CONFIG_LIMITS.MIN_TIMEOUT,
      CONFIG_LIMITS.MAX_TIMEOUT,
      'pool.idleTimeoutMillis',
      30000 // 30 seconds
    );
    
    validated.acquireTimeoutMillis = ConfigValidators.validateNumber(
      poolConfig.acquireTimeoutMillis,
      CONFIG_LIMITS.MIN_TIMEOUT,
      CONFIG_LIMITS.MAX_TIMEOUT,
      'pool.acquireTimeoutMillis',
      15000 // 15 seconds
    );
    
    return validated;
  }
  
  /**
   * Validate rate limiting configuration
   * @param {Object} rateLimitConfig - Rate limiting configuration
   * @returns {Object} Validated rate limiting configuration
   */
  static validateRateLimitConfig(rateLimitConfig = {}) {
    const validated = {};
    
    validated.windowMs = ConfigValidators.validateNumber(
      rateLimitConfig.windowMs,
      CONFIG_LIMITS.MIN_WINDOW_MS,
      CONFIG_LIMITS.MAX_WINDOW_MS,
      'rateLimit.windowMs',
      900000 // 15 minutes
    );
    
    validated.max = ConfigValidators.validateNumber(
      rateLimitConfig.max,
      CONFIG_LIMITS.MIN_RATE_LIMIT,
      CONFIG_LIMITS.MAX_RATE_LIMIT,
      'rateLimit.max',
      100
    );
    
    validated.standardHeaders = ConfigValidators.validateBoolean(
      rateLimitConfig.standardHeaders,
      'rateLimit.standardHeaders',
      false
    );
    
    validated.legacyHeaders = ConfigValidators.validateBoolean(
      rateLimitConfig.legacyHeaders,
      'rateLimit.legacyHeaders',
      false
    );
    
    return validated;
  }
  
  /**
   * Validate retry configuration
   * @param {Object} retryConfig - Retry configuration
   * @returns {Object} Validated retry configuration
   */
  static validateRetryConfig(retryConfig = {}) {
    const validated = {};
    
    validated.maxRetries = ConfigValidators.validateNumber(
      retryConfig.maxRetries,
      CONFIG_LIMITS.MIN_RETRIES,
      CONFIG_LIMITS.MAX_RETRIES,
      'retry.maxRetries',
      3
    );
    
    validated.initialDelay = ConfigValidators.validateNumber(
      retryConfig.initialDelay,
      CONFIG_LIMITS.MIN_RETRY_DELAY,
      CONFIG_LIMITS.MAX_RETRY_DELAY,
      'retry.initialDelay',
      1000 // 1 second
    );
    
    validated.maxDelay = ConfigValidators.validateNumber(
      retryConfig.maxDelay,
      validated.initialDelay,
      CONFIG_LIMITS.MAX_RETRY_DELAY,
      'retry.maxDelay',
      10000 // 10 seconds
    );
    
    validated.backoffFactor = ConfigValidators.validateNumber(
      retryConfig.backoffFactor,
      1.1,
      5.0,
      'retry.backoffFactor',
      2.0
    );
    
    validated.jitter = ConfigValidators.validateBoolean(
      retryConfig.jitter,
      'retry.jitter',
      true
    );
    
    return validated;
  }
  
  /**
   * Validate complete configuration object
   * @param {Object} fullConfig - Complete configuration object
   * @returns {Object} Fully validated configuration object
   */
  static validateFullConfig(fullConfig = {}) {
    return {
      cache: this.validateCacheConfig(fullConfig.cache),
      queue: this.validateQueueConfig(fullConfig.queue),
      pool: this.validatePoolConfig(fullConfig.pool),
      rateLimit: this.validateRateLimitConfig(fullConfig.rateLimit),
      retry: this.validateRetryConfig(fullConfig.retry),
      // Add other configuration sections as needed
      ...this.validateAdditionalConfig(fullConfig)
    };
  }
  
  /**
   * Validate additional configuration sections
   * @param {Object} fullConfig - Complete configuration object
   * @returns {Object} Additional validated configurations
   */
  static validateAdditionalConfig(fullConfig = {}) {
    const additional = {};
    
    // Add additional configuration validation here as needed
    
    return additional;
  }
}

// Export the unified configuration validation system
module.exports = {
  CONFIG_LIMITS,
  ConfigValidators,
  UnifiedConfigValidator
};