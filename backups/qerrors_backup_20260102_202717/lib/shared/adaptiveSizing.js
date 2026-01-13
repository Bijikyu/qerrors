"use strict";
/**
 * Adaptive Sizing Utility
 *
 * Purpose: Provides memory-aware resource sizing algorithms to optimize
 * cache and queue sizes based on current memory pressure levels.
 *
 * Design Rationale:
 * - Dynamic resource adjustment based on memory availability
 * - Configurable base limits and scaling factors
 * - Prevents memory exhaustion during high pressure
 * - Maintains performance during normal operation
 * - Consistent sizing across different resource types
 */
const { getCurrentMemoryPressure } = require('./memoryMonitor');
/**
 * Default memory pressure thresholds and scaling factors
 */
const DEFAULT_SCALING_FACTORS = {
    CRITICAL: 0.1, // 10% of base limit
    HIGH: 0.25, // 25% of base limit
    MEDIUM: 0.5, // 50% of base limit
    LOW: 1.0 // 100% of base limit
};
/**
 * Default minimum limits for each pressure level
 */
const DEFAULT_MIN_LIMITS = {
    CRITICAL: 5, // Minimum 5 items
    HIGH: 10, // Minimum 10 items
    MEDIUM: 20, // Minimum 20 items
    LOW: 0 // No minimum for low pressure
};
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
function calculateMemoryAwareSize(baseLimit, options = {}) {
    const { scalingFactors = DEFAULT_SCALING_FACTORS, minLimits = DEFAULT_MIN_LIMITS, maxLimit = Infinity } = options;
    // Get current memory pressure
    const memoryInfo = getCurrentMemoryPressure();
    const pressureLevel = memoryInfo.pressureLevel;
    // Calculate scaled size
    const scaleFactor = scalingFactors[pressureLevel] || scalingFactors.LOW;
    const scaledSize = Math.floor(baseLimit * scaleFactor);
    // Apply minimum limit
    const minLimit = minLimits[pressureLevel] || minLimits.LOW;
    const finalSize = Math.max(scaledSize, minLimit);
    // Apply maximum limit
    return Math.min(finalSize, maxLimit);
}
/**
 * Calculate memory-aware cache size with cache-specific defaults
 *
 * @param {number} baseLimit - Base cache limit
 * @param {Object} [options={}] - Additional configuration
 * @returns {number} Adjusted cache size
 */
function calculateCacheSize(baseLimit, options = {}) {
    const cacheOptions = {
        ...options,
        scalingFactors: {
            CRITICAL: 0.1, // Aggressive cache reduction
            HIGH: 0.25, // Significant reduction
            MEDIUM: 0.5, // Moderate reduction
            LOW: 1.0 // Full cache
        },
        minLimits: {
            CRITICAL: 5, // Keep minimum cache entries
            HIGH: 10, // Small cache under pressure
            MEDIUM: 20, // Medium cache
            LOW: 0 // No minimum for low pressure
        },
        maxLimit: Math.min(baseLimit, 200) // Cap maximum cache size
    };
    return calculateMemoryAwareSize(baseLimit, cacheOptions);
}
/**
 * Calculate memory-aware queue size with queue-specific defaults
 *
 * @param {Object} queueLimits - Queue limits by pressure level
 * @param {Object} [options={}] - Additional configuration
 * @returns {number} Adjusted queue size
 */
function calculateQueueSize(queueLimits, options = {}) {
    // Get current memory pressure
    const memoryInfo = getCurrentMemoryPressure();
    const pressureLevel = memoryInfo.pressureLevel.toLowerCase();
    // Get limit for current pressure level with fallback
    // Using lowercase convention for consistency
    const limit = queueLimits[pressureLevel] || queueLimits.low || queueLimits.LOW;
    // Log warning if not low pressure
    if (pressureLevel !== 'low' && options.logWarnings !== false) {
        console.warn(`Memory pressure: ${pressureLevel}, queue limit reduced to: ${limit}`);
    }
    return limit;
}
/**
 * Calculate memory-aware pool size for connection pools or similar resources
 *
 * @param {number} basePoolSize - Base pool size
 * @param {Object} [options={}] - Pool-specific configuration
 * @returns {number} Adjusted pool size
 */
function calculatePoolSize(basePoolSize, options = {}) {
    const poolOptions = {
        ...options,
        scalingFactors: {
            CRITICAL: 0.2, // Keep 20% of pool
            HIGH: 0.4, // Keep 40% of pool
            MEDIUM: 0.7, // Keep 70% of pool
            LOW: 1.0 // Full pool
        },
        minLimits: {
            CRITICAL: 1, // Keep minimum 1 connection
            HIGH: 2, // Keep minimum 2 connections
            MEDIUM: 3, // Keep minimum 3 connections
            LOW: 0 // No minimum for low pressure
        },
        maxLimit: basePoolSize
    };
    return calculateMemoryAwareSize(basePoolSize, poolOptions);
}
/**
 * Get current scaling factor based on memory pressure
 *
 * @param {Object} [scalingFactors] - Custom scaling factors
 * @returns {number} Current scaling factor (0.0 to 1.0)
 */
function getCurrentScalingFactor(scalingFactors = DEFAULT_SCALING_FACTORS) {
    const memoryInfo = getCurrentMemoryPressure();
    const pressureLevel = memoryInfo.pressureLevel;
    return scalingFactors[pressureLevel] || scalingFactors.LOW;
}
/**
 * Check if memory pressure indicates resource reduction is needed
 *
 * @returns {boolean} True if should reduce resource usage
 */
function shouldReduceResources() {
    const memoryInfo = getCurrentMemoryPressure();
    return memoryInfo.pressureLevel === 'HIGH' || memoryInfo.pressureLevel === 'CRITICAL';
}
/**
 * Check if memory pressure indicates aggressive resource reduction is needed
 *
 * @returns {boolean} True if should aggressively reduce resource usage
 */
function shouldAggressivelyReduce() {
    const memoryInfo = getCurrentMemoryPressure();
    return memoryInfo.pressureLevel === 'CRITICAL';
}
/**
 * Create a memory-aware resource manager for dynamic sizing
 *
 * @param {Object} config - Configuration for resource management
 * @returns {Object} Resource manager with size calculation methods
 */
function createMemoryAwareResourceManager(config) {
    const { baseLimit, resourceType = 'cache', scalingFactors = DEFAULT_SCALING_FACTORS, minLimits = DEFAULT_MIN_LIMITS, maxLimit = Infinity } = config;
    return {
        getCurrentSize: () => {
            switch (resourceType) {
                case 'cache':
                    return calculateCacheSize(baseLimit, { scalingFactors, minLimits, maxLimit });
                case 'queue':
                    return calculateQueueSize(baseLimit, { scalingFactors, minLimits, maxLimit });
                case 'pool':
                    return calculatePoolSize(baseLimit, { scalingFactors, minLimits, maxLimit });
                default:
                    return calculateMemoryAwareSize(baseLimit, { scalingFactors, minLimits, maxLimit });
            }
        },
        shouldReduce: shouldReduceResources,
        shouldAggressivelyReduce,
        getCurrentScalingFactor: () => getCurrentScalingFactor(scalingFactors)
    };
}
module.exports = {
    calculateMemoryAwareSize,
    calculateCacheSize,
    calculateQueueSize,
    calculatePoolSize,
    getCurrentScalingFactor,
    shouldReduceResources,
    shouldAggressivelyReduce,
    createMemoryAwareResourceManager,
    // Constants for customization
    DEFAULT_SCALING_FACTORS,
    DEFAULT_MIN_LIMITS
};
//# sourceMappingURL=adaptiveSizing.js.map