/**
 * Environment Variables Utilities using dotenv
 * 
 * Purpose: Export commonly used environment variables for consistent access across the codebase
 * using dotenv for .env file loading and enhanced validation utilities.
 * 
 * Design rationale:
 * - Uses dotenv for industry-standard .env file loading
 * - Provides enhanced validation and error reporting
 * - Maintains backward compatibility with original API
 * - Adds configuration summary and health check capabilities
 */

// Load environment variables from .env file
require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Error Handling Constants
 * 
 * Purpose: Standardized messages for error handling across the application
 */
const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';

/**
 * Core utility for identifying missing environment variables
 * 
 * This function serves as the foundation for all environment validation in qerrors.
 * It uses a functional programming approach with Array.filter for clean, readable code
 * that efficiently processes multiple variables in a single pass.
 * 
 * Design rationale:
 * - Pure function design enables easy reuse
 * - Filter operation is more readable than manual loop constructs  
 * - Returns array format allows flexible handling by calling code
 * - Truthiness check handles both undefined and empty string cases
 * 
 * @param {string[]} varArr - Array of environment variable names to check
 * @returns {string[]} Array of missing variable names (empty if all present)
 */
const getMissingEnvVars = varArr => varArr.filter(name => !process.env[name]);

/**
 * Throws an error if any required environment variables are missing
 * 
 * This function implements the "fail fast" principle for critical configuration.
 * It's designed for variables that are absolutely required for application function.
 * The thrown error includes all missing variables to help developers fix all issues at once.
 * 
 * @param {string[]} varArr - Array of required environment variable names
 * @throws {Error} If any variables are missing, with descriptive message
 * @returns {string[]} Empty array if no variables are missing
 */
const throwIfMissingEnvVars = varArr => {
  const missingEnvVars = getMissingEnvVars(varArr);
  if (missingEnvVars.length) {
    const errorMessage = `Missing required environment variables: ${missingEnvVars.join(', ')}`;
    console.error(errorMessage);
    const err = new Error(errorMessage);
    console.error(err);
    throw err;
  }
  return missingEnvVars;
};

/**
 * Logs warnings for missing optional environment variables
 * 
 * This function handles variables that enhance functionality but aren't strictly required.
 * It uses console.warn rather than throwing errors to allow graceful degradation.
 * The function is designed to provide helpful feedback without breaking the application.
 * 
 * @param {string[]} varArr - Array of optional environment variable names to check
 * @param {string} customMessage - Custom warning message to display (optional)
 * @returns {boolean} True if all variables are present, otherwise false
 */
const warnIfMissingEnvVars = (varArr, customMessage = '') => {
  const missingEnvVars = getMissingEnvVars(varArr);
  missingEnvVars.length && console.warn(customMessage || `Warning: Optional environment variables missing: ${missingEnvVars.join(', ')}. Some features may not work as expected.`);
  return missingEnvVars.length === 0;
};

/**
 * Alias for throwIfMissingEnvVars - validates required environment variables
 * 
 * Purpose: Provides a more intuitive function name matching common naming conventions
 * Maintains compatibility with @qtools/env-config patterns.
 * 
 * @param {string[]} vars - Array of required environment variable names
 * @returns {string[]} Empty array if all present, throws Error otherwise
 */
const validateRequiredEnvVars = (vars) => throwIfMissingEnvVars(vars);

/**
 * Alias for warnIfMissingEnvVars - warns about missing optional environment variables
 * 
 * Purpose: Provides a shorter function name matching common naming conventions
 * Maintains compatibility with @qtools/env-config patterns.
 * 
 * @param {string[]} vars - Array of optional environment variable names
 * @returns {boolean} True if all present, false otherwise
 */
const warnMissingEnvVars = (vars) => warnIfMissingEnvVars(vars);

/**
 * Check if .env file exists and is loaded
 * 
 * Purpose: Provides visibility into dotenv configuration status
 * 
 * @returns {boolean} True if .env file exists
 */
const hasEnvFile = () => require('fs').existsSync('.env');

/**
 * Get environment configuration health status
 * 
 * Purpose: Provides comprehensive environment configuration status
 * 
 * @param {string[]} requiredVars - Array of required variable names
 * @param {string[]} optionalVars - Array of optional variable names
 * @returns {Object} Health status information
 */
const getEnvHealth = (requiredVars = [], optionalVars = []) => {
  const missingRequired = getMissingEnvVars(requiredVars), missingOptional = getMissingEnvVars(optionalVars);
  return {
    environment: NODE_ENV,
    hasEnvFile: hasEnvFile(),
    isHealthy: missingRequired.length === 0,
    required: { total: requiredVars.length, configured: requiredVars.length - missingRequired.length, missing: missingRequired },
    optional: { total: optionalVars.length, configured: optionalVars.length - missingOptional.length, missing: missingOptional },
    summary: { totalVars: requiredVars.length + optionalVars.length, configuredVars: (requiredVars.length - missingRequired.length) + (optionalVars.length - missingOptional.length) }
  };
};

/**
 * Validate environment configuration and report status
 * 
 * Purpose: Comprehensive environment validation with detailed reporting
 * 
 * @param {Object} options - Validation options
 * @param {string[]} options.required - Required environment variables
 * @param {string[]} options.optional - Optional environment variables
 * @param {boolean} options.throwOnError - Whether to throw on missing required vars
 * @returns {Object} Validation result
 */
const validateEnvironment = (options = {}) => {
  const { required = [], optional = [], throwOnError = true } = options;
  const health = getEnvHealth(required, optional);
  throwOnError && !health.isHealthy && throwIfMissingEnvVars(required);
  return health;
};

module.exports = { NODE_ENV, DEFAULT_ERROR_MESSAGE, getMissingEnvVars, throwIfMissingEnvVars, warnIfMissingEnvVars, validateRequiredEnvVars, warnMissingEnvVars, hasEnvFile, getEnvHealth, validateEnvironment };