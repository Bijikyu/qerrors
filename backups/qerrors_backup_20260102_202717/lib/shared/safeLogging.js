/**
 * Safe logging utilities for qerrors module
 */
export const safeLogError = (error, context, metadata) => {
    console.error(`[${context}] Error:`, error, metadata);
};
export const safeLogInfo = (message, metadata) => {
    console.info(`[INFO] ${message}`, metadata);
};
export const safeLogWarn = (message, metadata) => {
    console.warn(`[WARN] ${message}`, metadata);
};
export const safeLogDebug = (message, metadata) => {
    console.debug(`[DEBUG] ${message}`, metadata);
};
export const safeLogAudit = (message, metadata) => {
    console.info(`[AUDIT] ${message}`, metadata);
};
//# sourceMappingURL=safeLogging.js.map