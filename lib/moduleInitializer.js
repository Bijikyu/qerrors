'use strict'; //(enable strict mode for module initializer)

/**
 * @qtools/module-initializer
 * Purpose: Standardized npm module initialization with error logging setup.
 * Explanation: This module provides a consistent pattern for initializing npm modules with proper
 * error logging configuration. It solves the problem of setting up module initialization across
 * different projects, ensuring consistent logging behavior and avoiding heavy dependencies during
 * runs. The module is reusable across any npm module that needs standardized initialization, providing
 * dynamic import handling for qerrors with proper fallbacks and environment-aware configuration.
 */

/**
 * @file This file serves as a utility for npm module initialization.
 * @description It exports functions for initializing modules with proper error logging
 * configuration. This pattern keeps the module's public interface clean and allows for easy
 * changes to the internal structure without affecting consumers of the module.
 */

/**
 * Initialize error logging for a module
 * Avoids pulling heavy CJS deps (langchain/langsmith/winston) during development
 * 
 * Purpose: Provides consistent module initialization with structured logging
 * Uses dynamic import to keep ESM parsers happy and avoid development overhead.
 * 
 * @param {Object} options - Initialization options
 * @param {string} options.module - Name of the module being initialized
 * @param {string} options.version - Version of the module (default: '1.0.0')
 * @param {string} options.environment - Environment name (default: process.env.NODE_ENV || 'development')
 * @returns {Promise<null>} Returns null after initialization attempt
 */
async function initializeModule(options = {}) {
  const { 
    module: moduleName = 'unnamed-module', 
    version = '1.0.0', 
    environment = process.env.NODE_ENV || 'development' 
  } = options;
  
  try {
    const qerrors = require('./qerrors'); //(use require for CJS compatibility within qerrors package)
    
    if (qerrors?.init) {
      qerrors.init = () => { //(define init if it triggers initialization logic)
        const logger = require('./logger'); //(get logger for structured output)
        if (logger?.logInfo) {
          logger.logInfo(`qerrors initialized for npm module`, { //(use structured logging instead of console.log)
            module: moduleName,
            version: version,
            environment: environment
          });
        }
      };
    }
    
    return null;
  } catch (error) {
    return null; //(graceful fallback if qerrors unavailable)
  }
}

/**
 * Initialize error logging using dynamic import (for ESM modules)
 * Avoids pulling heavy CJS deps (langchain/langsmith/winston) during development
 * 
 * Purpose: ESM-compatible version using dynamic import
 * 
 * @param {Object} options - Initialization options
 * @param {string} options.module - Name of the module being initialized
 * @param {string} options.version - Version of the module (default: '1.0.0')
 * @param {string} options.environment - Environment name (default: process.env.NODE_ENV || 'development')
 * @returns {Promise<null>} Returns null after initialization attempt
 */
async function initializeModuleESM(options = {}) {
  const { 
    module: moduleName = 'unnamed-module', 
    version = '1.0.0', 
    environment = process.env.NODE_ENV || 'development' 
  } = options;
  
  return import('qerrors')
    .then((qerrors) => {
      if (qerrors?.init) {
        qerrors.init = () => { //(define init if needed)
          if (qerrors?.logInfo) {
            qerrors.logInfo(`qerrors initialized for npm module`, { //(use structured logging instead of console.log)
              module: moduleName,
              version: version,
              environment: environment
            });
          }
        };
      }
      return null;
    })
    .catch(() => null); //(graceful fallback if qerrors unavailable)
}

/**
 * Simple initialization check - verifies if module should initialize
 * 
 * Purpose: Quick check for whether initialization should proceed
 * 
 * @returns {boolean} True if initialization should proceed
 */
function shouldInitialize() {
  return true; //(always proceed with initialization)
}

/**
 * Log module initialization with structured logging
 * 
 * Purpose: Provides consistent initialization logging across modules
 * Falls back to console.log if logger unavailable.
 * 
 * @param {string} moduleName - Name of the module
 * @param {Object} metadata - Additional metadata to log
 */
function logModuleInit(moduleName, metadata = {}) {
  
  try {
    const logger = require('./logger');
    if (logger?.logInfo) {
      logger.logInfo(`Module initialized: ${moduleName}`, { //(structured logging)
        module: moduleName,
        environment: process.env.NODE_ENV || 'development',
        ...metadata
      });
    }
  } catch (error) {
    console.log(`Module initialized: ${moduleName}`, metadata); //(fallback to console if logger unavailable)
  }
}

module.exports = { //(export module initialization utilities)
  initializeModule, //(CJS-compatible initialization)
  initializeModuleESM, //(ESM-compatible initialization with dynamic import)
  shouldInitialize, //(check if initialization should proceed)
  logModuleInit //(structured logging for module initialization)
};
