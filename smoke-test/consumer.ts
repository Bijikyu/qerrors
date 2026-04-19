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

// AIModelManager class method coverage
type _AIMgrGetAvailable = ReturnType<typeof _aiMgr.getAvailableModels>;
const _getAvailRes: string[] = null as unknown as _AIMgrGetAvailable;
void _getAvailRes;
type _AIMgrCacheStats = ReturnType<typeof _aiMgr.getCacheStats>;
const _cacheStats: Record<string, unknown> = null as unknown as _AIMgrCacheStats;
void _cacheStats;
type _AIMgrCleanup = ReturnType<typeof _aiMgr.cleanup>;
const _cleanupRes: Promise<void> = null as unknown as _AIMgrCleanup;
void _cleanupRes;

// ResponseBuilder class method coverage
import type { ResponseBuilder as RB } from '../lib/types';
type _RBSetSuccess = ReturnType<RB['setSuccess']>;
const _setSuccessRes: RB = null as unknown as _RBSetSuccess;
void _setSuccessRes;
type _RBSetMessage = ReturnType<RB['setMessage']>;
const _setMsgRes: RB = null as unknown as _RBSetMessage;
void _setMsgRes;
type _RBAddMeta = ReturnType<RB['addMetadata']>;
const _addMetaRes: RB = null as unknown as _RBAddMeta;
void _addMetaRes;
type _RBAddHeader = ReturnType<RB['addHeader']>;
const _addHdrRes: RB = null as unknown as _RBAddHeader;
void _addHdrRes;
type _RBSetPagination = ReturnType<RB['setPagination']>;
const _setPagRes: RB = null as unknown as _RBSetPagination;
void _setPagRes;
type _RBBuild = ReturnType<RB['build']>;
const _buildRes: object = null as unknown as _RBBuild;
void _buildRes;

export {};
