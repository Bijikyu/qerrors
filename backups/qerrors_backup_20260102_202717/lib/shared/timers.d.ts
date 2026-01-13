/**
 * Unified performance timer implementation
 */
export interface TimerContext {
    operation: string;
    duration_ms: number;
    success: boolean;
    memory_delta?: {
        heapUsed: number;
        external: number;
    };
    [key: string]: any;
}
export interface PerformanceTimer {
    elapsed: () => number;
    elapsedFormatted: () => string;
    logPerformance: (success?: boolean, additionalContext?: Record<string, any>) => Promise<TimerContext>;
}
/**
 * Create a unified performance timer
 * @param operation - Name of the operation being timed
 * @param includeMemoryTracking - Whether to track memory usage
 * @param requestId - Optional request ID for correlation
 * @returns Performance timer instance
 */
export declare const createUnifiedTimer: (operation: string, includeMemoryTracking?: boolean, requestId?: string | null) => PerformanceTimer;
export declare const createTimer: () => PerformanceTimer;
export declare const createPerformanceTimer: (operation: string, requestId?: string | null) => PerformanceTimer;
//# sourceMappingURL=timers.d.ts.map