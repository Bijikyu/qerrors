'use strict';

/**
 * Dependency Injection Interfaces Module - Centralized DI System for qerrors
 * 
 * Purpose: Provides a comprehensive dependency injection system that enables
 * clean separation of concerns, testability, and modular architecture for the
 * qerrors error handling system. This module manages all core dependencies
 * and provides both default implementations and custom dependency injection.
 * 
 * Design Rationale:
 * - Testability: Enables easy mocking of dependencies for unit testing
 * - Modularity: Allows different implementations to be injected as needed
 * - Singleton Management: Manages default dependency instances efficiently
 * - Backward Compatibility: Maintains existing API while adding DI capabilities
 * - Error Safety: Provides fallback mechanisms when dependencies are unavailable
 * 
 * Key Features:
 * - Core dependency factory for creating qerrors dependency sets
 * - Default dependency management with lazy initialization
 * - Dependency-aware error handling functions
 * - Severity extraction utilities
 * - Dependency reset capabilities for testing
 */

// Import error types module for severity enumeration and error utilities
const errorTypes = require('./errorTypes');

/**
 * Create core qerrors dependency set for dependency injection
 * 
 * Purpose: Factory function that creates a standardized dependency object
 * containing all essential qerrors functionality. This enables consistent
 * dependency injection across the application while maintaining a clean
 * interface for testing and modular development.
 * 
 * Design Rationale:
 * - Standardization: Ensures all dependency sets have the same structure
 * - Encapsulation: Bundles related functionality together
 * - Testability: Enables easy mocking of entire dependency sets
 * - Type Safety: Provides clear interface for required dependencies
 * 
 * @param {Object} qerrorsModule - qerrors module instance containing core functionality
 * @returns {Object} Standardized dependency object with qerrors functionality
 * @returns {Function} returns.qerrors - Main qerrors middleware function
 * @returns {Function} returns.logErrorWithSeverity - Severity-based error logging
 * @returns {Function} returns.withErrorHandling - Error handling wrapper utility
 * @returns {Object} returns.ErrorSeverity - Error severity enumeration
 * 
 * Example:
 * const deps = createQerrorsCoreDeps(require('./qerrors'));
 * // deps can now be injected into other modules for testing or customization
 */
const createQerrorsCoreDeps = qerrorsModule => ({
  qerrors: qerrorsModule,                                    // Main error handling middleware
  logErrorWithSeverity: qerrorsModule.logErrorWithSeverity,  // Severity-based logging
  withErrorHandling: qerrorsModule.withErrorHandling,        // Operation wrapper
  ErrorSeverity: errorTypes.ErrorSeverity                    // Severity level enumeration
});

// Default dependency instance - lazily initialized for performance
// This singleton pattern ensures we don't create multiple instances unnecessarily
let defaultQerrorsCoreDeps = null;

/**
 * Get default qerrors core dependencies with lazy initialization
 * 
 * Purpose: Provides access to the default dependency set with lazy initialization
 * to avoid circular dependencies and improve startup performance. The dependencies
 * are only created when first requested, and then cached for subsequent use.
 * 
 * Design Rationale:
 * - Lazy Loading: Prevents circular dependency issues during module initialization
 * - Performance: Avoids creating dependencies until they're actually needed
 * - Singleton Pattern: Ensures consistent dependency instances across the application
 * - Fallback Safety: Provides reliable access to core functionality
 * 
 * @returns {Object} Default qerrors core dependencies
 * 
 * Example:
 * const deps = getDefaultQerrorsCoreDeps();
 * await deps.logErrorWithSeverity(error, 'myFunction', context, severity);
 */
const getDefaultQerrorsCoreDeps = () => {
  // Create dependencies only if they don't exist yet (lazy initialization)
  if (!defaultQerrorsCoreDeps) {
    defaultQerrorsCoreDeps = createQerrorsCoreDeps(require('./qerrors'));
  }
  return defaultQerrorsCoreDeps;
};

/**
 * Create default error handling dependencies - convenience wrapper
 * 
 * Purpose: Provides a simple interface for accessing the default error handling
 * dependencies. This function exists primarily for API consistency and
 * readability, making it clear that we're getting error handling specific
 * dependencies rather than general qerrors dependencies.
 * 
 * Design Rationale:
 * - Semantic Clarity: Makes the purpose of the dependency request explicit
 * - API Consistency: Provides consistent naming patterns across the DI system
 * - Future Flexibility: Allows for error handling specific customizations
 * 
 * @returns {Object} Default error handling dependencies (same as core dependencies)
 */
const createDefaultErrorHandlingDeps = () => getDefaultQerrorsCoreDeps();

/**
 * Dependency-aware error logging function with fallback support
 * 
 * Purpose: Provides a simplified interface for error logging that automatically
 * resolves dependencies and handles fallback scenarios. This function is
 * designed to work both with explicit dependency injection and with the default
 * dependency system, making it flexible for different use cases.
 * 
 * Design Rationale:
 * - Flexibility: Works with both injected dependencies and default system
 * - Fallback Safety: Always has a valid dependency set to work with
 * - Simplicity: Provides a clean interface for common error logging scenarios
 * - Dependency Resolution: Automatically handles dependency injection complexity
 * 
 * @param {Error} e - Error object to log
 * @param {string} context - Context where the error occurred
 * @param {Object} [meta={}] - Additional metadata for error logging
 * @param {Object} [deps=null] - Optional explicit dependencies to use
 * @returns {Promise<void>} Promise that resolves when error is logged
 * 
 * Example:
 * // Using default dependencies
 * await qerr(error, 'myFunction', { userId: 123 });
 * 
 * // Using explicit dependencies (for testing)
 * await qerr(error, 'myFunction', { userId: 123 }, mockDeps);
 */
const qerr = async (e, context, meta = {}, deps = null) => {
  // Use provided dependencies or fall back to default system
  const resolvedDeps = deps || getDefaultQerrorsCoreDeps();
  
  // Ensure metadata is an object and log the error
  return resolvedDeps.qerrors(e, context, meta ?? {});
};

/**
 * Extract error severity from dependencies with fallback support
 * 
 * Purpose: Provides access to the ErrorSeverity enumeration through the
 * dependency injection system. This enables consistent access to severity
 * levels while maintaining the flexibility of the DI system.
 * 
 * Design Rationale:
 * - Consistency: Provides severity access through the same DI pattern
 * - Flexibility: Works with both injected and default dependencies
 * - Type Safety: Ensures access to the correct severity enumeration
 * 
 * @param {Object} [deps=null] - Optional explicit dependencies to use
 * @returns {Object} ErrorSeverity enumeration object
 * 
 * Example:
 * const severity = getErrorSeverity();
 * if (severity === severity.CRITICAL) {
 *   // Handle critical error
 * }
 */
const getErrorSeverity = (deps = null) => (deps || getDefaultQerrorsCoreDeps()).ErrorSeverity;

/**
 * Dependency-aware severity-based error logging with enhanced flexibility
 * 
 * Purpose: Provides a comprehensive error logging interface that supports
 * both dependency injection and fallback scenarios. This function automatically
 * detects the available logging method and uses the most appropriate one,
 * ensuring compatibility across different dependency configurations.
 * 
 * Design Rationale:
 * - Compatibility: Works with different dependency configurations
 * - Feature Detection: Automatically detects available logging methods
 * - Fallback Support: Provides alternative approaches when preferred method unavailable
 * - Parameter Flexibility: Supports both object and parameter-based calling patterns
 * 
 * @param {Object} params - Error logging parameters
 * @param {Error} params.error - Error object to log
 * @param {string} params.functionName - Name of the function where error occurred
 * @param {Object} [params.context={}] - Additional context information
 * @param {string} params.severity - Error severity level
 * @param {Object} [params.deps=null] - Optional explicit dependencies to use
 * @returns {Promise<void>} Promise that resolves when error is logged
 * 
 * Example:
 * await logErrorWithSeverityDI({
 *   error: new Error('Something went wrong'),
 *   functionName: 'processData',
 *   context: { userId: 123 },
 *   severity: 'HIGH'
 * });
 */
const logErrorWithSeverityDI = async ({ error, functionName, context = {}, severity, deps = null }) => {
  // Resolve dependencies using provided or default system
  const resolvedDeps = deps || getDefaultQerrorsCoreDeps();
  
  // Use dedicated severity logging if available, otherwise fall back to context-based logging
  return resolvedDeps.logErrorWithSeverity 
    ? await resolvedDeps.logErrorWithSeverity(error, functionName, context, severity)
    : await Promise.resolve(resolvedDeps.qerrors(error, functionName, { ...context, severity }));
};

/**
 * Get error handling wrapper function from dependencies
 * 
 * Purpose: Provides access to the withErrorHandling utility function through
 * the dependency injection system. This enables consistent operation wrapping
 * with error handling across the application while maintaining DI flexibility.
 * 
 * Design Rationale:
 * - Consistency: Provides access through the same DI pattern
 * - Flexibility: Works with both injected and default dependencies
 * - Function Return: Returns the actual function for immediate use
 * 
 * @param {Object} [deps=null] - Optional explicit dependencies to use
 * @returns {Function} withErrorHandling function for operation wrapping
 * 
 * Example:
 * const withErrorHandling = withErrorHandlingDI();
 * const result = await withErrorHandling(
 *   () => riskyOperation(),
 *   'riskyOperation',
 *   context,
 *   fallbackValue
 * );
 */
const withErrorHandlingDI = (deps = null) => (deps || getDefaultQerrorsCoreDeps()).withErrorHandling;

/**
 * Reset default qerrors core dependencies for testing and development
 * 
 * Purpose: Clears the cached default dependencies, forcing them to be
 * recreated on next access. This is essential for testing scenarios where
 * you need fresh dependency instances or want to test different dependency
 * configurations.
 * 
 * Design Rationale:
 * - Testing Support: Enables clean dependency state between tests
 * - Development Flexibility: Allows dependency configuration changes
 * - Memory Management: Clears cached instances when needed
 * - State Reset: Provides reliable way to reset application state
 * 
 * Usage:
 * - Call before unit tests to ensure clean dependency state
 * - Use when changing dependency configuration during development
 * - Helpful for debugging dependency-related issues
 * 
 * Example:
 * // In test setup
 * resetDefaultQerrorsCoreDeps();
 * 
 * // Now getDefaultQerrorsCoreDeps() will return fresh instances
 */
const resetDefaultQerrorsCoreDeps = () => {
  defaultQerrorsCoreDeps = null;
};

/**
 * Module exports - Complete dependency injection interface
 * 
 * This module provides the complete dependency injection system for qerrors,
 * enabling clean architecture, testability, and modular development. The exports
 * are organized to provide both factory functions and convenience utilities
 * for different usage patterns.
 * 
 * Export Categories:
 * - Factory Functions: Create dependency sets and configurations
 * - Default Management: Access and manage default dependency instances
 * - DI-Aware Utilities: Functions that work with the dependency system
 * - Testing Support: Utilities for testing and development
 */
module.exports = {
  // Factory functions
  createQerrorsCoreDeps,              // Create standardized dependency sets
  createDefaultErrorHandlingDeps,    // Create error handling specific dependencies
  
  // Default dependency management
  getDefaultQerrorsCoreDeps,          // Access default dependency instances
  
  // DI-aware utilities
  qerr,                              // Simplified error logging with DI
  getErrorSeverity,                  // Access severity through DI
  logErrorWithSeverityDI,            // Enhanced error logging with DI
  withErrorHandlingDI,               // Access error handling wrapper through DI
  
  // Testing and development support
  resetDefaultQerrorsCoreDeps        // Reset cached dependencies
};