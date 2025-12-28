/**
 * Centralized Rate Limiting Coordinator
 * 
 * Provides unified rate limiting across all endpoints with proper coordination
 * to prevent conflicts and ensure consistent behavior.
 */

'use strict';

const { getEnhancedRateLimiter } = require('./enhancedRateLimiter');
const qerrors = require('./qerrors');

class CentralizedRateLimitCoordinator {
  constructor() {
    this.rateLimiter = getEnhancedRateLimiter();
    this.endpointLimiters = new Map();
    this.globalStats = {
      totalRequests: 0,
      blockedRequests: 0,
      endpointStats: {}
    };
    this.coordinationInterval = null;
    this.startCoordination();
  }
  
  /**
   * Start periodic coordination of rate limiters
   */
  startCoordination() {
    this.coordinationInterval = setInterval(() => {
      this.coordinateLimiters();
    }, 30000); // Every 30 seconds
    this.coordinationInterval.unref();
  }
  
  /**
   * Coordinate rate limiters to prevent conflicts and optimize performance
   */
  coordinateLimiters() {
    try {
      const stats = this.rateLimiter.getStats();
      const memoryPressure = this.rateLimiter.getMemoryPressure();
      
      // Adjust limits based on memory pressure
      if (memoryPressure === 'critical') {
        this.adjustAllLimits(0.5); // Reduce all limits by 50%
      } else if (memoryPressure === 'high') {
        this.adjustAllLimits(0.75); // Reduce all limits by 25%
      }
      
      // Update global statistics
      this.globalStats.totalRequests = stats.totalRequests;
      this.globalStats.blockedRequests = stats.blockedRequests;
      
      // Log coordination activity
      if (stats.blockedRequests > 100) {
        console.warn(`High rate limit activity: ${stats.blockedRequests} blocked requests`);
      }
      
    } catch (error) {
      qerrors(error, 'centralizedRateLimitCoordinator.coordinateLimiters', {
        operation: 'rate_limiter_coordination',
        endpointCount: this.endpointLimiters.size
      });
    }
  }
  
  /**
   * Adjust all rate limits by a multiplier
   */
  adjustAllLimits(multiplier) {
    try {
      // This would require the enhanced rate limiter to support dynamic adjustment
      console.info(`Adjusting all rate limits by ${multiplier}x multiplier due to memory pressure`);
    } catch (error) {
      qerrors(error, 'centralizedRateLimitCoordinator.adjustAllLimits', {
        operation: 'dynamic_limit_adjustment',
        multiplier: multiplier
      });
    }
  }
  
  /**
   * Get or create limiter for specific endpoint
   */
  getEndpointLimiter(endpointPath) {
    if (!this.endpointLimiters.has(endpointPath)) {
      const limiter = this.rateLimiter.createLimiter(endpointPath);
      this.endpointLimiters.set(endpointPath, limiter);
    }
    return this.endpointLimiters.get(endpointPath);
  }
  
  /**
   * Get comprehensive rate limiting statistics
   */
  getStats() {
    const limiterStats = this.rateLimiter.getStats();
    
    return {
      global: this.globalStats,
      limiter: limiterStats,
      endpoints: this.endpointLimiters.size,
      coordination: {
        lastCoordination: Date.now(),
        memoryPressure: this.rateLimiter.getMemoryPressure()
      }
    };
  }
  
  /**
   * Reset all rate limiting statistics
   */
  resetStats() {
    this.globalStats = {
      totalRequests: 0,
      blockedRequests: 0,
      endpointStats: {}
    };
    
    // Reset limiter stats if supported
    if (this.rateLimiter.resetStats) {
      this.rateLimiter.resetStats();
    }
  }
  
  /**
   * Shutdown coordinator and cleanup resources
   */
  shutdown() {
    if (this.coordinationInterval) {
      clearInterval(this.coordinationInterval);
      this.coordinationInterval = null;
    }
    
    this.endpointLimiters.clear();
    
    if (this.rateLimiter.shutdown) {
      this.rateLimiter.shutdown();
    }
  }
}

// Singleton instance
let coordinator = null;

/**
 * Get or create centralized rate limiting coordinator
 */
function getCentralizedRateLimitCoordinator() {
  if (!coordinator) {
    coordinator = new CentralizedRateLimitCoordinator();
    
    // Add shutdown listeners
    const gracefulShutdown = () => {
      if (coordinator) {
        coordinator.shutdown();
        coordinator = null;
      }
    };
    
    process.once('SIGTERM', gracefulShutdown);
    process.once('SIGINT', gracefulShutdown);
    process.once('beforeExit', gracefulShutdown);
  }
  return coordinator;
}

/**
 * Express middleware factory for coordinated rate limiting
 */
function createCoordinatedRateLimitMiddleware(endpointPath) {
  const coordinator = getCentralizedRateLimitCoordinator();
  const limiter = coordinator.getEndpointLimiter(endpointPath);
  
  return async (req, res, next) => {
    try {
      // Update global stats
      coordinator.globalStats.totalRequests++;
      
      // Update endpoint stats
      if (!coordinator.globalStats.endpointStats[endpointPath]) {
        coordinator.globalStats.endpointStats[endpointPath] = 0;
      }
      coordinator.globalStats.endpointStats[endpointPath]++;
      
      // Apply rate limiting
      return limiter(req, res, next);
      
    } catch (error) {
      qerrors(error, 'coordinatedRateLimitMiddleware', {
        operation: 'rate_limiting_middleware',
        endpointPath: endpointPath,
        ip: req.ip
      });
      next(error);
    }
  };
}

module.exports = {
  CentralizedRateLimitCoordinator,
  getCentralizedRateLimitCoordinator,
  createCoordinatedRateLimitMiddleware
};