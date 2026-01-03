export declare const ErrorTypes: {
    VALIDATION: string;
    AUTHENTICATION: string;
    AUTHORIZATION: string;
    NOT_FOUND: string;
    RATE_LIMIT: string;
    NETWORK: string;
    DATABASE: string;
    SYSTEM: string;
    CONFIGURATION: string;
};
export declare const ErrorSeverity: {
    LOW: string;
    MEDIUM: string;
    HIGH: string;
    CRITICAL: string;
};
export declare const createTypedError: (message: string, type: string, code: string) => any;
export declare const createStandardError: (message: string, type: string, code: string) => any;
export declare const ErrorFactory: {
    validation: (message: string) => any;
    authentication: (message: string) => any;
    authorization: (message: string) => any;
    notFound: (message: string) => any;
    rateLimit: (message: string) => any;
    network: (message: string) => any;
    database: (message: string) => any;
    system: (message: string) => any;
    configuration: (message: string) => any;
};
export declare const errorMiddleware: (err: Error, _req: any, res: any, _next: Function) => void;
export declare const handleSimpleError: (error: Error) => void;
export declare class ServiceError extends Error {
    type: string;
    context: Record<string, any>;
    statusCode: number;
    severity: string;
    timestamp: string;
    constructor(message: string, type: string, context?: Record<string, any>);
}
export declare const errorUtils: {
    validation: (_field: string) => ServiceError;
    authentication: (service: string) => ServiceError;
    authorization: (action: string) => ServiceError;
    externalApi: (service: string, _error: Error) => ServiceError;
    internal: (message: string) => ServiceError;
    wrap: (_error: unknown, message: string) => ServiceError;
};
export declare const safeUtils: {
    execute: <T>(operation: () => Promise<T>) => Promise<{
        success: boolean;
        data: Awaited<T>;
        error?: never;
    } | {
        success: boolean;
        error: unknown;
        data?: never;
    }>;
    validate: <T>(value: unknown, validator: (v: unknown) => T, _field: string) => {
        success: boolean;
        data: T;
        error?: never;
    } | {
        success: boolean;
        error: unknown;
        data?: never;
    };
};
export declare const safeErrorMessage: (error: unknown, fallback: string) => string;
export declare const safeLogError: (error: unknown, context: string, metadata?: Record<string, unknown>) => void;
export declare const safeLogInfo: (message: string, metadata?: Record<string, unknown>) => void;
export declare const attempt: <T>(fn: () => T | Promise<T>) => Promise<{
    ok: boolean;
    value: Awaited<T>;
    error?: never;
} | {
    ok: boolean;
    error: unknown;
    value?: never;
}>;
export declare const executeWithQerrors: <T>(options: {
    opName: string;
    operation: () => T | Promise<T>;
    context?: Record<string, any>;
    failureMessage: string;
}) => Promise<T>;
export declare const formatErrorMessage: (error: unknown, context: string) => string;
//# sourceMappingURL=errorTypes.d.ts.map