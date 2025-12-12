'use strict'; //(enable strict mode for dependency interfaces)

/**
 * @qutils/error-handling-core
 * Purpose: Core error handling infrastructure with dependency injection and severity levels.
 * Explanation: This module provides fundamental error handling utilities that are completely 
 * framework-agnostic. It offers dependency-injected error handling functions with configurable
 * logging, severity classification, and consistent error patterns. The module is designed for
 * flexibility and can be customized for different logging and monitoring needs across any
 * Node.js/TypeScript project.
 */

const errorTypes = require('./errorTypes'); //(get error type definitions)

/**
 * @typedef {Object} QerrorsCoreDeps
 * @property {Function} qerrors - Main qerrors logging function
 * @property {Function} logErrorWithSeverity - Severity-aware error logging
 * @property {Function} withErrorHandling - Async operation wrapper
 * @property {Object} ErrorSeverity - Severity level constants
 */

/**
 * Create a QerrorsCoreDeps object from a qerrors module instance
 * Enables dependency injection for flexibility and framework customization.
 * 
 * @param {Object} qerrorsModule - The qerrors module or compatible implementation
 * @returns {QerrorsCoreDeps} Dependency container for error handling functions
 */
function createQerrorsCoreDeps(qerrorsModule) {
  return { //(create deps object with all required functions)
    qerrors: qerrorsModule, //(main qerrors function)
    logErrorWithSeverity: qerrorsModule.logErrorWithSeverity, //(severity logging)
    withErrorHandling: qerrorsModule.withErrorHandling, //(async wrapper)
    ErrorSeverity: errorTypes.ErrorSeverity //(severity constants)
  };
}

let defaultQerrorsCoreDeps = null; //(lazy-loaded default deps to avoid circular requires)

/**
 * Get or create the default QerrorsCoreDeps using the qerrors module
 * Uses lazy loading to avoid circular dependency issues.
 * 
 * @returns {QerrorsCoreDeps} Default dependency container
 */
function getDefaultQerrorsCoreDeps() {
  if (!defaultQerrorsCoreDeps) { //(lazy initialization)
    const qerrors = require('./qerrors'); //(load qerrors only when needed)
    defaultQerrorsCoreDeps = createQerrorsCoreDeps(qerrors); //(create deps from qerrors)
  }
  return defaultQerrorsCoreDeps;
}

/**
 * Create default error handling dependencies (alias for getDefaultQerrorsCoreDeps)
 * Matches @qutils/error-handling-core API.
 * 
 * @returns {QerrorsCoreDeps} Default dependency container
 */
function createDefaultErrorHandlingDeps() {
  return getDefaultQerrorsCoreDeps(); //(delegate to getter)
}

/**
 * Quick error logging with dependency injection support
 * Wraps qerrors with optional custom dependencies.
 * 
 * @param {unknown} e - The error object
 * @param {string} context - Error context description
 * @param {Record<string, unknown>} [meta] - Additional metadata
 * @param {QerrorsCoreDeps} [deps] - Optional custom dependencies
 * @returns {Promise<void>}
 */
async function qerr(e, context, meta = {}, deps = null) {
  const resolvedDeps = deps || getDefaultQerrorsCoreDeps(); //(use provided deps or defaults)
  return resolvedDeps.qerrors(e, context, meta ?? {}); //(call qerrors with resolved deps)
}

/**
 * Get ErrorSeverity constants with optional custom deps
 * 
 * @param {QerrorsCoreDeps} [deps] - Optional custom dependencies
 * @returns {Object} ErrorSeverity constants
 */
function getErrorSeverity(deps = null) {
  const resolvedDeps = deps || getDefaultQerrorsCoreDeps(); //(use provided deps or defaults)
  return resolvedDeps.ErrorSeverity; //(return severity constants)
}

/**
 * Log error with severity using dependency injection
 * 
 * @param {Object} options - Error logging options
 * @param {unknown} options.error - The error object
 * @param {string} options.functionName - Name of function where error occurred
 * @param {Record<string, unknown>} [options.context] - Additional context
 * @param {string} [options.severity] - Error severity level
 * @param {QerrorsCoreDeps} [options.deps] - Optional custom dependencies
 * @returns {Promise<void>}
 */
async function logErrorWithSeverityDI({ error, functionName, context = {}, severity, deps = null }) {
  const resolvedDeps = deps || getDefaultQerrorsCoreDeps(); //(use provided deps or defaults)
  if (resolvedDeps.logErrorWithSeverity) {
    await resolvedDeps.logErrorWithSeverity(error, functionName, context, severity); //(call with resolved deps)
  } else {
    await Promise.resolve(resolvedDeps.qerrors(error, functionName, { ...context, severity })); //(fallback to qerrors)
  }
}

/**
 * Wrap async operation with error handling using dependency injection
 * 
 * @param {QerrorsCoreDeps} [deps] - Optional custom dependencies
 * @returns {Function} The withErrorHandling function from deps
 */
function withErrorHandlingDI(deps = null) {
  const resolvedDeps = deps || getDefaultQerrorsCoreDeps(); //(use provided deps or defaults)
  return resolvedDeps.withErrorHandling; //(return wrapped function)
}

/**
 * Reset the default deps (useful for reconfiguration)
 */
function resetDefaultQerrorsCoreDeps() {
  defaultQerrorsCoreDeps = null; //(clear cached deps for reconfiguration)
}

module.exports = { //(export dependency injection utilities)
  createQerrorsCoreDeps, //(factory for creating deps from qerrors instance)
  getDefaultQerrorsCoreDeps, //(get/create default deps lazily)
  createDefaultErrorHandlingDeps, //(alias matching @qutils API)
  qerr, //(quick error logging with DI)
  getErrorSeverity, //(get severity constants with DI)
  logErrorWithSeverityDI, //(severity logging with DI)
  withErrorHandlingDI, //(async wrapper with DI)
  resetDefaultQerrorsCoreDeps //(helper to reset cached deps)
};
