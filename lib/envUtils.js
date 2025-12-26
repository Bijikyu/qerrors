'use strict';

/**
 * Environment Utilities Module
 * 
 * Purpose: Provides comprehensive environment variable validation, management,
 * and health checking utilities for Node.js applications. This module ensures
 * that required configuration is available before application startup and
 * provides clear feedback about missing or misconfigured environment variables.
 * 
 * Design Rationale:
 * - Early failure detection: Prevents runtime errors due to missing configuration
 * - Clear error messaging: Provides descriptive feedback about missing variables
 * - Flexible validation: Supports both strict (throw) and lenient (warn) validation modes
 * - Health monitoring: Enables configuration monitoring and reporting
 * - Environment file detection: Automatically detects .env file presence
 * 
 * Key Features:
 * - Required variable validation with automatic error throwing
 * - Optional variable validation with warning generation
 * - Environment health reporting with detailed metrics
 * - .env file detection and validation
 * - Comprehensive error messages for debugging
 * - Support for custom validation messages
 */

// Async dotenv loading - will be called during initialization
let dotenvLoaded = false;
const loadDotenv = async () => {
  if (!dotenvLoaded) {
    try {
      require('dotenv').config();
      dotenvLoaded = true;
    } catch (error) {
      console.warn('Failed to load .env file:', error.message);
      dotenvLoaded = true; // Mark as attempted even if failed
    }
  }
};

// Import local configuration variables and constants
const localVars = require('../config/localVars');
const { NODE_ENV } = localVars;

// Default error message for missing environment variables
const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';

/**
 * Check which environment variables are missing from the current environment
 * 
 * This function filters an array of environment variable names to identify
 * which ones are not currently set in process.env. It's used by other
 * validation functions to determine configuration completeness.
 * 
 * @param {string[]} varArr - Array of environment variable names to check
 * @returns {string[]} Array of missing environment variable names
 * 
 * Example:
 * const missing = getMissingEnvVars(['API_KEY', 'DB_URL']);
 * console.log(missing); // ['API_KEY'] if API_KEY is not set
 */
const getMissingEnvVars = varArr => varArr.filter(name => !process.env[name]);

/**
 * Validate required environment variables and throw error if any are missing
 * 
 * This function performs strict validation of required environment variables.
 * If any variables from the provided array are missing, it will throw a detailed
 * error message and also log the error to console for visibility.
 * 
 * Use this function when your application cannot function without specific
 * environment variables being set. This is ideal for API keys, database URLs,
 * and other critical configuration that must be present for the application
 * to operate correctly.
 * 
 * @param {string[]} varArr - Array of required environment variable names
 * @returns {string[]} Array of missing environment variable names (empty if all present)
 * @throws {Error} If any required environment variables are missing
 * 
 * Example:
 * try {
 *   throwIfMissingEnvVars(['OPENAI_API_KEY', 'DATABASE_URL']);
 *   console.log('All required variables are present');
 * } catch (error) {
 *   console.error('Configuration error:', error.message);
 *   process.exit(1);
 * }
 */
const throwIfMissingEnvVars = varArr => {
  const missingEnvVars = getMissingEnvVars(varArr);
  
  if (missingEnvVars.length) {
    const errorMessage = `Missing required environment variables: ${missingEnvVars.join(', ')}`;
    
    // Log error to console for immediate visibility
    console.error(errorMessage);
    
    // Create and throw error for programmatic handling
    const err = new Error(errorMessage);
    console.error(err);
    throw err;
  }
  
  return missingEnvVars;
};

/**
 * Validate optional environment variables and log warning if any are missing
 * 
 * This function performs lenient validation of optional environment variables.
 * Instead of throwing an error, it logs a warning message to inform developers
 * that some optional configuration is missing. This allows the application
 * to continue running while providing visibility into potentially missing
 * functionality.
 * 
 * Use this function for environment variables that enhance functionality
 * but are not required for basic operation. Examples include feature flags,
 * optional service URLs, or configuration that has sensible defaults.
 * 
 * @param {string[]} varArr - Array of optional environment variable names
 * @param {string} [customMessage=''] - Custom warning message to display instead of default
 * @returns {boolean} True if all optional variables are present, false otherwise
 * 
 * Example:
 * const isComplete = warnIfMissingEnvVars(['REDIS_URL', 'FEATURE_FLAG_X']);
 * if (!isComplete) {
 *   console.log('Some optional features may not be available');
 * }
 */
const warnIfMissingEnvVars = (varArr, customMessage = '') => {
  const missingEnvVars = getMissingEnvVars(varArr);
  
  if (missingEnvVars.length) {
    const defaultWarning = `Warning: Optional environment variables missing: ${missingEnvVars.join(', ')}. Some features may not work as expected.`;
    console.warn(customMessage || defaultWarning);
  }
  
  return missingEnvVars.length === 0;
};

/**
 * Alias for throwIfMissingEnvVars - validates required environment variables
 * 
 * This function provides a more descriptive name for the same functionality
 * as throwIfMissingEnvVars. It's useful when you want to be explicit about
 * validating required variables in your code.
 * 
 * @param {string[]} vars - Array of required environment variable names
 * @returns {string[]} Array of missing environment variable names
 * @throws {Error} If any required environment variables are missing
 */
const validateRequiredEnvVars = vars => throwIfMissingEnvVars(vars);

/**
 * Alias for warnIfMissingEnvVars - validates optional environment variables
 * 
 * This function provides a more descriptive name for the same functionality
 * as warnIfMissingEnvVars. It's useful when you want to be explicit about
 * validating optional variables in your code.
 * 
 * @param {string[]} vars - Array of optional environment variable names
 * @returns {boolean} True if all optional variables are present, false otherwise
 */
const warnMissingEnvVars = vars => warnIfMissingEnvVars(vars);

/**
 * Check if .env file exists in the current working directory
 * 
 * This function detects the presence of a .env file, which is commonly
 * used for local development environment configuration. The presence
 * of this file indicates that environment variables may be loaded from
 * a file rather than being set directly in the system environment.
 * 
 * @returns {boolean} True if .env file exists, false otherwise
 * 
 * Example:
 * if (hasEnvFile()) {
 *   console.log('Environment variables may be loaded from .env file');
 * } else {
 *   console.log('Using system environment variables only');
 * }
 */
const hasEnvFile = () => require('fs').existsSync('.env');

/**
 * Generate comprehensive environment health report
 * 
 * This function provides a detailed analysis of the current environment
 * configuration, including which required and optional variables are set,
 * which are missing, and overall configuration health status. It's useful
 * for debugging configuration issues and for monitoring environment state
 * in production applications.
 * 
 * The returned object includes metrics for both required and optional
 * variables, allowing you to track configuration completeness over time.
 * 
 * @param {string[]} [requiredVars=[]] - Array of required environment variable names
 * @param {string[]} [optionalVars=[]] - Array of optional environment variable names
 * @returns {Object} Comprehensive environment health report
 * @returns {string} returns.environment - Current NODE_ENV value
 * @returns {boolean} returns.hasEnvFile - Whether .env file exists
 * @returns {boolean} returns.isHealthy - Whether all required variables are present
 * @returns {Object} returns.required - Metrics for required variables
 * @returns {Object} returns.optional - Metrics for optional variables
 * @returns {Object} returns.summary - Overall configuration summary
 * 
 * Example:
 * const health = getEnvHealth(
 *   ['API_KEY', 'DATABASE_URL'],           // required variables
 *   ['REDIS_URL', 'DEBUG_MODE']            // optional variables
 * );
 * 
 * if (!health.isHealthy) {
 *   console.error('Environment is not healthy:', health.required.missing);
 * }
 * 
 * console.log(`Configuration completeness: ${health.summary.configuredVars}/${health.summary.totalVars}`);
 */
const getEnvHealth = (requiredVars = [], optionalVars = []) => {
  const missingRequired = getMissingEnvVars(requiredVars);
  const missingOptional = getMissingEnvVars(optionalVars);
  
  return {
    environment: NODE_ENV,
    hasEnvFile: hasEnvFile(),
    isHealthy: missingRequired.length === 0,
    
    // Required variables metrics
    required: {
      total: requiredVars.length,
      configured: requiredVars.length - missingRequired.length,
      missing: missingRequired
    },
    
    // Optional variables metrics
    optional: {
      total: optionalVars.length,
      configured: optionalVars.length - missingOptional.length,
      missing: missingOptional
    },
    
    // Overall summary
    summary: {
      totalVars: requiredVars.length + optionalVars.length,
      configuredVars: (requiredVars.length - missingRequired.length) + (optionalVars.length - missingOptional.length)
    }
  };
};

/**
 * Comprehensive environment validation with configurable error handling
 * 
 * This function provides a unified interface for environment validation,
 * combining the functionality of getEnvHealth with configurable error
 * handling. It's useful for application startup validation where you
 * want either strict validation (throw on error) or lenient validation
 * (return health report) based on configuration.
 * 
 * The function is designed to be flexible, allowing you to validate
 * different sets of variables in different contexts while maintaining
 * consistent error reporting and health metrics.
 * 
 * @param {Object} [options={}] - Configuration options for validation
 * @param {string[]} [options.required=[]] - Required environment variables
 * @param {string[]} [options.optional=[]] - Optional environment variables
 * @param {boolean} [options.throwOnError=true] - Whether to throw error on missing required vars
 * @returns {Object} Environment health report (same format as getEnvHealth)
 * @throws {Error} If throwOnError is true and required variables are missing
 * 
 * Example:
 * // Strict validation - throws error on missing required variables
 * try {
 *   const health = validateEnvironment({
 *     required: ['API_KEY', 'DATABASE_URL'],
 *     optional: ['REDIS_URL'],
 *     throwOnError: true
 *   });
 *   console.log('Environment is healthy:', health.isHealthy);
 * } catch (error) {
 *   console.error('Environment validation failed:', error.message);
 * }
 * 
 * // Lenient validation - returns health report without throwing
 * const health = validateEnvironment({
 *   required: ['API_KEY', 'DATABASE_URL'],
 *   optional: ['REDIS_URL'],
 *   throwOnError: false
 * });
 * 
 * if (!health.isHealthy) {
 *   console.warn('Environment has issues:', health.required.missing);
 * }
 */
const validateEnvironment = (options = {}) => {
  const { required = [], optional = [], throwOnError = true } = options;
  
  const health = getEnvHealth(required, optional);
  
  // Throw error if required variables are missing and strict validation is enabled
  if (throwOnError && !health.isHealthy) {
    throwIfMissingEnvVars(required);
  }
  
  return health;
};

// Export all utility functions for use in other modules
module.exports = {
  // Core validation functions
  getMissingEnvVars,
  throwIfMissingEnvVars,
  warnIfMissingEnvVars,
  
  // Convenience aliases
  validateRequiredEnvVars,
  warnMissingEnvVars,
  
  // Environment health and monitoring
  hasEnvFile,
  getEnvHealth,
  validateEnvironment,
  
  // Constants
  NODE_ENV,
  DEFAULT_ERROR_MESSAGE,
  
  // Async initialization
  loadDotenv
};