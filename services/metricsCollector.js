'use strict';

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
      .map(key => `${key}=${tags[key]}`)
      .join(',');
    return tagString ? `${name}(${tagString})` : name;
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
          .map(key => `${key}="${metric.tags[key]}"`)
          .join(',');

        if (metric.gauge !== undefined) {
          lines.push(`# TYPE ${name} gauge`);
          lines.push(`${name}${tagString ? '{' + tagString + '}' : ''} ${metric.gauge}`);
        }

        if (metric.count > 0) {
          lines.push(`# TYPE ${name}_count counter`);
          lines.push(`${name}_count${tagString ? '{' + tagString + '}' : ''} ${metric.count}`);
          
          lines.push(`# TYPE ${name}_sum counter`);
          lines.push(`${name}_sum${tagString ? '{' + tagString + '}' : ''} ${metric.sum}`);

          if (metric.avg !== undefined) {
            lines.push(`# TYPE ${name}_avg gauge`);
            lines.push(`${name}_avg${tagString ? '{' + tagString + '}' : ''} ${metric.avg.toFixed(2)}`);
          }
        }
      }
    }

    // Add system metrics
    const memUsage = process.memoryUsage();
    lines.push(`# TYPE process_memory_bytes gauge`);
    lines.push(`process_memory_bytes{type="rss"} ${memUsage.rss}`);
    lines.push(`process_memory_bytes{type="heap_used"} ${memUsage.heapUsed}`);
    lines.push(`process_memory_bytes{type="heap_total"} ${memUsage.heapTotal}`);
    
    lines.push(`# TYPE process_uptime_seconds gauge`);
    lines.push(`process_uptime_seconds ${process.uptime()}`);

    return lines.join('\n') + '\n';
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
    console.log(`Metrics collection started (interval: ${this.options.interval}ms)`);
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

module.exports = MetricsCollector;