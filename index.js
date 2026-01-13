// qerrors - Intelligent Error Handling Middleware
// Main entry point for the library

// Import core modules
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

// Export core functionality
module.exports = qerrors;

// Export additional modules
module.exports.logger = logger;
module.exports.errorTypes = errorTypes;
module.exports.sanitization = sanitization;
module.exports.queueManager = queueManager;
module.exports.utils = utils;
module.exports.config = config;
module.exports.envUtils = envUtils;
module.exports.aiModelManager = aiModelManager;
module.exports.moduleInitializer = moduleInitializer;
module.exports.dependencyInterfaces = dependencyInterfaces;
module.exports.entityGuards = entityGuards;
module.exports.responseHelpers = responseHelpers;
module.exports.circuitBreaker = circuitBreaker;

// Export convenience functions from qerrors
module.exports.logErrorWithSeverity = qerrors.logErrorWithSeverity || null;
module.exports.handleControllerError = qerrors.handleControllerError || null;
module.exports.withErrorHandling = qerrors.withErrorHandling || null;
module.exports.generateErrorId = qerrors.generateErrorId;
module.exports.extractContext = qerrors.extractContext;
module.exports.cleanup = qerrors.cleanup;
module.exports.getQueueStats = qerrors.getQueueStats;
module.exports.getAnalysisCache = qerrors.getAnalysisCache;

// Export error type functions
module.exports.createTypedError = errorTypes.createTypedError;
module.exports.createStandardError = errorTypes.createStandardError;
module.exports.ErrorTypes = errorTypes.ErrorTypes;
module.exports.ErrorSeverity = errorTypes.ErrorSeverity;
module.exports.ErrorFactory = errorTypes.ErrorFactory;
module.exports.errorMiddleware = errorTypes.errorMiddleware;
module.exports.handleSimpleError = errorTypes.handleSimpleError;
module.exports.ServiceError = errorTypes.ServiceError;
module.exports.errorUtils = errorTypes.errorUtils;
module.exports.safeUtils = errorTypes.safeUtils;

// Export logger functions
module.exports.logDebug = logger.logDebug;
module.exports.logInfo = logger.logInfo;
module.exports.logWarn = logger.logWarn;
module.exports.logError = logger.logError;
module.exports.logFatal = logger.logFatal;
module.exports.logAudit = logger.logAudit;
module.exports.createPerformanceTimer = logger.createPerformanceTimer;
module.exports.createEnhancedLogEntry = logger.createEnhancedLogEntry;
module.exports.LOG_LEVELS = logger.LOG_LEVELS;
module.exports.simpleLogger = logger.simpleLogger;
module.exports.createSimpleWinstonLogger = logger.createSimpleWinstonLogger;

// Export sanitization functions
module.exports.sanitizeMessage = sanitization.sanitizeMessage;
module.exports.sanitizeContext = sanitization.sanitizeContext;
module.exports.addCustomSanitizationPattern = sanitization.addCustomSanitizationPattern;
module.exports.clearCustomSanitizationPatterns = sanitization.clearCustomSanitizationPatterns;
module.exports.sanitizeWithCustomPatterns = sanitization.sanitizeWithCustomPatterns;

// Export queue manager functions
module.exports.createLimiter = queueManager.createLimiter;
module.exports.getQueueRejectCount = queueManager.getQueueRejectCount;
module.exports.startQueueMetrics = queueManager.startQueueMetrics;
module.exports.stopQueueMetrics = queueManager.stopQueueMetrics;

// Export utility functions
module.exports.safeRun = utils.safeRun;
module.exports.deepClone = utils.deepClone;
module.exports.createTimer = utils.createTimer;
module.exports.attempt = utils.attempt;
module.exports.executeWithQerrors = utils.executeWithQerrors;
module.exports.formatErrorMessage = utils.formatErrorMessage;

// Export configuration functions
module.exports.getEnv = config.getEnv;
module.exports.getInt = config.getInt;

// Export environment utility functions
module.exports.getMissingEnvVars = envUtils.getMissingEnvVars;
module.exports.throwIfMissingEnvVars = envUtils.throwIfMissingEnvVars;
module.exports.warnIfMissingEnvVars = envUtils.warnIfMissingEnvVars;
module.exports.validateRequiredEnvVars = envUtils.validateRequiredEnvVars;
module.exports.warnMissingEnvVars = envUtils.warnMissingEnvVars;
module.exports.NODE_ENV = envUtils.NODE_ENV;
module.exports.DEFAULT_ERROR_MESSAGE = envUtils.DEFAULT_ERROR_MESSAGE;

// Export AI model manager functions
module.exports.getAIModelManager = aiModelManager.getAIModelManager;
module.exports.resetAIModelManager = aiModelManager.resetAIModelManager;
module.exports.MODEL_PROVIDERS = aiModelManager.MODEL_PROVIDERS;
module.exports.createLangChainModel = aiModelManager.createLangChainModel;

// Export module initializer functions
module.exports.initializeModule = moduleInitializer.initializeModule;
module.exports.initializeModuleESM = moduleInitializer.initializeModuleESM;
module.exports.shouldInitialize = moduleInitializer.shouldInitialize;
module.exports.logModuleInit = moduleInitializer.logModuleInit;

// Export dependency interface functions
module.exports.createQerrorsCoreDeps = dependencyInterfaces.createQerrorsCoreDeps;
module.exports.getDefaultQerrorsCoreDeps = dependencyInterfaces.getDefaultQerrorsCoreDeps;
module.exports.createDefaultErrorHandlingDeps = dependencyInterfaces.createDefaultErrorHandlingDeps;
module.exports.qerr = dependencyInterfaces.qerr;
module.exports.getErrorSeverity = dependencyInterfaces.getErrorSeverity;
module.exports.logErrorWithSeverityDI = dependencyInterfaces.logErrorWithSeverityDI;
module.exports.withErrorHandlingDI = dependencyInterfaces.withErrorHandlingDI;
module.exports.resetDefaultQerrorsCoreDeps = dependencyInterfaces.resetDefaultQerrorsCoreDeps;

// Export entity guard functions
module.exports.throwIfNotFound = entityGuards.throwIfNotFound;
module.exports.throwIfNotFoundObj = entityGuards.throwIfNotFoundObj;
module.exports.throwIfNotFoundMany = entityGuards.throwIfNotFoundMany;
module.exports.throwIfNotFoundWithMessage = entityGuards.throwIfNotFoundWithMessage;
module.exports.entityExists = entityGuards.entityExists;
module.exports.assertEntityExists = entityGuards.assertEntityExists;

// Export response helper functions
module.exports.sendJsonResponse = responseHelpers.sendJsonResponse;
module.exports.sendSuccessResponse = responseHelpers.sendSuccessResponse;
module.exports.sendCreatedResponse = responseHelpers.sendCreatedResponse;
module.exports.sendErrorResponse = responseHelpers.sendErrorResponse;
module.exports.sendValidationErrorResponse = responseHelpers.sendValidationErrorResponse;
module.exports.sendNotFoundResponse = responseHelpers.sendNotFoundResponse;
module.exports.sendUnauthorizedResponse = responseHelpers.sendUnauthorizedResponse;
module.exports.sendForbiddenResponse = responseHelpers.sendForbiddenResponse;
module.exports.sendServerErrorResponse = responseHelpers.sendServerErrorResponse;
module.exports.createResponseHelper = responseHelpers.createResponseHelper;
module.exports.globalErrorHandler = responseHelpers.globalErrorHandler;

// Export utility functions
module.exports.generateUniqueId = () => require('crypto').randomUUID();
module.exports.verboseLog = (message) => console.log(`[VERBOSE] ${message}`);