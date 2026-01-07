## General Utility
### @qerrors/performance-timer
**Purpose:** High-precision performance timing with optional memory tracking and integrated logging.
**Explanation:**  
This module provides comprehensive performance timing utilities using Node.js's high-resolution timer for nanosecond precision timing. It includes optional memory usage tracking, integrated logging with performance metrics, flexible output formats for different use cases, and request correlation support. This is valuable for any application that needs accurate performance monitoring, API endpoint timing, database query performance analysis, or memory leak detection.

Key problems solved:
- Provides high-precision timing for accurate performance measurements
- Integrates memory tracking for comprehensive performance analysis
- Offers flexible output formats (ms, s, m) for different contexts
- Includes automatic performance logging with context
- Supports request correlation for distributed tracing

```javascript
// Exact current implementation copied from the codebase
const createUnifiedTimer = (operation, includeMemoryTracking = false, requestId = null) => {
  const startTime = process.hrtime.bigint();
  const startMemory = includeMemoryTracking ? process.memoryUsage() : null;

  return {
    elapsed: () => Number(process.hrtime.bigint() - startTime) / 1000000,

    elapsedFormatted: () => {
      const ms = Number(process.hrtime.bigint() - startTime) / 1000000;
      return ms < 1000
        ? `${ms.toFixed(2)}ms`
        : ms < 60000
          ? `${(ms / 1000).toFixed(2)}s`
          : `${(ms / 60000).toFixed(2)}m`;
    },

    logPerformance: async (success = true, additionalContext = {}) => {
      const endTime = process.hrtime.bigint();
      const endMemory = includeMemoryTracking ? process.memoryUsage() : null;
      const duration = Number(endTime - startTime) / 1000000;

      const context = {
        operation,
        duration_ms: Math.round(duration * 100) / 100,
        success,
        ...additionalContext
      };

      if (includeMemoryTracking && startMemory && endMemory) {
        context.memory_delta = {
          heapUsed: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024),
          external: Math.round((endMemory.external - startMemory.external) / 1024)
        };
      }

      const message = `${operation} completed in ${context.duration_ms}ms (${success ? 'success' : 'failure'})`;

      try {
        const logger = require('../logger');
        if (success) {
          await logger.logInfo(message, context, requestId);
        } else {
          await logger.logWarn(message, context, requestId);
        }
      } catch (err) {
        console[success ? 'log' : 'warn'](message, context);
      }

      return context;
    }
  };
};

const createTimer = () => createUnifiedTimer('operation', false);

const createPerformanceTimer = (operation, requestId = null) => createUnifiedTimer(operation, true, requestId);

module.exports = {
  createUnifiedTimer,
  createTimer,
  createPerformanceTimer
};
```

### @qerrors/lazy-imports
**Purpose:** Centralized import management with lazy loading and caching for optimized performance.
**Explanation:**  
This module provides a unified import system that centralizes commonly used import patterns to reduce duplication across codebases. It implements lazy loading with caching to reduce startup time, provides standardized import patterns across all files, and includes import combination helpers for frequently used module groups. This is valuable for any large application that needs to manage dependencies efficiently, reduce import statement duplication, and optimize module loading performance.

Key problems solved:
- Reduces import statement duplication across large codebases
- Implements lazy loading to improve application startup performance
- Provides centralized dependency management for easier maintenance
- Offers pre-configured import groups for common patterns
- Includes caching to avoid redundant module loads

```javascript
// Exact current implementation copied from the codebase
const importCache = new Map();

function lazyImport (modulePath) {
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

const sharedModules = {
  logging: () => lazyImport('./logging'),
  security: () => lazyImport('./security'),
  constants: () => lazyImport('./constants'),
  execution: () => lazyImport('./execution'),
  dataStructures: () => lazyImport('./dataStructures'),
  response: () => lazyImport('./response'),
  validation: () => lazyImport('./validation'),
  contracts: () => lazyImport('./contracts'),
  asyncContracts: () => lazyImport('./asyncContracts')
};

const commonImports = {
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

  security: () => {
    const security = sharedModules.security();
    return {
      sanitizeErrorMessage: security.sanitizeErrorMessage,
      sanitizeContextForLog: security.sanitizeContextForLog,
      sanitizeErrorInput: security.sanitizeErrorInput
    };
  },

  constants: () => {
    const constants = sharedModules.constants();
    return {
      LOG_LEVELS: constants.LOG_LEVELS,
      ERROR_SEVERITY: constants.ERROR_SEVERITY,
      OPERATION_TYPES: constants.OPERATION_TYPES
    };
  },

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

const importGroups = {
  errorHandling: () => ({
    ...commonImports.logging(),
    ...commonImports.security(),
    ...commonImports.constants()
  }),

  asyncOperations: () => ({
    ...commonImports.execution(),
    ...commonImports.logging(),
    ...sharedModules.asyncContracts()
  }),

  validation: () => ({
    ...commonImports.security(),
    ...sharedModules.validation(),
    ...commonImports.logging()
  }),

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

function clearCache () {
  importCache.clear();
}

function getCacheStats () {
  return {
    size: importCache.size,
    cachedModules: Array.from(importCache.keys())
  };
}

module.exports = {
  sharedModules,
  commonImports,
  importGroups,
  lazyImport,
  clearCache,
  getCacheStats
};
```

### @qerrors/env-config
**Purpose:** Environment variable management with type validation and defaults handling.
**Explanation:**  
This module provides comprehensive environment variable management with type validation, default value handling, and configuration validation. It includes utilities for getting string, integer, and boolean values from environment variables with proper fallbacks, validation for required environment variables, and configuration summary generation. This is valuable for any application that needs robust environment configuration management with type safety and validation.

Key problems solved:
- Provides type-safe environment variable access with validation
- Handles default values and fallbacks gracefully
- Includes comprehensive boolean parsing with various string formats
- Offers validation for required environment variables
- Provides configuration summaries for debugging and monitoring

```javascript
// Exact current implementation copied from the codebase
const { loadDotenv, checkEnvFileExists } = require('./shared/environmentLoader');
const localVars = require('../config/localVars');
const { CONFIG_DEFAULTS } = localVars;
const defaults = CONFIG_DEFAULTS;

const getEnv = (name, defaultVal) => 
  process.env[name] !== undefined ? process.env[name] : 
  defaultVal !== undefined ? defaultVal : defaults[name];

const safeRun = (name, fn, fallback, info) => {
  try {
    return fn();
  } catch (err) {
    console.error(`${name} failed`, info);
    return fallback;
  }
};

const getInt = (name, defaultValOrMin, min) => {
  const envValue = process.env[name];
  const int = parseInt(envValue || '', 10);
  const moduleDefault = typeof defaults[name] === 'number' ? defaults[name] : parseInt(defaults[name] || '0', 10);
  
  let fallbackVal, minVal;
  if (arguments.length <= 1) {
    fallbackVal = moduleDefault;
    minVal = 1;
  } else if (arguments.length === 2) {
    fallbackVal = moduleDefault;
    minVal = typeof defaultValOrMin === 'number' ? defaultValOrMin : 1;
  } else {
    fallbackVal = typeof defaultValOrMin === 'number' ? defaultValOrMin : moduleDefault;
    minVal = typeof min === 'number' ? min : 1;
  }
  
  const val = Number.isNaN(int) ? fallbackVal : int;
  return val >= minVal ? val : minVal;
};

const getBool = (name, defaultVal) => {
  const parseBool = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value !== 'string') return null;

    const normalized = value.trim().toLowerCase();
    if (normalized === '') return null;
    if (['1', 'true', 'yes', 'y', 'on', 'enable', 'enabled'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off', 'disable', 'disabled'].includes(normalized)) return false;
    return null;
  };

  const envValue = process.env[name];
  const envParsed = envValue !== undefined ? parseBool(String(envValue)) : null;
  if (envParsed !== null) return envParsed;

  const moduleDefault = defaults[name];
  const fallback = defaultVal !== undefined ? defaultVal : moduleDefault;
  const fallbackParsed = parseBool(fallback);

  return fallbackParsed !== null ? fallbackParsed : false;
};

const validateRequiredVars = varNames => {
  const missing = [];
  const present = [];
  for (const name of varNames) {
    process.env.hasOwnProperty(name) ? present.push(name) : missing.push(name);
  }
  return { isValid: missing.length === 0, missing, present };
};

const getConfigSummary = async () => {
  const hasEnvFile = await checkEnvFileExists();
  
  return {
    environment: localVars.NODE_ENV || 'development',
    hasEnvFile,
    configuredVars: Object.keys(defaults).filter(key => process.env[key] !== undefined),
    totalVars: Object.keys(defaults).length
  };
};

const getConfigSummarySync = () => {
  console.warn('getConfigSummarySync is deprecated - use async getConfigSummary() instead');
  const fs = require('fs');
  let hasEnvFile = null;
  try {
    hasEnvFile = fs.existsSync('.env');
  } catch (error) {
    hasEnvFile = false;
  }
  
  return {
    environment: localVars.NODE_ENV || 'development',
    hasEnvFile,
    configuredVars: Object.keys(defaults).filter(key => process.env[key] !== undefined),
    totalVars: Object.keys(defaults).length
  };
};

module.exports = {
  defaults,
  getEnv,
  safeRun,
  getInt,
  getBool,
  validateRequiredVars,
  getConfigSummary,
  getConfigSummarySync,
  loadDotenv
};
```

### @qerrors/logging-core
**Purpose:** Comprehensive logging utilities with circular reference handling and error safety.
**Explanation:**  
This module provides essential logging utilities with comprehensive error handling, circular reference detection, and safe string conversion. It includes context stringification with circular reference prevention, safe error message extraction from various error types, environment-based verbose logging, and enhanced log entry creation. This is valuable for any application that needs robust logging capabilities that won't fail due to serialization errors or complex object structures.

Key problems solved:
- Prevents JSON.stringify errors from circular object references
- Provides safe error message extraction from various error types
- Includes environment-controlled verbose logging for debugging
- Offers enhanced log entry creation with memory tracking
- Handles all data types safely without breaking the logging system

```javascript
// Exact current implementation copied from the codebase
const { createEnhancedLogEntry } = require('./errorContext');
const localVars = require('../../config/localVars');
const { LOG_LEVELS } = localVars;

const createLogEntry = (level, message, context = {}, requestId = null) => { 
  const entry = createEnhancedLogEntry(level, message, context, requestId); 
  const levelConfig = LOG_LEVELS[level.toUpperCase()]; 
  if (levelConfig && levelConfig.priority >= LOG_LEVELS.WARN.priority) { 
    const memUsage = process.memoryUsage(); 
    entry.memory = { 
      heapUsed: Math.round(memUsage.heapUsed / 1048576), 
      heapTotal: Math.round(memUsage.heapTotal / 1048576), 
      external: Math.round(memUsage.external / 1048576), 
      rss: Math.round(memUsage.rss / 1048576) 
    }; 
  } 
  return entry; 
};

const stringifyContext = ctx => {
  try {
    if (typeof ctx === 'string') return ctx;

    if (typeof ctx === 'object' && ctx !== null) {
      const seen = new Set();

      return JSON.stringify(ctx, (_, value) => {
        if (typeof value === 'object' && value !== null) {
          if (value === ctx) return '[Circular *1]';

          if (seen.has(value)) return '[Circular]';

          seen.add(value);
        }
        return value;
      });
    }

    return String(ctx);
  } catch (err) {
    return 'unknown context';
  }
};

const safeErrorMessage = (error, fallback = 'Unknown error') => {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String(error.message || '').trim();
    if (msg) return msg;
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return fallback;
};

const verboseLog = msg => localVars.QERRORS_VERBOSE !== 'false' && console.log(msg);

module.exports = {
  createLogEntry,
  stringifyContext,
  safeErrorMessage,
  verboseLog
};
```