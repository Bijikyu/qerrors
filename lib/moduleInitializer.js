'use strict';

/**
 * Module Initializer - Dynamic Module Loading and Initialization
 * 
 * This module provides utilities for safely initializing modules in both CommonJS and ES
 * environments. It handles the complex initialization scenarios that occur when modules
 * need to be loaded dynamically or when initialization patterns differ between module systems.
 * 
 * Key Use Cases:
 * - npm package initialization when qerrors is used as a dependency
 * - Conditional module loading based on environment
 * - Safe initialization that doesn't break if dependencies are missing
 * - ES module compatibility layer for mixed module systems
 * 
 * Design Philosophy:
 * - Graceful degradation: Initialization failures should not crash the application
 * - Environment awareness: Different initialization for development vs production
 * - Module system agnostic: Works with both CommonJS and ES modules
 * - Silent operation: Initialization happens transparently without noise
 */

const localVars = require('../config/localVars');

/**
 * Initializes qerrors module in CommonJS environment
 * 
 * This function safely loads and initializes the qerrors module for npm packages
 * that use it as a dependency. It's designed to be non-blocking and error-safe,
 * meaning initialization failures won't crash the host application.
 * 
 * @param {Object} options - Initialization options
 * @param {string} options.module - Module name for identification (default: 'unnamed-module')
 * @param {string} options.version - Module version for tracking (default: '1.0.0')
 * @param {string} options.environment - Environment context (default: NODE_ENV or 'development')
 * @returns {Promise<null>} Always returns null to indicate completion
 */
const initializeModule = async (options = {}) => {
  const { 
    module: moduleName = 'unnamed-module', 
    version = '1.0.0', 
    environment = localVars.NODE_ENV || 'development' 
  } = options;
  
  try {
    // Dynamically require qerrors to avoid circular dependencies
    const qerrors = require('./qerrors');
    
    // Set up initialization function if it exists
    if (qerrors?.init) {
      qerrors.init = () => {
        // Defer logger import to avoid circular dependency issues
        const logger = require('./logger');
        
        // Log module initialization if logger is available
        if (logger?.logInfo) {
          logger.logInfo(`qerrors initialized for npm module`, { 
            module: moduleName, 
            version: version, 
            environment: environment 
          });
        }
      };
    }
    
    return null; // Indicate successful initialization
  } catch (error) {
    // Silently handle initialization failures
    // This ensures that qerrors initialization doesn't break the host application
    return null;
  }
};

/**
 * Initializes qerrors module in ES Module environment
 * 
 * This function handles ES module imports and initialization for modern JavaScript
 * environments. It provides the same safety guarantees as the CommonJS version
 * but works with dynamic imports and ES module semantics.
 * 
 * @param {Object} options - Initialization options (same as initializeModule)
 * @returns {Promise<null>} Always returns null to indicate completion
 */
const initializeModuleESM = async (options = {}) => {
  const { 
    module: moduleName = 'unnamed-module', 
    version = '1.0.0', 
    environment = localVars.NODE_ENV || 'development' 
  } = options;
  
  // Cache the module import to avoid repeated file I/O
  // Use cached require instead of dynamic import for better performance
  try {
    const qerrors = require('./qerrors');
    // Set up initialization function if it exists
    if (qerrors?.init) {
      qerrors.init = () => {
        // Log module initialization if logging function is available
        if (qerrors?.logInfo) {
          qerrors.logInfo(`qerrors initialized for npm module`, { 
            module: moduleName, 
            version: version, 
            environment: environment 
          });
        }
      };
    }
    
    return null; // Indicate successful initialization
  } catch (error) {
    // Silently handle import failures
    // This ensures that qerrors initialization doesn't break the host application
    return null;
  }
};

/**
 * Determines whether initialization should proceed
 * 
 * This function provides a centralized decision point for initialization logic.
 * Currently always returns true, but allows for future environment-based logic
 * or configuration-based initialization decisions.
 * 
 * @returns {boolean} Whether initialization should proceed
 */
const shouldInitialize = () => {
  // Currently always true, but allows for future logic:
  // - Environment-based decisions
  // - Configuration checks
  // - Dependency validation
  return true;
};

/**
 * Logs module initialization information
 * 
 * This function provides a standardized way to log that a module has been
 * initialized. It includes relevant metadata for tracking and debugging
 * module loading issues.
 * 
 * @param {string} moduleName - Name of the module being initialized
 * @param {Object} metadata - Additional metadata for logging
 */
const logModuleInit = (moduleName, metadata = {}) => {
  try {
    // Attempt to use the main logger for structured logging
    const logger = require('./logger');
    
    if (logger?.logInfo) {
      logger.logInfo(`Module initialized: ${moduleName}`, { 
        module: moduleName, 
        environment: localVars.NODE_ENV || 'development', 
        ...metadata 
      });
    }
  } catch (error) {
    // Fallback to console logging if logger is not available
    // This ensures initialization logging always works
    console.log(`Module initialized: ${moduleName}`, metadata);
  }
};

/**
 * Module exports - Initialization utilities
 * 
 * The export strategy provides different initialization patterns for different
 * use cases while maintaining consistent behavior and error handling.
 */
module.exports = {
  // Core initialization functions
  initializeModule,        // CommonJS initialization
  initializeModuleESM,     // ES Module initialization
  
  // Utility functions
  shouldInitialize,         // Initialization decision logic
  logModuleInit            // Standardized initialization logging
};