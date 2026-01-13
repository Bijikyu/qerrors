'use strict';

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class HealthCheckService {
  constructor(options = {}) {
    this.options = {
      interval: options.interval || 300000, // 5 minutes
      timeout: options.timeout || 5000,
      ...options
    };
    this.lastCheck = null;
    this.status = 'unknown';
    this.metrics = {};
    this.intervals = [];
  }

  async checkHealth() {
    const startTime = performance.now();
    
    try {
      const checks = await Promise.all([
        this.checkFileSystem(),
        this.checkMemory(),
        this.checkDependencies(),
        this.checkLogs()
      ]);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.lastCheck = new Date().toISOString();
      this.status = checks.every(check => check.healthy) ? 'healthy' : 'unhealthy';
      this.metrics = {
        responseTime,
        checks,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      };

      return {
        status: this.status,
        timestamp: this.lastCheck,
        metrics: this.metrics,
        version: this.getVersion()
      };
    } catch (error) {
      this.status = 'unhealthy';
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  async checkFileSystem() {
    try {
      const criticalPaths = [
        './lib/qerrors.js',
        './logs',
        './config'
      ];

      for (const filePath of criticalPaths) {
        if (!fs.existsSync(filePath)) {
          return { healthy: false, issue: `Missing path: ${filePath}` };
        }
      }

      return { healthy: true };
    } catch (error) {
      return { healthy: false, issue: error.message };
    }
  }

  async checkMemory() {
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
      const usageRatio = heapUsedMB / heapTotalMB;

      return {
        healthy: usageRatio < 0.9,
        heapUsed: heapUsedMB,
        heapTotal: heapTotalMB,
        usageRatio
      };
    } catch (error) {
      return { healthy: false, issue: error.message };
    }
  }

  async checkDependencies() {
    try {
      const criticalDeps = ['axios', 'winston', 'lodash'];
      const results = [];

      for (const dep of criticalDeps) {
        try {
          require.resolve(dep);
          results.push({ dependency: dep, available: true });
        } catch (error) {
          results.push({ dependency: dep, available: false, error: error.message });
        }
      }

      return {
        healthy: results.every(r => r.available),
        dependencies: results
      };
    } catch (error) {
      return { healthy: false, issue: error.message };
    }
  }

  async checkLogs() {
    try {
      const logsDir = './logs';
      if (!fs.existsSync(logsDir)) {
        return { healthy: false, issue: 'Logs directory does not exist' };
      }

      const stats = fs.statSync(logsDir);
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      const age = Date.now() - stats.mtime.getTime();

      return {
        healthy: age < maxAge,
        lastModified: stats.mtime,
        ageHours: age / (60 * 60 * 1000)
      };
    } catch (error) {
      return { healthy: false, issue: error.message };
    }
  }

  getVersion() {
    try {
      const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      return packageJson.version;
    } catch (error) {
      return 'unknown';
    }
  }

  startMonitoring() {
    if (this.intervals.length > 0) {
      return; // Already monitoring
    }

    const interval = setInterval(async () => {
      const health = await this.checkHealth();
      
      // Log health status
      if (health.status !== 'healthy') {
        console.error('Health check failed:', health);
      }
    }, this.options.interval);

    this.intervals.push(interval);
    console.log(`Health monitoring started (interval: ${this.options.interval}ms)`);
  }

  stopMonitoring() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    console.log('Health monitoring stopped');
  }

  getMiddleware() {
    return async (req, res, next) => {
      if (req.path === '/health') {
        try {
          const health = await this.checkHealth();
          const statusCode = health.status === 'healthy' ? 200 : 503;
          res.status(statusCode).json(health);
        } catch (error) {
          res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        next();
      }
    };
  }
}

module.exports = HealthCheckService;