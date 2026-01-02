'use strict';

/**
 * Memory Pressure Detection Utility
 * 
 * Purpose: Provides centralized memory monitoring with configurable pressure levels
 * and event-driven notifications for memory state changes. This utility helps
 * prevent memory exhaustion and enables proactive resource management.
 * 
 * Design Rationale:
 * - Singleton pattern for consistent memory state across the application
 * - Configurable pressure thresholds for different operational requirements
 * - Event-driven architecture for responsive memory management
 * - Cached calculations to minimize monitoring overhead
 * - Integration with application logging for observability
 * 
 * Memory Pressure Levels:
 * - CRITICAL: >85% memory usage - Immediate action required
 * - HIGH: 70-85% memory usage - Caution, proactive cleanup recommended
 * - MEDIUM: 50-70% memory usage - Normal operation with monitoring
 * - LOW: <50% memory usage - Optimal performance
 */

const EventEmitter = require('events');
const { safeLogInfo, safeLogWarn, safeLogError } = require('./safeLogging');

/**
 * Memory pressure level constants
 */
const MEMORY_PRESSURE_LEVELS = {
  CRITICAL: { threshold: 0.85, priority: 4, name: 'CRITICAL' },
  HIGH: { threshold: 0.70, priority: 3, name: 'HIGH' },
  MEDIUM: { threshold: 0.50, priority: 2, name: 'MEDIUM' },
  LOW: { threshold: 0.0, priority: 1, name: 'LOW' }
};

/**
 * Memory Monitor Class
 * 
 * Implements singleton pattern for consistent memory monitoring across
 * the application with configurable thresholds and event notifications.
 */
class MemoryMonitor extends EventEmitter {
  constructor() {
    super();
    
    // Singleton enforcement
    if (MemoryMonitor.instance) {
      return MemoryMonitor.instance;
    }
    
    this.currentLevel = null;
    this.lastCheck = 0;
    this.checkInterval = 5000; // 5 seconds between checks
    this.cachedMemoryUsage = null;
    this.cacheExpiry = 1000; // Cache for 1 second
    
    // Configurable thresholds (can be customized per module)
    this.thresholds = { ...MEMORY_PRESSURE_LEVELS };
    
    MemoryMonitor.instance = this;
  }

  /**
   * Configure custom thresholds for specific use cases
   * 
   * @param {Object} customThresholds - Custom threshold configuration
   */
  configureThresholds(customThresholds) {
    this.thresholds = { ...this.thresholds, ...customThresholds };
    safeLogInfo('Memory monitor thresholds configured', { thresholds: this.thresholds });
  }

  /**
   * Get current memory usage with caching to reduce overhead
   * 
   * @returns {Object} Memory usage information with pressure level
   */
  getMemoryUsage() {
    const now = Date.now();
    
    // Use cached value if still valid
    if (this.cachedMemoryUsage && (now - this.lastCheck) < this.cacheExpiry) {
      return this.cachedMemoryUsage;
    }
    
    // Calculate fresh memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const heapUsageRatio = memUsage.heapUsed / memUsage.heapTotal;
    
    // Determine current pressure level
    const currentLevel = this.calculatePressureLevel(heapUsageRatio);
    
    this.cachedMemoryUsage = {
      raw: memUsage,
      heapUsedMB,
      heapTotalMB,
      heapUsageRatio,
      pressureLevel: currentLevel,
      timestamp: now
    };
    
    this.lastCheck = now;
    
    // Emit events for pressure level changes
    this.handlePressureLevelChange(currentLevel);
    
    return this.cachedMemoryUsage;
  }

  /**
   * Calculate memory pressure level based on usage ratio
   * 
   * @param {number} ratio - Memory usage ratio (0.0 to 1.0)
   * @returns {string} Current pressure level
   */
  calculatePressureLevel(ratio) {
    if (ratio >= this.thresholds.CRITICAL.threshold) {
      return 'CRITICAL';
    } else if (ratio >= this.thresholds.HIGH.threshold) {
      return 'HIGH';
    } else if (ratio >= this.thresholds.MEDIUM.threshold) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  /**
   * Handle pressure level changes and emit appropriate events
   * 
   * @param {string} newLevel - New pressure level
   */
  handlePressureLevelChange(newLevel) {
    if (this.currentLevel !== newLevel) {
      const oldLevel = this.currentLevel;
      this.currentLevel = newLevel;
      
      safeLogInfo('Memory pressure level changed', {
        from: oldLevel,
        to: newLevel,
        memory: this.cachedMemoryUsage
      });
      
      // Emit change event with error handling
      try {
        this.emit('pressureChange', {
          from: oldLevel,
          to: newLevel,
          memory: this.cachedMemoryUsage
        });
        
        // Emit level-specific events with error handling
        this.emit(newLevel.toLowerCase(), this.cachedMemoryUsage);
      } catch (eventError) {
        safeLogError('Error in memory pressure event handlers', {
          error: eventError.message,
          level: newLevel,
          from: oldLevel
        });
      }
    }
  }

  /**
   * Check if memory pressure is at or above specified level
   * 
   * @param {string} level - Minimum pressure level to check
   * @returns {boolean} True if pressure is at or above specified level
   */
  isPressureLevel(level) {
    const memory = this.getMemoryUsage();
    const levelPriority = this.thresholds[level]?.priority || 0;
    const currentPriority = this.thresholds[memory.pressureLevel]?.priority || 0;
    
    return currentPriority >= levelPriority;
  }

  /**
   * Get memory usage recommendations based on current pressure
   * 
   * @returns {Array} Array of actionable recommendations
   */
  getRecommendations() {
    const memory = this.getMemoryUsage();
    const recommendations = [];
    
    switch (memory.pressureLevel) {
      case 'CRITICAL':
        recommendations.push({
          priority: 'immediate',
          action: 'emergency_gc',
          description: 'Force garbage collection immediately'
        });
        recommendations.push({
          priority: 'immediate',
          action: 'clear_caches',
          description: 'Clear all application caches'
        });
        recommendations.push({
          priority: 'immediate',
          action: 'reject_operations',
          description: 'Reject non-critical operations'
        });
        break;
        
      case 'HIGH':
        recommendations.push({
          priority: 'high',
          action: 'proactive_gc',
          description: 'Trigger proactive garbage collection'
        });
        recommendations.push({
          priority: 'high',
          action: 'reduce_cache_sizes',
          description: 'Reduce cache TTLs and sizes'
        });
        recommendations.push({
          priority: 'medium',
          action: 'limit_concurrency',
          description: 'Limit operation concurrency'
        });
        break;
        
      case 'MEDIUM':
        recommendations.push({
          priority: 'medium',
          action: 'monitor_closely',
          description: 'Increase monitoring frequency'
        });
        recommendations.push({
          priority: 'low',
          action: 'optimize_allocations',
          description: 'Review memory allocation patterns'
        });
        break;
        
      case 'LOW':
        recommendations.push({
          priority: 'info',
          action: 'normal_operation',
          description: 'Memory usage is optimal'
        });
        break;
    }
    
    return recommendations;
  }

  /**
   * Start continuous memory monitoring
   * 
   * @param {number} [interval=5000] - Monitoring interval in milliseconds
   */
  startMonitoring(interval = 5000) {
    this.checkInterval = interval;
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    
    this.monitoringTimer = setInterval(() => {
      this.getMemoryUsage();
    }, this.checkInterval);
    
    safeLogInfo('Memory monitoring started', { interval: this.checkInterval });
  }

  /**
   * Stop continuous memory monitoring
   */
  stopMonitoring() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
      safeLogInfo('Memory monitoring stopped');
    }
  }

  /**
   * Get memory usage statistics over time
   * 
   * @param {number} [samples=10] - Number of recent samples to analyze
   * @returns {Object} Statistical summary of memory usage
   */
  getMemoryStatistics(samples = 10) {
    // For now, return current statistics
    // In a full implementation, this would maintain a history buffer
    const memory = this.getMemoryUsage();
    
    return {
      current: memory,
      average: memory.heapUsedMB, // Would be calculated from history
      peak: memory.heapUsedMB,     // Would be calculated from history
      samples: 1,                   // Would be actual sample count
      trend: 'stable'              // Would be calculated from trend analysis
    };
  }

  /**
   * Force garbage collection if available
   * 
   * @returns {boolean} True if GC was triggered
   */
  forceGarbageCollection() {
    if (global.gc) {
      global.gc();
      safeLogInfo('Forced garbage collection');
      return true;
    } else {
      safeLogWarn('Garbage collection not available (run with --expose-gc)');
      return false;
    }
  }
}

// Create singleton instance
const memoryMonitor = new MemoryMonitor();

/**
 * Convenience functions for common memory monitoring tasks
 */

/**
 * Check current memory pressure level
 */
function getCurrentMemoryPressure() {
  return memoryMonitor.getMemoryUsage();
}

/**
 * Check if memory pressure is critical
 */
function isMemoryCritical() {
  return memoryMonitor.isPressureLevel('CRITICAL');
}

/**
 * Check if memory pressure is high or critical
 */
function isMemoryHigh() {
  return memoryMonitor.isPressureLevel('HIGH');
}

/**
 * Get memory usage recommendations
 */
function getMemoryRecommendations() {
  return memoryMonitor.getRecommendations();
}

/**
 * Start memory monitoring
 */
function startMemoryMonitoring(interval) {
  return memoryMonitor.startMonitoring(interval);
}

/**
 * Stop memory monitoring
 */
function stopMemoryMonitoring() {
  return memoryMonitor.stopMonitoring();
}

module.exports = {
  MemoryMonitor,
  memoryMonitor,
  getCurrentMemoryPressure,
  isMemoryCritical,
  isMemoryHigh,
  getMemoryRecommendations,
  startMemoryMonitoring,
  stopMemoryMonitoring,
  MEMORY_PRESSURE_LEVELS
};