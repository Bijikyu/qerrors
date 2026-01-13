/**
 * Configuration Management Module - Environment Variable Handling and Validation
 * 
 * Purpose: Provides centralized configuration management for the qerrors system,
 * including environment variable loading, type conversion, validation, and
 * sensible defaults. This module ensures consistent configuration behavior
 * across different deployment environments.
 * 
 * Design Rationale:
 * - Environment-first configuration: Uses environment variables with fallback defaults
 * - Type safety: Provides type-specific getters with validation and conversion
 * - Graceful degradation: Handles missing or invalid values safely
 * - Development-friendly: Supports .env file loading for local development
 * - Validation capabilities: Enables required variable checking for critical settings
 * - Monitoring support: Provides configuration summary for debugging
 * 
 * Key Features:
 * - Automatic .env file loading with dotenv
 * - Type-safe environment variable getters (string, int, bool)
 * - Required variable validation with detailed reporting
 * - Configuration summary for monitoring and debugging
 * - Safe error handling with fallback values
 * - Support for both sync and async configuration operations
 */

// Import required dependencies
const { loadDotenv, checkEnvFileExists } = require('./shared/environmentLoader');
const localVars = require('../config/localVars');
const { CONFIG_DEFAULTS } = localVars;

// Extract defaults from localVars for easier access
// This provides the baseline configuration values that will be used
// when environment variables are not specified
const defaults = CONFIG_DEFAULTS;

/**
 * Get environment variable with fallback support
 * 
 * This function retrieves an environment variable using a three-tier fallback
 * strategy: 1) Use the actual environment variable if set, 2) Use the provided
 * default value if specified, 3) Use the module default from CONFIG_DEFAULTS.
 * This ensures that configuration is flexible while maintaining sensible defaults.
 * 
 * @param {string} name - Environment variable name to retrieve
 * @param {*} defaultVal - Optional fallback value if environment variable is not set
 * @returns {string|undefined} The environment variable value or appropriate fallback
 * 
 * Example:
 * // Get PORT with fallback to module default (usually 3000)
 * const port = getEnv('PORT');
 * 
 * // Get DEBUG with custom fallback
 * const debug = getEnv('DEBUG', 'false');
 */
const getEnv = (name, defaultVal) => 
  process.env[name] !== undefined ? process.env[name] : 
  defaultVal !== undefined ? defaultVal : defaults[name];

/**
 * Execute a function safely with error handling and fallback
 * 
 * This utility function executes potentially risky operations (like configuration
 * parsing or validation) and provides comprehensive error handling. If the
 * operation fails, it logs the error with context information and returns a
 * safe fallback value instead of propagating the exception.
 * 
 * Design Rationale:
 * - Error safety: Never allows configuration errors to crash the application
 * - Contextual logging: Provides detailed error information for debugging
 * - Graceful degradation: Uses fallback values when operations fail
 * - Operational stability: Ensures the application can start even with config issues
 * 
 * @param {string} name - Operation name for error logging (identifies what failed)
 * @param {Function} fn - Function to execute safely
 * @param {*} fallback - Value to return if the function fails
 * @param {string} info - Additional context information for error logging
 * @returns {*} Result of the function or fallback value if it fails
 * 
 * Example:
 * // Safely parse JSON configuration
 * const config = safeRun('parseConfig', () => JSON.parse(jsonStr), {}, 'parsing main config');
 */
const safeRun = (name, fn, fallback, info) => {
  try {
    return fn();
  } catch (err) {
    console.error(`${name} failed`, info);
    return fallback;
  }
};

/**
 * Get environment variable as integer with validation and bounds checking
 * 
 * This function retrieves an environment variable and converts it to an integer
 * with comprehensive validation and bounds checking. It supports multiple calling
 * patterns to provide flexibility for different use cases while maintaining
 * type safety and sensible defaults.
 * 
 * Calling Patterns:
 * - getInt(name): Use environment variable or module default, minimum value of 1
 * - getInt(name, min): Use environment variable or module default, custom minimum
 * - getInt(name, default, min): Use environment variable or custom default, custom minimum
 * 
 * Design Rationale:
 * - Type safety: Ensures integer values with proper parsing
 * - Bounds validation: Enforces minimum values to prevent invalid configurations
 * - Flexible defaults: Supports both module defaults and custom fallbacks
 * - Graceful handling: Uses fallback values for invalid or missing values
 * 
 * @param {string} name - Environment variable name
 * @param {number} [defaultValOrMin] - Default value OR minimum value (based on arg count)
 * @param {number} [min] - Minimum allowed value (only when 3 args provided)
 * @returns {number} Validated integer value with bounds checking applied
 * 
 * Examples:
 * // Use module default with minimum of 1
 * const port = getInt('PORT');
 * 
 * // Use module default with custom minimum
 * const timeout = getInt('TIMEOUT', 1000);
 * 
 * // Use custom default with custom minimum
 * const workers = getInt('WORKERS', 4, 1);
 */
const getInt = (name, defaultValOrMin, min) => {
  // Parse the environment variable as integer
  const envValue = process.env[name];
  const int = parseInt(envValue || '', 10);
  
  // Get the module default value for this variable
  const moduleDefault = typeof defaults[name] === 'number' ? defaults[name] : parseInt(defaults[name] || '0', 10);
  
  // Determine fallback and minimum values based on argument count
  let fallbackVal, minVal;
  if (arguments.length <= 1) {
    // getInt(name) - use module default, minimum of 1
    fallbackVal = moduleDefault;
    minVal = 1;
  } else if (arguments.length === 2) {
    // getInt(name, min) - use module default, custom minimum
    fallbackVal = moduleDefault;
    minVal = typeof defaultValOrMin === 'number' ? defaultValOrMin : 1;
  } else {
    // getInt(name, default, min) - use custom default, custom minimum
    fallbackVal = typeof defaultValOrMin === 'number' ? defaultValOrMin : moduleDefault;
    minVal = typeof min === 'number' ? min : 1;
  }
  
  // Use parsed value if valid, otherwise use fallback
  const val = Number.isNaN(int) ? fallbackVal : int;
  
  // Enforce minimum value constraint
  return val >= minVal ? val : minVal;
};

/**
 * Get environment variable as boolean with comprehensive parsing
 * 
 * This function retrieves an environment variable and converts it to a boolean
 * using comprehensive parsing that supports multiple boolean representations.
 * It handles various string formats, numeric values, and actual boolean types
 * while providing sensible fallback behavior.
 * 
 * Supported True Values: '1', 'true', 'yes', 'y', 'on', 'enable', 'enabled', 1, true
 * Supported False Values: '0', 'false', 'no', 'n', 'off', 'disable', 'disabled', 0, false
 * 
 * Design Rationale:
 * - Flexible parsing: Supports common boolean representations in environment variables
 * - Type safety: Handles multiple input types (string, number, boolean)
 * - Case-insensitive: Normalizes string values for robust matching
 * - Graceful fallback: Uses defaults when values cannot be parsed
 * - Default safety: Returns false as ultimate fallback for unparseable values
 * 
 * @param {string} name - Environment variable name
 * @param {*} defaultVal - Optional fallback value if environment variable is not set
 * @returns {boolean} Parsed boolean value with fallback support
 * 
 * Examples:
 * // Parse DEBUG environment variable
 * const debugEnabled = getBool('DEBUG');
 * 
 * // Parse with custom fallback
 * const verbose = getBool('VERBOSE', false);
 * 
 * // Environment variable examples:
 * // DEBUG=true -> true
 * // DEBUG=1 -> true
 * // DEBUG=yes -> true
 * // DEBUG=false -> false
 * // DEBUG=0 -> false
 * // DEBUG= (unset) -> fallback value
 */
const getBool = (name, defaultVal) => {
  /**
   * Parse a value as boolean with comprehensive format support
   * 
   * This helper function converts various input types to boolean values.
   * It returns null for unparseable values, allowing the caller to handle
   * fallback logic appropriately.
   * 
   * @param {*} value - Value to parse as boolean
   * @returns {boolean|null} Parsed boolean or null if unparseable
   */
  const parseBool = (value) => {
    // Handle actual boolean values directly
    if (typeof value === 'boolean') return value;
    
    // Handle numeric values (0 = false, non-zero = true)
    if (typeof value === 'number') return value !== 0;
    
    // Reject non-string values (except the cases handled above)
    if (typeof value !== 'string') return null;

    // Normalize string value for case-insensitive matching
    const normalized = value.trim().toLowerCase();
    
    // Empty string cannot be parsed as boolean
    if (normalized === '') return null;
    
    // Check for various true representations
    if (['1', 'true', 'yes', 'y', 'on', 'enable', 'enabled'].includes(normalized)) return true;
    
    // Check for various false representations
    if (['0', 'false', 'no', 'n', 'off', 'disable', 'disabled'].includes(normalized)) return false;
    
    // Value is not a recognized boolean representation
    return null;
  };

  // Try to parse the environment variable value
  const envValue = process.env[name];
  const envParsed = envValue !== undefined ? parseBool(String(envValue)) : null;
  
  // Return parsed environment value if successful
  if (envParsed !== null) return envParsed;

  // Get fallback value (provided default or module default)
  const moduleDefault = defaults[name];
  const fallback = defaultVal !== undefined ? defaultVal : moduleDefault;
  const fallbackParsed = parseBool(fallback);

  // Return parsed fallback or false as ultimate fallback
  return fallbackParsed !== null ? fallbackParsed : false;
};

/**
 * Validate that required environment variables are present
 * 
 * This function checks if all specified environment variables are set and
 * provides detailed reporting of which variables are missing and which are
 * present. This is useful for startup validation to ensure that critical
 * configuration is available before the application begins operation.
 * 
 * Design Rationale:
 * - Startup validation: Ensures critical configuration is available before running
 * - Detailed reporting: Provides comprehensive feedback about configuration state
 * - Early failure detection: Prevents runtime errors from missing configuration
 * - Operational safety: Helps identify configuration issues quickly
 * 
 * @param {string[]} varNames - Array of environment variable names to validate
 * @returns {Object} Validation result with detailed status information
 * @returns {boolean} returns.isValid - True if all required variables are present
 * @returns {string[]} returns.missing - Array of missing variable names
 * @returns {string[]} returns.present - Array of present variable names
 * 
 * Example:
 * // Validate critical configuration at startup
 * const requiredVars = ['DATABASE_URL', 'API_KEY', 'JWT_SECRET'];
 * const validation = validateRequiredVars(requiredVars);
 * 
 * if (!validation.isValid) {
 *   console.error('Missing required environment variables:', validation.missing);
 *   process.exit(1);
 * }
 * 
 * console.log('All required variables present:', validation.present);
 */
const validateRequiredVars = varNames => {
  const missing = [];
  const present = [];
  
  // Check each variable name for presence in environment
  for (const name of varNames) {
    process.env.hasOwnProperty(name) ? present.push(name) : missing.push(name);
  }
  
  // Return comprehensive validation result
  return { isValid: missing.length === 0, missing, present };
};

/**
 * Get comprehensive configuration summary for monitoring and debugging
 * 
 * This async function provides a detailed overview of the current configuration
 * state, including environment detection, .env file presence, and configuration
 * coverage. This information is valuable for monitoring, debugging, and
 * operational visibility into the application's configuration state.
 * 
 * Design Rationale:
 * - Operational visibility: Provides insights into configuration state for monitoring
 * - Debugging support: Helps identify configuration issues during development
 * - Environment detection: Clearly shows which environment the app is running in
 * - Configuration coverage: Indicates how many configuration variables are actually set
 * - Async safety: Uses async file checking to avoid blocking operations
 * 
 * @returns {Promise<Object>} Configuration summary with detailed state information
 * @returns {string} returns.environment - Current environment (development, production, etc.)
 * @returns {boolean} returns.hasEnvFile - Whether .env file exists in the project
 * @returns {string[]} returns.configuredVars - Array of environment variable names that are set
 * @returns {number} returns.totalVars - Total number of configuration variables defined
 * 
 * Example:
 * // Get configuration summary for logging
 * const configSummary = await getConfigSummary();
 * console.log('Configuration state:', configSummary);
 * // Output: { environment: 'production', hasEnvFile: false, configuredVars: ['PORT', 'NODE_ENV'], totalVars: 15 }
 */
const getConfigSummary = async () => {
  // Check if .env file exists (async operation)
  const hasEnvFile = await checkEnvFileExists();
  
  // Build comprehensive configuration summary
  return {
    environment: localVars.NODE_ENV || 'development',
    hasEnvFile,
    configuredVars: Object.keys(defaults).filter(key => process.env[key] !== undefined),
    totalVars: Object.keys(defaults).length
  };
};

/**
 * Get configuration summary synchronously (deprecated - use async version)
 * 
 * This function provides the same configuration summary as getConfigSummary but
 * uses synchronous file operations. This is deprecated because synchronous file
 * operations can block the event loop and should be avoided in production.
 * The async version is preferred for better performance.
 * 
 * @deprecated Use getConfigSummary() instead for better performance
 * @returns {Object} Configuration summary (same format as async version)
 * @returns {string} returns.environment - Current environment
 * @returns {boolean} returns.hasEnvFile - Whether .env file exists
 * @returns {string[]} returns.configuredVars - Array of set environment variable names
 * @returns {number} returns.totalVars - Total number of configuration variables
 * 
 * Example:
 * // Legacy usage (not recommended)
 * const summary = getConfigSummarySync();
 * console.log('Configuration:', summary);
 * 
 * // Preferred modern usage:
 * // const summary = await getConfigSummary();
 */
const getConfigSummarySync = () => {
  // Issue deprecation warning to guide developers toward better practice
  console.warn('getConfigSummarySync is deprecated - use async getConfigSummary() instead');
  
  // Use synchronous file system operations (not recommended for production)
  const fs = require('fs');
  let hasEnvFile = null;
  
  try {
    hasEnvFile = fs.existsSync('.env');
  } catch (error) {
    // If file check fails, assume no .env file exists
    hasEnvFile = false;
  }
  
  // Return same format as async version
  return {
    environment: localVars.NODE_ENV || 'development',
    hasEnvFile,
    configuredVars: Object.keys(defaults).filter(key => process.env[key] !== undefined),
    totalVars: Object.keys(defaults).length
  };
};

/**
 * Module exports - Complete configuration management system
 * 
 * This module exports a comprehensive configuration management system that
 * provides everything needed for environment variable handling, type conversion,
 * validation, and monitoring. The exports are organized by functionality for
 * easy importing and clear API boundaries.
 * 
 * Export Categories:
 * - Core getters: Type-safe environment variable retrieval
 * - Validation: Required variable checking and validation
 * - Utilities: Helper functions for safe operations
 * - Monitoring: Configuration state and summary functions
 * - Defaults: Access to baseline configuration values
 */
module.exports = {
  // Core configuration values and defaults
  defaults,
  
  // Type-safe environment variable getters
  getEnv,        // Get string value with fallback support
  getInt,        // Get integer value with validation and bounds checking
  getBool,       // Get boolean value with comprehensive parsing
  
  // Validation and safety utilities
  validateRequiredVars,  // Check if required environment variables are present
  safeRun,              // Execute operations safely with error handling
  
  // Configuration monitoring and debugging
  getConfigSummary,      // Async configuration summary (preferred)
  getConfigSummarySync, // Sync configuration summary (deprecated)
  
  // Environment file management
  loadDotenv  // Load .env file for local development
};
