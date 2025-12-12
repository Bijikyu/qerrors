/**
 * @qtools/qerrors-types
 * Purpose: TypeScript type definitions for qerrors module.
 * Explanation: This module provides comprehensive TypeScript type definitions for the qerrors error
 * handling library. It solves the problem of missing type definitions when using qerrors in TypeScript
 * projects, enabling proper IntelliSense and compile-time type checking. The module is reusable across
 * any TypeScript project using qerrors, providing complete type coverage for all qerrors functionality
 * including error handling, logging, performance timing, and sanitization utilities.
 */

declare module 'qerrors' {
  interface QErrorsModule {
    qerrors(error: any, context: string, ...args: any[]): void;
    logger: any;
    errorTypes: any;
    logErrorWithSeverity: any;
    handleControllerError: any;
    withErrorHandling: any;
    createTypedError: any;
    createStandardError: any;
    ErrorTypes: any;
    ErrorSeverity: any;
    ErrorFactory: any;
    errorMiddleware: any;
    handleSimpleError: any;
    logDebug: any;
    logInfo: any;
    logWarn: any;
    logError: any;
    logFatal: any;
    logAudit: any;
    createPerformanceTimer: any;
    createEnhancedLogEntry: any;
    LOG_LEVELS: any;
    simpleLogger: any;
    createSimpleWinstonLogger: any;
    sanitizeMessage: any;
    sanitizeContext: any;
    addCustomSanitizationPattern: any;
    clearCustomSanitizationPatterns: any;
    sanitizeWithCustomPatterns: any;
    createLimiter: any;
    getQueueLength: any;
    getQueueRejectCount: any;
    startQueueMetrics: any;
    stopQueueMetrics: any;
    generateUniqueId: any;
    createTimer: any;
    deepClone: any;
    safeRun: any;
    verboseLog: any;
    getEnv: (key: string, defaultVal?: any) => any;
    getInt: {
      (name: string): number;
      (name: string, min: number): number;
      (name: string, defaultVal: number, min: number): number;
    };
    getMissingEnvVars: (vars: string[]) => string[];
    throwIfMissingEnvVars: (vars: string[]) => string[];
    warnIfMissingEnvVars: (vars: string[], customMessage?: string) => boolean;
    validateRequiredEnvVars: (vars: string[]) => string[];
    warnMissingEnvVars: (vars: string[]) => boolean;
    NODE_ENV: string | undefined;
    DEFAULT_ERROR_MESSAGE: string;
    TEST_SUCCESS_MESSAGE: string;
    TEST_FAILURE_MESSAGE: string;
    getAIModelManager: any;
    resetAIModelManager: any;
    MODEL_PROVIDERS: any;
    createLangChainModel: any;
    initializeModule: (options?: ModuleInitOptions) => Promise<null>;
    initializeModuleESM: (options?: ModuleInitOptions) => Promise<null>;
    shouldInitialize: () => boolean;
    logModuleInit: (moduleName: string, metadata?: object) => void;
    createQerrorsCoreDeps: (qerrorsModule: object) => QerrorsCoreDeps;
    getDefaultQerrorsCoreDeps: () => QerrorsCoreDeps;
    createDefaultErrorHandlingDeps: () => QerrorsCoreDeps;
    qerr: (e: unknown, context: string, meta?: Record<string, unknown>, deps?: QerrorsCoreDeps) => Promise<void>;
    getErrorSeverity: (deps?: QerrorsCoreDeps) => Record<string, string>;
    logErrorWithSeverityDI: (options: LogErrorWithSeverityDIOptions) => Promise<void>;
    withErrorHandlingDI: (deps?: QerrorsCoreDeps) => Function;
    resetDefaultQerrorsCoreDeps: () => void;
    throwIfNotFound: <T>(entity: T | null | undefined, entityName: string) => T;
    throwIfNotFoundObj: <T>(input: ThrowIfNotFoundInput<T>) => ThrowIfNotFoundOutput<T>;
    throwIfNotFoundMany: (entities: Array<{ entity: any; entityName: string }>) => any[];
    throwIfNotFoundWithMessage: <T>(entity: T | null | undefined, errorMessage: string) => T;
    entityExists: <T>(entity: T | null | undefined) => boolean;
    assertEntityExists: <T>(entity: T | null | undefined, entityName: string, errorType?: string) => T;
    safeErrorMessage: (error: unknown, fallback: string) => string;
    safeLogError: (error: unknown, context: string, metadata?: Record<string, unknown>) => void;
    safeLogInfo: (message: string, metadata?: Record<string, unknown>) => void;
    safeLogWarn: (message: string, metadata?: Record<string, unknown>) => void;
    attempt: <T>(fn: () => T | Promise<T>) => Promise<{ ok: true; value: T } | { ok: false; error: unknown }>;
    executeWithQerrors: <T>(options: ExecuteWithQerrorsOptions<T>) => Promise<T>;
    formatErrorMessage: (error: unknown, context: string) => string;
    sendJsonResponse: (res: any, status: number, data: any) => any;
    sendSuccessResponse: (res: any, data: any, options?: ResponseOptions) => any;
    sendCreatedResponse: (res: any, data: any) => any;
    sendErrorResponse: (res: any, status: number, message: string, details?: any, options?: ResponseOptions) => any;
    sendValidationErrorResponse: (res: any, errors: any[], options?: ResponseOptions) => any;
    sendNotFoundResponse: (res: any, message?: string) => any;
    sendUnauthorizedResponse: (res: any, message?: string) => any;
    sendForbiddenResponse: (res: any, message?: string) => any;
    sendServerErrorResponse: (res: any, message?: string) => any;
    createResponseHelper: (res: any, startTime?: number | null) => ResponseHelper;
    globalErrorHandler: (err: Error, req: any, res: any, next: Function) => void;
    safeQerrors: (error: unknown, context: string, extra?: Record<string, any>) => Promise<void>;
    CircuitBreaker: typeof CircuitBreaker;
    CircuitState: { CLOSED: 'CLOSED'; OPEN: 'OPEN'; HALF_OPEN: 'HALF_OPEN' };
    createCircuitBreaker: <T extends (...args: any[]) => Promise<any>>(operation: T, serviceName: string, overrides?: Partial<CircuitBreakerOptions>) => CircuitBreaker<T>;
    ServiceError: typeof ServiceError;
    errorUtils: ErrorUtils;
    safeUtils: SafeUtils;
    createSafeAsyncWrapper: <T extends any[], R>(options: SafeAsyncWrapperOptions<T, R>) => (...args: T) => Promise<R | void>;
    createSafeLogger: (functionName: string, fallbackLevel?: 'error' | 'warn' | 'log' | 'info') => (message: string, details?: Record<string, unknown>) => Promise<void>;
    createSafeOperation: <T extends any[], R>(asyncFn: (...args: T) => Promise<R>, fallbackValue?: R, onError?: (error: unknown, ...args: T) => void) => (...args: T) => Promise<R | undefined>;
    safeJsonParse: <T = any>(text: string, fallback?: T | null) => T | null;
    safeJsonStringify: (value: any, fallback?: string) => string;
  }

  interface SafeAsyncWrapperOptions<T extends any[], R> {
    modulePath?: string;
    functionName?: string;
    fallbackFn?: (...args: T) => R | Promise<R>;
    silent?: boolean;
    errorMessage?: string;
  }

  interface ExecuteWithQerrorsOptions<T> {
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

  interface ResponseOptions {
    includeProcessingTime?: boolean;
    startTime?: number | null;
    requestId?: string | null;
    processingTime?: number | null;
  }

  interface ResponseHelper {
    success: (data: any, options?: ResponseOptions) => any;
    created: (data: any) => any;
    error: (status: number, message: string, details?: any, options?: ResponseOptions) => any;
    validation: (errors: any[], options?: ResponseOptions) => any;
    notFound: (message?: string) => any;
    unauthorized: (message?: string) => any;
    forbidden: (message?: string) => any;
    serverError: (message?: string) => any;
  }

  interface CircuitBreakerOptions {
    failureThreshold: number;
    recoveryTimeoutMs: number;
    monitoringPeriodMs: number;
    timeoutMs?: number;
  }

  interface ServiceMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    lastFailureTime?: number;
  }

  type CircuitStateType = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

  class CircuitBreaker<T extends (...args: any[]) => Promise<any>> {
    constructor(operation: T, serviceName: string, options: CircuitBreakerOptions);
    execute(...args: Parameters<T>): Promise<ReturnType<T>>;
    getState(): CircuitStateType;
    getMetrics(): ServiceMetrics;
    getSuccessRate(): number;
    getFailureRate(): number;
    reset(): void;
    forceOpen(): void;
  }

  class ServiceError extends Error {
    constructor(message: string, type: string, context?: Record<string, unknown>, cause?: Error | null);
    type: string;
    context: Record<string, unknown>;
    cause: Error | null;
    statusCode: number;
    severity: string;
    timestamp: string;
    toJSON(): Record<string, unknown>;
  }

  type Result<T, E = ServiceError> = 
    | { success: true; data: T }
    | { success: false; error: E };

  interface ErrorUtils {
    validation: (field: string, value?: unknown) => ServiceError;
    authentication: (serviceName: string) => ServiceError;
    authorization: (action: string) => ServiceError;
    externalApi: (serviceName: string, originalError: Error) => ServiceError;
    internal: (message: string, context?: Record<string, unknown>) => ServiceError;
    wrap: (error: unknown, defaultMessage: string) => ServiceError;
    asyncHandler: <T>(operation: () => Promise<T>, errorMessage: string) => Promise<T>;
  }

  interface SafeUtils {
    execute: <T>(operation: () => Promise<T>) => Promise<Result<T>>;
    validate: <T>(value: unknown, validator: (v: unknown) => T, field: string) => Result<T>;
  }

  interface ModuleInitOptions {
    module?: string;
    version?: string;
    environment?: string;
  }

  interface QerrorsCoreDeps {
    qerrors: Function;
    logErrorWithSeverity: Function;
    withErrorHandling: Function;
    ErrorSeverity: Record<string, string>;
  }

  interface LogErrorWithSeverityDIOptions {
    error: unknown;
    functionName: string;
    context?: Record<string, unknown>;
    severity?: string;
    deps?: QerrorsCoreDeps;
  }

  interface ThrowIfNotFoundInput<T> {
    entity: T | null | undefined;
    entityName: string;
  }

  interface ThrowIfNotFoundOutput<T> {
    entity: T | null;
    found: boolean;
  }

  const qerrorsModule: QErrorsModule;
  export = qerrorsModule;
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
