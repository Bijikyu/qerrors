export = qerrors;
/**
 * Main qerrors error handler function
 * @param {Error} error - The error to handle
 * @param {string} location - Where the error occurred
 * @param {object} context - Additional context
 * @returns {Promise<object|null>} Error analysis result
 */
declare function qerrors(error: Error, location: string, context?: object): Promise<object | null>;
declare namespace qerrors {
    export { qerrorsMiddleware as middleware, generateErrorId, extractContext, cleanup, getQueueStats, getAnalysisCache };
}
/**
 * Express middleware for error handling
 * @param {object} options - Middleware options
 * @returns {function} Express middleware function
 */
declare function qerrorsMiddleware(options?: object): Function;
/**
 * Generate a unique error identifier
 * @returns {string} A 12-character error ID
 */
declare function generateErrorId(): string;
/**
 * Extract safe context from an error object
 * @param {Error} error - The error object
 * @param {object} context - Additional context
 * @returns {object} Sanitized context object
 */
declare function extractContext(error: Error, context?: object): object;
/**
 * Cleanup resources and shutdown gracefully
 */
declare function cleanup(): void;
declare function getQueueStats(): {
    length: number;
    rejectCount: number;
};
declare function getAnalysisCache(): {
    clear: () => void;
    purgeExpired: () => void;
    startCleanup: () => void;
    stopCleanup: () => void;
};
//# sourceMappingURL=qerrors.d.ts.map