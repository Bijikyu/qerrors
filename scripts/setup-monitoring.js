#!/usr/bin/env node

/**
 * Production logging and monitoring setup for qerrors
 * Configures comprehensive logging and health monitoring
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('📊 Setting up logging and monitoring...\n');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function logStep(step, color = colors.blue) {
  console.log(`${color}► ${step}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`  ${colors.green}✓ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`  ${colors.red}✗ ${message}${colors.reset}`);
}

function setupLoggingStructure() {
  logStep('Creating logging directory structure');
  
  const baseDir = process.cwd();
  const logsDir = path.join(baseDir, 'logs');
  
  // Create main logs directory
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    logSuccess('Created logs directory');
  } else {
    logSuccess('Logs directory already exists');
  }
  
  // Create subdirectories
  const subdirs = ['app', 'error', 'performance', 'security', 'audit'];
  for (const subdir of subdirs) {
    const subdirPath = path.join(logsDir, subdir);
    if (!fs.existsSync(subdirPath)) {
      fs.mkdirSync(subdirPath, { recursive: true });
      logSuccess(`Created ${subdir} logs subdirectory`);
    } else {
      logSuccess(`${subdir} logs subdirectory already exists`);
    }
  }
  
  return logsDir;
}

function createWinstonConfig() {
  logStep('Creating Winston logging configuration');
  
  const winstonConfig = {
    levels: {
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      debug: 4
    },
    colors: {
      error: 'red',
      warn: 'yellow',
      info: 'green',
      http: 'magenta',
      debug: 'white'
    },
    transports: {
      console: {
        level: process.env.LOG_LEVEL || 'info',
        handleExceptions: true,
        json: false,
        colorize: true
      },
      file: {
        level: 'info',
        filename: 'logs/app/app.log',
        handleExceptions: true,
        json: true,
        maxsize: 5242880, // 5MB
        maxFiles: 10,
        colorize: false
      },
      errorFile: {
        level: 'error',
        filename: 'logs/error/error.log',
        handleExceptions: true,
        json: true,
        maxsize: 5242880, // 5MB
        maxFiles: 10,
        colorize: false
      }
    }
  };
  
  const configDir = path.join(process.cwd(), 'config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(configDir, 'winston.json'),
    JSON.stringify(winstonConfig, null, 2)
  );
  
  logSuccess('Winston configuration created');
  return winstonConfig;
}

function createMonitoringConfig() {
  logStep('Creating monitoring configuration');
  
  const monitoringConfig = {
    enabled: true,
    healthCheck: {
      enabled: true,
      interval: 300000, // 5 minutes
      endpoint: '/health',
      timeout: 5000
    },
    metrics: {
      enabled: true,
      interval: 60000, // 1 minute
      endpoint: '/metrics',
      collectors: [
        'errorCount',
        'responseTime',
        'memoryUsage',
        'cpuUsage',
        'queueLength',
        'cacheHitRate'
      ]
    },
    alerts: {
      enabled: true,
      thresholds: {
        errorRate: 0.1, // 10% error rate
        responseTime: 1000, // 1 second
        memoryUsage: 0.8, // 80% memory usage
        queueLength: 100
      },
      channels: [
        'log',
        'webhook'
      ]
    },
    dashboards: {
      enabled: true,
      refreshInterval: 30000, // 30 seconds
      retentionPeriod: 86400000 // 24 hours
    }
  };
  
  const configDir = path.join(process.cwd(), 'config');
  fs.writeFileSync(
    path.join(configDir, 'monitoring.json'),
    JSON.stringify(monitoringConfig, null, 2)
  );
  
  logSuccess('Monitoring configuration created');
  return monitoringConfig;
}

function createHealthCheckService() {
  logStep('Creating health check service');
  
  const healthCheckCode = `'use strict';

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
          return { healthy: false, issue: \`Missing path: \${filePath}\` };
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
    console.log(\`Health monitoring started (interval: \${this.options.interval}ms)\`);
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

module.exports = HealthCheckService;`;

  const servicesDir = path.join(process.cwd(), 'services');
  if (!fs.existsSync(servicesDir)) {
    fs.mkdirSync(servicesDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(servicesDir, 'healthCheck.js'),
    healthCheckCode
  );

  logSuccess('Health check service created');
}

function createMetricsCollector() {
  logStep('Creating metrics collector');
  
  const metricsCode = `'use strict';

const EventEmitter = require('events');

class MetricsCollector extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      interval: options.interval || 60000, // 1 minute
      retention: options.retention || 86400000, // 24 hours
      ...options
    };
    this.metrics = new Map();
    this.intervals = [];
    this.startTime = Date.now();
  }

  increment(name, value = 1, tags = {}) {
    const key = this.createKey(name, tags);
    const current = this.metrics.get(key) || { count: 0, sum: 0, tags };
    current.count++;
    current.sum += value;
    current.lastUpdate = Date.now();
    this.metrics.set(key, current);
    this.emit('metric', { type: 'increment', name, value, tags });
  }

  gauge(name, value, tags = {}) {
    const key = this.createKey(name, tags);
    const current = this.metrics.get(key) || { count: 0, sum: 0, tags };
    current.gauge = value;
    current.lastUpdate = Date.now();
    this.metrics.set(key, current);
    this.emit('metric', { type: 'gauge', name, value, tags });
  }

  histogram(name, value, tags = {}) {
    const key = this.createKey(name, tags);
    const current = this.metrics.get(key) || { 
      count: 0, 
      sum: 0, 
      min: value, 
      max: value, 
      values: [],
      tags 
    };
    current.count++;
    current.sum += value;
    current.min = Math.min(current.min, value);
    current.max = Math.max(current.max, value);
    current.values.push(value);
    current.lastUpdate = Date.now();
    
    // Keep only last 100 values to manage memory
    if (current.values.length > 100) {
      current.values = current.values.slice(-100);
    }
    
    this.metrics.set(key, current);
    this.emit('metric', { type: 'histogram', name, value, tags });
  }

  timing(name, durationMs, tags = {}) {
    this.histogram(name, durationMs, tags);
    this.emit('metric', { type: 'timing', name, durationMs, tags });
  }

  createKey(name, tags) {
    const tagString = Object.keys(tags)
      .sort()
      .map(key => \`\${key}=\${tags[key]}\`)
      .join(',');
    return tagString ? \`\${name}(\${tagString})\` : name;
  }

  getMetrics() {
    const now = Date.now();
    const result = {};

    for (const [key, metric] of this.metrics) {
      // Skip old metrics
      if (now - metric.lastUpdate > this.options.retention) {
        this.metrics.delete(key);
        continue;
      }

      const baseKey = key.split('(')[0]; // Remove tags part
      if (!result[baseKey]) {
        result[baseKey] = [];
      }

      const metricData = {
        tags: metric.tags,
        count: metric.count,
        sum: metric.sum,
        lastUpdate: metric.lastUpdate
      };

      if (metric.gauge !== undefined) {
        metricData.gauge = metric.gauge;
      }

      if (metric.min !== undefined) {
        metricData.min = metric.min;
        metricData.max = metric.max;
        metricData.avg = metric.sum / metric.count;
      }

      result[baseKey].push(metricData);
    }

    return result;
  }

  getPrometheusFormat() {
    const metrics = this.getMetrics();
    const lines = [];

    for (const [name, metricArray] of Object.entries(metrics)) {
      for (const metric of metricArray) {
        const tagString = Object.keys(metric.tags)
          .map(key => \`\${key}="\${metric.tags[key]}"\`)
          .join(',');

        if (metric.gauge !== undefined) {
          lines.push(\`# TYPE \${name} gauge\`);
          lines.push(\`\${name}\${tagString ? '{' + tagString + '}' : ''} \${metric.gauge}\`);
        }

        if (metric.count > 0) {
          lines.push(\`# TYPE \${name}_count counter\`);
          lines.push(\`\${name}_count\${tagString ? '{' + tagString + '}' : ''} \${metric.count}\`);
          
          lines.push(\`# TYPE \${name}_sum counter\`);
          lines.push(\`\${name}_sum\${tagString ? '{' + tagString + '}' : ''} \${metric.sum}\`);

          if (metric.avg !== undefined) {
            lines.push(\`# TYPE \${name}_avg gauge\`);
            lines.push(\`\${name}_avg\${tagString ? '{' + tagString + '}' : ''} \${metric.avg.toFixed(2)}\`);
          }
        }
      }
    }

    // Add system metrics
    const memUsage = process.memoryUsage();
    lines.push(\`# TYPE process_memory_bytes gauge\`);
    lines.push(\`process_memory_bytes{type="rss"} \${memUsage.rss}\`);
    lines.push(\`process_memory_bytes{type="heap_used"} \${memUsage.heapUsed}\`);
    lines.push(\`process_memory_bytes{type="heap_total"} \${memUsage.heapTotal}\`);
    
    lines.push(\`# TYPE process_uptime_seconds gauge\`);
    lines.push(\`process_uptime_seconds \${process.uptime()}\`);

    return lines.join('\\n') + '\\n';
  }

  startCollection() {
    if (this.intervals.length > 0) {
      return; // Already collecting
    }

    // Collect system metrics periodically
    const interval = setInterval(() => {
      const memUsage = process.memoryUsage();
      this.gauge('process_memory_rss_bytes', memUsage.rss);
      this.gauge('process_memory_heap_used_bytes', memUsage.heapUsed);
      this.gauge('process_memory_heap_total_bytes', memUsage.heapTotal);
      this.gauge('process_uptime_seconds', process.uptime());
      this.gauge('process_cpu_usage', process.cpuUsage().user);
    }, this.options.interval);

    this.intervals.push(interval);
    console.log(\`Metrics collection started (interval: \${this.options.interval}ms)\`);
  }

  stopCollection() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    console.log('Metrics collection stopped');
  }

  getMiddleware() {
    return (req, res, next) => {
      if (req.path === '/metrics') {
        res.set('Content-Type', 'text/plain');
        res.send(this.getPrometheusFormat());
      } else {
        next();
      }
    };
  }
}

module.exports = MetricsCollector;`;

  const servicesDir = path.join(process.cwd(), 'services');
  fs.writeFileSync(
    path.join(servicesDir, 'metricsCollector.js'),
    metricsCode
  );

  logSuccess('Metrics collector created');
}

function createLogRotationConfig() {
  logStep('Creating log rotation configuration');
  
  const logRotationConfig = {
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    frequency: 'daily',
    createSymlink: true,
    symlinkName: 'current.log',
    auditFile: './logs/audit.json',
    compressOnRotation: true,
    rotateOnlyOnRotation: false,
    zippedArchive: true
  };

  const configDir = path.join(process.cwd(), 'config');
  fs.writeFileSync(
    path.join(configDir, 'logRotation.json'),
    JSON.stringify(logRotationConfig, null, 2)
  );

  logSuccess('Log rotation configuration created');
}

// Execute setup
const logsDir = setupLoggingStructure();
const winstonConfig = createWinstonConfig();
const monitoringConfig = createMonitoringConfig();
createHealthCheckService();
createMetricsCollector();
createLogRotationConfig();

// Create setup summary
const setupInfo = {
  setupTime: new Date().toISOString(),
  nodeVersion: process.version,
  logsDirectory: logsDir,
  configuration: {
    winston: winstonConfig,
    monitoring: monitoringConfig
  },
  services: {
    healthCheck: './services/healthCheck.js',
    metricsCollector: './services/metricsCollector.js'
  }
};

fs.writeFileSync(
  path.join(logsDir, 'setup-info.json'),
  JSON.stringify(setupInfo, null, 2)
);

console.log(`\n${colors.green}🎉 Logging and monitoring setup completed!${colors.reset}`);
console.log(`\n${colors.blue}Next steps:${colors.reset}`);
console.log(`• Integrate HealthCheckService in your main application`);
console.log(`• Integrate MetricsCollector for performance metrics`);
console.log(`• Configure Winston with the generated configuration`);
console.log(`• Monitor logs at: ${logsDir}`);
console.log(`• Access health endpoint: GET /health`);
console.log(`• Access metrics endpoint: GET /metrics`);