/**
 * Calculate memory-aware size using linear scaling
 *
 * @param {number} baseLimit - Base limit for normal memory conditions
 * @param {Object} [options={}] - Configuration options
 * @param {Object} [options.scalingFactors] - Custom scaling factors per pressure level
 * @param {Object} [options.minLimits] - Custom minimum limits per pressure level
 * @param {number} [options.maxLimit] - Maximum allowed limit regardless of memory pressure
 * @returns {number} Adjusted size based on current memory pressure
 */
export function calculateMemoryAwareSize(baseLimit: number, options?: {
    scalingFactors?: Object | undefined;
    minLimits?: Object | undefined;
    maxLimit?: number | undefined;
}): number;
/**
 * Calculate memory-aware cache size with cache-specific defaults
 *
 * @param {number} baseLimit - Base cache limit
 * @param {Object} [options={}] - Additional configuration
 * @returns {number} Adjusted cache size
 */
export function calculateCacheSize(baseLimit: number, options?: Object): number;
/**
 * Calculate memory-aware queue size with queue-specific defaults
 *
 * @param {Object} queueLimits - Queue limits by pressure level
 * @param {Object} [options={}] - Additional configuration
 * @returns {number} Adjusted queue size
 */
export function calculateQueueSize(queueLimits: Object, options?: Object): number;
/**
 * Calculate memory-aware pool size for connection pools or similar resources
 *
 * @param {number} basePoolSize - Base pool size
 * @param {Object} [options={}] - Pool-specific configuration
 * @returns {number} Adjusted pool size
 */
export function calculatePoolSize(basePoolSize: number, options?: Object): number;
/**
 * Get current scaling factor based on memory pressure
 *
 * @param {Object} [scalingFactors] - Custom scaling factors
 * @returns {number} Current scaling factor (0.0 to 1.0)
 */
export function getCurrentScalingFactor(scalingFactors?: Object): number;
/**
 * Check if memory pressure indicates resource reduction is needed
 *
 * @returns {boolean} True if should reduce resource usage
 */
export function shouldReduceResources(): boolean;
/**
 * Check if memory pressure indicates aggressive resource reduction is needed
 *
 * @returns {boolean} True if should aggressively reduce resource usage
 */
export function shouldAggressivelyReduce(): boolean;
/**
 * Create a memory-aware resource manager for dynamic sizing
 *
 * @param {Object} config - Configuration for resource management
 * @returns {Object} Resource manager with size calculation methods
 */
export function createMemoryAwareResourceManager(config: Object): Object;
export namespace DEFAULT_SCALING_FACTORS {
    let CRITICAL: number;
    let HIGH: number;
    let MEDIUM: number;
    let LOW: number;
}
export namespace DEFAULT_MIN_LIMITS {
    let CRITICAL_1: number;
    export { CRITICAL_1 as CRITICAL };
    let HIGH_1: number;
    export { HIGH_1 as HIGH };
    let MEDIUM_1: number;
    export { MEDIUM_1 as MEDIUM };
    let LOW_1: number;
    export { LOW_1 as LOW };
}
//# sourceMappingURL=adaptiveSizing.d.ts.map