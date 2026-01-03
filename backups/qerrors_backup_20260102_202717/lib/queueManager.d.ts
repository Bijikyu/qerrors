/**
 * Queue management utilities for qerrors module
 *
 * This module provides queue management functionality for handling
 * AI analysis requests with proper rate limiting and metrics.
 */
/**
 * Get the current queue reject count
 * @returns Number of rejected queue requests
 */
export declare const getQueueRejectCount: () => number;
/**
 * Start queue metrics logging
 */
export declare const startQueueMetrics: () => void;
/**
 * Stop queue metrics logging
 */
export declare const stopQueueMetrics: () => void;
/**
 * Start advice cleanup interval
 * @param purgeFunction - Function to call for cleanup
 */
export declare const startAdviceCleanup: (purgeFunction: () => void) => void;
/**
 * Stop advice cleanup interval
 */
export declare const stopAdviceCleanup: () => void;
/**
 * Enforce queue limit
 * @param currentLength - Current queue length
 * @param maxLength - Maximum allowed queue length
 * @returns True if request is allowed, false if rejected
 */
export declare const enforceQueueLimit: (currentLength: number, maxLength: number) => boolean;
/**
 * Create a rate limiter
 * @param max - Maximum concurrent operations
 * @returns pLimit instance
 */
export declare const createLimiter: (max: number) => import("p-limit").LimitFunction;
//# sourceMappingURL=queueManager.d.ts.map