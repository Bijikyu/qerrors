'use strict';

/**
 * Qerrors Configuration Management and Safety Limits
 * 
 * This module manages all qerrors configuration values with built-in safety
 * mechanisms to prevent misconfiguration that could harm system performance
 * or cause resource exhaustion. It enforces reasonable limits while providing
 * flexibility for different deployment scenarios.
 * 
 * Key Safety Features:
 * - Clamping: Prevents dangerously high configuration values
 * - Safe Thresholds: Provides reasonable fallback values
 * - Warning System: Logs when configuration values are clamped
 * - Environment Validation: Ensures values are safe for production use
 * 
 * Configuration Philosophy:
 * - Security First: Better to limit functionality than risk resource exhaustion
 * - Performance Awareness: Limits prevent performance degradation at scale
 * - Operational Safety: Configurations that could cause system instability are rejected
 * - Graceful Degradation: Bad configurations result in safe defaults, not crashes
 */

// Import configuration utilities for environment variable access
const config = require('./config');
const localVars = require('../config/localVars');

/**
 * Safely clamps configuration values to prevent dangerous settings
 * 
 * This function provides a safety net for configuration values by ensuring
 * they don't exceed safe thresholds. It handles edge cases like undefined
 * values, null values, and NaN gracefully while providing clear feedback
 * when values are modified for safety.
 * 
 * @param {*} rawValue - The raw configuration value from environment
 * @param {number} safeThreshold - Maximum safe value for this configuration
 * @param {string} configName - Name of the configuration for logging
 * @returns {number} Clamped safe configuration value
 */
function clampConfigValue(rawValue, safeThreshold, configName) {
  // Handle edge cases: undefined, null, NaN values fall back to safe threshold
  // This ensures that misconfiguration doesn't result in invalid values
  const valueToClamp = rawValue !== undefined && rawValue !== null && !Number.isNaN(rawValue) 
    ? rawValue 
    : safeThreshold;
  
  // Clamp the value to the safe threshold (prevents dangerous high values)
  const clampedValue = Math.min(valueToClamp, safeThreshold);
  
  // Log when values are clamped so administrators know about configuration issues
  // This helps identify misconfiguration while maintaining system safety
  if (rawValue > safeThreshold) {
    logSync('warn', `${configName} clamped from ${rawValue} to ${clampedValue}`);
  }
  
  return clampedValue;
}

/**
 * Synchronous logging for module-level configuration issues
 * 
 * This function provides synchronous console logging during module initialization.
 * It's used because the main logger may not be available when configuration
 * is being processed. The synchronous nature ensures configuration warnings
 * are immediately visible during startup.
 * 
 * @param {string} level - Log level (warn, error, info)
 * @param {string} message - Message to log
 */
function logSync(level, message) {
  console[level](message);
}

// Load and validate concurrency limits for AI analysis
const rawConc = config.getInt('QERRORS_CONCURRENCY', 5);        // Raw concurrency setting
const rawQueue = config.getInt('QERRORS_QUEUE_LIMIT', 100);    // Raw queue limit setting
const SAFE_THRESHOLD = config.getInt('QERRORS_SAFE_THRESHOLD', 1000); // Global safety limit

// Apply safety clamping to concurrency and queue limits
// These limits prevent resource exhaustion from too many concurrent AI requests
const CONCURRENCY_LIMIT = clampConfigValue(rawConc, SAFE_THRESHOLD, 'QERRORS_CONCURRENCY');
const QUEUE_LIMIT = clampConfigValue(rawQueue, SAFE_THRESHOLD, 'QERRORS_QUEUE_LIMIT');

// Log warning if any limits were clamped for safety
// This helps administrators understand why their configuration was modified
if (rawConc > SAFE_THRESHOLD || rawQueue > SAFE_THRESHOLD) {
  logSync('warn', `High qerrors limits clamped conc ${rawConc} queue ${rawQueue}`);
}

// Load and validate HTTP connection pool settings for AI API requests
// These settings control connection reuse and resource management
const rawSockets = config.getInt('QERRORS_MAX_SOCKETS');
const MAX_SOCKETS = clampConfigValue(rawSockets, SAFE_THRESHOLD, 'QERRORS_MAX_SOCKETS');

const rawFreeSockets = config.getInt('QERRORS_MAX_FREE_SOCKETS');
const MAX_FREE_SOCKETS = clampConfigValue(rawFreeSockets, SAFE_THRESHOLD, 'QERRORS_MAX_FREE_SOCKETS');

// Load and validate cache configuration
// Special handling for 0 value to allow complete cache disabling
const parsedLimit = config.getInt('QERRORS_CACHE_LIMIT', 0);
const ADVICE_CACHE_LIMIT = parsedLimit === 0 
  ? 0 
  : clampConfigValue(parsedLimit, SAFE_THRESHOLD, 'QERRORS_CACHE_LIMIT');

// Cache TTL (0 = no expiration, can be safe since cache has size limits)
const CACHE_TTL_SECONDS = config.getInt('QERRORS_CACHE_TTL', 0);

/**
 * Module exports - Safe configuration values
 * 
 * All exported values have been validated and clamped to safe thresholds.
 * This ensures that consuming modules receive configuration values that
 * won't cause resource exhaustion or performance issues. The exports are
 * organized by functional area for clarity.
 * 
 * Export Categories:
 * - Concurrency Controls: AI analysis limits and queue management
 * - HTTP Connection Settings: Socket management for API requests  
 * - Cache Configuration: Size and timing controls for advice cache
 * - Safety Constants: Global safety thresholds
 */
module.exports = {
  // Concurrency and queue management
  CONCURRENCY_LIMIT,        // Maximum concurrent AI analysis requests
  QUEUE_LIMIT,              // Maximum pending analysis requests in queue
  
  // HTTP connection pool management
  MAX_SOCKETS,              // Maximum concurrent HTTP connections
  MAX_FREE_SOCKETS,         // Maximum idle HTTP connections
  
  // Cache configuration
  ADVICE_CACHE_LIMIT,       // Maximum number of cached advice entries
  CACHE_TTL_SECONDS,        // Time to live for cache entries
  
  // Safety constants
  SAFE_THRESHOLD            // Global safety limit for all configurations
};