
'use strict'; //enforce strict parsing and error handling across module

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

const qerrors = require('./lib/qerrors'); //load primary error handler implementation
const logger = require('./lib/logger'); //load configured winston logger used by qerrors
const errorTypes = require('./lib/errorTypes'); //load error classification and handling utilities
const sanitization = require('./lib/sanitization'); //load data sanitization utilities
const queueManager = require('./lib/queueManager'); //load queue management utilities
const utils = require('./lib/utils'); //load common utility functions
const config = require('./lib/config'); //load configuration utilities
const envUtils = require('./lib/envUtils'); //load environment validation utilities
const aiModelManager = require('./lib/aiModelManager'); //load AI model management utilities
const moduleInitializer = require('./lib/moduleInitializer'); //load module initialization utilities
const dependencyInterfaces = require('./lib/dependencyInterfaces'); //load dependency injection utilities
const entityGuards = require('./lib/entityGuards'); //load entity validation utilities
const responseHelpers = require('./lib/responseHelpers'); //load Express response helper utilities
const circuitBreaker = require('./lib/circuitBreaker'); //load circuit breaker utilities
const testing = require('./lib/testing'); //load Jest-compatible testing mocks

/**
 * Error logger middleware that logs errors and provides AI-powered suggestions.
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 * @param {Object} [req] - Express request object (optional)
 * @param {Object} [res] - Express response object (optional)
 * @param {Function} [next] - Express next function (optional)
 * @returns {Promise<void>}
 */

module.exports = { //(primary export object allows destructuring imports like { qerrors, logger, errorTypes } providing clear explicit imports while keeping related functionality grouped)
  qerrors, //(main error handling function users interact with)
  logger, //(winston logger instance for consistent logging, exposes same configured logger qerrors uses internally)
  errorTypes, //(error classification and handling utilities for standardized error management)
  logErrorWithSeverity: qerrors.logErrorWithSeverity, //(severity-based logging function for enhanced error categorization)
  handleControllerError: qerrors.handleControllerError, //(standardized controller error handler with automatic response formatting)
  withErrorHandling: qerrors.withErrorHandling, //(async operation wrapper with integrated error handling)
  createTypedError: errorTypes.createTypedError, //(typed error factory for consistent error classification)
  createStandardError: errorTypes.createStandardError, //(standardized error object factory)
  ErrorTypes: errorTypes.ErrorTypes, //(error type constants for classification)
  ErrorSeverity: errorTypes.ErrorSeverity, //(severity level constants for monitoring)
  ErrorFactory: errorTypes.ErrorFactory, //(convenient error creation utilities for common scenarios)
  errorMiddleware: errorTypes.errorMiddleware, //(Express global error handling middleware)
  handleSimpleError: errorTypes.handleSimpleError, //(simplified error response handler for basic scenarios)
  ServiceError: errorTypes.ServiceError, //(enhanced error class with type, context, and cause chaining)
  errorUtils: errorTypes.errorUtils, //(common error handling utilities for creating and wrapping errors)
  safeUtils: errorTypes.safeUtils, //(result-type pattern for error-safe operations)

  // Enhanced logging utilities with security and performance monitoring
  logDebug: logger.logDebug, //(enhanced debug logging with sanitization)
  logInfo: logger.logInfo, //(enhanced info logging with sanitization)
  logWarn: logger.logWarn, //(enhanced warn logging with performance monitoring)
  logError: logger.logError, //(enhanced error logging with performance monitoring)
  logFatal: logger.logFatal, //(enhanced fatal logging with performance monitoring)
  logAudit: logger.logAudit, //(enhanced audit logging for compliance)
  createPerformanceTimer: logger.createPerformanceTimer, //(performance timer utility for operation monitoring)
  createEnhancedLogEntry: logger.createEnhancedLogEntry, //(enhanced log entry creator with metadata)
  LOG_LEVELS: logger.LOG_LEVELS, //(log level constants with priorities and colors)
  
  // Simple Winston logger for basic logging needs
  simpleLogger: logger.simpleLogger, //(basic Winston logger instance with console output)
  createSimpleWinstonLogger: logger.createSimpleWinstonLogger, //(factory for creating simple Winston loggers)

  // Data sanitization utilities for security
  sanitizeMessage: sanitization.sanitizeMessage, //(message sanitization utility for security)
  sanitizeContext: sanitization.sanitizeContext, //(context sanitization utility for security)
  addCustomSanitizationPattern: sanitization.addCustomSanitizationPattern, //(register custom sanitization rules)
  clearCustomSanitizationPatterns: sanitization.clearCustomSanitizationPatterns, //(clear custom patterns for testing)
  sanitizeWithCustomPatterns: sanitization.sanitizeWithCustomPatterns, //(enhanced sanitization with custom rules)

  // Queue management and monitoring utilities
  createLimiter: queueManager.createLimiter, //(concurrency limiting utility)
  getQueueLength: queueManager.getQueueLength, //(queue depth monitoring)
  getQueueRejectCount: queueManager.getQueueRejectCount, //(reject count monitoring)
  startQueueMetrics: queueManager.startQueueMetrics, //(start periodic metrics)
  stopQueueMetrics: queueManager.stopQueueMetrics, //(stop periodic metrics)

  // Common utility functions
  generateUniqueId: utils.generateUniqueId, //(unique identifier generation)
  createTimer: utils.createTimer, //(performance timing utilities)
  deepClone: utils.deepClone, //(deep object cloning)
  safeRun: utils.safeRun, //(safe function execution wrapper)
  verboseLog: utils.verboseLog, //(conditional verbose logging)

  // Configuration and environment utilities
  getEnv: config.getEnv, //(environment variable getter with explicit default support)
  getInt: config.getInt, //(integer parsing with explicit default support and validation)
  getMissingEnvVars: envUtils.getMissingEnvVars, //(environment validation)
  throwIfMissingEnvVars: envUtils.throwIfMissingEnvVars, //(required environment validation)
  warnIfMissingEnvVars: envUtils.warnIfMissingEnvVars, //(optional environment validation)
  validateRequiredEnvVars: envUtils.validateRequiredEnvVars, //(alias for throwIfMissingEnvVars)
  warnMissingEnvVars: envUtils.warnMissingEnvVars, //(alias for warnIfMissingEnvVars)
  
  // Environment constants
  NODE_ENV: envUtils.NODE_ENV, //(current Node environment)
  DEFAULT_ERROR_MESSAGE: envUtils.DEFAULT_ERROR_MESSAGE, //(standardized default error message)
  TEST_SUCCESS_MESSAGE: envUtils.TEST_SUCCESS_MESSAGE, //(test success marker)
  TEST_FAILURE_MESSAGE: envUtils.TEST_FAILURE_MESSAGE, //(test failure marker)

  // AI model management utilities (LangChain integration)
  getAIModelManager: aiModelManager.getAIModelManager, //(get AI model manager singleton)
  resetAIModelManager: aiModelManager.resetAIModelManager, //(reset AI model manager for testing)
  MODEL_PROVIDERS: aiModelManager.MODEL_PROVIDERS, //(available AI providers)
  createLangChainModel: aiModelManager.createLangChainModel, //(create LangChain model instances)

  // Module initialization utilities
  initializeModule: moduleInitializer.initializeModule, //(CJS-compatible module initialization)
  initializeModuleESM: moduleInitializer.initializeModuleESM, //(ESM-compatible initialization with dynamic import)
  shouldInitialize: moduleInitializer.shouldInitialize, //(check if initialization should proceed)
  logModuleInit: moduleInitializer.logModuleInit, //(structured logging for module initialization)

  // Dependency injection utilities (@qutils/error-handling-core)
  createQerrorsCoreDeps: dependencyInterfaces.createQerrorsCoreDeps, //(factory for creating deps from qerrors instance)
  getDefaultQerrorsCoreDeps: dependencyInterfaces.getDefaultQerrorsCoreDeps, //(get/create default deps lazily)
  createDefaultErrorHandlingDeps: dependencyInterfaces.createDefaultErrorHandlingDeps, //(alias matching @qutils API)
  qerr: dependencyInterfaces.qerr, //(quick error logging with DI)
  getErrorSeverity: dependencyInterfaces.getErrorSeverity, //(get severity constants with DI)
  logErrorWithSeverityDI: dependencyInterfaces.logErrorWithSeverityDI, //(severity logging with DI)
  withErrorHandlingDI: dependencyInterfaces.withErrorHandlingDI, //(async wrapper with DI)
  resetDefaultQerrorsCoreDeps: dependencyInterfaces.resetDefaultQerrorsCoreDeps, //(test helper to reset cached deps)

  // Entity validation utilities (@qutils/entity-guards)
  throwIfNotFound: entityGuards.throwIfNotFound, //(validate entity exists or throw)
  throwIfNotFoundObj: entityGuards.throwIfNotFoundObj, //(object-based validation with found flag)
  throwIfNotFoundMany: entityGuards.throwIfNotFoundMany, //(batch entity validation)
  throwIfNotFoundWithMessage: entityGuards.throwIfNotFoundWithMessage, //(custom error message validation)
  entityExists: entityGuards.entityExists, //(check existence without throwing)
  assertEntityExists: entityGuards.assertEntityExists, //(typed error validation for qerrors integration)

  // Utility functions
  safeErrorMessage: utils.safeErrorMessage, //(safe error message extraction from unknown types)
  safeLogError: utils.logError, //(unified structured error logger that never throws)
  safeLogInfo: utils.logInfo, //(unified structured info logger that never throws)
  safeLogWarn: utils.logWarn, //(unified structured warning logger that never throws)
  
  // Async operation wrappers
  attempt: utils.attempt, //(Result-type pattern for safe operation execution)
  executeWithQerrors: utils.executeWithQerrors, //(async operation wrapper with comprehensive error handling)
  formatErrorMessage: utils.formatErrorMessage, //(standardized error message formatting)
  
  // Safe async wrappers
  createSafeAsyncWrapper: utils.createSafeAsyncWrapper, //(create safe async wrapper with module fallback)
  createSafeLogger: utils.createSafeLogger, //(create safe logger with console fallback)
  createSafeOperation: utils.createSafeOperation, //(wrap async function with error protection)
  safeJsonParse: utils.safeJsonParse, //(safe JSON parsing with fallback)
  safeJsonStringify: utils.safeJsonStringify, //(safe JSON stringify with fallback)
  safeQerrors: utils.safeQerrors, //(safe wrapper for main qerrors with console fallback)
  
  // Express response helpers
  sendJsonResponse: responseHelpers.sendJsonResponse, //(core JSON response sender)
  sendSuccessResponse: responseHelpers.sendSuccessResponse, //(200 success response)
  sendCreatedResponse: responseHelpers.sendCreatedResponse, //(201 created response)
  sendErrorResponse: responseHelpers.sendErrorResponse, //(general error response)
  sendValidationErrorResponse: responseHelpers.sendValidationErrorResponse, //(400 validation response)
  sendNotFoundResponse: responseHelpers.sendNotFoundResponse, //(404 not found response)
  sendUnauthorizedResponse: responseHelpers.sendUnauthorizedResponse, //(401 unauthorized response)
  sendForbiddenResponse: responseHelpers.sendForbiddenResponse, //(403 forbidden response)
  sendServerErrorResponse: responseHelpers.sendServerErrorResponse, //(500 server error response)
  createResponseHelper: responseHelpers.createResponseHelper, //(factory for response helper object)
  globalErrorHandler: responseHelpers.globalErrorHandler, //(centralized Express error handler middleware)
  handleError: responseHelpers.handleError, //(async error handler with dynamic import and fallback)
  
  // Circuit breaker
  CircuitBreaker: circuitBreaker.CircuitBreaker, //(circuit breaker class)
  CircuitState: circuitBreaker.CircuitState, //(circuit state enum)
  createCircuitBreaker: circuitBreaker.createCircuitBreaker, //(factory with defaults)
  
  // Testing utilities (Jest mocks)
  testing, //(Jest-compatible testing mocks for unit tests)
  MockErrorFactory: testing.MockErrorFactory, //(mock error factory for tests)
  createMockResponse: testing.createMockResponse, //(mock Express response factory)
  createMockRequest: testing.createMockRequest //(mock Express request factory)
};

module.exports.default = qerrors; //(default export for backward compatibility allowing both 'const qerrors = require("qerrors")' and destructuring patterns, dual strategy accommodates different developer preferences)
