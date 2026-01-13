/**
 * Memory-efficient queue manager with bounded resources
 */
export class ScalableQueueManager extends EventEmitter<[never]> {
    constructor(options?: {});
    maxQueueSize: any;
    maxConcurrency: any;
    queue: any[];
    activeCount: number;
    totalProcessed: number;
    rejectCount: number;
    metrics: {
        avgProcessingTime: number;
        maxProcessingTime: number;
        minProcessingTime: number;
    };
    cleanupInterval: NodeJS.Timeout;
    /**
     * Add task to queue with bounded size and overflow protection
     */
    enqueue(task: any, priority?: number): Promise<any>;
    /**
     * Process queue with concurrency control
     */
    processQueue(): Promise<void>;
    /**
     * Update metrics with memory-efficient rolling average
     */
    updateMetrics(processingTime: any): void;
    /**
     * Remove item from queue
     */
    removeFromQueue(queueItem: any): void;
    /**
     * Cleanup expired items and prevent memory leaks
     */
    cleanup(): void;
    /**
     * Get queue statistics
     */
    getStats(): {
        queueLength: number;
        activeCount: number;
        totalProcessed: number;
        rejectCount: number;
        metrics: {
            avgProcessingTime: number;
            maxProcessingTime: number;
            minProcessingTime: number;
        };
    };
    /**
     * Graceful shutdown
     */
    shutdown(): void;
}
/**
 * Memory-efficient cache with LRU eviction and size limits
 */
export class ScalableCache {
    constructor(options?: {});
    maxSize: any;
    ttl: any;
    cache: Map<any, any>;
    accessOrder: Map<any, any>;
    cleanupInterval: NodeJS.Timeout;
    /**
     * Get item from cache
     */
    get(key: any): any;
    /**
     * Set item in cache with size management
     */
    set(key: any, value: any): void;
    /**
     * Delete item from cache
     */
    delete(key: any): void;
    /**
     * Find oldest accessed key for LRU eviction
     */
    findOldestKey(): any;
    /**
     * Cleanup expired items
     */
    cleanup(): void;
    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        maxSize: any;
        hitRate: number;
    };
    /**
     * Clear cache
     */
    clear(): void;
    /**
     * Shutdown cache
     */
    shutdown(): void;
}
/**
 * Optimized error handler with memory management
 */
export class ScalableErrorHandler {
    constructor(options?: {});
    maxErrorHistory: number;
    errorHistory: CircularErrorBuffer;
    queueManager: ScalableQueueManager;
    cache: ScalableCache;
    memoryCheckInterval: NodeJS.Timeout;
    emergencyCleanupThreshold: number;
    /**
     * Handle error with memory-efficient processing
     */
    handleError(error: any, context?: {}): Promise<{
        id: string;
        timestamp: number;
        message: string;
        name: string;
        stack: any;
        context: {};
        severity: any;
    } | {
        advice: any;
        cached: boolean;
        id: string;
        timestamp: number;
        message: string;
        name: string;
        stack: any;
        context: {};
        severity: any;
    }>;
    /**
     * Add error to bounded history with memory-aware sizing
     */
    addToHistory(errorRecord: any): void;
    /**
     * Adjust error history size based on memory pressure
     */
    adjustHistorySize(): void;
    /**
     * Enforce history size limit with efficient cleanup
     */
    enforceHistoryLimit(customLimit?: null): void;
    /**
     * Sanitize context to prevent memory bloat
     */
    sanitizeContext(context: any): {};
    /**
     * Generate unique error ID (optimized for performance)
     */
    generateErrorId(): string;
    /**
     * Generate cache key for error
     */
    generateCacheKey(errorRecord: any): string;
    /**
     * Analyze error (placeholder for AI analysis)
     */
    analyzeError(errorRecord: any): Promise<{
        suggestion: string;
        severity: any;
        timestamp: number;
    }>;
    /**
     * Get error statistics
     */
    getStats(): {
        errorHistory: number;
        maxErrorHistory: number;
        queue: {
            queueLength: number;
            activeCount: number;
            totalProcessed: number;
            rejectCount: number;
            metrics: {
                avgProcessingTime: number;
                maxProcessingTime: number;
                minProcessingTime: number;
            };
        };
        cache: {
            size: number;
            maxSize: any;
            hitRate: number;
        };
    };
    /**
     * Graceful shutdown with memory cleanup
     */
    shutdown(): void;
}
/**
 * Memory-efficient circular buffer for error history
 */
export class CircularErrorBuffer {
    constructor(maxSize?: number);
    maxSize: number;
    buffer: any[];
    head: number;
    tail: number;
    count: number;
    /**
     * Add error record to circular buffer
     */
    push(errorRecord: any): void;
    /**
     * Get all error records in chronological order
     */
    getAll(): any[];
    /**
     * Get current size
     */
    get size(): number;
    /**
     * Clear buffer
     */
    clear(): void;
    /**
     * Resize buffer (only allows shrinking for safety)
     */
    resize(newMaxSize: any): void;
}
import { EventEmitter } from "events";
//# sourceMappingURL=scalabilityFixes.d.ts.map