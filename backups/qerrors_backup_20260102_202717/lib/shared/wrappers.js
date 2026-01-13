/**
 * Safe async wrappers for qerrors module
 */
export const createSafeAsyncWrapper = (options) => {
    // Simple placeholder implementation
    return async (...args) => {
        try {
            return await options.fallbackFn?.(...args);
        }
        catch (error) {
            if (!options.silent) {
                console.error(`Error in ${options.functionName || 'operation'}:`, error);
            }
            return undefined;
        }
    };
};
export const createSafeLogger = (functionName, fallbackLevel = 'error') => {
    return (message, details) => {
        const level = fallbackLevel.toUpperCase();
        switch (level) {
            case 'ERROR':
                console.error(`[${functionName}] ${message}`, details);
                break;
            case 'WARN':
                console.warn(`[${functionName}] ${message}`, details);
                break;
            case 'INFO':
                console.info(`[${functionName}] ${message}`, details);
                break;
            case 'LOG':
                console.log(`[${functionName}] ${message}`, details);
                break;
            default:
                console.log(`[${functionName}] ${message}`, details);
                break;
        }
    };
};
export const createSafeOperation = (asyncFn, fallbackValue, onError) => {
    return async (...args) => {
        try {
            return await asyncFn(...args);
        }
        catch (error) {
            onError?.(error, ...args);
            return fallbackValue;
        }
    };
};
export const safeJsonParse = (text, fallback = null) => {
    try {
        return JSON.parse(text);
    }
    catch {
        return fallback;
    }
};
import { safeJsonStringify as _safeJsonStringify } from './jsonHelpers.js';
export const safeJsonStringify = _safeJsonStringify;
//# sourceMappingURL=wrappers.js.map