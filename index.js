'use strict';

/**
 * Main entry point for the qerrors package - an intelligent error handling middleware
 * that combines traditional error logging with AI-powered error analysis.
 * 
 * This module exports both the core qerrors function and the underlying logger,
 * providing flexibility for different use cases while maintaining a clean API.
 * 
 * Design rationale:
 * - Separates concerns by keeping qerrors logic and logging logic in separate modules
 * - Provides both individual exports and a default export for different import patterns
 * - Maintains backward compatibility through multiple export strategies
 * - Uses strict mode to catch common JavaScript pitfalls early
 */

/**
 * Main entry point for the qerrors package - Comprehensive error handling system
 * 
 * This module serves as the primary interface for the qerrors intelligent error
 * handling middleware. It exports both the core qerrors function and a complete
 * ecosystem of supporting utilities, providing everything needed for advanced
 * error management in Node.js applications.
 * 
 * Architecture overview:
 * - Core qerrors function: AI-powered error analysis middleware
 * - Error types system: Standardized error classification and handling
 * - Logging infrastructure: Winston-based logging with performance tracking
 * - Queue management: Async processing for AI analysis to maintain fast responses
 * - Security utilities: Input sanitization and XSS prevention
 * - Circuit breaker: Resilience patterns for external service calls
 * - Response helpers: Standardized API response formatting
 */

// Core error handling and AI analysis
const qerrors = require('./lib/qerrors');              // Main qerrors middleware function
const logger = require('./lib/logger');                // Winston-based logging system
const errorTypes = require('./lib/errorTypes');          // Error classification and utilities

// Security and data sanitization
const sanitization = require('./lib/sanitization');      // Input sanitization utilities

// Async processing and queue management
const queueManager = require('./lib/queueManager');      // Background job processing

// General utilities and helpers
const utils = require('./lib/utils');                    // Common utility functions
const config = require('./lib/config');                  // Configuration management
const envUtils = require('./lib/envUtils');              // Environment variable utilities

// AI model management and analysis
const aiModelManager = require('./lib/aiModelManager');  // AI model abstraction layer

// Module initialization and lifecycle
const moduleInitializer = require('./lib/moduleInitializer'); // Module setup utilities

// Dependency injection and interfaces
const dependencyInterfaces = require('./lib/dependencyInterfaces'); // DI system

// Entity validation and guards
const entityGuards = require('./lib/entityGuards');      // Entity existence validation

// HTTP response utilities
const responseHelpers = require('./lib/responseHelpers'); // Standardized API responses

// Resilience and circuit breaking
const circuitBreaker = require('./lib/circuitBreaker');  // Circuit breaker pattern implementation

// Async operation contracts and retry utilities
const asyncContracts = require('./lib/shared/asyncContracts');  // Retry, circuit breaker, async patterns

/**
 * Error logger middleware that logs errors and provides AI-powered suggestions.
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 * @param {Object} [req] - Express request object (optional)
 * @param {Object} [res] - Express response object (optional)
 * @param {Function} [next] - Express next function (optional)
 * @returns {Promise<void>}
 */

/**
 * Comprehensive module exports - Complete qerrors ecosystem
 * 
 * This export object provides access to the entire qerrors functionality
 * organized by category for easy importing. The structure allows both
 * selective imports (specific functions) and complete imports (entire system).
 * 
 * Export categories:
 * 1. Core error handling - Main qerrors functionality
 * 2. Error types system - Error classification and utilities
 * 3. Logging infrastructure - Winston-based logging system
 * 4. Security utilities - Input sanitization and validation
 * 5. Queue management - Async processing and job management
 * 6. General utilities - Common helper functions
 * 7. Configuration - Environment and config management
 * 8. Module lifecycle - Initialization and setup utilities
 * 9. Dependency injection - DI system and interfaces
 * 10. Entity validation - Guards and validation utilities
 * 11. Response helpers - Standardized API responses
 * 12. Resilience patterns - Circuit breaker and fault tolerance
 * 13. AI management - Model abstraction and analysis
 * 14. Compatibility exports - Direct module access
 */
module.exports = {
  // ====================================================================
  // CORE ERROR HANDLING - Main qerrors functionality
  // ====================================================================
  qerrors,                                    // Primary error handling middleware
  logErrorWithSeverity: qerrors.logErrorWithSeverity,  // Severity-based logging
  handleControllerError: qerrors.handleControllerError, // Controller error handling
  withErrorHandling: qerrors.withErrorHandling,        // Operation wrapper
  
  // ====================================================================
  // ERROR TYPES SYSTEM - Error classification and utilities
  // ====================================================================
  createTypedError: errorTypes.createTypedError,        // Low-level error factory
  createStandardError: errorTypes.createStandardError,  // Standard error pattern
  ErrorTypes: errorTypes.ErrorTypes,                    // Error type enumeration
  ErrorSeverity: errorTypes.ErrorSeverity,              // Severity level enumeration
  ErrorFactory: errorTypes.ErrorFactory,                // High-level error factories
  errorMiddleware: errorTypes.errorMiddleware,          // Express error middleware
  handleSimpleError: errorTypes.handleSimpleError,      // Standardized error responses
  ServiceError: errorTypes.ServiceError,                // Enhanced error class
  errorUtils: errorTypes.errorUtils,                    // Error utility functions
  safeUtils: errorTypes.safeUtils,                      // Error-safe operations
  
  // ====================================================================
  // LOGGING INFRASTRUCTURE - Winston-based logging system
  // ====================================================================
  logDebug: logger.logDebug,                          // Debug-level logging
  logInfo: logger.logInfo,                            // Info-level logging
  logWarn: logger.logWarn,                            // Warning-level logging
  logError: logger.logError,                          // Error-level logging
  logFatal: logger.logFatal,                          // Fatal-level logging
  logAudit: logger.logAudit,                          // Audit-level logging
  createPerformanceTimer: logger.createPerformanceTimer, // Performance timing
  createEnhancedLogEntry: logger.createEnhancedLogEntry, // Enhanced log creation
  LOG_LEVELS: logger.LOG_LEVELS,                      // Standardized log levels
  simpleLogger: logger.simpleLogger,                  // Simple logger instance
  createSimpleWinstonLogger: logger.createSimpleWinstonLogger, // Logger factory
  
  // ====================================================================
  // SECURITY UTILITIES - Input sanitization and validation
  // ====================================================================
  sanitizeMessage: sanitization.sanitizeMessage,      // Message sanitization
  sanitizeContext: sanitization.sanitizeContext,      // Context sanitization
  addCustomSanitizationPattern: sanitization.addCustomSanitizationPattern, // Custom patterns
  clearCustomSanitizationPatterns: sanitization.clearCustomSanitizationPatterns, // Pattern cleanup
  sanitizeWithCustomPatterns: sanitization.sanitizeWithCustomPatterns, // Custom sanitization
  
  // ====================================================================
  // QUEUE MANAGEMENT - Async processing and job management
  // ====================================================================
  createLimiter: queueManager.createLimiter,          // Rate limiting
  getQueueLength: queueManager.getQueueLength,        // Queue size monitoring
  getQueueRejectCount: queueManager.getQueueRejectCount, // Overflow tracking
  startQueueMetrics: queueManager.startQueueMetrics,  // Metrics collection
  stopQueueMetrics: queueManager.stopQueueMetrics,    // Metrics cleanup
  
  // ====================================================================
  // GENERAL UTILITIES - Common helper functions
  // ====================================================================
  generateUniqueId: utils.generateUniqueId,            // Unique ID generation
  createTimer: utils.createTimer,                      // Timer creation
  deepClone: utils.deepClone,                          // Deep cloning
  safeRun: utils.safeRun,                              // Safe execution
  verboseLog: utils.verboseLog,                        // Verbose logging
  
  // ====================================================================
  // CONFIGURATION - Environment and config management
  // ====================================================================
  getEnv: config.getEnv,                              // Environment variable access
  getInt: config.getInt,                              // Integer environment variables
  getMissingEnvVars: envUtils.getMissingEnvVars,      // Missing variable detection
  throwIfMissingEnvVars: envUtils.throwIfMissingEnvVars, // Strict validation
  warnIfMissingEnvVars: envUtils.warnIfMissingEnvVars, // Warning validation
  validateRequiredEnvVars: envUtils.validateRequiredEnvVars, // Required validation
  warnMissingEnvVars: envUtils.warnIfMissingEnvVars,   // Missing variable warnings
  NODE_ENV: envUtils.NODE_ENV,                        // Environment type
  DEFAULT_ERROR_MESSAGE: envUtils.DEFAULT_ERROR_MESSAGE, // Default messages
  TEST_SUCCESS_MESSAGE: envUtils.TEST_SUCCESS_MESSAGE, // Test success message
  TEST_FAILURE_MESSAGE: envUtils.TEST_FAILURE_MESSAGE, // Test failure message
  
  // ====================================================================
  // MODULE LIFECYCLE - Initialization and setup utilities
  // ====================================================================
  initializeModule: moduleInitializer.initializeModule,        // Module initialization
  initializeModuleESM: moduleInitializer.initializeModuleESM,  // ESM initialization
  shouldInitialize: moduleInitializer.shouldInitialize,        // Initialization check
  logModuleInit: moduleInitializer.logModuleInit,              // Initialization logging
  
  // ====================================================================
  // DEPENDENCY INJECTION - DI system and interfaces
  // ====================================================================
  createQerrorsCoreDeps: dependencyInterfaces.createQerrorsCoreDeps, // Core dependencies
  getDefaultQerrorsCoreDeps: dependencyInterfaces.getDefaultQerrorsCoreDeps, // Default deps
  createDefaultErrorHandlingDeps: dependencyInterfaces.createDefaultErrorHandlingDeps, // Error handling deps
  qerr: dependencyInterfaces.qerr,                              // DI error function
  logErrorWithSeverityDI: dependencyInterfaces.logErrorWithSeverityDI, // DI severity logging
  withErrorHandlingDI: dependencyInterfaces.withErrorHandlingDI, // DI error wrapper
  getErrorSeverity: dependencyInterfaces.getErrorSeverity,     // Severity extraction
  resetDefaultQerrorsCoreDeps: dependencyInterfaces.resetDefaultQerrorsCoreDeps, // DI reset
  
  // ====================================================================
  // ENTITY VALIDATION - Guards and validation utilities
  // ====================================================================
  throwIfNotFound: entityGuards.throwIfNotFound,              // Single entity guard
  throwIfNotFoundObj: entityGuards.throwIfNotFoundObj,        // Object entity guard
  throwIfNotFoundMany: entityGuards.throwIfNotFoundMany,      // Multiple entity guard
  throwIfNotFoundWithMessage: entityGuards.throwIfNotFoundWithMessage, // Custom message guard
  entityExists: entityGuards.entityExists,                    // Entity existence check
  assertEntityExists: entityGuards.assertEntityExists,        // Entity assertion
  
  // ====================================================================
  // RESPONSE HELPERS - Standardized API responses
  // ====================================================================
  sendJsonResponse: responseHelpers.sendJsonResponse,        // Generic JSON response
  sendSuccessResponse: responseHelpers.sendSuccessResponse,  // Success response
  sendCreatedResponse: responseHelpers.sendCreatedResponse,  // Created response
  sendErrorResponse: responseHelpers.sendErrorResponse,    // Error response
  sendValidationErrorResponse: responseHelpers.sendValidationErrorResponse, // Validation error
  sendNotFoundResponse: responseHelpers.sendNotFoundResponse, // Not found response
  sendUnauthorizedResponse: responseHelpers.sendUnauthorizedResponse, // Unauthorized response
  sendForbiddenResponse: responseHelpers.sendForbiddenResponse, // Forbidden response
  sendServerErrorResponse: responseHelpers.sendServerErrorResponse, // Server error response
  createResponseHelper: responseHelpers.createResponseHelper, // Response helper factory
  globalErrorHandler: responseHelpers.globalErrorHandler,   // Global error handler
  
  // ====================================================================
  // RESILIENCE PATTERNS - Circuit breaker and fault tolerance
  // ====================================================================
  CircuitBreaker: circuitBreaker.CircuitBreaker,            // Circuit breaker class
  CircuitState: circuitBreaker.CircuitState,                // Circuit state enumeration
  createCircuitBreaker: circuitBreaker.createCircuitBreaker, // Circuit breaker factory
  
  // ====================================================================
  // RETRY UTILITIES - Retry orchestration and presets
  // ====================================================================
  RetryHandler: asyncContracts.RetryHandler,                // Retry handler class
  withRetry: asyncContracts.withRetry,                      // Method decorator for retries
  retryOperation: asyncContracts.retryOperation,            // Functional retry wrapper
  StandardAsyncExecutor: asyncContracts.StandardAsyncExecutor, // Async executor with retry/circuit
  AsyncOperationFactory: asyncContracts.AsyncOperationFactory, // Factory for async operations
  RetryConfigPresets: require('./config/localVars').RetryConfigPresets, // Retry config presets
  
  // ====================================================================
  // AI MANAGEMENT - Model abstraction and analysis
  // ====================================================================
  getAIModelManager: aiModelManager.getAIModelManager,      // AI model manager
  resetAIModelManager: aiModelManager.resetAIModelManager,  // Manager reset
  MODEL_PROVIDERS: aiModelManager.MODEL_PROVIDERS,          // Provider enumeration
  createLangChainModel: aiModelManager.createLangChainModel, // LangChain integration
  
  // ====================================================================
  // COMPATIBILITY EXPORTS - Direct module access
  // ====================================================================
  // These exports provide direct access to the underlying modules
  // for advanced usage or when specific module functionality is needed
  logger,              // Winston logger instance
  config,              // Configuration module
  envUtils,            // Environment utilities
  utils,               // General utilities
  sanitization,        // Sanitization module
  queueManager,        // Queue management
  errorTypes,          // Error types module
  aiModelManager,      // AI model management
  moduleInitializer,   // Module initialization
  dependencyInterfaces, // Dependency injection
  entityGuards,        // Entity guards
  responseHelpers,     // Response helpers
  circuitBreaker,      // Circuit breaker
  asyncContracts       // Async contracts and retry utilities
};

/**
 * Default export for convenience - Primary qerrors function
 * 
 * This default export allows for simple importing when only the main
 * qerrors middleware function is needed, providing a clean and
 * straightforward import experience.
 * 
 * Usage: import qerrors from 'qerrors'; // or const qerrors = require('qerrors');
 */
module.exports.default = qerrors;