/**
 * Configuration defaults for qerrors module using dotenv
 * 
 * This module provides environment variable management using dotenv for loading
 * .env files and custom parsing utilities for type conversion and validation.
 * Maintains backward compatibility with the original config module while leveraging
 * industry-standard dotenv for environment file loading.
 * 
 * Design rationale:
 * - Uses dotenv for industry-standard .env file loading
 * - Maintains custom parsing utilities for type conversion and validation
 * - Preserves all original defaults and helper functions
 * - Provides enhanced error handling and validation
 */

// Load environment variables from .env file
require('dotenv').config();

/**
 * Configuration defaults for qerrors module
 * 
 * These defaults represent carefully balanced values for production use. Each setting
 * has been chosen based on practical experience and common deployment scenarios.
 * 
 * Design rationale:
 * - Conservative defaults prevent resource exhaustion while allowing customization
 * - String values maintain consistency with environment variable parsing
 * - Values scale appropriately for both development and production environments
 * - OpenAI integration defaults balance API cost with functionality
 */
const defaults = {
  QERRORS_CONCURRENCY: '5', //max concurrent analyses
  QERRORS_CACHE_LIMIT: '50', //LRU cache size
  QERRORS_CACHE_TTL: '86400', //seconds each cache entry remains valid //(new default ttl)
  QERRORS_QUEUE_LIMIT: '100', //max waiting analyses before rejecting //(new env default)
  QERRORS_SAFE_THRESHOLD: '1000', //upper limit for concurrency and queue //(new config default)

  QERRORS_RETRY_ATTEMPTS: '2', //number of API retries //(renamed env var and updated default)
  QERRORS_RETRY_BASE_MS: '100', //base delay for retries //(renamed env var and updated default)
  QERRORS_RETRY_MAX_MS: '2000', //cap wait time for exponential backoff //(new env default)
  QERRORS_TIMEOUT: '10000', //axios request timeout in ms
  QERRORS_MAX_SOCKETS: '50', //max sockets per http/https agent
  QERRORS_MAX_FREE_SOCKETS: '256', //max idle sockets per agent //(new env default)
  QERRORS_MAX_TOKENS: '2048', //max tokens for openai responses //(new env default)
  QERRORS_OPENAI_URL: 'https://api.openai.com/v1/chat/completions', //endpoint used for analysis //(new openai url default)

  QERRORS_LOG_MAXSIZE: String(1024 * 1024), //log file size in bytes
  QERRORS_LOG_MAXFILES: '5', //number of rotated log files
  QERRORS_LOG_MAX_DAYS: '0', //days to retain rotated logs //(0 disables time rotation)
  QERRORS_VERBOSE: 'true', //default on so AI advice prints to console, set to 'false' to suppress
  QERRORS_LOG_DIR: 'logs', //directory for rotated logs
  QERRORS_DISABLE_FILE_LOGS: '', //flag to disable file transports when set
  QERRORS_SERVICE_NAME: 'qerrors', //service identifier for logger //(new default)

  QERRORS_LOG_LEVEL: 'info', //logger output severity default

  QERRORS_METRIC_INTERVAL_MS: '30000' //interval for queue metrics in ms //(new default)
};

/**
 * Enhanced environment variable getter with explicit default support
 * 
 * Purpose: Retrieves environment variables with fallback to explicit default or module defaults
 * Supports both single-argument (uses module defaults) and two-argument (explicit default) patterns.
 * 
 * @param {string} name - Environment variable name to retrieve
 * @param {*} defaultVal - Optional explicit default value (falls back to module defaults if not provided)
 * @returns {*} Environment variable value or default
 */
function getEnv(name, defaultVal) {
  if (process.env[name] !== undefined) {
    return process.env[name]; //(return actual env value if set)
  }
  if (defaultVal !== undefined) {
    return defaultVal; //(use explicit default if provided)
  }
  return defaults[name]; //(fall back to module defaults)
}

/**
 * Safe execution utility for environment operations
 * 
 * Purpose: Provides safe execution with fallback for environment-related operations
 * 
 * @param {string} name - Operation name for logging
 * @param {Function} fn - Function to execute
 * @param {*} fallback - Fallback value on error
 * @param {Object} info - Additional info for logging
 * @returns {*} Function result or fallback
 */
function safeRun(name, fn, fallback, info) {
  try { 
    return fn(); 
  } catch (err) { 
    console.error(`${name} failed`, info); 
    return fallback; 
  }
}

/**
 * Enhanced integer environment variable parser with explicit default support
 * 
 * Purpose: Parses integer environment variables with validation and explicit defaults
 * Supports multiple call patterns for backward compatibility:
 * - getInt(name) - uses module default, min=1
 * - getInt(name, min) - LEGACY: uses module default with custom min
 * - getInt(name, defaultVal, min) - NEW: explicit default and min
 * 
 * @param {string} name - Environment variable name to parse
 * @param {number} defaultValOrMin - When 3 args: explicit default. When 2 args: minimum (legacy pattern)
 * @param {number} min - Minimum allowed value (defaults to 1)
 * @returns {number} Parsed integer value with minimum enforcement
 */
function getInt(name, defaultValOrMin, min) {
  const envValue = process.env[name]; //(get raw env value)
  const int = parseInt(envValue || '', 10); //attempt parse
  const moduleDefault = typeof defaults[name] === 'number' ? defaults[name] : parseInt(defaults[name] || '0', 10); //(get module default safely)
  
  let fallbackVal;
  let minVal;
  
  if (arguments.length <= 1) {
    fallbackVal = moduleDefault; //(use module default when no explicit default provided)
    minVal = 1; //(default min)
  } else if (arguments.length === 2) {
    fallbackVal = moduleDefault; //(legacy pattern: second arg is min, use module default)
    minVal = typeof defaultValOrMin === 'number' ? defaultValOrMin : 1;
  } else {
    fallbackVal = typeof defaultValOrMin === 'number' ? defaultValOrMin : moduleDefault; //(new pattern: explicit default)
    minVal = typeof min === 'number' ? min : 1;
  }
  
  const val = Number.isNaN(int) ? fallbackVal : int; //default when NaN
  return val >= minVal ? val : minVal; //enforce allowed minimum
}

/**
 * Validate required environment variables
 * 
 * Purpose: Checks if all required environment variables are present
 * 
 * @param {string[]} varNames - Array of required variable names
 * @returns {Object} Validation result with missing variables
 */
function validateRequiredVars(varNames) {
  const missing = varNames.filter(name => !process.env[name]);
  return {
    isValid: missing.length === 0,
    missing,
    present: varNames.filter(name => process.env[name])
  };
}

/**
 * Get environment configuration summary
 * 
 * Purpose: Provides a summary of current environment configuration
 * 
 * @returns {Object} Configuration summary
 */
function getConfigSummary() {
  return {
    environment: process.env.NODE_ENV || 'development',
    hasEnvFile: require('fs').existsSync('.env'),
    configuredVars: Object.keys(defaults).filter(key => process.env[key] !== undefined),
    totalVars: Object.keys(defaults).length
  };
}

module.exports = {
  defaults, //export defaults for external use
  getEnv, //enhanced environment variable getter
  safeRun, //safe execution utility
  getInt, //enhanced integer parser
  validateRequiredVars, //environment validation
  getConfigSummary //configuration summary
};