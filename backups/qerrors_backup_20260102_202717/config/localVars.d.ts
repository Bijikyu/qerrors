export namespace MODEL_PROVIDERS {
    let OPENAI: string;
    let GOOGLE: string;
}
export const MODEL_CONFIGS: {
    [MODEL_PROVIDERS.OPENAI]: {
        models: {
            'gpt-4o': {
                maxTokens: number;
                temperature: number;
                topP: number;
            };
            'gpt-4o-mini': {
                maxTokens: number;
                temperature: number;
                topP: number;
            };
            'gpt-4': {
                maxTokens: number;
                temperature: number;
                topP: number;
            };
            'gpt-3.5-turbo': {
                maxTokens: number;
                temperature: number;
                topP: number;
            };
        };
        defaultModel: string;
        requiredEnvVars: string[];
    };
    [MODEL_PROVIDERS.GOOGLE]: {
        models: {
            'gemini-2.5-flash-lite': {
                maxTokens: number;
                temperature: number;
                topP: number;
            };
            'gemini-2.0-flash-exp': {
                maxTokens: number;
                temperature: number;
                topP: number;
            };
            'gemini-pro': {
                maxTokens: number;
                temperature: number;
                topP: number;
            };
            'gemini-1.5-pro': {
                maxTokens: number;
                temperature: number;
                topP: number;
            };
            'gemini-1.5-flash': {
                maxTokens: number;
                temperature: number;
                topP: number;
            };
        };
        defaultModel: string;
        requiredEnvVars: string[];
    };
};
export namespace CircuitState {
    let CLOSED: string;
    let OPEN: string;
    let HALF_OPEN: string;
}
export namespace ErrorTypes {
    let VALIDATION: string;
    let AUTHENTICATION: string;
    let AUTHORIZATION: string;
    let NOT_FOUND: string;
    let RATE_LIMIT: string;
    let NETWORK: string;
    let DATABASE: string;
    let SYSTEM: string;
    let CONFIGURATION: string;
}
export namespace ErrorSeverity {
    let LOW: string;
    let MEDIUM: string;
    let HIGH: string;
    let CRITICAL: string;
}
/**
 * Map error types to HTTP status codes
 *
 * This mapping ensures consistent HTTP response codes
 * based on error classification. Each error type
 * maps to the most appropriate HTTP status code.
 */
export const ERROR_STATUS_MAP: {
    [ErrorTypes.VALIDATION]: number;
    [ErrorTypes.AUTHENTICATION]: number;
    [ErrorTypes.AUTHORIZATION]: number;
    [ErrorTypes.NOT_FOUND]: number;
    [ErrorTypes.RATE_LIMIT]: number;
    [ErrorTypes.NETWORK]: number;
    [ErrorTypes.DATABASE]: number;
    [ErrorTypes.SYSTEM]: number;
    [ErrorTypes.CONFIGURATION]: number;
};
/**
 * Map error types to severity levels
 *
 * This mapping determines operational priority and
 * logging levels based on error type. More severe
 * error types require immediate attention.
 */
export const ERROR_SEVERITY_MAP: {
    [ErrorTypes.VALIDATION]: string;
    [ErrorTypes.AUTHENTICATION]: string;
    [ErrorTypes.AUTHORIZATION]: string;
    [ErrorTypes.NOT_FOUND]: string;
    [ErrorTypes.RATE_LIMIT]: string;
    [ErrorTypes.NETWORK]: string;
    [ErrorTypes.DATABASE]: string;
    [ErrorTypes.SYSTEM]: string;
    [ErrorTypes.CONFIGURATION]: string;
};
export namespace HTTP_STATUS {
    export let OK: number;
    export let CREATED: number;
    export let BAD_REQUEST: number;
    export let UNAUTHORIZED: number;
    export let FORBIDDEN: number;
    let NOT_FOUND_1: number;
    export { NOT_FOUND_1 as NOT_FOUND };
    export let INTERNAL_SERVER_ERROR: number;
}
export namespace DEFAULT_MESSAGES {
    export let VALIDATION_FAILED: string;
    let NOT_FOUND_2: string;
    export { NOT_FOUND_2 as NOT_FOUND };
    let UNAUTHORIZED_1: string;
    export { UNAUTHORIZED_1 as UNAUTHORIZED };
    let FORBIDDEN_1: string;
    export { FORBIDDEN_1 as FORBIDDEN };
    export let INTERNAL_ERROR: string;
}
export namespace LOG_LEVELS {
    namespace DEBUG {
        let priority: number;
        let color: string;
        let name: string;
    }
    namespace INFO {
        let priority_1: number;
        export { priority_1 as priority };
        let color_1: string;
        export { color_1 as color };
        let name_1: string;
        export { name_1 as name };
    }
    namespace WARN {
        let priority_2: number;
        export { priority_2 as priority };
        let color_2: string;
        export { color_2 as color };
        let name_2: string;
        export { name_2 as name };
    }
    namespace ERROR {
        let priority_3: number;
        export { priority_3 as priority };
        let color_3: string;
        export { color_3 as color };
        let name_3: string;
        export { name_3 as name };
    }
    namespace FATAL {
        let priority_4: number;
        export { priority_4 as priority };
        let color_4: string;
        export { color_4 as color };
        let name_4: string;
        export { name_4 as name };
    }
    namespace AUDIT {
        let priority_5: number;
        export { priority_5 as priority };
        let color_5: string;
        export { color_5 as color };
        let name_5: string;
        export { name_5 as name };
    }
}
export const LOG_DIR: string;
export const DISABLE_FILE_LOGS: boolean;
export namespace ROTATION_OPTS {
    let maxsize: number;
    let maxFiles: number;
    let tailable: boolean;
}
/**
 * Runtime environment and basic configuration
 *
 * These variables control fundamental behavior like error messages,
 * logging verbosity, and operational mode.
 */
export const NODE_ENV: string;
export const DEFAULT_ERROR_MESSAGE: "An unexpected error occurred";
/**
 * AI model configuration variables
 *
 * These settings control which AI provider and model to use for
 * error analysis, along with request limits and verbosity.
 */
export const QERRORS_AI_PROVIDER: string | undefined;
export const QERRORS_AI_MODEL: string | undefined;
export const QERRORS_MAX_TOKENS: string | undefined;
export const QERRORS_VERBOSE: string | undefined;
export const QERRORS_LOG_MAXSIZE: string | undefined;
export const QERRORS_LOG_MAXFILES: string | undefined;
export const QERRORS_LOG_MAX_DAYS: string | undefined;
export const QERRORS_LOG_DIR: string | undefined;
export const QERRORS_DISABLE_FILE_LOGS: string | undefined;
export const QERRORS_SERVICE_NAME: string | undefined;
export const QERRORS_LOG_LEVEL: string | undefined;
export const QERRORS_CONCURRENCY: string | undefined;
export const QERRORS_CACHE_LIMIT: string | undefined;
export const QERRORS_CACHE_TTL: string | undefined;
export const QERRORS_QUEUE_LIMIT: string | undefined;
export const QERRORS_SAFE_THRESHOLD: string | undefined;
export const QERRORS_RETRY_ATTEMPTS: string | undefined;
export const QERRORS_RETRY_BASE_MS: string | undefined;
export const QERRORS_RETRY_MAX_MS: string | undefined;
export const QERRORS_TIMEOUT: string | undefined;
export const QERRORS_MAX_SOCKETS: string | undefined;
export const QERRORS_MAX_FREE_SOCKETS: string | undefined;
export const QERRORS_OPENAI_URL: string | undefined;
export const QERRORS_METRIC_INTERVAL_MS: string | undefined;
export namespace CONFIG_DEFAULTS {
    let QERRORS_CONCURRENCY: string;
    let QERRORS_CACHE_LIMIT: string;
    let QERRORS_CACHE_TTL: string;
    let QERRORS_QUEUE_LIMIT: string;
    let QERRORS_SAFE_THRESHOLD: string;
    let QERRORS_RETRY_ATTEMPTS: string;
    let QERRORS_RETRY_BASE_MS: string;
    let QERRORS_RETRY_MAX_MS: string;
    let QERRORS_TIMEOUT: string;
    let QERRORS_MAX_SOCKETS: string;
    let QERRORS_MAX_FREE_SOCKETS: string;
    let QERRORS_MAX_TOKENS: string;
    let QERRORS_OPENAI_URL: string;
    let QERRORS_LOG_MAXSIZE: string;
    let QERRORS_LOG_MAXFILES: string;
    let QERRORS_LOG_MAX_DAYS: string;
    let QERRORS_VERBOSE: string;
    let QERRORS_LOG_DIR: string;
    let QERRORS_DISABLE_FILE_LOGS: string;
    let QERRORS_SERVICE_NAME: string;
    let QERRORS_LOG_LEVEL: string;
    let QERRORS_METRIC_INTERVAL_MS: string;
}
export namespace STANDARD_ERROR_RESPONSE {
    let success: boolean;
    namespace error {
        let code: null;
        let message: null;
        let severity: null;
        let category: null;
        let details: null;
    }
    namespace metadata {
        let timestamp: null;
        let operationName: null;
        let requestId: null;
    }
    let context: {};
}
export namespace ERROR_SEVERITY_MAP_CONTRACTS {
    import SYSTEM_ERROR = LOG_LEVELS.ERROR;
    export { SYSTEM_ERROR };
    import TIMEOUT_ERROR = LOG_LEVELS.ERROR;
    export { TIMEOUT_ERROR };
    import MEMORY_ERROR = LOG_LEVELS.ERROR;
    export { MEMORY_ERROR };
    import NETWORK_ERROR = LOG_LEVELS.ERROR;
    export { NETWORK_ERROR };
    import VALIDATION_ERROR = LOG_LEVELS.WARN;
    export { VALIDATION_ERROR };
    import AUTHORIZATION_ERROR = LOG_LEVELS.WARN;
    export { AUTHORIZATION_ERROR };
    import NOT_FOUND_ERROR = LOG_LEVELS.INFO;
    export { NOT_FOUND_ERROR };
    import CONFLICT_ERROR = LOG_LEVELS.WARN;
    export { CONFLICT_ERROR };
    import OPERATION_ERROR = LOG_LEVELS.ERROR;
    export { OPERATION_ERROR };
    import CONFIGURATION_ERROR = LOG_LEVELS.ERROR;
    export { CONFIGURATION_ERROR };
    import DEPENDENCY_ERROR = LOG_LEVELS.ERROR;
    export { DEPENDENCY_ERROR };
}
export namespace DEFAULT_ASYNC_CONFIG {
    let enableTiming: boolean;
    let enableLogging: boolean;
    let enableMetrics: boolean;
    let timeoutMs: null;
    let retryAttempts: number;
    let retryDelayMs: number;
    let retryBackoffMultiplier: number;
    let retryMaxDelayMs: null;
    let retryJitter: boolean;
    let circuitBreakerThreshold: number;
    let circuitBreakerTimeoutMs: number;
}
export namespace RetryConfigPresets {
    namespace network {
        let maxAttempts: number;
        let baseDelay: number;
        let maxDelay: number;
        let backoffFactor: number;
        let jitter: boolean;
    }
    namespace database {
        let maxAttempts_1: number;
        export { maxAttempts_1 as maxAttempts };
        let baseDelay_1: number;
        export { baseDelay_1 as baseDelay };
        let maxDelay_1: number;
        export { maxDelay_1 as maxDelay };
        let backoffFactor_1: number;
        export { backoffFactor_1 as backoffFactor };
        let jitter_1: boolean;
        export { jitter_1 as jitter };
    }
    namespace externalAPI {
        let maxAttempts_2: number;
        export { maxAttempts_2 as maxAttempts };
        let baseDelay_2: number;
        export { baseDelay_2 as baseDelay };
        let maxDelay_2: number;
        export { maxDelay_2 as maxDelay };
        let backoffFactor_2: number;
        export { backoffFactor_2 as backoffFactor };
        let jitter_2: boolean;
        export { jitter_2 as jitter };
    }
    namespace filesystem {
        let maxAttempts_3: number;
        export { maxAttempts_3 as maxAttempts };
        let baseDelay_3: number;
        export { baseDelay_3 as baseDelay };
        let maxDelay_3: number;
        export { maxDelay_3 as maxDelay };
        let backoffFactor_3: number;
        export { backoffFactor_3 as backoffFactor };
        let jitter_3: boolean;
        export { jitter_3 as jitter };
    }
    namespace aggressive {
        let maxAttempts_4: number;
        export { maxAttempts_4 as maxAttempts };
        let baseDelay_4: number;
        export { baseDelay_4 as baseDelay };
        let maxDelay_4: number;
        export { maxDelay_4 as maxDelay };
        let backoffFactor_4: number;
        export { backoffFactor_4 as backoffFactor };
        let jitter_4: boolean;
        export { jitter_4 as jitter };
    }
    namespace conservative {
        let maxAttempts_5: number;
        export { maxAttempts_5 as maxAttempts };
        let baseDelay_5: number;
        export { baseDelay_5 as baseDelay };
        let maxDelay_5: number;
        export { maxDelay_5 as maxDelay };
        let backoffFactor_5: number;
        export { backoffFactor_5 as backoffFactor };
        let jitter_5: boolean;
        export { jitter_5 as jitter };
    }
}
//# sourceMappingURL=localVars.d.ts.map