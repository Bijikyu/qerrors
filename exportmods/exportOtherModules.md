## @qerrors/async-init
**Purpose:** Async module initialization utilities with dependency management and error handling.

**Explanation:**  
This module provides utilities for asynchronous module initialization with dependency management, initialization state tracking, error handling for failed initializations, and support for both ESM and CommonJS modules. It ensures proper initialization order for modules with async dependencies, provides clear error reporting for initialization failures, and supports graceful degradation when optional modules fail to initialize. The async initialization utilities are broadly applicable to any Node.js application that needs to manage complex module initialization with dependencies, particularly in microservices or applications with plugin architectures.

```js
/**
 * Async Module Initialization Utilities
 *
 * Purpose: Provides utilities for asynchronous module initialization with
 * dependency management, error handling, and state tracking. This ensures
 * proper initialization order for modules with async dependencies and
 * provides clear error reporting for initialization failures.
 *
 * Design Rationale:
 * - Dependency management: Handle initialization order for dependent modules
 * - Error safety: Graceful handling of initialization failures
 * - State tracking: Prevent duplicate initialization attempts
 * - Flexibility: Support both ESM and CommonJS module patterns
 * - Observability: Clear logging and error reporting for debugging
 */

const { safeLogInfo, safeLogWarn, safeLogError } = require('./shared/safeLogging');

/**
 * Module initialization state tracker
 */
class InitializationTracker {
  constructor() {
    this.initializedModules = new Set();
    this.initializingModules = new Set();
    this.failedModules = new Map();
    this.dependencies = new Map();
  }

  /**
   * Check if a module is currently initializing
   * @param {string} moduleName - Module name
   * @returns {boolean} True if module is initializing
   */
  isInitializing(moduleName) {
    return this.initializingModules.has(moduleName);
  }

  /**
   * Check if a module is initialized
   * @param {string} moduleName - Module name
   * @returns {boolean} True if module is initialized
   */
  isInitialized(moduleName) {
    return this.initializedModules.has(moduleName);
  }

  /**
   * Check if a module failed to initialize
   * @param {string} moduleName - Module name
   * @returns {boolean} True if module failed to initialize
   */
  hasFailed(moduleName) {
    return this.failedModules.has(moduleName);
  }

  /**
   * Mark a module as initializing
   * @param {string} moduleName - Module name
   */
  markInitializing(moduleName) {
    this.initializingModules.add(moduleName);
  }

  /**
   * Mark a module as successfully initialized
   * @param {string} moduleName - Module name
   */
  markInitialized(moduleName) {
    this.initializingModules.delete(moduleName);
    this.initializedModules.add(moduleName);
    this.failedModules.delete(moduleName);
  }

  /**
   * Mark a module as failed to initialize
   * @param {string} moduleName - Module name
   * @param {Error} error - Initialization error
   */
  markFailed(moduleName, error) {
    this.initializingModules.delete(moduleName);
    this.failedModules.set(moduleName, error);
  }

  /**
   * Register module dependencies
   * @param {string} moduleName - Module name
   * @param {string[]} dependencies - Array of dependency module names
   */
  registerDependencies(moduleName, dependencies) {
    this.dependencies.set(moduleName, dependencies);
  }

  /**
   * Check if all dependencies are initialized
   * @param {string} moduleName - Module name
   * @returns {boolean} True if all dependencies are initialized
   */
  areDependenciesInitialized(moduleName) {
    const deps = this.dependencies.get(moduleName);
    if (!deps) return true;
    
    return deps.every(dep => this.isInitialized(dep));
  }

  /**
   * Get initialization status for all modules
   * @returns {Object} Status report
   */
  getStatus() {
    return {
      initialized: Array.from(this.initializedModules),
      initializing: Array.from(this.initializingModules),
      failed: Object.fromEntries(this.failedModules),
      dependencies: Object.fromEntries(this.dependencies)
    };
  }
}

// Global tracker instance
const tracker = new InitializationTracker();

/**
 * Initialize a module asynchronously with dependency checking
 * 
 * @param {string} moduleName - Module name for tracking
 * @param {Function} initFunction - Async initialization function
 * @param {Object} options - Initialization options
 * @param {string[]} options.dependencies - Array of dependency module names
 * @param {boolean} options.optional - Whether this module is optional
 * @param {number} options.timeout - Initialization timeout in milliseconds
 * @returns {Promise<*>} Initialization result
 */
const initializeModule = async (moduleName, initFunction, options = {}) => {
  const {
    dependencies = [],
    optional = false,
    timeout = 30000
  } = options;

  try {
    // Check if already initialized
    if (tracker.isInitialized(moduleName)) {
      safeLogInfo(`Module ${moduleName} already initialized`);
      return;
    }

    // Check if currently initializing
    if (tracker.isInitializing(moduleName)) {
      safeLogWarn(`Module ${moduleName} is already being initialized, waiting...`);
      
      // Wait for initialization to complete
      while (tracker.isInitializing(moduleName)) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (tracker.isInitialized(moduleName)) {
        return;
      }
      
      if (tracker.hasFailed(moduleName)) {
        throw tracker.failedModules.get(moduleName);
      }
    }

    // Register dependencies
    tracker.registerDependencies(moduleName, dependencies);

    // Check dependencies
    if (!tracker.areDependenciesInitialized(moduleName)) {
      const missingDeps = dependencies.filter(dep => !tracker.isInitialized(dep));
      throw new Error(`Module ${moduleName} has uninitialized dependencies: ${missingDeps.join(', ')}`);
    }

    // Mark as initializing
    tracker.markInitializing(moduleName);
    safeLogInfo(`Initializing module: ${moduleName}`);

    // Initialize with timeout
    const result = await Promise.race([
      initFunction(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Module ${moduleName} initialization timed out after ${timeout}ms`)), timeout)
      )
    ]);

    // Mark as successfully initialized
    tracker.markInitialized(moduleName);
    safeLogInfo(`Successfully initialized module: ${moduleName}`);

    return result;
  } catch (error) {
    tracker.markFailed(moduleName, error);
    
    if (optional) {
      safeLogWarn(`Optional module ${moduleName} failed to initialize:`, error.message);
      return null;
    } else {
      safeLogError(`Required module ${moduleName} failed to initialize:`, error.message);
      throw error;
    }
  }
};

/**
 * Initialize a module using ESM import pattern
 * 
 * @param {string} moduleName - Module name for tracking
 * @param {string} modulePath - Module path to import
 * @param {Object} options - Initialization options
 * @returns {Promise<*>} Imported module
 */
const initializeModuleESM = async (moduleName, modulePath, options = {}) => {
  return initializeModule(moduleName, async () => {
    return await import(modulePath);
  }, options);
};

/**
 * Check if a module should be initialized based on conditions
 * 
 * @param {Object} options - Conditions to check
 * @param {boolean} options.force - Force initialization regardless of conditions
 * @param {Function} options.condition - Custom condition function
 * @param {string} options.envVar - Environment variable to check
 * @param {string} options.envValue - Expected environment variable value
 * @returns {boolean} True if module should be initialized
 */
const shouldInitialize = (options = {}) => {
  const {
    force = false,
    condition = null,
    envVar = null,
    envValue = 'true'
  } = options;

  if (force) {
    return true;
  }

  if (condition && typeof condition === 'function') {
    return condition();
  }

  if (envVar) {
    return process.env[envVar] === envValue;
  }

  return true;
};

/**
 * Log module initialization with context
 * 
 * @param {string} moduleName - Module name
 * @param {string} status - Initialization status
 * @param {Object} context - Additional context
 */
const logModuleInit = (moduleName, status, context = {}) => {
  const message = `Module ${moduleName}: ${status}`;
  
  switch (status.toLowerCase()) {
  case 'success':
  case 'initialized':
    safeLogInfo(message, context);
    break;
  case 'warning':
  case 'optional':
    safeLogWarn(message, context);
    break;
  case 'error':
  case 'failed':
    safeLogError(message, context);
    break;
  default:
    safeLogInfo(message, context);
  }
};

/**
 * Get initialization tracker instance (for testing/advanced usage)
 * 
 * @returns {InitializationTracker} Tracker instance
 */
const getInitializationTracker = () => tracker;

module.exports = {
  initializeModule,
  initializeModuleESM,
  shouldInitialize,
  logModuleInit,
  getInitializationTracker,
  InitializationTracker
};
```