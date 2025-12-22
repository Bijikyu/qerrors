'use strict';

/**
 * Configuration Validation Module
 * 
 * Purpose: Provides comprehensive configuration validation with safety limits,
 * clamping mechanisms, and environment variable validation. This module ensures
 * that configuration values remain within safe operational boundaries to prevent
 * resource exhaustion and security vulnerabilities.
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

/**
 * Helper function for async logger access with fallback
 * 
 * Purpose: Provides safe async logging that falls back to console.error
 * if the logger module is unavailable or fails to load. This ensures
 * that configuration validation errors are always logged.
 * 
 * Error Handling Strategy:
 * - Attempts to load and use the application logger
 * - Falls back to console.error if logger fails
 * - Includes original message in fallback logging
 * - Prevents logging failures from breaking configuration validation
 * 
 * @param {string} level - Log level (info, warn, error, etc.)
 * @param {string} message - Message to log
 */
async function logAsync(level, message) {
  try {
    const logger = require('../logger');
    const log = await logger;
    log[level](message);
  } catch (err) {
    console.error(`Logger error: ${err.message}, original message: ${message}`);
  }
}

/**
 * Synchronous logging for module-level initialization
 * 
 * Purpose: Provides immediate synchronous logging for configuration validation
 * during module initialization. This is critical because async logging
 * might not be available during initial module loading.
 * 
 * Implementation Details:
 * - Handles both sync and async logger interfaces
 * - Falls back to console.error for all error scenarios
 * - Preserves original message context in all fallbacks
 * - Prevents logger failures from breaking configuration loading
 * 
 * @param {string} level - Log level (info, warn, error, etc.)
 * @param {string} message - Message to log
 */
function logSync(level, message) {
  try {
    const logger = require('../logger');
    logger.then(l => l[level](message)).catch(err => {
      console.error(`Logger error: ${err.message}, original message: ${message}`);
    });
  } catch (err) {
    console.error(`Logger error: ${err.message}, original message: ${message}`);
  }
}

/**
 * Configuration Validation Utilities with Safety Clamping
 * 
 * Purpose: Provides comprehensive configuration validation with automatic
 * clamping to prevent unsafe values. This class implements the core safety
 * mechanisms that protect the qerrors module from misconfiguration.
 * 
 * Safety Mechanisms:
 * - Automatic value clamping to prevent resource exhaustion
 * - Configuration validation with meaningful error messages
 * - Environment variable validation with type checking
 * - Audit logging for all configuration modifications
 * - Backward compatibility with existing configuration patterns
 * 
 * Design Philosophy:
 * - Fail-safe defaults when configuration is missing
 * - Conservative limits for all configurable resources
 * - Transparent logging when values are modified
 * - Easy extensibility for new configuration options
 */
class ConfigValidator {
  /**
   * Initialize validator with configurable safety threshold
   * 
   * @param {number} [safeThreshold=1000] - Maximum safe value for numeric configs
   */
  constructor(safeThreshold = 1000) {
    this.SAFE_THRESHOLD = safeThreshold;
  }

/**
 * Validate and clamp numeric configuration values to safe limits
 * 
 * Purpose: Ensures numeric configuration values remain within safe
 * operational boundaries to prevent resource exhaustion and DoS attacks.
 * This is the core safety mechanism for all numeric configurations.
 * 
 * Clamping Strategy:
 * - Uses Math.min() to enforce upper limits
 * - Preserves original value if within safe bounds
 * - Logs warnings when values are clamped for transparency
 * - Returns default value if configuration is missing
 * 
 * Security Benefits:
 * - Prevents unlimited resource allocation
 * - Stops misconfiguration from causing memory exhaustion
 * - Provides audit trail for configuration modifications
 * - Maintains system stability under all configuration scenarios
 * 
 * @param {string} key - Configuration key name
 * @param {number} [defaultValue=0] - Default value if key not found
 * @returns {number} Clamped configuration value
 */
  clampConfigValue(key, defaultValue = 0) {
    const rawValue = config.getInt(key, defaultValue);
    const clampedValue = Math.min(rawValue, this.SAFE_THRESHOLD);
    
    if (rawValue > this.SAFE_THRESHOLD) {
      logSync('warn', `Configuration ${key} clamped from ${rawValue} to ${clampedValue}`);
    }
    
    return clampedValue;
  }

/**
 * Validate queue and concurrency limits for qerrors operations
 * 
 * Purpose: Validates and clamps critical queue management parameters
 * that control qerrors resource usage and concurrency behavior. These
 * settings directly impact system stability and performance.
 * 
 * Critical Parameters Validated:
 * - CONCURRENCY_LIMIT: Maximum parallel qerrors operations
 * - QUEUE_LIMIT: Maximum queued qerrors requests
 * 
 * Resource Protection:
 * - Prevents excessive parallel operations that could overwhelm system
 * - Stops unlimited queue growth that could consume all memory
 * - Ensures qerrors remains stable under high load conditions
 * - Maintains predictable resource usage patterns
 * 
 * @returns {Object} Validated configuration with CONCURRENCY_LIMIT and QUEUE_LIMIT
 */
  validateQueueConfig() {
    const CONCURRENCY_LIMIT = this.clampConfigValue('QERRORS_CONCURRENCY');
    const QUEUE_LIMIT = this.clampConfigValue('QERRORS_QUEUE_LIMIT');
    
    const rawConc = config.getInt('QERRORS_CONCURRENCY');
    const rawQueue = config.getInt('QERRORS_QUEUE_LIMIT');
    
    if (rawConc > this.SAFE_THRESHOLD || rawQueue > this.SAFE_THRESHOLD) {
      logSync('warn', `High qerrors limits clamped conc ${rawConc} queue ${rawQueue}`);
    }
    
    return { CONCURRENCY_LIMIT, QUEUE_LIMIT };
  }

/**
 * Validate socket configuration for HTTP client connections
 * 
 * Purpose: Validates socket pool settings that control HTTP client
 * connection behavior and resource usage. These settings impact
 * network performance and resource consumption.
 * 
 * Socket Parameters:
 * - MAX_SOCKETS: Maximum total socket connections
 * - MAX_FREE_SOCKETS: Maximum idle sockets to keep open
 * 
 * @returns {Object} Validated socket configuration
 */
  validateSocketConfig() {
    const MAX_SOCKETS = this.clampConfigValue('QERRORS_MAX_SOCKETS');
    const MAX_FREE_SOCKETS = this.clampConfigValue('QERRORS_MAX_FREE_SOCKETS');
    
    return { MAX_SOCKETS, MAX_FREE_SOCKETS };
  }

/**
 * Validate cache configuration with special handling for disabled cache
 * 
 * Purpose: Validates cache size limits with special handling for cache
 * disabled (value 0). Cache settings directly impact memory usage and
 * AI API cost optimization.
 * 
 * Cache Logic:
 * - Value 0 disables cache completely
 * - Non-zero values are clamped to safe limits
 * - Prevents unlimited cache growth
 * 
 * @returns {number} Validated cache limit (0 if disabled)
 */
  validateCacheConfig() {
    const parsedLimit = config.getInt('QERRORS_CACHE_LIMIT', 0);
    if (parsedLimit === 0) return 0;
    
    return this.clampConfigValue('QERRORS_CACHE_LIMIT', parsedLimit);
  }

/**
 * Validate retry configuration for AI API calls
 * 
 * Purpose: Validates retry parameters that control resilience behavior
 * when AI API calls fail. These settings impact reliability and cost
 * management for qerrors AI analysis.
 * 
 * Retry Strategy:
 * - attempts: Maximum retry attempts (default 3)
 * - baseMs: Base delay for exponential backoff (default 1000ms)
 * - maxMs: Maximum delay between retries (default 30000ms)
 * 
 * @returns {Object} Validated retry configuration
 */
  validateRetryConfig() {
    return {
      attempts: config.getInt('QERRORS_RETRY_ATTEMPTS', 3),
      baseMs: config.getInt('QERRORS_RETRY_BASE_MS', 1000),
      maxMs: config.getInt('QERRORS_RETRY_MAX_MS', 30000)
    };
  }

/**
 * Validate timeout configuration for operations
 * 
 * Purpose: Validates operation timeout to prevent hanging operations.
 * Timeout settings are critical for system responsiveness and
 * resource management.
 * 
 * @returns {number} Validated timeout in milliseconds (default 30000)
 */
  validateTimeoutConfig() {
    return config.getInt('QERRORS_TIMEOUT', 30000);
  }

/**
 * Validate all qerrors configuration in comprehensive manner
 * 
 * Purpose: Orchestrates validation of all qerrors configuration
 * sections to ensure complete configuration safety and consistency.
 * This is the main entry point for configuration validation.
 * 
 * Configuration Sections Validated:
 * - Queue settings for concurrency and limits
 * - Socket settings for HTTP connections
 * - Cache settings for AI API optimization
 * - Retry settings for resilience
 * - Timeout settings for operation bounds
 * 
 * @returns {Object} Complete validated configuration object
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
 * Validate required environment variable exists and is non-empty
 * 
 * Purpose: Ensures critical environment variables are present and
 * contain meaningful values. This prevents runtime failures due to
 * missing required configuration.
 * 
 * Validation Rules:
 * - Variable must exist in process.env
 * - Value must not be null or undefined
 * - Value must not be empty after trimming whitespace
 * - Throws descriptive error for missing variables
 * 
 * @param {string} varName - Environment variable name to validate
 * @returns {string} Validated environment variable value
 * @throws {Error} If variable is missing or empty
 */
  validateRequiredEnvVar(varName) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      throw new Error(`Required environment variable ${varName} is missing or empty`);
    }
    return value;
  }

/**
 * Validate optional environment variable with fallback value
 * 
 * Purpose: Provides flexible environment variable validation for
 * optional settings with meaningful fallbacks. This enables
 * graceful degradation when optional variables are not set.
 * 
 * @param {string} varName - Environment variable name
 * @param {string} [fallback=''] - Default value if variable not found
 * @returns {string} Variable value or fallback
 */
  validateOptionalEnvVar(varName, fallback = '') {
    const value = process.env[varName];
    return value && value.trim() !== '' ? value : fallback;
  }

/**
 * Validate boolean environment variable with flexible value parsing
 * 
 * Purpose: Parses environment variables as boolean values using
 * flexible value patterns to accommodate different configuration
 * styles and conventions.
 * 
 * Accepted Truthy Values:
 * - "true", "1", "yes", "on" (case insensitive)
 * - Any non-empty value treated as truthy if defaultValue is true
 * 
 * @param {string} varName - Environment variable name
 * @param {boolean} [defaultValue=false] - Default value if not found
 * @returns {boolean} Parsed boolean value
 */
  validateBooleanEnvVar(varName, defaultValue = false) {
    const value = process.env[varName];
    if (!value) return defaultValue;
    
    const lowerValue = value.toLowerCase().trim();
    return ['true', '1', 'yes', 'on'].includes(lowerValue);
  }

/**
 * Validate numeric environment variable with range enforcement
 * 
 * Purpose: Parses and validates numeric environment variables
 * with optional range constraints to ensure values are within
 * acceptable operational boundaries.
 * 
 * Validation Process:
 * - Converts to number using Number() constructor
 * - Validates against NaN (invalid numbers)
 * - Applies min/max range constraints
 * - Logs warnings for invalid values
 * - Uses fallback for invalid or out-of-range values
 * 
 * @param {string} varName - Environment variable name
 * @param {number} [defaultValue=0] - Default value if not found
 * @param {number} [min=0] - Minimum allowed value
 * @param {number} [max=Infinity] - Maximum allowed value
 * @returns {number} Validated numeric value
 */
  validateNumericEnvVar(varName, defaultValue = 0, min = 0, max = Infinity) {
    const value = process.env[varName];
    if (!value) return defaultValue;
    
    const numValue = Number(value);
    if (Number.isNaN(numValue)) {
      logSync('warn', `Invalid numeric value for ${varName}: ${value}, using default ${defaultValue}`);
      return defaultValue;
    }
    
    return Math.max(min, Math.min(max, numValue));
  }
}

// Create singleton instance for global consistency
const configValidator = new ConfigValidator();

/**
 * Module exports with both class and convenience functions
 * 
 * Purpose: Provides flexible access patterns to configuration
 * validation - either through class instances or direct
 * convenience functions for common use cases.
 * 
 * Export Patterns:
 * - ConfigValidator: Class for creating custom validators
 * - configValidator: Singleton instance for immediate use
 * - Convenience functions: Direct access to common validations
 * 
 * Usage Flexibility:
 * - Can create multiple validator instances with different thresholds
 * - Can use singleton for simple cases
 * - Can import individual functions for specific validation needs
 */
module.exports = {
  ConfigValidator,
  configValidator,
  
  // Convenience exports for common validation operations
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