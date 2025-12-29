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
 * - Uses TypeScript for enhanced type safety and developer experience
 */

import qerrors from './lib/qerrors.js';
import * as logger from './lib/logger.js';
import * as errorTypes from './lib/errorTypes.js';
import * as sanitization from './lib/sanitization.js';
import * as queueManager from './lib/queueManager.js';
import * as utils from './lib/utils.js';
import * as config from './lib/config.js';
import * as envUtils from './lib/envUtils.js';
import * as aiModelManager from './lib/aiModelManager.js';
import * as moduleInitializer from './lib/moduleInitializer.js';
import * as dependencyInterfaces from './lib/dependencyInterfaces.js';
import * as entityGuards from './lib/entityGuards.js';
import * as responseHelpers from './lib/responseHelpers.js';
import * as circuitBreaker from './lib/circuitBreaker.js';

// Get the logger instance and its attached properties
const loggerInstance = await (logger as any);

/**
 * Error logger middleware that logs errors and provides AI-powered suggestions.
 * @param error - The error object
 * @param context - Context where the error occurred
 * @param req - Express request object (optional)
 * @param res - Express response object (optional)
 * @param next - Express next function (optional)
 * @returns Promise<void>
 */
export { qerrors };

// Export all other modules
export { loggerInstance as logger };
export { errorTypes };
export { sanitization };
export { queueManager };
export { utils };
export { config };
export { envUtils };
export { aiModelManager };
export { moduleInitializer };
export { dependencyInterfaces };
export { entityGuards };
export { responseHelpers };
export { circuitBreaker };

// Export specific functions and constants for convenience
export const logErrorWithSeverity = (qerrors as any).logErrorWithSeverity || null;
export const handleControllerError = (qerrors as any).handleControllerError || null;
export const withErrorHandling = (qerrors as any).withErrorHandling || null;
export const createTypedError = errorTypes.createTypedError;
export const createStandardError = errorTypes.createStandardError;
export const ErrorTypes = errorTypes.ErrorTypes;
export const ErrorSeverity = errorTypes.ErrorSeverity;
export const ErrorFactory = errorTypes.ErrorFactory;
export const errorMiddleware = errorTypes.errorMiddleware;
export const handleSimpleError = errorTypes.handleSimpleError;
export const ServiceError = errorTypes.ServiceError;
export const errorUtils = errorTypes.errorUtils;
export const safeUtils = errorTypes.safeUtils;

// Logger exports from the logger instance
export const logDebug = loggerInstance.logDebug;
export const logInfo = loggerInstance.logInfo;
export const logWarn = loggerInstance.logWarn;
export const logError = loggerInstance.logError;
export const logFatal = loggerInstance.logFatal;
export const logAudit = loggerInstance.logAudit;
export const createPerformanceTimer = loggerInstance.createPerformanceTimer;
export const createEnhancedLogEntry = loggerInstance.createEnhancedLogEntry;
export const LOG_LEVELS = loggerInstance.LOG_LEVELS;
export const simpleLogger = loggerInstance.simpleLogger;
export const createSimpleWinstonLogger = loggerInstance.createSimpleWinstonLogger;

// Sanitization exports
export const sanitizeMessage = sanitization.sanitizeMessage;
export const sanitizeContext = sanitization.sanitizeContext;
export const addCustomSanitizationPattern = sanitization.addCustomSanitizationPattern;
export const clearCustomSanitizationPatterns = sanitization.clearCustomSanitizationPatterns;
export const sanitizeWithCustomPatterns = sanitization.sanitizeWithCustomPatterns;

// Queue management exports
export const createLimiter = queueManager.createLimiter;
export const getQueueRejectCount = queueManager.getQueueRejectCount;
export const startQueueMetrics = queueManager.startQueueMetrics;
export const stopQueueMetrics = queueManager.stopQueueMetrics;

// Utility exports
export const safeRun = utils.safeRun;
export const deepClone = utils.deepClone;
export const createTimer = utils.createTimer;
export const attempt = utils.attempt;
export const executeWithQerrors = utils.executeWithQerrors;
export const formatErrorMessage = utils.formatErrorMessage;

// Additional exports that were missing
export const generateUniqueId = () => crypto.randomUUID();
export const verboseLog = (message: string) => console.log(`[VERBOSE] ${message}`);

// Configuration exports
export const getEnv = config.getEnv;
export const getInt = config.getInt;

// Environment utilities exports
export const getMissingEnvVars = envUtils.getMissingEnvVars;
export const throwIfMissingEnvVars = envUtils.throwIfMissingEnvVars;
export const warnIfMissingEnvVars = envUtils.warnIfMissingEnvVars;
export const validateRequiredEnvVars = envUtils.validateRequiredEnvVars;
export const warnMissingEnvVars = envUtils.warnMissingEnvVars;
export const NODE_ENV = envUtils.NODE_ENV;
export const DEFAULT_ERROR_MESSAGE = envUtils.DEFAULT_ERROR_MESSAGE;

// AI Model Manager exports
export const getAIModelManager = aiModelManager.getAIModelManager;
export const resetAIModelManager = aiModelManager.resetAIModelManager;
export const MODEL_PROVIDERS = aiModelManager.MODEL_PROVIDERS;
export const createLangChainModel = aiModelManager.createLangChainModel;

// Module Initializer exports
export const initializeModule = moduleInitializer.initializeModule;
export const initializeModuleESM = moduleInitializer.initializeModuleESM;
export const shouldInitialize = moduleInitializer.shouldInitialize;
export const logModuleInit = moduleInitializer.logModuleInit;

// Dependency Interfaces exports
export const createQerrorsCoreDeps = dependencyInterfaces.createQerrorsCoreDeps;
export const getDefaultQerrorsCoreDeps = dependencyInterfaces.getDefaultQerrorsCoreDeps;
export const createDefaultErrorHandlingDeps = dependencyInterfaces.createDefaultErrorHandlingDeps;
export const qerr = dependencyInterfaces.qerr;
export const getErrorSeverity = dependencyInterfaces.getErrorSeverity;
export const logErrorWithSeverityDI = dependencyInterfaces.logErrorWithSeverityDI;
export const withErrorHandlingDI = dependencyInterfaces.withErrorHandlingDI;
export const resetDefaultQerrorsCoreDeps = dependencyInterfaces.resetDefaultQerrorsCoreDeps;

// Entity Guards exports
export const throwIfNotFound = entityGuards.throwIfNotFound;
export const throwIfNotFoundObj = entityGuards.throwIfNotFoundObj;
export const throwIfNotFoundMany = entityGuards.throwIfNotFoundMany;
export const throwIfNotFoundWithMessage = entityGuards.throwIfNotFoundWithMessage;
export const entityExists = entityGuards.entityExists;
export const assertEntityExists = entityGuards.assertEntityExists;

// Response Helpers exports
export const sendJsonResponse = responseHelpers.sendJsonResponse;
export const sendSuccessResponse = responseHelpers.sendSuccessResponse;
export const sendCreatedResponse = responseHelpers.sendCreatedResponse;
export const sendErrorResponse = responseHelpers.sendErrorResponse;
export const sendValidationErrorResponse = responseHelpers.sendValidationErrorResponse;
export const sendNotFoundResponse = responseHelpers.sendNotFoundResponse;
export const sendUnauthorizedResponse = responseHelpers.sendUnauthorizedResponse;
export const sendForbiddenResponse = responseHelpers.sendForbiddenResponse;
export const sendServerErrorResponse = responseHelpers.sendServerErrorResponse;
export const createResponseHelper = responseHelpers.createResponseHelper;
export const globalErrorHandler = responseHelpers.globalErrorHandler;

// Circuit Breaker exports - commented out until module is converted
// export const CircuitBreaker = circuitBreaker.CircuitBreaker;
// export const CircuitState = circuitBreaker.CircuitState;
// export const createCircuitBreaker = circuitBreaker.createCircuitBreaker;

// Default export
export default qerrors;