import qerrors from '../lib/qerrors.js';
export const ErrorTypes = { VALIDATION: 'validation', AUTHENTICATION: 'authentication', AUTHORIZATION: 'authorization', NOT_FOUND: 'not_found', RATE_LIMIT: 'rate_limit', NETWORK: 'network', DATABASE: 'database', SYSTEM: 'system', CONFIGURATION: 'configuration' };
export const ErrorSeverity = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' };
export const createTypedError = (message, type, code) => { const error = new Error(message); error.type = type, error.code = code; return error; };
export const createStandardError = createTypedError;
export const ErrorFactory = { validation: (message) => createTypedError(message, ErrorTypes.VALIDATION, 'VALIDATION_ERROR'), authentication: (message) => createTypedError(message, ErrorTypes.AUTHENTICATION, 'AUTH_ERROR'), authorization: (message) => createTypedError(message, ErrorTypes.AUTHORIZATION, 'AUTH_ERROR'), notFound: (message) => createTypedError(message, ErrorTypes.NOT_FOUND, 'NOT_FOUND'), rateLimit: (message) => createTypedError(message, ErrorTypes.RATE_LIMIT, 'RATE_LIMIT'), network: (message) => createTypedError(message, ErrorTypes.NETWORK, 'NETWORK_ERROR'), database: (message) => createTypedError(message, ErrorTypes.DATABASE, 'DATABASE_ERROR'), system: (message) => createTypedError(message, ErrorTypes.SYSTEM, 'SYSTEM_ERROR'), configuration: (message) => createTypedError(message, ErrorTypes.CONFIGURATION, 'CONFIG_ERROR') };
export const errorMiddleware = (err, _req, res, _next) => { console.error('Error middleware:', err); res.status(500).json({ error: 'Internal server error' }); };
export const handleSimpleError = (error) => { console.error('Simple error:', error); };
export class ServiceError extends Error {
    type;
    context;
    statusCode;
    severity;
    timestamp;
    constructor(message, type, context = {}) { super(message); this.name = 'ServiceError'; this.type = type; this.context = context; this.statusCode = 500; this.severity = 'medium'; this.timestamp = new Date().toISOString(); }
}
export const errorUtils = { validation: (_field) => new ServiceError('Validation failed', 'validation'), authentication: (service) => new ServiceError(`Authentication failed for ${service}`, 'authentication'), authorization: (action) => new ServiceError(`Authorization failed for ${action}`, 'authorization'), externalApi: (service, _error) => new ServiceError(`External API ${service} failed`, 'network'), internal: (message) => new ServiceError(message, 'system'), wrap: (_error, message) => new ServiceError(message, 'system') };
export const safeUtils = { execute: async (operation) => { try {
        const result = await operation();
        return { success: true, data: result };
    }
    catch (error) {
        try {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            await qerrors(errorObj, 'errorTypes.safeUtils.execute', { operation: 'safe_execution', timestamp: new Date().toISOString() });
        }
        catch (qerror) {
            console.error('qerrors logging failed in safeUtils execute', qerror);
        }
        return { success: false, error };
    } }, validate: (value, validator, _field) => { try {
        const result = validator(value);
        return { success: true, data: result };
    }
    catch (error) {
        return { success: false, error };
    } } };
export const safeErrorMessage = (error, fallback) => error instanceof Error ? error.message : fallback;
export const safeLogError = (error, context, metadata) => { console.error(`[${context}] Error:`, safeErrorMessage(error, 'Unknown error'), metadata); };
export const safeLogInfo = (message, metadata) => { console.info(`[INFO] ${message}`, metadata); };
export const attempt = async (fn) => { try {
    const value = await fn();
    return { ok: true, value };
}
catch (error) {
    try {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        await qerrors(errorObj, 'errorTypes.attempt', { operation: 'attempt_execution', timestamp: new Date().toISOString() });
    }
    catch (qerror) {
        console.error('qerrors logging failed in attempt', qerror);
    }
    return { ok: false, error };
} };
export const executeWithQerrors = async (options) => { try {
    return await options.operation();
}
catch (error) {
    console.error(options.failureMessage, error);
    try {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        await qerrors(errorObj, `errorTypes.executeWithQerrors.${options.opName}`, { operation: options.opName, context: options.context, failureMessage: options.failureMessage, timestamp: new Date().toISOString() });
    }
    catch (qerror) {
        console.error('qerrors logging failed in executeWithQerrors', qerror);
    }
    throw error;
} };
export const formatErrorMessage = (error, context) => error instanceof Error ? `${context}: ${error.message}` : `${context}: ${String(error)}`;
//# sourceMappingURL=errorTypes.js.map