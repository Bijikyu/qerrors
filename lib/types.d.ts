/**
 * @bijikyu/qerrors – TypeScript type definitions
 *
 * Supports both ESM named imports and CommonJS default import patterns.
 * TypeScript consumers using moduleResolution "node16" or "bundler" will
 * resolve these types via the "types" condition in package.json exports.
 */

/* ------------------------------------------------------------------ */
/*  Supporting interfaces                                               */
/* ------------------------------------------------------------------ */

export interface ModuleInitOptions {
  module?: string;
  version?: string;
  environment?: string;
}

export interface QerrorsCoreDeps {
  qerrors: Function;
  logErrorWithSeverity: Function;
  withErrorHandling: Function;
  ErrorSeverity: Record<string, string>;
}

export interface LogErrorWithSeverityDIOptions {
  error: unknown;
  functionName: string;
  context?: Record<string, unknown>;
  severity?: string;
  deps?: QerrorsCoreDeps;
}

export interface ThrowIfNotFoundInput<T> {
  entity: T | null | undefined;
  entityName: string;
}

export interface ThrowIfNotFoundOutput<T> {
  entity: T | null;
  found: boolean;
}

export interface ExecuteWithQerrorsOptions<T> {
  opName: string;
  operation: () => Promise<T>;
  context?: Record<string, unknown>;
  failureMessage: string;
  errorCode?: string;
  errorType?: string;
  logMessage?: string;
  rethrow?: boolean;
  fallbackValue?: T;
}

export interface ResponseOptions {
  includeProcessingTime?: boolean;
  startTime?: number | null;
  requestId?: string | null;
  processingTime?: number | null;
}

export interface ResponseHelper {
  success: (data: any, options?: ResponseOptions) => any;
  created: (data: any) => any;
  error: (status: number, message: string, details?: any, options?: ResponseOptions) => any;
  validation: (errors: any[], options?: ResponseOptions) => any;
  notFound: (message?: string) => any;
  unauthorized: (message?: string) => any;
  forbidden: (message?: string) => any;
  serverError: (message?: string) => any;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  monitoringPeriodMs: number;
  timeoutMs?: number;
}

export interface ServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastFailureTime?: number;
}

export type CircuitStateType = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export declare class CircuitBreaker<T extends (...args: any[]) => Promise<any>> {
  constructor(operation: T, serviceName: string, options: CircuitBreakerOptions);
  execute(...args: Parameters<T>): Promise<ReturnType<T>>;
  getState(): CircuitStateType;
  getMetrics(): ServiceMetrics;
  getSuccessRate(): number;
  getFailureRate(): number;
  reset(): void;
  forceOpen(): void;
  isRequestAllowed(): boolean;
}

export declare class ServiceError extends Error {
  constructor(message: string, type: string, context?: Record<string, unknown>, cause?: Error | null);
  type: string;
  context: Record<string, unknown>;
  cause: Error | null;
  statusCode: number;
  severity: string;
  timestamp: string;
  toJSON(): Record<string, unknown>;
}

export type Result<T, E = ServiceError> =
  | { success: true; data: T }
  | { success: false; error: E };

export interface ErrorUtils {
  validation: (field: string, value?: unknown) => ServiceError;
  authentication: (serviceName: string) => ServiceError;
  authorization: (action: string) => ServiceError;
  externalApi: (serviceName: string, originalError: Error) => ServiceError;
  internal: (message: string, context?: Record<string, unknown>) => ServiceError;
  wrap: (error: unknown, defaultMessage: string) => ServiceError;
  asyncHandler: <T>(operation: () => Promise<T>, errorMessage: string) => Promise<T>;
}

export interface SafeUtils {
  execute: <T>(operation: () => Promise<T>) => Promise<Result<T>>;
  validate: <T>(value: unknown, validator: (v: unknown) => T, field: string) => Result<T>;
}

export interface SafeAsyncWrapperOptions<T extends any[], R> {
  modulePath?: string;
  functionName?: string;
  fallbackFn?: (...args: T) => R | Promise<R>;
  silent?: boolean;
  errorMessage?: string;
}

export interface ErrorTypeConstants {
  VALIDATION: 'validation';
  AUTHENTICATION: 'authentication';
  AUTHORIZATION: 'authorization';
  NOT_FOUND: 'not_found';
  RATE_LIMIT: 'rate_limit';
  NETWORK: 'network';
  DATABASE: 'database';
  SYSTEM: 'system';
  CONFIGURATION: 'configuration';
}

export interface ErrorSeverityConstants {
  LOW: 'low';
  MEDIUM: 'medium';
  HIGH: 'high';
  CRITICAL: 'critical';
}

export interface LogLevelConfig {
  priority: number;
  color: string;
  name: string;
}

export interface LogLevels {
  DEBUG: LogLevelConfig;
  INFO: LogLevelConfig;
  WARN: LogLevelConfig;
  ERROR: LogLevelConfig;
  FATAL: LogLevelConfig;
  AUDIT: LogLevelConfig;
}

export interface WinstonLeveledLogMethod {
  (message: string, ...meta: unknown[]): void;
  (infoObject: Record<string, unknown>): void;
}

export interface WinstonLogger {
  log(level: string, message: string, ...meta: unknown[]): void;
  log(entry: { level: string; message: string; [key: string]: unknown }): void;
  error: WinstonLeveledLogMethod;
  warn: WinstonLeveledLogMethod;
  info: WinstonLeveledLogMethod;
  http: WinstonLeveledLogMethod;
  verbose: WinstonLeveledLogMethod;
  debug: WinstonLeveledLogMethod;
  silly: WinstonLeveledLogMethod;
}

export interface LoggerModule extends WinstonLogger {
  logStart(name: string, data?: Record<string, unknown>): Promise<void>;
  logReturn(name: string, data?: Record<string, unknown>): Promise<void>;
  logDebug(message: string, context?: Record<string, unknown>, requestId?: string): Promise<void>;
  logInfo(message: string, context?: Record<string, unknown>, requestId?: string): Promise<void>;
  logWarn(message: string, context?: Record<string, unknown>, requestId?: string): Promise<void>;
  logError(message: string, context?: Record<string, unknown>, requestId?: string): Promise<void>;
  logFatal(message: string, context?: Record<string, unknown>, requestId?: string): Promise<void>;
  logAudit(message: string, context?: Record<string, unknown>, requestId?: string): Promise<void>;
  createPerformanceTimer(): PerformanceTimer;
  sanitizeMessage(message: string): string;
  sanitizeContext(context: Record<string, unknown>): Record<string, unknown>;
  createEnhancedLogEntry(level: string, message: string, context?: object): EnhancedLogEntry;
  LOG_LEVELS: LogLevels;
  simpleLogger: WinstonLogger;
  createSimpleWinstonLogger(options?: object): WinstonLogger;
  getLogQueueStats(): Record<string, unknown>;
  getLogQueueMetrics(): Record<string, unknown>;
}

export interface ConfigValidationResult {
  isValid: boolean;
  missing: string[];
  present: string[];
}

export interface ConfigSummary {
  environment: string;
  hasEnvFile: boolean;
  configuredVars: string[];
  totalVars: number;
}

export interface ConfigModule {
  defaults: Record<string, unknown>;
  getEnv(name: string, defaultVal?: unknown): unknown;
  getInt(name: string, defaultValOrMin?: number, min?: number): number;
  getBool(name: string, defaultVal?: unknown): boolean;
  validateRequiredVars(varNames: string[]): ConfigValidationResult;
  safeRun<T>(name: string, fn: () => T, fallback: T, info?: string): T;
  getConfigSummary(): Promise<ConfigSummary>;
  getConfigSummarySync(): ConfigSummary;
  loadDotenv(): void;
}

export interface CircuitBreakerInstance<T extends (...args: any[]) => Promise<any>> {
  execute(...args: Parameters<T>): ReturnType<T>;
  getState(): string;
  getStats(): Record<string, unknown>;
  forceState(state: 'open' | 'close' | 'halfOpen'): void;
}

export interface CircuitBreakerModule {
  createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
    operation: T,
    serviceName: string,
    options?: Partial<CircuitBreakerOptions>
  ): CircuitBreakerInstance<T>;
}

export interface StandardError extends Error {
  type: string;
  code: string;
  context: object;
  statusCode: number;
  severity: string;
}

export interface ErrorFactoryInterface {
  validation(message: string, field?: string | null, context?: object): StandardError;
  authentication(message?: string, context?: object): StandardError;
  authorization(message?: string, context?: object): StandardError;
  notFound(resource: string, id?: string, context?: object): StandardError;
  rateLimit(message?: string, context?: object): StandardError;
  network(service: string, message?: string, context?: object): StandardError;
  database(operation?: string, context?: object): StandardError;
  system(message?: string, component?: string, context?: object): StandardError;
  configuration(message?: string, context?: object): StandardError;
  from(error: unknown, meta?: object): Error;
}

export interface PerformanceTimer {
  elapsed(): number;
  elapsedMs(): number;
  reset(): void;
}

export interface EnhancedLogEntry {
  timestamp: string;
  level: string;
  message: string;
  context: object;
  requestId: string | null;
  service: string;
  environment: string;
  memoryUsage: NodeJS.MemoryUsage;
}

export interface MockResponse {
  statusCode: number;
  body: any;
  status(code: number): MockResponse;
  json(data: any): MockResponse;
  send(data: any): MockResponse;
}

export interface MockRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: any;
  params: Record<string, string>;
  query: Record<string, string>;
  ip: string;
}

/* ---- errorTypes namespace ---- */

export interface SimpleErrorResult {
  success: false;
  error: {
    code: string;
    message: string;
    type: string;
    severity: string;
    context: Record<string, unknown>;
    timestamp: string;
  };
}

export interface ErrorTypesModule {
  ServiceError: typeof ServiceError;
  errorUtils: ErrorUtils;
  safeUtils: SafeUtils;
  createTypedError(message: string, type: string, code?: string | null, context?: object): StandardError;
  createStandardError(code: string, message: string, type: string, context?: object): StandardError;
  ErrorTypes: ErrorTypeConstants;
  ErrorSeverity: ErrorSeverityConstants;
  ERROR_STATUS_MAP: Record<string, number>;
  ERROR_SEVERITY_MAP: Record<string, string>;
  ErrorFactory: ErrorFactoryInterface;
  handleSimpleError(error: unknown, context?: object): SimpleErrorResult;
  errorMiddleware(err: Error, req: any, res: any, next: Function): void;
  attempt<T>(fn: () => T | Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }>;
  executeWithQerrors<T>(options: ExecuteWithQerrorsOptions<T>): Promise<T>;
}

/* ---- sanitization namespace ---- */

export interface SanitizationModule {
  sanitizeMessage(message: string): string;
  sanitizeContext(context: Record<string, unknown>): Record<string, unknown>;
  maskKey(key: string): string;
}

/* ---- queueManager namespace ---- */

export interface QueueMetrics {
  rejectCount: number;
  activeCount: number;
  totalProcessed: number;
  averageProcessingTime: number;
  queueSize: number;
  maxQueueSize: number;
}

export interface QueueManagerModule {
  createLimiter(concurrency?: number): Function;
  getQueueRejectCount(): number;
  getQueueMetrics(): QueueMetrics;
  logQueueMetrics(): void;
  startQueueMetrics(intervalMs?: number): void;
  stopQueueMetrics(): void;
  startAdviceCleanup(purgeFunction: () => void, intervalMs?: number): void;
  stopAdviceCleanup(): void;
  enforceQueueLimit(currentLength: number, maxLength: number): boolean;
  _getStateManager(): object;
}

/* ---- utils namespace ---- */

export interface UtilsModule {
  createEnhancedLogEntry(level: string, message: string, context?: object): EnhancedLogEntry;
  stringifyContext(context: unknown): string;
  safeErrorMessage(error: unknown): string;
  verboseLog(message: string, meta?: Record<string, unknown>): void;
  createPerformanceTimer(): PerformanceTimer;
  safeLogError(message: string, details?: Record<string, unknown>): Promise<void>;
  safeLogInfo(message: string, details?: Record<string, unknown>): Promise<void>;
  safeLogWarn(message: string, details?: Record<string, unknown>): Promise<void>;
  safeLogDebug(message: string, details?: Record<string, unknown>): Promise<void>;
  safeRun<T>(fn: () => T | Promise<T>): Promise<T | undefined>;
  deepClone<T>(obj: T): T;
  createTimer(): { elapsed(): number; elapsedMs(): number };
  attempt<T>(fn: () => T | Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }>;
  executeWithQerrors<T>(options: ExecuteWithQerrorsOptions<T>): Promise<T>;
  formatErrorMessage(error: unknown, context: string): string;
  createSafeAsyncWrapper<T extends any[], R>(options: SafeAsyncWrapperOptions<T, R>): (...args: T) => Promise<R | void>;
  createSafeLogger(functionName: string, fallbackLevel?: 'error' | 'warn' | 'log' | 'info'): (message: string, details?: Record<string, unknown>) => Promise<void>;
  createSafeOperation<T extends any[], R>(asyncFn: (...args: T) => Promise<R>, fallbackValue?: R, onError?: (error: unknown, ...args: T) => void): (...args: T) => Promise<R | undefined>;
  safeQerrors(error: unknown, context: string, meta?: Record<string, unknown>): Promise<void>;
  logError(message: string, meta?: Record<string, unknown>): void;
  logInfo(message: string, meta?: Record<string, unknown>): void;
  logWarn(message: string, meta?: Record<string, unknown>): void;
}

/* ---- envUtils namespace ---- */

export interface EnvVarGroupMetrics {
  total: number;
  configured: number;
  missing: string[];
}

export interface EnvHealthSummary {
  totalVars: number;
  configuredVars: number;
}

export interface EnvHealthReport {
  environment: string | undefined;
  hasEnvFile: boolean;
  isHealthy: boolean;
  required: EnvVarGroupMetrics;
  optional: EnvVarGroupMetrics;
  summary: EnvHealthSummary;
}

export interface ValidateEnvironmentOptions {
  required?: string[];
  optional?: string[];
  throwOnError?: boolean;
}

export interface EnvUtilsModule {
  getMissingEnvVars(vars: string[]): string[];
  throwIfMissingEnvVars(vars: string[]): string[];
  warnIfMissingEnvVars(vars: string[], customMessage?: string): boolean;
  validateRequiredEnvVars(vars: string[]): string[];
  warnMissingEnvVars(vars: string[]): boolean;
  hasEnvFile(): Promise<boolean>;
  hasEnvFileSync(): boolean;
  getEnvHealth(requiredVars?: string[], optionalVars?: string[]): Promise<EnvHealthReport>;
  getEnvHealthSync(requiredVars?: string[], optionalVars?: string[]): EnvHealthReport;
  validateEnvironment(options?: ValidateEnvironmentOptions): Promise<EnvHealthReport>;
  validateEnvironmentSync(options?: ValidateEnvironmentOptions): EnvHealthReport;
  NODE_ENV: string | undefined;
  DEFAULT_ERROR_MESSAGE: string;
  loadDotenv(): Promise<void>;
}

/* ---- aiModelManager namespace ---- */

export interface ModelInfo {
  provider: string;
  model: string;
  available: boolean;
}

export interface ModelSettings {
  maxTokens: number;
  temperature: number;
  topP: number;
}

export interface ModelConfig {
  defaultModel: string;
  models: Record<string, ModelSettings>;
  requiredEnvVars: string[];
}

export declare class AIModelManager {
  constructor();
  initializeModel(): void;
  switchModel(provider: string, modelName?: string | null): boolean;
  getCurrentModelInfo(): ModelInfo;
  getAvailableModels(provider?: string): string[];
  analyzeError(errorPrompt: string): Promise<Record<string, unknown> | null>;
  createAnalysisModel(): object | null;
  initializeCacheTracking(): void;
  getCacheStats(): Record<string, unknown>;
  cleanup(): Promise<void>;
}

export interface AIModelManagerModule {
  getAIModelManager(): AIModelManager;
  resetAIModelManager(): Promise<void> | undefined;
  AIModelManager: typeof AIModelManager;
  MODEL_PROVIDERS: Record<string, string>;
  MODEL_CONFIGS: Record<string, ModelConfig>;
}

/* ---- moduleInitializer namespace ---- */

export interface ModuleInitializerModule {
  initializeModule(options?: ModuleInitOptions): Promise<null>;
  initializeModuleESM(options?: ModuleInitOptions): Promise<null>;
  shouldInitialize(): boolean;
  logModuleInit(moduleName: string, metadata?: object): void;
}

/* ---- dependencyInterfaces namespace ---- */

export interface DependencyInterfacesModule {
  createQerrorsCoreDeps(qerrorsModule: object): QerrorsCoreDeps;
  createDefaultErrorHandlingDeps(): QerrorsCoreDeps;
  getDefaultQerrorsCoreDeps(): QerrorsCoreDeps;
  qerr(e: unknown, context: string, meta?: Record<string, unknown>, deps?: QerrorsCoreDeps): Promise<void>;
  getErrorSeverity(deps?: QerrorsCoreDeps): Record<string, string>;
  logErrorWithSeverityDI(options: LogErrorWithSeverityDIOptions): Promise<void>;
  withErrorHandlingDI(deps?: QerrorsCoreDeps): Function;
  resetDefaultQerrorsCoreDeps(): void;
}

/* ---- entityGuards namespace ---- */

export interface EntityGuardsModule {
  throwIfNotFound<T>(entity: T | null | undefined, entityName: string): T;
  throwIfNotFoundObj<T>(input: ThrowIfNotFoundInput<T>): ThrowIfNotFoundOutput<T>;
  throwIfNotFoundMany(entities: Array<{ entity: any; entityName: string }>): any[];
  throwIfNotFoundWithMessage<T>(entity: T | null | undefined, errorMessage: string): T;
  entityExists<T>(entity: T | null | undefined): boolean;
  assertEntityExists<T>(entity: T | null | undefined, entityName: string, errorType?: string): T;
}

/* ---- responseHelpers namespace ---- */

export interface HttpStatusMap {
  OK: 200;
  CREATED: 201;
  NO_CONTENT: 204;
  BAD_REQUEST: 400;
  UNAUTHORIZED: 401;
  FORBIDDEN: 403;
  NOT_FOUND: 404;
  INTERNAL_SERVER_ERROR: 500;
  [key: string]: number;
}

export interface DefaultMessages {
  NOT_FOUND: string;
  UNAUTHORIZED: string;
  FORBIDDEN: string;
  INTERNAL_ERROR: string;
  VALIDATION_FAILED: string;
  [key: string]: string;
}

export declare class ResponseBuilder {
  constructor(res: any);
  setStatus(status: number): this;
  setSuccess(success: boolean): this;
  setData(data: any): this;
  setError(error: any, message?: string | null): this;
  setMessage(message: string): this;
  addMetadata(key: string, value: unknown): this;
  addMetadata(obj: Record<string, unknown>): this;
  addHeader(key: string, value: string): this;
  addHeaders(headers: Record<string, string>): this;
  setRequestId(requestId: string): this;
  setProcessingTime(startTime: number): this;
  setPagination(page: number, limit: number, total: number): this;
  setValidationErrors(errors: any[]): this;
  build(): object;
  send(): any;
  success(data: any, options?: ResponseOptions): any;
  created(data: any, options?: ResponseOptions): any;
  notFound(message?: string): any;
  unauthorized(message?: string): any;
  forbidden(message?: string): any;
  validation(errors: any[]): any;
  serverError(message?: string): any;
  badRequest(message?: string): any;
}

export interface ResponseHelpersModule {
  ResponseBuilder: typeof ResponseBuilder;
  createResponseBuilder(res: any): ResponseBuilder;
  responseBuilderMiddleware(req: any, res: any, next: Function): void;
  sendJsonResponse(res: any, status: number, data: any): any;
  createResponseData(success: boolean, data: any, options?: ResponseOptions): object;
  addResponseMetadata(data: object, options?: ResponseOptions): object;
  sendSuccessResponse(res: any, data: any, options?: ResponseOptions): any;
  sendCreatedResponse(res: any, data: any): any;
  sendErrorResponse(res: any, status: number, message: string, details?: any, options?: ResponseOptions): any;
  sendValidationErrorResponse(res: any, errors: any[], options?: ResponseOptions): any;
  sendNotFoundResponse(res: any, message?: string): any;
  sendUnauthorizedResponse(res: any, message?: string): any;
  sendForbiddenResponse(res: any, message?: string): any;
  sendServerErrorResponse(res: any, message?: string): any;
  createResponseHelper(res: any, startTime?: number | null): ResponseHelper;
  createStatusResponseHelper(status: number, defaultMessage: string): (res: any, message?: string, options?: ResponseOptions) => any;
  globalErrorHandler(err: Error, req: any, res: any, next: Function): void;
  handleError(error: unknown, context: string, res: any, next?: Function): Promise<any>;
  HTTP_STATUS: HttpStatusMap;
  DEFAULT_MESSAGES: DefaultMessages;
}

/* ------------------------------------------------------------------ */
/*  Named exports (mirror of index.mjs named exports)                  */
/* ------------------------------------------------------------------ */

export declare const logger: LoggerModule;
export declare const errorTypes: ErrorTypesModule;
export declare const sanitization: SanitizationModule;
export declare const queueManager: QueueManagerModule;
export declare const utils: UtilsModule;
export declare const config: ConfigModule;
export declare const envUtils: EnvUtilsModule;
export declare const aiModelManager: AIModelManagerModule;
export declare const moduleInitializer: ModuleInitializerModule;
export declare const dependencyInterfaces: DependencyInterfacesModule;
export declare const entityGuards: EntityGuardsModule;
export declare const responseHelpers: ResponseHelpersModule;
export declare const circuitBreaker: CircuitBreakerModule;

export declare function logErrorWithSeverity(options: LogErrorWithSeverityDIOptions): Promise<void>;
export declare function handleControllerError(res: any, error: Error, context?: string, meta?: object): any;
export declare function withErrorHandling(fn: Function, context?: string): Function;
export declare function generateErrorId(): string;
export declare function extractContext(req: any): Record<string, unknown>;
export declare function cleanup(): Promise<void>;
export declare function getQueueStats(): Record<string, unknown>;
export declare function getAnalysisCache(): any;

export declare function createTypedError(type: string, message: string, context?: object): StandardError;
export declare function createStandardError(message: string, type?: string, context?: object): StandardError;
export declare const ErrorTypes: ErrorTypeConstants;
export declare const ErrorSeverity: ErrorSeverityConstants;
export declare const ErrorFactory: ErrorFactoryInterface;
export declare function errorMiddleware(err: Error, req: any, res: any, next: Function): void;
export declare function handleSimpleError(error: unknown, context: string): void;
export declare const errorUtils: ErrorUtils;
export declare const safeUtils: SafeUtils;

export declare function logDebug(message: string, meta?: Record<string, unknown>): void;
export declare function logInfo(message: string, meta?: Record<string, unknown>): void;
export declare function logWarn(message: string, meta?: Record<string, unknown>): void;
export declare function logError(message: string, meta?: Record<string, unknown>): void;
export declare function logFatal(message: string, meta?: Record<string, unknown>): void;
export declare function logAudit(message: string, meta?: Record<string, unknown>): void;
export declare function createPerformanceTimer(): PerformanceTimer;
export declare function createEnhancedLogEntry(level: string, message: string, context?: object): EnhancedLogEntry;
export declare const LOG_LEVELS: LogLevels;
export declare const simpleLogger: WinstonLogger;
export declare function createSimpleWinstonLogger(options?: object): WinstonLogger;

export declare function sanitizeMessage(message: string): string;
export declare function sanitizeContext(context: Record<string, unknown>): Record<string, unknown>;
export declare function addCustomSanitizationPattern(pattern: RegExp | string): void;
export declare function clearCustomSanitizationPatterns(): void;
export declare function sanitizeWithCustomPatterns(message: string): string;

export declare function createLimiter(options?: object): any;
export declare function getQueueRejectCount(): number;
export declare function startQueueMetrics(): void;
export declare function stopQueueMetrics(): void;
export declare function safeRun<T>(fn: () => T | Promise<T>): Promise<T | undefined>;
export declare function deepClone<T>(obj: T): T;
export declare function createTimer(): { elapsed(): number; elapsedMs(): number };
export declare function attempt<T>(fn: () => T | Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }>;
export declare function executeWithQerrors<T>(options: ExecuteWithQerrorsOptions<T>): Promise<T>;
export declare function formatErrorMessage(error: unknown, context: string): string;

export declare function getEnv(key: string, defaultVal?: any): any;
export declare function getInt(name: string, defaultValOrMin?: number, min?: number): number;
export declare function getMissingEnvVars(vars: string[]): string[];
export declare function throwIfMissingEnvVars(vars: string[]): string[];
export declare function warnIfMissingEnvVars(vars: string[], customMessage?: string): boolean;
export declare function validateRequiredEnvVars(vars: string[]): string[];
export declare function warnMissingEnvVars(vars: string[]): boolean;
export declare const NODE_ENV: string | undefined;
export declare const DEFAULT_ERROR_MESSAGE: string;

export declare function getAIModelManager(): any;
export declare function resetAIModelManager(): void;
export declare const MODEL_PROVIDERS: Record<string, string>;
export declare function createLangChainModel(options?: object): any;

export declare function initializeModule(options?: ModuleInitOptions): Promise<null>;
export declare function initializeModuleESM(options?: ModuleInitOptions): Promise<null>;
export declare function shouldInitialize(): boolean;
export declare function logModuleInit(moduleName: string, metadata?: object): void;

export declare function createQerrorsCoreDeps(qerrorsModule: object): QerrorsCoreDeps;
export declare function getDefaultQerrorsCoreDeps(): QerrorsCoreDeps;
export declare function createDefaultErrorHandlingDeps(): QerrorsCoreDeps;
export declare function qerr(e: unknown, context: string, meta?: Record<string, unknown>, deps?: QerrorsCoreDeps): Promise<void>;
export declare function getErrorSeverity(deps?: QerrorsCoreDeps): Record<string, string>;
export declare function logErrorWithSeverityDI(options: LogErrorWithSeverityDIOptions): Promise<void>;
export declare function withErrorHandlingDI(deps?: QerrorsCoreDeps): Function;
export declare function resetDefaultQerrorsCoreDeps(): void;

export declare function throwIfNotFound<T>(entity: T | null | undefined, entityName: string): T;
export declare function throwIfNotFoundObj<T>(input: ThrowIfNotFoundInput<T>): ThrowIfNotFoundOutput<T>;
export declare function throwIfNotFoundMany(entities: Array<{ entity: any; entityName: string }>): any[];
export declare function throwIfNotFoundWithMessage<T>(entity: T | null | undefined, errorMessage: string): T;
export declare function entityExists<T>(entity: T | null | undefined): boolean;
export declare function assertEntityExists<T>(entity: T | null | undefined, entityName: string, errorType?: string): T;

export declare function sendJsonResponse(res: any, status: number, data: any): any;
export declare function sendSuccessResponse(res: any, data: any, options?: ResponseOptions): any;
export declare function sendCreatedResponse(res: any, data: any): any;
export declare function sendErrorResponse(res: any, status: number, message: string, details?: any, options?: ResponseOptions): any;
export declare function sendValidationErrorResponse(res: any, errors: any[], options?: ResponseOptions): any;
export declare function sendNotFoundResponse(res: any, message?: string): any;
export declare function sendUnauthorizedResponse(res: any, message?: string): any;
export declare function sendForbiddenResponse(res: any, message?: string): any;
export declare function sendServerErrorResponse(res: any, message?: string): any;
export declare function createResponseHelper(res: any, startTime?: number | null): ResponseHelper;

export declare function globalErrorHandler(err: Error, req: any, res: any, next: Function): void;
export declare function generateUniqueId(): string;
export declare function verboseLog(message: string, meta?: Record<string, unknown>): void;

export declare function createSafeAsyncWrapper<T extends any[], R>(
  options: SafeAsyncWrapperOptions<T, R>
): (...args: T) => Promise<R | void>;
export declare function createSafeLogger(
  functionName: string,
  fallbackLevel?: 'error' | 'warn' | 'log' | 'info'
): (message: string, details?: Record<string, unknown>) => Promise<void>;
export declare function createSafeOperation<T extends any[], R>(
  asyncFn: (...args: T) => Promise<R>,
  fallbackValue?: R,
  onError?: (error: unknown, ...args: T) => void
): (...args: T) => Promise<R | undefined>;
export declare function safeJsonParse<T = any>(text: string, fallback?: T | null): T | null;
export declare function safeJsonStringify(value: any, fallback?: string): string;

/* ------------------------------------------------------------------ */
/*  Default export – the callable qerrors function                     */
/* ------------------------------------------------------------------ */

export interface QerrorsCallable {
  (error: any, context: string, ...args: any[]): void;
}

declare const qerrorsDefault: QerrorsCallable;
export default qerrorsDefault;
