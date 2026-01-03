/**
 * Unified performance timer implementation
 */
/**
 * Create a unified performance timer
 * @param operation - Name of the operation being timed
 * @param includeMemoryTracking - Whether to track memory usage
 * @param requestId - Optional request ID for correlation
 * @returns Performance timer instance
 */
export const createUnifiedTimer = (operation, includeMemoryTracking = false, requestId = null) => {
    const startTime = process.hrtime.bigint();
    const startMemory = includeMemoryTracking ? process.memoryUsage() : null;
    return {
        elapsed: () => Number(process.hrtime.bigint() - startTime) / 1000000,
        elapsedFormatted: () => {
            const ms = Number(process.hrtime.bigint() - startTime) / 1000000;
            return ms < 1000 ? `${ms.toFixed(2)}ms` :
                ms < 60000 ? `${(ms / 1000).toFixed(2)}s` :
                    `${(ms / 60000).toFixed(2)}m`;
        },
        // Performance logging method
        logPerformance: async (success = true, additionalContext = {}) => {
            const endTime = process.hrtime.bigint();
            const endMemory = includeMemoryTracking ? process.memoryUsage() : null;
            const duration = Number(endTime - startTime) / 1000000;
            const context = {
                operation,
                duration_ms: Math.round(duration * 100) / 100,
                success,
                ...additionalContext
            };
            if (includeMemoryTracking && startMemory && endMemory) {
                context.memory_delta = {
                    heapUsed: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024),
                    external: Math.round((endMemory.external - startMemory.external) / 1024)
                };
            }
            const message = `${operation} completed in ${context.duration_ms}ms (${success ? 'success' : 'failure'})`;
            try {
                const logger = await import('../logger.js');
                if (success) {
                    await logger.logInfo(message, context, requestId);
                }
                else {
                    await logger.logWarn(message, context, requestId);
                }
            }
            catch (err) {
                // Fallback to console if logger fails
                console[success ? 'log' : 'warn'](message, context);
            }
            return context;
        }
    };
};
// Backward compatibility aliases
export const createTimer = () => createUnifiedTimer('operation', false);
export const createPerformanceTimer = (operation, requestId = null) => createUnifiedTimer(operation, true, requestId);
//# sourceMappingURL=timers.js.map