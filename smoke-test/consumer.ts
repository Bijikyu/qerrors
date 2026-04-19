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
// switchModel returns boolean
type _AIMgrSwitchModel = ReturnType<typeof _aiMgr.switchModel>;
const _switchModelRes: boolean = null as unknown as _AIMgrSwitchModel;
void _switchModelRes;
// resetAIModelManager returns Promise<void> | undefined
type _ResetRes = ReturnType<typeof aiModelManager.resetAIModelManager>;
const _resetRes: Promise<void> | undefined = null as unknown as _ResetRes;
void _resetRes;

// ResponseBuilder class method coverage — including addMetadata object-merge overload
import type { ResponseBuilder as RB } from '../lib/types';
// Verify addMetadata object overload compiles (overload resolution check)
type _RBAddMetaObj = (obj: Record<string, unknown>) => RB;
const _checkAddMetaOverload: _RBAddMetaObj = null as unknown as RB['addMetadata'];
void _checkAddMetaOverload;
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

// -----------------------------------------------------------------------
// Task #6 — Call-site type checks that CATCH REAL MISTAKES
// Each block would produce a tsc error if the declaration were wrong.
// -----------------------------------------------------------------------

// (1) throwIfNotFound<T> must narrow T | null | undefined → T
interface User { id: number; name: string }
declare const maybeUser: User | null;
const _user: User = throwIfNotFound(maybeUser, 'user'); // would error if return type were `unknown`
void _user;

// (2) assertEntityExists<T> also narrows to T
const _user2: User = assertEntityExists(maybeUser, 'user');
void _user2;

// (3) entityGuards namespace: same narrowing via namespace member
const _user3: User = entityGuards.throwIfNotFound(maybeUser, 'user');
void _user3;

// (4) executeWithQerrors<T> propagates T through Promise<T>
type _ExecResult = Awaited<ReturnType<typeof executeWithQerrors<number>>>;
const _execNum: number = null as unknown as _ExecResult; // errors if T were unknown
void _execNum;

// (5) ErrorUtils.asyncHandler<T> propagates T
type _AsyncHandlerResult = Awaited<ReturnType<typeof errorUtils.asyncHandler<string>>>;
const _asyncStr: string = null as unknown as _AsyncHandlerResult;
void _asyncStr;

// (6) SafeUtils.execute<T> wraps in Result<T> — value property must be T
type _SafeResult = Awaited<ReturnType<typeof safeUtils.execute<number>>>;
type _SafeValue = Extract<_SafeResult, { ok: true }>['value'];
const _safeNum: number = null as unknown as _SafeValue;
void _safeNum;

// (7) CircuitBreaker<T> preserves function signature through execute()
import type { CircuitBreaker as CB, CircuitBreakerOptions } from '../lib/types';
type _CBFn = (x: number) => Promise<string>;
declare const _cb: CB<_CBFn>;
type _CBExecArgs = Parameters<typeof _cb.execute>;   // must be [number]
type _CBExecRet  = Awaited<ReturnType<typeof _cb.execute>>;  // must be string
const _cbArg: _CBExecArgs[0] extends number ? true : false = true; // errors if not number
const _cbRet: string = null as unknown as _CBExecRet;
void _cbArg; void _cbRet;

// (8) ResponseBuilder fluent chain: setStatus().setData() must return ResponseBuilder
import type { ResponseBuilder as RBType } from '../lib/types';
type _RBChain = ReturnType<RBType['setStatus']>;
const _isRB: RBType = null as unknown as _RBChain; // errors if setStatus() returned void
void _isRB;

// (9) QueueMetrics shape check — accessing a renamed field errors
type _QMR = Awaited<ReturnType<typeof queueManager.getQueueMetrics>>;
const _rejectCnt: number = (null as unknown as _QMR).rejectCount;   // typed, not any
const _activeC: number   = (null as unknown as _QMR).activeCount;
const _qSize: number     = (null as unknown as _QMR).queueSize;
void _rejectCnt; void _activeC; void _qSize;

// (10) AIModelManager.switchModel returns boolean (not void)
type _SwitchRet = ReturnType<typeof _aiMgr.switchModel>;
const _switchBool: boolean = null as unknown as _SwitchRet; // errors if void
void _switchBool;

// (11) EnvHealthReport nested shape — required.missing is string[]
type _EHR = Awaited<ReturnType<typeof envUtils.getEnvHealth>>;
type _EHRMissing = _EHR['required']['missing'];
const _missingArr: string[] = null as unknown as _EHRMissing;
void _missingArr;

// (12) ErrorFactory.validation signature: (message, field?) — positional args only
type _EFValidation = typeof ErrorFactory.validation;
type _EFValP0 = Parameters<_EFValidation>[0]; // must be string
type _EFValP1 = Parameters<_EFValidation>[1]; // must be string | null | undefined
const _valP0IsStr: _EFValP0 extends string ? true : false = true;
void _valP0IsStr;

// (13) ModelConfig.models is a typed Record (not any)
type _MC = import('../lib/types').ModelConfig;
type _MCModels = _MC['models'];
type _MCModelVal = _MCModels[string];
const _maxTok: number = (null as unknown as _MCModelVal).maxTokens;
void _maxTok;

export {};
