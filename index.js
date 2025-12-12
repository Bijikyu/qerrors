
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

const qerrors=require('./lib/qerrors'),logger=require('./lib/logger'),errorTypes=require('./lib/errorTypes'),sanitization=require('./lib/sanitization'),queueManager=require('./lib/queueManager'),utils=require('./lib/utils'),config=require('./lib/config'),envUtils=require('./lib/envUtils'),aiModelManager=require('./lib/aiModelManager'),moduleInitializer=require('./lib/moduleInitializer'),dependencyInterfaces=require('./lib/dependencyInterfaces'),entityGuards=require('./lib/entityGuards'),responseHelpers=require('./lib/responseHelpers'),circuitBreaker=require('./lib/circuitBreaker');


/**
 * Error logger middleware that logs errors and provides AI-powered suggestions.
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 * @param {Object} [req] - Express request object (optional)
 * @param {Object} [res] - Express response object (optional)
 * @param {Function} [next] - Express next function (optional)
 * @returns {Promise<void>}
 */

module.exports={qerrors,logger,errorTypes,logErrorWithSeverity:qerrors.logErrorWithSeverity,handleControllerError:qerrors.handleControllerError,withErrorHandling:qerrors.withErrorHandling,createTypedError:errorTypes.createTypedError,createStandardError:errorTypes.createStandardError,ErrorTypes:errorTypes.ErrorTypes,ErrorSeverity:errorTypes.ErrorSeverity,ErrorFactory:errorTypes.ErrorFactory,errorMiddleware:errorTypes.errorMiddleware,handleSimpleError:errorTypes.handleSimpleError,ServiceError:errorTypes.ServiceError,errorUtils:errorTypes.errorUtils,safeUtils:errorTypes.safeUtils,logDebug:logger.logDebug,logInfo:logger.logInfo,logWarn:logger.logWarn,logError:logger.logError,logFatal:logger.logFatal,logAudit:logger.logAudit,createPerformanceTimer:logger.createPerformanceTimer,createEnhancedLogEntry:logger.createEnhancedLogEntry,LOG_LEVELS:logger.LOG_LEVELS,simpleLogger:logger.simpleLogger,createSimpleWinstonLogger:logger.createSimpleWinstonLogger,sanitizeMessage:sanitization.sanitizeMessage,sanitizeContext:sanitization.sanitizeContext,addCustomSanitizationPattern:sanitization.addCustomSanitizationPattern,clearCustomSanitizationPatterns:sanitization.clearCustomSanitizationPatterns,sanitizeWithCustomPatterns:sanitization.sanitizeWithCustomPatterns,createLimiter:queueManager.createLimiter,getQueueLength:queueManager.getQueueLength,getQueueRejectCount:queueManager.getQueueRejectCount,startQueueMetrics:queueManager.startQueueMetrics,stopQueueMetrics:queueManager.stopQueueMetrics,generateUniqueId:utils.generateUniqueId,createTimer:utils.createTimer,deepClone:utils.deepClone,safeRun:utils.safeRun,verboseLog:utils.verboseLog,getEnv:config.getEnv,getInt:config.getInt,getMissingEnvVars:envUtils.getMissingEnvVars,throwIfMissingEnvVars:envUtils.throwIfMissingEnvVars,warnIfMissingEnvVars:envUtils.warnIfMissingEnvVars,validateRequiredEnvVars:envUtils.validateRequiredEnvVars,warnMissingEnvVars:envUtils.warnMissingEnvVars,NODE_ENV:envUtils.NODE_ENV,DEFAULT_ERROR_MESSAGE:envUtils.DEFAULT_ERROR_MESSAGE,getAIModelManager:aiModelManager.getAIModelManager,resetAIModelManager:aiModelManager.resetAIModelManager,MODEL_PROVIDERS:aiModelManager.MODEL_PROVIDERS,createLangChainModel:aiModelManager.createLangChainModel,initializeModule:moduleInitializer.initializeModule,initializeModuleESM:moduleInitializer.initializeModuleESM,shouldInitialize:moduleInitializer.shouldInitialize,logModuleInit:moduleInitializer.logModuleInit,createQerrorsCoreDeps:dependencyInterfaces.createQerrorsCoreDeps,getDefaultQerrorsCoreDeps:dependencyInterfaces.getDefaultQerrorsCoreDeps,createDefaultErrorHandlingDeps:dependencyInterfaces.createDefaultErrorHandlingDeps,qerr:dependencyInterfaces.qerr,getErrorSeverity:dependencyInterfaces.getErrorSeverity,logErrorWithSeverityDI:dependencyInterfaces.logErrorWithSeverityDI,withErrorHandlingDI:dependencyInterfaces.withErrorHandlingDI,resetDefaultQerrorsCoreDeps:dependencyInterfaces.resetDefaultQerrorsCoreDeps,throwIfNotFound:entityGuards.throwIfNotFound,throwIfNotFoundObj:entityGuards.throwIfNotFoundObj,throwIfNotFoundMany:entityGuards.throwIfNotFoundMany,throwIfNotFoundWithMessage:entityGuards.throwIfNotFoundWithMessage,entityExists:entityGuards.entityExists,assertEntityExists:entityGuards.assertEntityExists,safeErrorMessage:utils.safeErrorMessage,safeLogError:utils.logError,safeLogInfo:utils.logInfo,safeLogWarn:utils.logWarn,attempt:utils.attempt,executeWithQerrors:utils.executeWithQerrors,formatErrorMessage:utils.formatErrorMessage,createSafeAsyncWrapper:utils.createSafeAsyncWrapper,createSafeLogger:utils.createSafeLogger,createSafeOperation:utils.createSafeOperation,safeJsonParse:utils.safeJsonParse,safeJsonStringify:utils.safeJsonStringify,safeQerrors:utils.safeQerrors,sendJsonResponse:responseHelpers.sendJsonResponse,sendSuccessResponse:responseHelpers.sendSuccessResponse,sendCreatedResponse:responseHelpers.sendCreatedResponse,sendErrorResponse:responseHelpers.sendErrorResponse,sendValidationErrorResponse:responseHelpers.sendValidationErrorResponse,sendNotFoundResponse:responseHelpers.sendNotFoundResponse,sendUnauthorizedResponse:responseHelpers.sendUnauthorizedResponse,sendForbiddenResponse:responseHelpers.sendForbiddenResponse,sendServerErrorResponse:responseHelpers.sendServerErrorResponse,createResponseHelper:responseHelpers.createResponseHelper,globalErrorHandler:responseHelpers.globalErrorHandler,handleError:responseHelpers.handleError,CircuitBreaker:circuitBreaker.CircuitBreakerWrapper,CircuitState:circuitBreaker.CircuitState,createCircuitBreaker:circuitBreaker.createCircuitBreaker};

module.exports.default=qerrors;
