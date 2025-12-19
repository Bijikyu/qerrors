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

const qerrors = require('./lib/qerrors');
const logger = require('./lib/logger');
const errorTypes = require('./lib/errorTypes');
const sanitization = require('./lib/sanitization');
const queueManager = require('./lib/queueManager');
const utils = require('./lib/utils');
const config = require('./lib/config');
const envUtils = require('./lib/envUtils');
const aiModelManager = require('./lib/aiModelManager');
const moduleInitializer = require('./lib/moduleInitializer');
const dependencyInterfaces = require('./lib/dependencyInterfaces');
const entityGuards = require('./lib/entityGuards');
const responseHelpers = require('./lib/responseHelpers');
const circuitBreaker = require('./lib/circuitBreaker');

/**
 * Error logger middleware that logs errors and provides AI-powered suggestions.
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 * @param {Object} [req] - Express request object (optional)
 * @param {Object} [res] - Express response object (optional)
 * @param {Function} [next] - Express next function (optional)
 * @returns {Promise<void>}
 */

module.exports = {
  // Core error handling
  qerrors,
  logErrorWithSeverity: qerrors.logErrorWithSeverity,
  handleControllerError: qerrors.handleControllerError,
  withErrorHandling: qerrors.withErrorHandling,
  
  // Error types and utilities
  createTypedError: errorTypes.createTypedError,
  createStandardError: errorTypes.createStandardError,
  ErrorTypes: errorTypes.ErrorTypes,
  ErrorSeverity: errorTypes.ErrorSeverity,
  ErrorFactory: errorTypes.ErrorFactory,
  errorMiddleware: errorTypes.errorMiddleware,
  handleSimpleError: errorTypes.handleSimpleError,
  ServiceError: errorTypes.ServiceError,
  errorUtils: errorTypes.errorUtils,
  safeUtils: errorTypes.safeUtils,
  
  // Logging utilities
  logDebug: logger.logDebug,
  logInfo: logger.logInfo,
  logWarn: logger.logWarn,
  logError: logger.logError,
  logFatal: logger.logFatal,
  logAudit: logger.logAudit,
  createPerformanceTimer: logger.createPerformanceTimer,
  createEnhancedLogEntry: logger.createEnhancedLogEntry,
  LOG_LEVELS: logger.LOG_LEVELS,
  simpleLogger: logger.simpleLogger,
  createSimpleWinstonLogger: logger.createSimpleWinstonLogger,
  
  // Sanitization utilities
  sanitizeMessage: sanitization.sanitizeMessage,
  sanitizeContext: sanitization.sanitizeContext,
  addCustomSanitizationPattern: sanitization.addCustomSanitizationPattern,
  clearCustomSanitizationPatterns: sanitization.clearCustomSanitizationPatterns,
  sanitizeWithCustomPatterns: sanitization.sanitizeWithCustomPatterns,
  
  // Queue management
  createLimiter: queueManager.createLimiter,
  getQueueLength: queueManager.getQueueLength,
  getQueueRejectCount: queueManager.getQueueRejectCount,
  startQueueMetrics: queueManager.startQueueMetrics,
  stopQueueMetrics: queueManager.stopQueueMetrics,
  
  // General utilities
  generateUniqueId: utils.generateUniqueId,
  createTimer: utils.createTimer,
  deepClone: utils.deepClone,
  safeRun: utils.safeRun,
  verboseLog: utils.verboseLog,
  
  // Configuration and environment
  getEnv: config.getEnv,
  getInt: config.getInt,
  getMissingEnvVars: envUtils.getMissingEnvVars,
  throwIfMissingEnvVars: envUtils.throwIfMissingEnvVars,
  warnIfMissingEnvVars: envUtils.warnIfMissingEnvVars,
  validateRequiredEnvVars: envUtils.validateRequiredEnvVars,
  warnMissingEnvVars: envUtils.warnIfMissingEnvVars,
  NODE_ENV: envUtils.NODE_ENV,
  DEFAULT_ERROR_MESSAGE: envUtils.DEFAULT_ERROR_MESSAGE,
  TEST_SUCCESS_MESSAGE: envUtils.TEST_SUCCESS_MESSAGE,
  TEST_FAILURE_MESSAGE: envUtils.TEST_FAILURE_MESSAGE,
  
  // Module initialization
  initializeModule: moduleInitializer.initializeModule,
  initializeModuleESM: moduleInitializer.initializeModuleESM,
  shouldInitialize: moduleInitializer.shouldInitialize,
  logModuleInit: moduleInitializer.logModuleInit,
  
  // Dependency injection
  createQerrorsCoreDeps: dependencyInterfaces.createQerrorsCoreDeps,
  getDefaultQerrorsCoreDeps: dependencyInterfaces.getDefaultQerrorsCoreDeps,
  createDefaultErrorHandlingDeps: dependencyInterfaces.createDefaultErrorHandlingDeps,
  qerr: dependencyInterfaces.qerr,
  logErrorWithSeverityDI: dependencyInterfaces.logErrorWithSeverityDI,
  withErrorHandlingDI: dependencyInterfaces.withErrorHandlingDI,
  getErrorSeverity: dependencyInterfaces.getErrorSeverity,
  resetDefaultQerrorsCoreDeps: dependencyInterfaces.resetDefaultQerrorsCoreDeps,
  
  // Entity guards
  throwIfNotFound: entityGuards.throwIfNotFound,
  throwIfNotFoundObj: entityGuards.throwIfNotFoundObj,
  throwIfNotFoundMany: entityGuards.throwIfNotFoundMany,
  throwIfNotFoundWithMessage: entityGuards.throwIfNotFoundWithMessage,
  entityExists: entityGuards.entityExists,
  assertEntityExists: entityGuards.assertEntityExists,
  
  // Response helpers
  sendJsonResponse: responseHelpers.sendJsonResponse,
  sendSuccessResponse: responseHelpers.sendSuccessResponse,
  sendCreatedResponse: responseHelpers.sendCreatedResponse,
  sendErrorResponse: responseHelpers.sendErrorResponse,
  sendValidationErrorResponse: responseHelpers.sendValidationErrorResponse,
  sendNotFoundResponse: responseHelpers.sendNotFoundResponse,
  sendUnauthorizedResponse: responseHelpers.sendUnauthorizedResponse,
  sendForbiddenResponse: responseHelpers.sendForbiddenResponse,
  sendServerErrorResponse: responseHelpers.sendServerErrorResponse,
  createResponseHelper: responseHelpers.createResponseHelper,
  globalErrorHandler: responseHelpers.globalErrorHandler,
  
  // Circuit breaker
  CircuitBreaker: circuitBreaker.CircuitBreaker,
  CircuitState: circuitBreaker.CircuitState,
  createCircuitBreaker: circuitBreaker.createCircuitBreaker,
  
  // AI model management
  getAIModelManager: aiModelManager.getAIModelManager,
  resetAIModelManager: aiModelManager.resetAIModelManager,
  MODEL_PROVIDERS: aiModelManager.MODEL_PROVIDERS,
  createLangChainModel: aiModelManager.createLangChainModel,
  
  // Additional exports for compatibility
  logger,
  config,
  envUtils,
  utils,
  sanitization,
  queueManager,
  errorTypes,
  aiModelManager,
  moduleInitializer,
  dependencyInterfaces,
  entityGuards,
  responseHelpers,
  circuitBreaker
};

// Default export for convenience
module.exports.default = qerrors;