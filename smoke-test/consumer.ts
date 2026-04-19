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
  simpleLogger,
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
  logger,
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
void logger;
void simpleLogger;

// ---- Call-site type checks: logger ----
// logger.info accepts a string message
const _loggerInfoResult: void = logger.info('hello from logger');
void _loggerInfoResult;
// logger.logInfo returns Promise<void>
const _loggerLogInfo: Promise<void> = logger.logInfo('test message', { key: 'value' });
void _loggerLogInfo;
// logger.createPerformanceTimer returns a PerformanceTimer (has .elapsed and .elapsedMs)
const _loggerTimer = logger.createPerformanceTimer();
const _loggerElapsed: number = _loggerTimer.elapsed();
void _loggerElapsed;
// simpleLogger.info accepts a string message
const _simpleLoggerResult: void = simpleLogger.info('hello from simpleLogger');
void _simpleLoggerResult;

// ---- @ts-expect-error: confirm logger.info rejects non-string first argument ----
// @ts-expect-error - number is not assignable to string | Record<string,unknown>
logger.info(42);

// ---- Call-site type checks: config ----
// config.getEnv returns unknown
const _configEnvVal: unknown = config.getEnv('PORT');
void _configEnvVal;
// config.getInt returns number
const _configIntVal: number = config.getInt('PORT', 3000);
void _configIntVal;
// config.getBool returns boolean
const _configBoolVal: boolean = config.getBool('DEBUG', false);
void _configBoolVal;
// config.validateRequiredVars returns ConfigValidationResult (has isValid, missing, present)
const _configValidation = config.validateRequiredVars(['NODE_ENV']);
const _configIsValid: boolean = _configValidation.isValid;
const _configMissing: string[] = _configValidation.missing;
void _configIsValid;
void _configMissing;

// ---- @ts-expect-error: confirm config.getInt rejects a non-numeric default ----
// @ts-expect-error - string is not assignable to number for defaultValOrMin
config.getInt('PORT', 'not-a-number');

// ---- Call-site type checks: circuitBreaker ----
// createCircuitBreaker wraps an async operation and returns a CircuitBreakerInstance
type _AsyncFn = (x: number) => Promise<string>;
const _cbInstance = circuitBreaker.createCircuitBreaker(
  ((_x: number) => Promise.resolve('ok')) as _AsyncFn,
  'test-service',
  { failureThreshold: 5, recoveryTimeoutMs: 1000, monitoringPeriodMs: 10000 }
);
// getState returns string
const _cbState: string = _cbInstance.getState();
void _cbState;
// getStats returns Record<string, unknown>
const _cbStats: Record<string, unknown> = _cbInstance.getStats();
void _cbStats;

// ---- @ts-expect-error: confirm createCircuitBreaker rejects non-async operation ----
// @ts-expect-error - sync function does not satisfy the constraint (...) => Promise<any>
circuitBreaker.createCircuitBreaker((_x: number) => _x + 1, 'sync-service');

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

// ---- Call-site type checks: errorTypes ----
// createTypedError returns StandardError (has .type, .code, .statusCode, .severity)
const _etError = errorTypes.createTypedError('Something failed', 'system');
const _etErrorType: string = _etError.type;
const _etErrorCode: string = _etError.code;
const _etStatusCode: number = _etError.statusCode;
void _etErrorType; void _etErrorCode; void _etStatusCode;
// createStandardError returns StandardError
const _etStdError = errorTypes.createStandardError('ERR_001', 'Not found', 'not_found');
const _etStdSeverity: string = _etStdError.severity;
void _etStdSeverity;
// handleSimpleError returns SimpleErrorResult (success is always false, error.code is string)
const _etSimple = errorTypes.handleSimpleError(new Error('oops'));
const _etSimpleCode: string = _etSimple.error.code;
const _etSimpleMsg: string = _etSimple.error.message;
void _etSimpleCode; void _etSimpleMsg;
// attempt<T> wraps in Result (ok: true => value is T)
type _ETAttemptRes = Awaited<ReturnType<typeof errorTypes.attempt<string>>>;
type _ETAttemptOk = Extract<_ETAttemptRes, { ok: true }>['value'];
const _etAttemptStr: string = null as unknown as _ETAttemptOk;
void _etAttemptStr;

// ---- @ts-expect-error: errorTypes.createTypedError rejects non-string message ----
// @ts-expect-error - number is not assignable to string for message parameter
errorTypes.createTypedError(42, 'system');

// ---- Call-site type checks: entityGuards ----
// entityExists returns boolean
const _egExists: boolean = entityGuards.entityExists(maybeUser);
void _egExists;
// throwIfNotFoundWithMessage<T> narrows T | null | undefined → T
const _egUser: User = entityGuards.throwIfNotFoundWithMessage(maybeUser, 'User not found');
void _egUser;
// throwIfNotFoundObj returns ThrowIfNotFoundOutput (has .entity and .found)
type _ThrowIfNotFoundOutput<T> = import('../lib/types').ThrowIfNotFoundOutput<T>;
const _egObjResult: _ThrowIfNotFoundOutput<User> = entityGuards.throwIfNotFoundObj({ entity: maybeUser, entityName: 'user' });
const _egFound: boolean = _egObjResult.found;
void _egFound;

// ---- @ts-expect-error: entityGuards.throwIfNotFound rejects non-string entityName ----
// @ts-expect-error - number is not assignable to string for entityName parameter
entityGuards.throwIfNotFound(maybeUser, 42);

// ---- Call-site type checks: responseHelpers ----
// HTTP_STATUS.OK is typed as the literal 200
const _rhStatusOk: 200 = responseHelpers.HTTP_STATUS.OK;
void _rhStatusOk;
// HTTP_STATUS.NOT_FOUND is typed as the literal 404
const _rhStatusNotFound: 404 = responseHelpers.HTTP_STATUS.NOT_FOUND;
void _rhStatusNotFound;
// DEFAULT_MESSAGES.NOT_FOUND is a string
const _rhDefaultMsg: string = responseHelpers.DEFAULT_MESSAGES.NOT_FOUND;
void _rhDefaultMsg;
// createResponseBuilder returns a ResponseBuilder instance with typed methods
declare const _mockRes: import('../lib/types').MockResponse;
const _rhBuilder = responseHelpers.createResponseBuilder(_mockRes);
// setStatus returns ResponseBuilder (fluent)
const _rhBuilderChained: typeof _rhBuilder = _rhBuilder.setStatus(200);
void _rhBuilderChained;
// build() returns object
const _rhBuilt: object = _rhBuilder.build();
void _rhBuilt;

// ---- @ts-expect-error: HTTP_STATUS.OK (200) is not assignable to string ----
// @ts-expect-error - 200 is not assignable to string
const _rhStatusStr: string = responseHelpers.HTTP_STATUS.OK;
void _rhStatusStr;

// ---- Call-site type checks: dependencyInterfaces ----
// createDefaultErrorHandlingDeps returns QerrorsCoreDeps
const _diDeps = dependencyInterfaces.createDefaultErrorHandlingDeps();
const _diQerrFn: Function = _diDeps.qerrors;
const _diErrSevFn: Function = _diDeps.logErrorWithSeverity;
void _diQerrFn; void _diErrSevFn;
// getDefaultQerrorsCoreDeps returns QerrorsCoreDeps
const _diDefaultDeps = dependencyInterfaces.getDefaultQerrorsCoreDeps();
const _diDefaultSev: Record<string, string> = _diDefaultDeps.ErrorSeverity;
void _diDefaultSev;
// getErrorSeverity returns Record<string, string>
const _diSeverity: Record<string, string> = dependencyInterfaces.getErrorSeverity();
void _diSeverity;
// qerr returns Promise<void>
const _diQerrPromise: Promise<void> = dependencyInterfaces.qerr(new Error('test'), 'ctx');
void _diQerrPromise;

// ---- @ts-expect-error: dependencyInterfaces.getErrorSeverity result is not a number ----
// @ts-expect-error - Record<string, string> is not assignable to number
const _diSeverityNum: number = dependencyInterfaces.getErrorSeverity();
void _diSeverityNum;

export {};
