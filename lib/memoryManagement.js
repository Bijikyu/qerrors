"use strict";
/**
 * Scalable Memory Management Utilities
 *
 * Provides memory-efficient data structures and algorithms
 * for high-load scenarios with bounded memory usage.
 */
const qerrors = require('./qerrors');
/**
 * Memory-bounded circular buffer for scalability
 */
class CircularBuffer {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.buffer = new Array(maxSize);
        this.head = 0;
        this.tail = 0;
        this.count = 0;
    }
    push(item) {
        try {
            this.buffer[this.tail] = item;
            this.tail = (this.tail + 1) % this.maxSize;
            if (this.count < this.maxSize) {
                this.count++;
            }
            else {
                this.head = (this.head + 1) % this.maxSize; // Overwrite oldest
            }
        }
        catch (error) {
            // Log circular buffer push error asynchronously
            setImmediate(() => {
                qerrors(error, 'memoryManagement.CircularBuffer.push', {
                    maxSize: this.maxSize,
                    currentCount: this.count,
                    tail: this.tail,
                    head: this.head,
                    operation: 'circular_buffer_push'
                }).catch(qerror => {
                    console.error('qerrors logging failed in CircularBuffer push', qerror);
                });
            });
            throw error;
        }
    }
    shift() {
        try {
            if (this.count === 0)
                return undefined;
            const item = this.buffer[this.head];
            this.head = (this.head + 1) % this.maxSize;
            this.count--;
            return item;
        }
        catch (error) {
            // Log circular buffer shift error asynchronously
            setImmediate(() => {
                qerrors(error, 'memoryManagement.CircularBuffer.shift', {
                    maxSize: this.maxSize,
                    currentCount: this.count,
                    head: this.head,
                    operation: 'circular_buffer_shift'
                }).catch(qerror => {
                    console.error('qerrors logging failed in CircularBuffer shift', qerror);
                });
            });
            throw error;
        }
    }
    size() {
        return this.count;
    }
    isEmpty() {
        return this.count === 0;
    }
    isFull() {
        return this.count === this.maxSize;
    }
    toArray() {
        // For large buffers, use lazy iterator to avoid large memory allocation
        if (this.count > 1000) {
            return this.createLazyIterator();
        }
        
        // Pre-allocate result array with exact size to avoid multiple allocations
        const result = new Array(this.count);
        // Use direct assignment instead of push for better performance
        for (let i = 0; i < this.count; i++) {
            const index = (this.head + i) % this.maxSize;
            result[i] = this.buffer[index];
        }
        return result;
    }
    
    createLazyIterator() {
        const self = this;
        let currentIndex = 0;
        
        return {
            [Symbol.iterator]() {
                return {
                    next() {
                        if (currentIndex >= self.count) {
                            return { done: true };
                        }
                        
                        const index = (self.head + currentIndex) % self.maxSize;
                        const value = self.buffer[index];
                        currentIndex++;
                        
                        return { value, done: false };
                    }
                };
            }
        };
    }
    clear() {
        this.head = 0;
        this.tail = 0;
        this.count = 0;
    }
}
/**
 * Memory-pool for object reuse (reduces GC pressure)
 */
class ObjectPool {
    constructor(createFn, resetFn, maxSize = 1000) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.maxSize = maxSize;
        this.pool = [];
        this.created = 0;
        this.reused = 0;
    }
    acquire() {
        try {
            if (this.pool.length > 0) {
                this.reused++;
                const obj = this.pool.pop();
                this.resetFn(obj);
                return obj;
            }
            this.created++;
            if (this.created > this.maxSize) {
                const error = new Error(`ObjectPool exceeded max size: ${this.created} > ${this.maxSize}`);
                // Log pool size exceeded error asynchronously
                setImmediate(() => {
                    qerrors(error, 'memoryManagement.ObjectPool.acquire', {
                        created: this.created,
                        reused: this.reused,
                        maxSize: this.maxSize,
                        poolSize: this.pool.length,
                        operation: 'object_pool_acquire_size_exceeded'
                    }).catch(qerror => {
                        console.error('qerrors logging failed in ObjectPool acquire size exceeded', qerror);
                    });
                });
                console.warn(`ObjectPool exceeded max size: ${this.created} > ${this.maxSize}`);
            }
            return this.createFn();
        }
        catch (error) {
            // Log object pool acquire error asynchronously
            setImmediate(() => {
                qerrors(error, 'memoryManagement.ObjectPool.acquire.error', {
                    created: this.created,
                    reused: this.reused,
                    maxSize: this.maxSize,
                    poolSize: this.pool.length,
                    operation: 'object_pool_acquire_error'
                }).catch(qerror => {
                    console.error('qerrors logging failed in ObjectPool acquire error', qerror);
                });
            });
            throw error;
        }
    }
    release(obj) {
        if (this.pool.length < this.maxSize) {
            this.pool.push(obj);
        }
    }
    getStats() {
        return {
            poolSize: this.pool.length,
            created: this.created,
            reused: this.reused,
            reuseRate: this.reused / (this.created + this.reused)
        };
    }
    clear() {
        this.pool.length = 0;
    }
}
/**
 * Memory-bounded set with LRU eviction
 */
class BoundedSet {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.data = new Map();
        this.accessOrder = [];
        this.keyCache = new WeakMap(); // Cache for object keys to avoid repeated JSON.stringify
    }
    
    // Optimized key generation with caching
    generateKey(item) {
        if (typeof item !== 'object' || item === null) {
            return item;
        }
        
        // Check cache first
        const cachedKey = this.keyCache.get(item);
        if (cachedKey !== undefined) {
            return cachedKey;
        }
        
try {
            // Use object constructor and property count for simple key
            const constructor = item.constructor && item.constructor.name ? item.constructor.name : 'Object';
            const propCount = Object.keys(item).length;
            const key = `${constructor}:${propCount}`;
            
            // Cache key
            this.keyCache.set(item, key);
            return key;
        } catch (error) {
            // Fallback to JSON.stringify for complex objects
            try {
                const key = JSON.stringify(item);
                this.keyCache.set(item, key);
                return key;
            } catch (stringifyError) {
                // Ultimate fallback - use object hash
                const crypto = require('crypto');
                const hash = crypto.createHash('md5');
                hash.update(String(item));
                const key = hash.digest('hex');
                this.keyCache.set(item, key);
                return key;
            }
        }
    }
    add(item) {
        try {
const key = this.generateKey(item);
            if (this.data.has(key)) {
                // Move to end (most recently used)
                const index = this.accessOrder.indexOf(key);
                this.accessOrder.splice(index, 1);
                this.accessOrder.push(key);
                return false;
            }
            if (this.data.size >= this.maxSize) {
                // Evict least recently used
                const lruKey = this.accessOrder.shift();
                this.data.delete(lruKey);
            }
            this.data.set(key, item);
            this.accessOrder.push(key);
            return true;
        }
        catch (error) {
            // Log bounded set add error asynchronously
            setImmediate(() => {
                qerrors(error, 'memoryManagement.BoundedSet.add', {
                    maxSize: this.maxSize,
                    currentSize: this.data.size,
                    itemType: typeof item,
                    operation: 'bounded_set_add'
                }).catch(qerror => {
                    console.error('qerrors logging failed in BoundedSet add', qerror);
                });
            });
            throw error;
        }
    }
    has(item) {
        const key = typeof item === 'object' ? JSON.stringify(item) : item;
        return this.data.has(key);
    }
    delete(item) {
        const key = typeof item === 'object' ? JSON.stringify(item) : item;
        const index = this.accessOrder.indexOf(key);
        if (index !== -1) {
            this.accessOrder.splice(index, 1);
        }
        return this.data.delete(key);
    }
    size() {
        return this.data.size;
    }
    toArray() {
        return Array.from(this.data.values());
    }
    clear() {
        this.data.clear();
        this.accessOrder.length = 0;
    }
}
/**
 * Memory-efficient event emitter with bounded listeners
 */
class BoundedEventEmitter {
    constructor(maxListeners = 100) {
        this.maxListeners = maxListeners;
        this.listeners = new Map();
        this.eventQueue = new CircularBuffer(1000); // Bounded event queue
        this.processing = false;
    }
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        const eventListeners = this.listeners.get(event);
        if (eventListeners.length >= this.maxListeners) {
            console.warn(`Too many listeners for event ${event}: ${eventListeners.length}`);
            return false;
        }
        eventListeners.push(listener);
        return true;
    }
    off(event, listener) {
        const eventListeners = this.listeners.get(event);
        if (!eventListeners)
            return false;
        const index = eventListeners.indexOf(listener);
        if (index !== -1) {
            eventListeners.splice(index, 1);
            return true;
        }
        return false;
    }
    emit(event, data) {
        // Queue event to prevent stack overflow
        this.eventQueue.push({ event, data, timestamp: Date.now() });
        if (!this.processing) {
            this.processQueue();
        }
    }
    processQueue() {
        this.processing = true;
        try {
            while (!this.eventQueue.isEmpty()) {
                const { event, data } = this.eventQueue.shift();
                const listeners = this.listeners.get(event) || [];
                // Copy listeners to prevent issues with removal during iteration
                const listenersCopy = listeners.slice();
                for (const listener of listenersCopy) {
                    try {
                        listener(data);
                    }
                    catch (error) {
                        // Log event listener error with qerrors
                        setImmediate(() => {
                            qerrors(error, 'memoryManagement.BoundedEventEmitter.processQueue.listener', {
                                event,
                                queueSize: this.eventQueue.size(),
                                listenerCount: listenersCopy.length,
                                operation: 'event_listener_execution'
                            }).catch(qerror => {
                                console.error('qerrors logging failed in BoundedEventEmitter listener', qerror);
                            });
                        });
                        console.error(`Event listener error for ${event}:`, error);
                    }
                }
            }
        }
        catch (error) {
            // Log queue processing error asynchronously
            setImmediate(() => {
                qerrors(error, 'memoryManagement.BoundedEventEmitter.processQueue.error', {
                    queueSize: this.eventQueue.size(),
                    processing: this.processing,
                    operation: 'event_queue_processing_error'
                }).catch(qerror => {
                    console.error('qerrors logging failed in BoundedEventEmitter processQueue error', qerror);
                });
            });
            throw error;
        }
        finally {
            this.processing = false;
        }
    }
    getStats() {
        return {
            queueSize: this.eventQueue.size(),
            listenerCounts: Object.fromEntries(Array.from(this.listeners.entries()).map(([event, listeners]) => [event, listeners.length]))
        };
    }
}
/**
 * Enhanced memory usage monitor with dynamic thresholds and intelligent scaling
 */
class MemoryMonitor {
    constructor(options = {}) {
        const os = require('os');
        const totalMemory = os.totalmem();
        const availableMemory = os.freemem();
        // Dynamic thresholds based on system memory capacity
        this.systemMemoryTotal = totalMemory;
        this.systemMemoryAvailable = availableMemory;
        // Calculate thresholds as percentages of total memory
        const warningPercent = options.warningPercent || 70; // 70% of total memory
        const criticalPercent = options.criticalPercent || 85; // 85% of total memory
        this.warningThreshold = options.warningThreshold || (totalMemory * warningPercent / 100);
        this.criticalThreshold = options.criticalThreshold || (totalMemory * criticalPercent / 100);
        // Adaptive check interval based on memory pressure
        this.checkInterval = options.checkInterval || 5000; // 5 seconds default
        this.adaptiveInterval = true;
        // Enhanced tracking
        this.history = new CircularBuffer(200); // Keep more samples for better analysis
        this.monitoring = false;
        this.cleanupCallbacks = [];
        this.lastCleanup = Date.now();
        this.cleanupInterval = options.cleanupInterval || 30000; // 30 seconds
        // Memory pressure tracking
        this.pressureHistory = new CircularBuffer(50);
        this.currentPressure = 'low';
        this.lastPressureChange = Date.now();
        // Scaling recommendations
        this.scalingActions = {
            low: [],
            medium: ['reduceCache', 'increaseCleanup'],
            high: ['aggressiveCleanup', 'reduceConcurrency'],
            critical: ['emergencyCleanup', 'pauseProcessing']
        };
    }
    start() {
        if (this.monitoring)
            return;
        this.monitoring = true;
        this.interval = setInterval(() => {
            this.checkMemory();
        }, this.checkInterval);
    }
    stop() {
        if (!this.monitoring)
            return;
        this.monitoring = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    checkMemory() {
        try {
            const usage = process.memoryUsage();
            const os = require('os');
            const systemMemory = os.freemem();
            const heapUsed = usage.heapUsed;
            const memoryUsagePercent = (heapUsed / this.systemMemoryTotal) * 100;
            const systemMemoryPercent = ((this.systemMemoryTotal - systemMemory) / this.systemMemoryTotal) * 100;
            // Update history with enhanced metrics
            this.history.push({
                heapUsed,
                heapTotal: usage.heapTotal,
                external: usage.external,
                rss: usage.rss,
                systemMemory,
                memoryUsagePercent,
                systemMemoryPercent,
                timestamp: Date.now()
            });
            // Calculate memory pressure
            const pressure = this.calculateMemoryPressure(heapUsed, systemMemory);
            this.pressureHistory.push({
                pressure,
                timestamp: Date.now()
            });
            // Adaptive check interval based on pressure
            this.adjustCheckInterval(pressure);
            // Handle different pressure levels
            if (pressure === 'critical') {
                const error = new Error(`CRITICAL: Memory usage ${Math.round(heapUsed / 1024 / 1024)}MB (${memoryUsagePercent.toFixed(1)}%) - System memory ${systemMemoryPercent.toFixed(1)}%`);
                // Log critical memory usage with qerrors
                setImmediate(() => {
                    qerrors(error, 'memoryManagement.MemoryMonitor.checkMemory.critical', {
                        heapUsed,
                        heapTotal: usage.heapTotal,
                        memoryUsagePercent,
                        systemMemory,
                        systemMemoryPercent,
                        warningThreshold: this.warningThreshold,
                        criticalThreshold: this.criticalThreshold,
                        operation: 'memory_critical_threshold_exceeded'
                    }).catch(qerror => {
                        console.error('qerrors logging failed in MemoryMonitor critical', qerror);
                    });
                });
                console.error(`CRITICAL: Memory usage ${Math.round(heapUsed / 1024 / 1024)}MB (${memoryUsagePercent.toFixed(1)}%) - System memory ${systemMemoryPercent.toFixed(1)}%`);
                this.triggerMemoryCleanup();
            }
            else if (heapUsed > this.warningThreshold) {
                const error = new Error(`WARNING: Memory usage ${Math.round(heapUsed / 1024 / 1024)}MB exceeds warning threshold`);
                // Log warning memory usage with qerrors
                setImmediate(() => {
                    qerrors(error, 'memoryManagement.MemoryMonitor.checkMemory.warning', {
                        heapUsed,
                        heapTotal: usage.heapTotal,
                        memoryUsagePercent,
                        warningThreshold: this.warningThreshold,
                        operation: 'memory_warning_threshold_exceeded'
                    }).catch(qerror => {
                        console.error('qerrors logging failed in MemoryMonitor warning', qerror);
                    });
                });
                console.warn(`WARNING: Memory usage ${Math.round(heapUsed / 1024 / 1024)}MB exceeds warning threshold`);
            }
        }
        catch (error) {
            // Log memory check error asynchronously
            setImmediate(() => {
                qerrors(error, 'memoryManagement.MemoryMonitor.checkMemory.error', {
                    warningThreshold: this.warningThreshold,
                    criticalThreshold: this.criticalThreshold,
                    systemMemoryTotal: this.systemMemoryTotal,
                    operation: 'memory_check_error'
                }).catch(qerror => {
                    console.error('qerrors logging failed in MemoryMonitor checkMemory error', qerror);
                });
            });
            throw error;
        }
    }
    triggerMemoryCleanup() {
        try {
            const now = Date.now();
            // Prevent too frequent cleanups
            if (now - this.lastCleanup < this.cleanupInterval) {
                return;
            }
            this.lastCleanup = now;
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            // Clear object pools
            if (global.objectPools) {
                for (const pool of global.objectPools) {
                    try {
                        pool.clear();
                    }
                    catch (error) {
                        // Log pool cleanup error asynchronously
                        setImmediate(() => {
                            qerrors(error, 'memoryManagement.MemoryMonitor.triggerMemoryCleanup.pool', {
                                poolType: typeof pool,
                                operation: 'memory_cleanup_pool_clear'
                            }).catch(qerror => {
                                console.error('qerrors logging failed in MemoryMonitor pool cleanup', qerror);
                            });
                        });
                    }
                }
            }
            // Execute registered cleanup callbacks
            for (const callback of this.cleanupCallbacks) {
                try {
                    callback();
                }
                catch (error) {
                    // Log cleanup callback error with qerrors
                    setImmediate(() => {
                        qerrors(error, 'memoryManagement.MemoryMonitor.triggerMemoryCleanup.callback', {
                            callbackCount: this.cleanupCallbacks.length,
                            operation: 'memory_cleanup_callback_execution'
                        }).catch(qerror => {
                            console.error('qerrors logging failed in MemoryMonitor cleanup callback', qerror);
                        });
                    });
                    console.error('Memory cleanup callback error:', error);
                }
            }
        }
        catch (error) {
            // Log memory cleanup trigger error asynchronously
            setImmediate(() => {
                qerrors(error, 'memoryManagement.MemoryMonitor.triggerMemoryCleanup.error', {
                    lastCleanup: this.lastCleanup,
                    cleanupInterval: this.cleanupInterval,
                    callbackCount: this.cleanupCallbacks.length,
                    operation: 'memory_cleanup_trigger_error'
                }).catch(qerror => {
                    console.error('qerrors logging failed in MemoryMonitor triggerMemoryCleanup error', qerror);
                });
            });
            throw error;
        }
    }
    /**
     * Register cleanup callback for memory pressure events
     */
    addCleanupCallback(callback) {
        this.cleanupCallbacks.push(callback);
    }
    /**
     * Calculate memory pressure level based on heap and system memory
     */
    calculateMemoryPressure(heapUsed, systemMemory) {
        const heapUsagePercent = (heapUsed / this.systemMemoryTotal) * 100;
        const systemUsagePercent = ((this.systemMemoryTotal - systemMemory) / this.systemMemoryTotal) * 100;
        // Use the higher of heap or system memory pressure
        const effectivePressure = Math.max(heapUsagePercent, systemUsagePercent);
        if (effectivePressure > 85)
            return 'critical';
        if (effectivePressure > 70)
            return 'high';
        if (effectivePressure > 50)
            return 'medium';
        return 'low';
    }
    /**
     * Adaptively adjust check interval based on memory pressure
     */
    adjustCheckInterval(pressure) {
        if (!this.adaptiveInterval)
            return;
        const newInterval = {
            critical: 1000, // 1 second
            high: 2000, // 2 seconds
            medium: 5000, // 5 seconds
            low: 10000 // 10 seconds
        }[pressure] || this.checkInterval;
        if (newInterval !== this.checkInterval) {
            this.checkInterval = newInterval;
            // Restart interval with new timing
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = setInterval(() => {
                    this.checkMemory();
                }, this.checkInterval);
            }
        }
    }
    /**
     * Get scaling recommendations based on current memory pressure
     */
    getScalingRecommendations() {
        const currentPressure = this.getCurrentPressure();
        return this.scalingActions[currentPressure] || [];
    }
    /**
     * Get current memory pressure from recent history
     */
    getCurrentPressure() {
        if (this.pressureHistory.size() === 0)
            return 'low';
        // Get most recent pressure readings
        const recent = this.pressureHistory.data.slice(-5);
        const pressureCounts = { low: 0, medium: 0, high: 0, critical: 0 };
        for (const entry of recent) {
            if (entry && entry.pressure) {
                pressureCounts[entry.pressure]++;
            }
        }
        // Return the highest pressure level seen recently
        if (pressureCounts.critical > 0)
            return 'critical';
        if (pressureCounts.high > 0)
            return 'high';
        if (pressureCounts.medium > 0)
            return 'medium';
        return 'low';
    }
    /**
     * Get enhanced memory statistics
     */
    getMemoryStats() {
        const usage = process.memoryUsage();
        const os = require('os');
        const systemMemory = os.freemem();
        return {
            process: {
                heapUsed: usage.heapUsed,
                heapTotal: usage.heapTotal,
                external: usage.external,
                rss: usage.rss,
                usagePercent: (usage.heapUsed / this.systemMemoryTotal) * 100
            },
            system: {
                total: this.systemMemoryTotal,
                free: systemMemory,
                used: this.systemMemoryTotal - systemMemory,
                usagePercent: ((this.systemMemoryTotal - systemMemory) / this.systemMemoryTotal) * 100
            },
            thresholds: {
                warning: this.warningThreshold,
                critical: this.criticalThreshold
            },
            pressure: this.getCurrentPressure(),
            checkInterval: this.checkInterval,
            historySize: this.history.size()
        };
    }
    /**
     * Remove cleanup callback
     */
    removeCleanupCallback(callback) {
        const index = this.cleanupCallbacks.indexOf(callback);
        if (index > -1) {
            this.cleanupCallbacks.splice(index, 1);
        }
    }
    getStats() {
        if (this.history.isEmpty())
            return null;
        const samples = this.history.toArray();
        const heapUsages = samples.map(s => s.heapUsed);
        return {
            current: heapUsages[heapUsages.length - 1],
            average: heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length,
            max: Math.max(...heapUsages),
            min: Math.min(...heapUsages),
            samples: heapUsages.length
        };
    }
}
// Global memory management utilities
const MemoryUtils = {
    /**
     * Create bounded array with automatic cleanup
     */
    createBoundedArray(maxSize) {
        const array = [];
        array.push = function (item) {
            if (this.length >= maxSize) {
                this.splice(0, this.length - maxSize + 1);
            }
            return Array.prototype.push.call(this, item);
        };
        return array;
    },
    /**
     * Memory-efficient string concatenation
     */
    joinStrings(strings, separator = '') {
        if (strings.length === 0)
            return '';
        if (strings.length === 1)
            return strings[0];
        // Calculate total length first to avoid reallocations
        let totalLength = 0;
        for (const str of strings) {
            totalLength += str.length;
        }
        totalLength += separator.length * (strings.length - 1);
        // Allocate final string once
        const result = new Array(totalLength);
        let pos = 0;
        for (let i = 0; i < strings.length; i++) {
            if (i > 0) {
                for (let j = 0; j < separator.length; j++) {
                    result[pos++] = separator[j];
                }
            }
            const str = strings[i];
            for (let j = 0; j < str.length; j++) {
                result[pos++] = str[j];
            }
        }
        return String.fromCharCode.apply(null, result);
    },
    /**
     * Efficient object cloning with memory limits
     */
    deepClone(obj, maxDepth = 5, maxProperties = 100) {
        try {
            if (obj === null || typeof obj !== 'object')
                return obj;
            if (maxDepth <= 0)
                return null; // Prevent infinite recursion
            let propertyCount = 0;
            const clone = Array.isArray(obj) ? [] : {};
            for (const key in obj) {
                if (propertyCount++ >= maxProperties) {
                    const error = new Error('Object has too many properties, truncating clone');
                    // Log deep clone truncation error asynchronously
                    setImmediate(() => {
                        qerrors(error, 'memoryManagement.MemoryUtils.deepClone', {
                            maxDepth,
                            maxProperties,
                            propertyCount,
                            objectType: Array.isArray(obj) ? 'array' : 'object',
                            operation: 'deep_clone_truncation'
                        }).catch(qerror => {
                            console.error('qerrors logging failed in MemoryUtils deepClone', qerror);
                        });
                    });
                    console.warn('Object has too many properties, truncating clone');
                    break;
                }
                if (obj.hasOwnProperty(key)) {
                    clone[key] = MemoryUtils.deepClone(obj[key], maxDepth - 1, Math.floor(maxProperties / 2));
                }
            }
            return clone;
        }
        catch (error) {
            // Log deep clone error asynchronously
            setImmediate(() => {
                qerrors(error, 'memoryManagement.MemoryUtils.deepClone.error', {
                    maxDepth,
                    maxProperties,
                    objectType: typeof obj,
                    operation: 'deep_clone_error'
                }).catch(qerror => {
                    console.error('qerrors logging failed in MemoryUtils deepClone error', qerror);
                });
            });
            throw error;
        }
    }
};
module.exports = {
    CircularBuffer,
    ObjectPool,
    BoundedSet,
    BoundedEventEmitter,
    MemoryMonitor,
    MemoryUtils
};
//# sourceMappingURL=memoryManagement.js.map