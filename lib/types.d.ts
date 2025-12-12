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
