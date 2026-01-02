/**
 * Unified Import Helper Module
 * 
 * Purpose: Centralizes commonly used import patterns to reduce duplication
 * across the qerrors codebase and provide a consistent import interface.
 * 
 * This module acts as a registry for shared utilities, making it easier
 * to manage dependencies and reduce repetitive import statements.
 * 
 * Design Philosophy:
 * - Centralization: Common imports available from single source
 * - Lazy loading: Modules loaded only when needed to reduce startup time
 * - Consistency: Standardized import patterns across all files
 * - Maintainability: Single point of contact for import management
 */

const importCache = new Map();

/**
 * Lazy loading import helper with caching
 * @param {string} modulePath - Path to the module to import
 * @returns {*} Exported module contents
 */
function lazyImport(modulePath) {
  if (!importCache.has(modulePath)) {
    try {
      const module = require(modulePath);
      importCache.set(modulePath, module);
      return module;
    } catch (error) {
      throw new Error(`Failed to import module ${modulePath}: ${error.message}`);
    }
  }
  return importCache.get(modulePath);
}

/**
 * Shared module exports registry
 * Provides centralized access to commonly used shared modules
 */
const sharedModules = {
  /**
   * Logging utilities and functions
   */
  logging: () => lazyImport('./logging'),
  
  /**
   * Security and sanitization functions
   */
  security: () => lazyImport('./security'),
  
  /**
   * Application constants and enums
   */
  constants: () => lazyImport('./constants'),
  
  /**
   * Execution and performance utilities
   */
  execution: () => lazyImport('./execution'),
  
  /**
   * Data structure implementations
   */
  dataStructures: () => lazyImport('./dataStructures'),
  
  /**
   * Response formatting helpers
   */
  response: () => lazyImport('./response'),
  
  /**
   * Validation utilities
   */
  validation: () => lazyImport('./validation'),
  
  /**
   * Error handling contracts
   */
  contracts: () => lazyImport('./contracts'),
  
  /**
   * Async operation contracts
   */
  asyncContracts: () => lazyImport('./asyncContracts')
};

/**
 * Quick import helpers for the most common patterns
 */
const commonImports = {
  /**
   * Common logging imports
   */
  logging: () => {
    const logging = sharedModules.logging();
    return {
      stringifyContext: logging.stringifyContext,
      verboseLog: logging.verboseLog,
      createEnhancedLogEntry: logging.createEnhancedLogEntry,
      safeLogError: logging.safeLogError,
      safeLogInfo: logging.safeLogInfo,
      safeLogWarn: logging.safeLogWarn,
      safeLogDebug: logging.safeLogDebug
    };
  },
  
  /**
   * Common security imports
   */
  security: () => {
    const security = sharedModules.security();
    return {
      sanitizeErrorMessage: security.sanitizeErrorMessage,
      sanitizeContextForLog: security.sanitizeContextForLog,
      sanitizeErrorInput: security.sanitizeErrorInput
    };
  },
  
  /**
   * Common constants imports
   */
  constants: () => {
    const constants = sharedModules.constants();
    return {
      LOG_LEVELS: constants.LOG_LEVELS,
      ERROR_SEVERITY: constants.ERROR_SEVERITY,
      OPERATION_TYPES: constants.OPERATION_TYPES
    };
  },
  
  /**
   * Common execution imports
   */
  execution: () => {
    const execution = sharedModules.execution();
    return {
      createTimer: execution.createTimer,
      createUnifiedTimer: execution.createUnifiedTimer,
      safeRun: execution.safeRun,
      attempt: execution.attempt,
      executeWithQerrors: execution.executeWithQerrors
    };
  }
};

/**
 * Import combination helpers for frequently used module groups
 */
const importGroups = {
  /**
   * Core error handling imports
   */
  errorHandling: () => ({
    ...commonImports.logging(),
    ...commonImports.security(),
    ...commonImports.constants()
  }),
  
  /**
   * Async operation imports
   */
  asyncOperations: () => ({
    ...commonImports.execution(),
    ...commonImports.logging(),
    ...sharedModules.asyncContracts()
  }),
  
  /**
   * Validation and security imports
   */
  validation: () => ({
    ...commonImports.security(),
    ...sharedModules.validation(),
    ...commonImports.logging()
  }),
  
  /**
   * Full shared suite (use sparingly - prefer specific groups)
   */
  fullSuite: () => ({
    ...commonImports.logging(),
    ...commonImports.security(),
    ...commonImports.constants(),
    ...commonImports.execution(),
    ...sharedModules.dataStructures(),
    ...sharedModules.response(),
    ...sharedModules.validation(),
    ...sharedModules.contracts(),
    ...sharedModules.asyncContracts()
  })
};

/**
 * Clear import cache (useful for testing or hot reload scenarios)
 */
function clearCache() {
  importCache.clear();
}

/**
 * Get cache statistics for monitoring
 */
function getCacheStats() {
  return {
    size: importCache.size,
    cachedModules: Array.from(importCache.keys())
  };
}

module.exports = {
  // Individual module accessors
  sharedModules,
  commonImports,
  importGroups,
  
  // Utility functions
  lazyImport,
  clearCache,
  getCacheStats
};