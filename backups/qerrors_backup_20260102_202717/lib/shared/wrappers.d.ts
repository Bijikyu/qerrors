/**
 * Safe async wrappers for qerrors module
 */
export declare const createSafeAsyncWrapper: (options: {
    modulePath?: string;
    functionName?: string;
    fallbackFn?: (...args: any[]) => any;
    silent?: boolean;
    errorMessage?: string;
}) => any;
export declare const createSafeLogger: (functionName: string, fallbackLevel?: "error" | "warn" | "log" | "info") => any;
export declare const createSafeOperation: (asyncFn: (...args: any[]) => Promise<any>, fallbackValue?: any, onError?: (error: unknown, ...args: any[]) => void) => any;
export declare const safeJsonParse: (text: string, fallback?: any) => any;
import { safeJsonStringify as _safeJsonStringify } from './jsonHelpers.js';
export declare const safeJsonStringify: typeof _safeJsonStringify;
//# sourceMappingURL=wrappers.d.ts.map