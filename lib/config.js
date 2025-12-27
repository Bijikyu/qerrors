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

// Async dotenv loading - will be called during initialization
let dotenvLoaded = false;
const loadDotenv = async () => {
  if (!dotenvLoaded) {
    try {
      require('dotenv').config();
      dotenvLoaded = true;
    } catch (error) {
      qerrors(error, 'config.loadDotenv', {
        operation: 'dotenv_loading'
      });
      console.warn('Failed to load .env file:', error.message);
      dotenvLoaded = true; // Mark as attempted even if failed
    }
  }
};

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
const localVars = require('../config/localVars');
const { CONFIG_DEFAULTS } = localVars;
const defaults = CONFIG_DEFAULTS;

/**
 * Enhanced environment variable getter with explicit default support and fallback hierarchy
 * 
 * Purpose: Retrieves environment variables with a comprehensive fallback strategy that
 * supports multiple calling patterns. This function provides flexible default value
 * handling while maintaining backward compatibility with existing code.
 * 
 * Design Rationale:
 * - Flexible calling patterns: Supports both 1-arg and 2-arg calling conventions
 * - Fallback hierarchy: Environment variable > explicit default > module default
 * - Undefined handling: Properly distinguishes between unset and explicitly set variables
 * - Type preservation: Returns values in their original string type from process.env
 * - Backward compatibility: Maintains existing API while adding enhanced functionality
 * 
 * Calling Patterns:
 * - getEnv('VAR_NAME') - Uses module default if environment variable not set
 * - getEnv('VAR_NAME', 'explicit_default') - Uses explicit default if environment variable not set
 * 
 * @param {string} name - Environment variable name to retrieve
 * @param {*} [defaultVal] - Optional explicit default value (falls back to module defaults if not provided)
 * @returns {*} Environment variable value or appropriate default
 * 
 * Example:
 * getEnv('PORT') // Returns process.env.PORT or module default
 * getEnv('PORT', '3000') // Returns process.env.PORT or '3000'
 */
const getEnv=(name,defaultVal)=>process.env[name]!==undefined?process.env[name]:defaultVal!==undefined?defaultVal:defaults[name];

/**
 * Safe execution utility for environment operations with comprehensive error handling
 * 
 * Purpose: Provides a safe wrapper for executing environment-related operations that
 * might fail, such as parsing environment variables or accessing configuration files.
 * This function ensures that failures in environment operations don't crash the
 * application while providing visibility into what went wrong.
 * 
 * Design Rationale:
 * - Error isolation: Prevents environment operation failures from affecting application startup
 * - Visibility: Logs errors with operation name and context for debugging
 * - Predictable behavior: Always returns a value (result or fallback) for consistent operation
 * - Environment focus: Specifically designed for environment variable and configuration operations
 * 
 * @param {string} name - Operation name for error logging and identification
 * @param {Function} fn - Function to execute safely
 * @param {*} fallback - Fallback value to return if function throws an exception
 * @param {Object} info - Additional context information for error logging
 * @returns {*} Function result or fallback value if error occurs
 * 
 * Example:
 * safeRun('parsePort', () => parseInt(process.env.PORT), 3000, { defaultValue: 3000 });
 * // Returns parsed port or 3000 if parsing fails
 */
const safeRun=(name,fn,fallback,info)=>{try{return fn();}catch(err){console.error(`${name} failed`,info);return fallback;}};

/**
 * Enhanced integer environment variable parser with comprehensive validation and flexible calling patterns
 * 
 * Purpose: Parses integer environment variables with validation, minimum enforcement, and
 * support for multiple calling patterns to maintain backward compatibility. This function
 * ensures that integer configuration values are always valid numbers within acceptable ranges.
 * 
 * Design Rationale:
 * - Multiple calling patterns: Supports both legacy and new calling conventions
 * - Type safety: Ensures returned values are valid numbers
 * - Minimum enforcement: Applies minimum value constraints for configuration safety
 * - Backward compatibility: Maintains existing API while adding enhanced functionality
 * - Fallback hierarchy: Environment variable > explicit default > module default > minimum
 * 
 * Calling Patterns:
 * - getInt(name) - Uses module default, minimum of 1
 * - getInt(name, min) - LEGACY: Uses module default with custom minimum
 * - getInt(name, defaultVal, min) - NEW: Uses explicit default and custom minimum
 * 
 * @param {string} name - Environment variable name to parse
 * @param {number} defaultValOrMin - When 3 args: explicit default. When 2 args: minimum (legacy pattern)
 * @param {number} min - Minimum allowed value (defaults to 1)
 * @returns {number} Parsed integer value with minimum enforcement
 * 
 * Example:
 * getInt('PORT') // Uses module default, min=1
 * getInt('PORT', 8080) // Legacy: uses module default, min=8080
 * getInt('PORT', 3000, 1024) // New: uses 3000 as default, min=1024
 */
const getInt = (name, defaultValOrMin, min) => {
  // Parse environment variable as integer
  const envValue = process.env[name];
  const int = parseInt(envValue || '', 10);
  
  // Get module default (handle both number and string defaults)
  const moduleDefault = typeof defaults[name] === 'number' 
    ? defaults[name] 
    : parseInt(defaults[name] || '0', 10);
  
  let fallbackVal, minVal;
  
  // Determine calling pattern and set appropriate values
  if (arguments.length <= 1) {
    // getInt(name) - use module default, min=1
    fallbackVal = moduleDefault;
    minVal = 1;
  } else if (arguments.length === 2) {
    // getInt(name, min) - legacy pattern: use module default, custom min
    fallbackVal = moduleDefault;
    minVal = typeof defaultValOrMin === 'number' ? defaultValOrMin : 1;
  } else {
    // getInt(name, defaultVal, min) - new pattern: explicit default and min
    fallbackVal = typeof defaultValOrMin === 'number' ? defaultValOrMin : moduleDefault;
    minVal = typeof min === 'number' ? min : 1;
  }
  
  // Use parsed value or fallback, then enforce minimum
  const val = Number.isNaN(int) ? fallbackVal : int;
  return val >= minVal ? val : minVal;
};

/**
 * Validate required environment variables with comprehensive result reporting
 * 
 * Purpose: Checks if all required environment variables are present and provides
 * detailed validation results including missing variables and present variables.
 * This function is useful for application startup validation to ensure that
 * all required configuration is available before proceeding.
 * 
 * Design Rationale:
 * - Comprehensive validation: Checks all required variables in a single call
 * - Detailed reporting: Provides both missing and present variable lists
 * - Boolean result: Simple isValid flag for quick validation checks
 * - Array filtering: Efficient validation using array filter operations
 * - Startup safety: Enables early failure detection for missing configuration
 * 
 * @param {string[]} varNames - Array of required environment variable names
 * @returns {Object} Validation result object with detailed information
 * @returns {boolean} returns.isValid - True if all required variables are present
 * @returns {string[]} returns.missing - Array of missing required variable names
 * @returns {string[]} returns.present - Array of present required variable names
 * 
 * Example:
 * const result = validateRequiredVars(['API_KEY', 'DATABASE_URL']);
 * if (!result.isValid) {
 *   console.error('Missing required variables:', result.missing);
 * }
 */
const validateRequiredVars=varNames=>{const missing=varNames.filter(name=>!process.env[name]);return{isValid:missing.length===0,missing,present:varNames.filter(name=>process.env[name])};};

/**
 * Get comprehensive environment configuration summary for debugging and monitoring
 * 
 * Purpose: Provides a detailed overview of the current environment configuration
 * including which variables are set, environment file status, and configuration
 * completeness. This is useful for debugging configuration issues and monitoring
 * environment state in production applications.
 * 
 * Design Rationale:
 * - Configuration visibility: Provides clear view of current configuration state
 * - Environment detection: Identifies current NODE_ENV and .env file presence
 * - Completeness metrics: Shows how many required variables are configured
 * - Debugging support: Helps identify missing or misconfigured environment variables
 * - Monitoring ready: Suitable for health checks and configuration monitoring
 * 
 * @returns {Object} Comprehensive configuration summary object
 * @returns {string} returns.environment - Current NODE_ENV value (defaults to 'development')
 * @returns {boolean} returns.hasEnvFile - Whether .env file exists in current directory
 * @returns {string[]} returns.configuredVars - Array of configured environment variable names
 * @returns {number} returns.totalVars - Total number of configurable variables
 * 
 * Example:
 * const summary = getConfigSummary();
 * console.log(`Environment: ${summary.environment}`);
 * console.log(`Configured: ${summary.configuredVars.length}/${summary.totalVars}`);
 */
const getConfigSummary=()=>({environment:localVars.NODE_ENV||'development',hasEnvFile:require('fs').existsSync('.env'),configuredVars:Object.keys(defaults).filter(key=>process.env[key]!==undefined),totalVars:Object.keys(defaults).length});

module.exports={defaults,getEnv,safeRun,getInt,validateRequiredVars,getConfigSummary,loadDotenv};