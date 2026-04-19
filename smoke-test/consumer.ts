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

// ---- Call-site type checks: logger.logStart ----
// logStart(name: string, data?: Record<string, unknown>): Promise<void>
const _loggerLogStart: Promise<void> = logger.logStart('my-operation', { requestId: '123' });
void _loggerLogStart;

// ---- @ts-expect-error: logger.logStart rejects a non-string name argument ----
// @ts-expect-error - number is not assignable to string for name parameter
logger.logStart(42);

// ---- Call-site type checks: logger.logReturn ----
// logReturn(name: string, data?: Record<string, unknown>): Promise<void>
const _loggerLogReturn: Promise<void> = logger.logReturn('my-operation', { result: 'ok' });
void _loggerLogReturn;

// ---- @ts-expect-error: logger.logReturn rejects a non-string name argument ----
// @ts-expect-error - number is not assignable to string for name parameter
logger.logReturn(99);

// ---- Call-site type checks: logger.createEnhancedLogEntry ----
// createEnhancedLogEntry(level: string, message: string, context?: object): EnhancedLogEntry
const _loggerEnhancedEntry: import('../lib/types').EnhancedLogEntry = logger.createEnhancedLogEntry('info', 'hello world', { requestId: 'abc' });
const _loggerEntryTimestamp: string = _loggerEnhancedEntry.timestamp;
const _loggerEntryLevel: string = _loggerEnhancedEntry.level;
void _loggerEntryTimestamp; void _loggerEntryLevel;

// ---- @ts-expect-error: logger.createEnhancedLogEntry rejects a non-string level ----
// @ts-expect-error - number is not assignable to string for level parameter
logger.createEnhancedLogEntry(1, 'message');

// ---- Call-site type checks: logger.getLogQueueMetrics ----
// getLogQueueMetrics(): Record<string, unknown>
const _loggerQueueMetrics: Record<string, unknown> = logger.getLogQueueMetrics();
void _loggerQueueMetrics;

// ---- @ts-expect-error: logger.getLogQueueMetrics result is not assignable to string ----
// @ts-expect-error - Record<string, unknown> is not assignable to string
const _loggerQueueMetricsStr: string = logger.getLogQueueMetrics();
void _loggerQueueMetricsStr;

// ---- @ts-expect-error: logger.getLogQueueMetrics takes no arguments ----
// @ts-expect-error - Expected 0 arguments but got 1
logger.getLogQueueMetrics(42);

// ---- Call-site type checks: logger.sanitizeMessage ----
// sanitizeMessage(message: string): string
const _loggerSanitizeMsg: string = logger.sanitizeMessage('hello secret-key-abc123');
void _loggerSanitizeMsg;

// ---- @ts-expect-error: logger.sanitizeMessage rejects a non-string argument ----
// @ts-expect-error - number is not assignable to string for message parameter
logger.sanitizeMessage(42);

// ---- Call-site type checks: logger.sanitizeContext ----
// sanitizeContext(context: Record<string, unknown>): Record<string, unknown>
const _loggerSanitizeCtx: Record<string, unknown> = logger.sanitizeContext({ password: 'secret', user: 'alice' });
void _loggerSanitizeCtx;

// ---- @ts-expect-error: logger.sanitizeContext rejects a non-object argument ----
// @ts-expect-error - string is not assignable to Record<string, unknown> for context parameter
logger.sanitizeContext('not-an-object');

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

// forceState is the canonical API on CircuitBreakerInstance for trip/reset:
//   forceState('open')    = trip the breaker (equivalent to "open / trip")
//   forceState('close')   = reset the breaker (equivalent to "reset")
//   forceState('halfOpen') = put in probe mode
_cbInstance.forceState('open');
_cbInstance.forceState('close');
_cbInstance.forceState('halfOpen');

// ---- @ts-expect-error: forceState rejects an invalid state string ----
// @ts-expect-error - 'broken' is not assignable to 'open' | 'close' | 'halfOpen'
_cbInstance.forceState('broken');

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

// MODEL_PROVIDERS is Record<string, string>
const _providerKey: string = Object.values(aiModelManager.MODEL_PROVIDERS)[0] as string;
void _providerKey;

// MODEL_CONFIGS nested shape: models[key].maxTokens is number
const _firstConfig = Object.values(aiModelManager.MODEL_CONFIGS)[0];
const _aiMgrMaxTok: number = (_firstConfig as import('../lib/types').ModelConfig).models[
  (_firstConfig as import('../lib/types').ModelConfig).defaultModel
].maxTokens;
void _aiMgrMaxTok;

// switchModel returns boolean
const _switchResult: boolean = _aiMgr.switchModel('openai');
void _switchResult;

// createLangChainModel is a named export declared as returning `any` in lib/types.d.ts.
// We verify it is callable with an options object; return type is not further constrained
// because the underlying LangChain model type varies by provider at runtime.
const _langChain = createLangChainModel({});
void _langChain;

// ---- @ts-expect-error: aiModelManager.switchModel rejects a number as provider ----
// @ts-expect-error - number is not assignable to string for provider parameter
_aiMgr.switchModel(42);

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

// ---- Call-site type checks: utils namespace ----
// deepClone<T> returns T (generic identity clone)
const _utilsCloned: { a: number } = utils.deepClone({ a: 1 });
void _utilsCloned;
// createTimer returns an object with elapsed() and elapsedMs() returning number
const _utilsTimer = utils.createTimer();
const _utilsElapsed: number = _utilsTimer.elapsed();
const _utilsElapsedMs: number = _utilsTimer.elapsedMs();
void _utilsElapsed; void _utilsElapsedMs;
// formatErrorMessage returns string
const _utilsFmtMsg: string = utils.formatErrorMessage(new Error('boom'), 'test-context');
void _utilsFmtMsg;

// ---- @ts-expect-error: utils.formatErrorMessage rejects a non-string context argument ----
// @ts-expect-error - number is not assignable to string for context parameter
utils.formatErrorMessage(new Error('x'), 42);

// ---- Call-site type checks: envUtils namespace ----
// validateEnvironment returns Promise<EnvHealthReport>
const _evValidatePromise: Promise<import('../lib/types').EnvHealthReport> = envUtils.validateEnvironment({ required: ['NODE_ENV'] });
void _evValidatePromise;
// getEnvHealthSync returns EnvHealthReport (synchronous)
const _evHealthSync: import('../lib/types').EnvHealthReport = envUtils.getEnvHealthSync(['NODE_ENV'], []);
const _evIsHealthy: boolean = _evHealthSync.isHealthy;
const _evEnv: string | undefined = _evHealthSync.environment;
void _evIsHealthy; void _evEnv;

// ---- @ts-expect-error: envUtils.getEnvHealthSync rejects non-array first argument ----
// @ts-expect-error - string is not assignable to string[] for requiredVars parameter
envUtils.getEnvHealthSync('NODE_ENV');

// ---- Call-site type checks: sanitization namespace ----
// sanitizeMessage returns string
const _sanMsg: string = sanitization.sanitizeMessage('hello secret-key-abc123');
void _sanMsg;
// sanitizeContext returns Record<string, unknown>
const _sanCtx: Record<string, unknown> = sanitization.sanitizeContext({ password: 'hunter2', user: 'alice' });
void _sanCtx;
// maskKey returns string
const _sanMasked: string = sanitization.maskKey('api_key');
void _sanMasked;

// ---- @ts-expect-error: sanitization.sanitizeMessage rejects a non-string argument ----
// @ts-expect-error - number is not assignable to string for message parameter
sanitization.sanitizeMessage(42);

// ---- Call-site type checks: queueManager namespace ----
// getQueueMetrics returns QueueMetrics (rejectCount, activeCount, totalProcessed, queueSize, maxQueueSize, averageProcessingTime)
const _qmMetrics = queueManager.getQueueMetrics();
const _qmRejectCount: number = _qmMetrics.rejectCount;
const _qmActiveCount: number = _qmMetrics.activeCount;
const _qmTotalProcessed: number = _qmMetrics.totalProcessed;
const _qmQueueSize: number = _qmMetrics.queueSize;
void _qmRejectCount; void _qmActiveCount; void _qmTotalProcessed; void _qmQueueSize;
// enforceQueueLimit returns boolean
const _qmEnforced: boolean = queueManager.enforceQueueLimit(10, 100);
void _qmEnforced;

// ---- @ts-expect-error: queueManager.enforceQueueLimit rejects string arguments ----
// @ts-expect-error - string is not assignable to number for currentLength parameter
queueManager.enforceQueueLimit('ten', 100);

// ---- Call-site type checks: moduleInitializer namespace ----
// initializeModule returns Promise<null>
const _miInit: Promise<null> = moduleInitializer.initializeModule();
void _miInit;
// initializeModule accepts a ModuleInitOptions object
const _miInitWithOpts: Promise<null> = moduleInitializer.initializeModule({ module: 'test', version: '1.0.0', environment: 'test' });
void _miInitWithOpts;
// initializeModuleESM returns Promise<null>
const _miInitESM: Promise<null> = moduleInitializer.initializeModuleESM();
void _miInitESM;
// initializeModuleESM accepts a ModuleInitOptions object
const _miInitESMWithOpts: Promise<null> = moduleInitializer.initializeModuleESM({ module: 'esm-test', version: '2.0.0' });
void _miInitESMWithOpts;
// shouldInitialize returns boolean
const _miShouldInit: boolean = moduleInitializer.shouldInitialize();
void _miShouldInit;
// logModuleInit returns void
const _miLogInit: void = moduleInitializer.logModuleInit('my-module', { key: 'value' });
void _miLogInit;
// logModuleInit accepts a module name with no metadata
const _miLogInitNoMeta: void = moduleInitializer.logModuleInit('my-module');
void _miLogInitNoMeta;

// ---- @ts-expect-error: initializeModule rejects a non-object argument ----
// @ts-expect-error - string is not assignable to ModuleInitOptions for options parameter
moduleInitializer.initializeModule('bad-argument');

// ---- @ts-expect-error: initializeModuleESM rejects a non-object argument ----
// @ts-expect-error - string is not assignable to ModuleInitOptions for options parameter
moduleInitializer.initializeModuleESM('bad-esm-argument');

// ---- @ts-expect-error: shouldInitialize result is not assignable to string ----
// @ts-expect-error - boolean is not assignable to string
const _miShouldInitStr: string = moduleInitializer.shouldInitialize();
void _miShouldInitStr;

// ---- @ts-expect-error: logModuleInit rejects a non-string moduleName ----
// @ts-expect-error - number is not assignable to string for moduleName parameter
moduleInitializer.logModuleInit(42);

export {};

