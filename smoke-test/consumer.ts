import qerrors, {
  sanitizeMessage,
  sanitizeContext,
  addCustomSanitizationPattern,
  clearCustomSanitizationPatterns,
  sanitizeWithCustomPatterns,
  logDebug,
  logInfo,
  logWarn,
  logError,
  logFatal,
  logAudit,
  createPerformanceTimer,
  LOG_LEVELS,
  ServiceError,
  ErrorTypes,
  ErrorSeverity,
  ErrorFactory,
  errorUtils,
  safeUtils,
  throwIfNotFound,
  throwIfNotFoundObj,
  throwIfNotFoundMany,
  throwIfNotFoundWithMessage,
  entityExists,
  assertEntityExists,
  sendJsonResponse,
  sendSuccessResponse,
  sendCreatedResponse,
  sendErrorResponse,
  sendNotFoundResponse,
  sendUnauthorizedResponse,
  sendForbiddenResponse,
  sendServerErrorResponse,
  createResponseHelper,
  globalErrorHandler,
  generateUniqueId,
  getEnv,
  getInt,
  getMissingEnvVars,
  throwIfMissingEnvVars,
  warnIfMissingEnvVars,
  validateRequiredEnvVars,
  warnMissingEnvVars,
  NODE_ENV,
  DEFAULT_ERROR_MESSAGE,
  initializeModule,
  initializeModuleESM,
  shouldInitialize,
  qerr,
  getErrorSeverity,
  resetDefaultQerrorsCoreDeps,
  createQerrorsCoreDeps,
  getDefaultQerrorsCoreDeps,
  createDefaultErrorHandlingDeps,
  attempt,
  executeWithQerrors,
  formatErrorMessage,
  safeRun,
  deepClone,
  createTimer,
  generateErrorId,
  cleanup,
  getQueueStats,
  getQueueRejectCount,
  startQueueMetrics,
  stopQueueMetrics,
  verboseLog,
  MODEL_PROVIDERS,
  getAIModelManager,
  resetAIModelManager,
  createLangChainModel,
  logModuleInit,
  // namespace exports
  errorTypes,
  sanitization,
  queueManager,
  utils,
  config,
  envUtils,
  aiModelManager,
  moduleInitializer,
  dependencyInterfaces,
  entityGuards,
  responseHelpers,
  circuitBreaker,
} from '@bijikyu/qerrors';

void qerrors;
void sanitizeMessage;
void sanitizeContext;
void addCustomSanitizationPattern;
void clearCustomSanitizationPatterns;
void sanitizeWithCustomPatterns;
void logDebug;
void logInfo;
void logWarn;
void logError;
void logFatal;
void logAudit;
void createPerformanceTimer;
void LOG_LEVELS;
void ServiceError;
void ErrorTypes;
void ErrorSeverity;
void ErrorFactory;
void errorUtils;
void safeUtils;
void throwIfNotFound;
void throwIfNotFoundObj;
void throwIfNotFoundMany;
void throwIfNotFoundWithMessage;
void entityExists;
void assertEntityExists;
void sendJsonResponse;
void sendSuccessResponse;
void sendCreatedResponse;
void sendErrorResponse;
void sendNotFoundResponse;
void sendUnauthorizedResponse;
void sendForbiddenResponse;
void sendServerErrorResponse;
void createResponseHelper;
void globalErrorHandler;
void generateUniqueId;
void getEnv;
void getInt;
void getMissingEnvVars;
void throwIfMissingEnvVars;
void warnIfMissingEnvVars;
void validateRequiredEnvVars;
void warnMissingEnvVars;
void NODE_ENV;
void DEFAULT_ERROR_MESSAGE;
void initializeModule;
void initializeModuleESM;
void shouldInitialize;
void qerr;
void getErrorSeverity;
void resetDefaultQerrorsCoreDeps;
void createQerrorsCoreDeps;
void getDefaultQerrorsCoreDeps;
void createDefaultErrorHandlingDeps;
void attempt;
void executeWithQerrors;
void formatErrorMessage;
void safeRun;
void deepClone;
void createTimer;
void generateErrorId;
void cleanup;
void getQueueStats;
void getQueueRejectCount;
void startQueueMetrics;
void stopQueueMetrics;
void verboseLog;
void MODEL_PROVIDERS;
void getAIModelManager;
void resetAIModelManager;
void createLangChainModel;
void logModuleInit;
void errorTypes;
void sanitization;
void queueManager;
void utils;
void config;
void envUtils;
void aiModelManager;
void moduleInitializer;
void dependencyInterfaces;
void entityGuards;
void responseHelpers;
void circuitBreaker;

// Verify members of namespace exports are typed (not any)
const _sanitized: string = sanitization.sanitizeMessage('test');
void _sanitized;
const _masked: string = sanitization.maskKey('password');
void _masked;
const _missing: string[] = envUtils.getMissingEnvVars(['NODE_ENV']);
void _missing;
const _rejectCount: number = queueManager.getQueueRejectCount();
void _rejectCount;
const _aiMgr = aiModelManager.getAIModelManager();
void _aiMgr;

export {};
