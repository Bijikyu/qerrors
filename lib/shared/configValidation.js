'use strict';

const config = require('../config');

/**
 * Configuration validation utilities with clamping
 */
class ConfigValidator {
  constructor(safeThreshold = 1000) {
    this.SAFE_THRESHOLD = safeThreshold;
  }

  /**
   * Validate and clamp numeric configuration values
   */
  clampConfigValue(key, defaultValue = 0) {
    const rawValue = config.getInt(key, defaultValue);
    const clampedValue = Math.min(rawValue, this.SAFE_THRESHOLD);
    
    if (rawValue > this.SAFE_THRESHOLD) {
      const logger = require('../logger');
      logger.then(l => l.warn(`Configuration ${key} clamped from ${rawValue} to ${clampedValue}`));
    }
    
    return clampedValue;
  }

  /**
   * Validate queue and concurrency limits
   */
  validateQueueConfig() {
    const rawConc = config.getInt('QERRORS_CONCURRENCY');
    const rawQueue = config.getInt('QERRORS_QUEUE_LIMIT');
    
    const CONCURRENCY_LIMIT = Math.min(rawConc, this.SAFE_THRESHOLD);
    const QUEUE_LIMIT = Math.min(rawQueue, this.SAFE_THRESHOLD);
    
    if (rawConc > this.SAFE_THRESHOLD || rawQueue > this.SAFE_THRESHOLD) {
      const logger = require('../logger');
      logger.then(l => l.warn(`High qerrors limits clamped conc ${rawConc} queue ${rawQueue}`));
    }
    
    return { CONCURRENCY_LIMIT, QUEUE_LIMIT };
  }

  /**
   * Validate socket configuration
   */
  validateSocketConfig() {
    const rawSockets = config.getInt('QERRORS_MAX_SOCKETS');
    const rawFreeSockets = config.getInt('QERRORS_MAX_FREE_SOCKETS');
    
    const MAX_SOCKETS = Math.min(rawSockets, this.SAFE_THRESHOLD);
    const MAX_FREE_SOCKETS = Math.min(rawFreeSockets, this.SAFE_THRESHOLD);
    
    if (rawSockets > this.SAFE_THRESHOLD) {
      const logger = require('../logger');
      logger.then(l => l.warn(`max sockets clamped ${rawSockets}`));
    }
    
    if (rawFreeSockets > this.SAFE_THRESHOLD) {
      const logger = require('../logger');
      logger.then(l => l.warn(`max free sockets clamped ${rawFreeSockets}`));
    }
    
    return { MAX_SOCKETS, MAX_FREE_SOCKETS };
  }

  /**
   * Validate cache configuration
   */
  validateCacheConfig() {
    const parsedLimit = config.getInt('QERRORS_CACHE_LIMIT', 0);
    const ADVICE_CACHE_LIMIT = parsedLimit === 0 ? 0 : Math.min(parsedLimit, this.SAFE_THRESHOLD);
    
    if (parsedLimit > this.SAFE_THRESHOLD) {
      const logger = require('../logger');
      logger.then(l => l.warn(`cache limit clamped ${parsedLimit}`));
    }
    
    return ADVICE_CACHE_LIMIT;
  }

  /**
   * Validate retry configuration
   */
  validateRetryConfig() {
    return {
      attempts: config.getInt('QERRORS_RETRY_ATTEMPTS', 3),
      baseMs: config.getInt('QERRORS_RETRY_BASE_MS', 1000),
      maxMs: config.getInt('QERRORS_RETRY_MAX_MS', 30000)
    };
  }

  /**
   * Validate timeout configuration
   */
  validateTimeoutConfig() {
    return config.getInt('QERRORS_TIMEOUT', 30000);
  }

  /**
   * Validate all qerrors configuration
   */
  validateAllConfig() {
    return {
      ...this.validateQueueConfig(),
      ...this.validateSocketConfig(),
      cacheLimit: this.validateCacheConfig(),
      ...this.validateRetryConfig(),
      timeout: this.validateTimeoutConfig()
    };
  }

  /**
   * Validate environment variable exists and is non-empty
   */
  validateRequiredEnvVar(varName) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      throw new Error(`Required environment variable ${varName} is missing or empty`);
    }
    return value;
  }

  /**
   * Validate optional environment variable with fallback
   */
  validateOptionalEnvVar(varName, fallback = '') {
    const value = process.env[varName];
    return value && value.trim() !== '' ? value : fallback;
  }

  /**
   * Validate boolean environment variable
   */
  validateBooleanEnvVar(varName, defaultValue = false) {
    const value = process.env[varName];
    if (!value) return defaultValue;
    
    const lowerValue = value.toLowerCase().trim();
    return ['true', '1', 'yes', 'on'].includes(lowerValue);
  }

  /**
   * Validate numeric environment variable with range
   */
  validateNumericEnvVar(varName, defaultValue = 0, min = 0, max = Infinity) {
    const value = process.env[varName];
    if (!value) return defaultValue;
    
    const numValue = Number(value);
    if (Number.isNaN(numValue)) {
      const logger = require('../logger');
      logger.then(l => l.warn(`Invalid numeric value for ${varName}: ${value}, using default ${defaultValue}`));
      return defaultValue;
    }
    
    return Math.max(min, Math.min(max, numValue));
  }
}

// Create singleton instance
const configValidator = new ConfigValidator();

module.exports = {
  ConfigValidator,
  configValidator,
  
  // Convenience exports
  clampConfigValue: (...args) => configValidator.clampConfigValue(...args),
  validateQueueConfig: (...args) => configValidator.validateQueueConfig(...args),
  validateSocketConfig: (...args) => configValidator.validateSocketConfig(...args),
  validateCacheConfig: (...args) => configValidator.validateCacheConfig(...args),
  validateRetryConfig: (...args) => configValidator.validateRetryConfig(...args),
  validateTimeoutConfig: (...args) => configValidator.validateTimeoutConfig(...args),
  validateAllConfig: (...args) => configValidator.validateAllConfig(...args),
  validateRequiredEnvVar: (...args) => configValidator.validateRequiredEnvVar(...args),
  validateOptionalEnvVar: (...args) => configValidator.validateOptionalEnvVar(...args),
  validateBooleanEnvVar: (...args) => configValidator.validateBooleanEnvVar(...args),
  validateNumericEnvVar: (...args) => configValidator.validateNumericEnvVar(...args)
};