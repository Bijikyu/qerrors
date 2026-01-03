/**
 * Memory Monitor Class
 *
 * Implements singleton pattern for consistent memory monitoring across
 * the application with configurable thresholds and event notifications.
 */
export class MemoryMonitor extends EventEmitter<[never]> {
    constructor();
    currentLevel: any;
    lastCheck: number | undefined;
    checkInterval: number | undefined;
    cachedMemoryUsage: {
        raw: NodeJS.MemoryUsage;
        heapUsedMB: number;
        heapTotalMB: number;
        heapUsageRatio: number;
        pressureLevel: string;
        timestamp: number;
    } | null;
    cacheExpiry: number | undefined;
    thresholds: {
        CRITICAL: {
            threshold: number;
            priority: number;
            name: string;
        };
        HIGH: {
            threshold: number;
            priority: number;
            name: string;
        };
        MEDIUM: {
            threshold: number;
            priority: number;
            name: string;
        };
        LOW: {
            threshold: number;
            priority: number;
            name: string;
        };
    } | undefined;
    /**
     * Configure custom thresholds for specific use cases
     *
     * @param {Object} customThresholds - Custom threshold configuration
     */
    configureThresholds(customThresholds: Object): void;
    /**
     * Get current memory usage with caching to reduce overhead
     *
     * @returns {Object} Memory usage information with pressure level
     */
    getMemoryUsage(): Object;
    /**
     * Calculate memory pressure level based on usage ratio
     *
     * @param {number} ratio - Memory usage ratio (0.0 to 1.0)
     * @returns {string} Current pressure level
     */
    calculatePressureLevel(ratio: number): string;
    /**
     * Handle pressure level changes and emit appropriate events
     *
     * @param {string} newLevel - New pressure level
     */
    handlePressureLevelChange(newLevel: string): void;
    /**
     * Check if memory pressure is at or above specified level
     *
     * @param {string} level - Minimum pressure level to check
     * @returns {boolean} True if pressure is at or above specified level
     */
    isPressureLevel(level: string): boolean;
    /**
     * Get memory usage recommendations based on current pressure
     *
     * @returns {Array} Array of actionable recommendations
     */
    getRecommendations(): any[];
    /**
     * Start continuous memory monitoring
     *
     * @param {number} [interval=5000] - Monitoring interval in milliseconds
     */
    startMonitoring(interval?: number): void;
    monitoringTimer: NodeJS.Timeout | null | undefined;
    /**
     * Stop continuous memory monitoring
     */
    stopMonitoring(): void;
    /**
     * Get memory usage statistics over time
     *
     * @param {number} [samples=10] - Number of recent samples to analyze
     * @returns {Object} Statistical summary of memory usage
     */
    getMemoryStatistics(samples?: number): Object;
    /**
     * Force garbage collection if available
     *
     * @returns {boolean} True if GC was triggered
     */
    forceGarbageCollection(): boolean;
}
export const memoryMonitor: MemoryMonitor;
/**
 * Convenience functions for common memory monitoring tasks
 */
/**
 * Check current memory pressure level
 */
export function getCurrentMemoryPressure(): Object;
/**
 * Check if memory pressure is critical
 */
export function isMemoryCritical(): boolean;
/**
 * Check if memory pressure is high or critical
 */
export function isMemoryHigh(): boolean;
/**
 * Get memory usage recommendations
 */
export function getMemoryRecommendations(): any[];
/**
 * Start memory monitoring
 */
export function startMemoryMonitoring(interval: any): void;
/**
 * Stop memory monitoring
 */
export function stopMemoryMonitoring(): void;
export namespace MEMORY_PRESSURE_LEVELS {
    namespace CRITICAL {
        let threshold: number;
        let priority: number;
        let name: string;
    }
    namespace HIGH {
        let threshold_1: number;
        export { threshold_1 as threshold };
        let priority_1: number;
        export { priority_1 as priority };
        let name_1: string;
        export { name_1 as name };
    }
    namespace MEDIUM {
        let threshold_2: number;
        export { threshold_2 as threshold };
        let priority_2: number;
        export { priority_2 as priority };
        let name_2: string;
        export { name_2 as name };
    }
    namespace LOW {
        let threshold_3: number;
        export { threshold_3 as threshold };
        let priority_3: number;
        export { priority_3 as priority };
        let name_3: string;
        export { name_3 as name };
    }
}
import EventEmitter = require("events");
//# sourceMappingURL=memoryMonitor.d.ts.map