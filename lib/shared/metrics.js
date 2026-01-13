'use strict';

/**
 * Metrics Collection Module
 *
 * Provides lightweight metrics collection for counters, histograms,
 * and gauges. Supports periodic reporting and automatic cleanup.
 * Optimized for performance monitoring in production environments.
 */

class MetricsCollector {
  /**
   * Creates a new metrics collector
   */
  constructor () { this.counters = new Map(); this.histograms = new Map(); this.gauges = new Map(); this.timerIntervals = new Map(); }

  /**
   * Increments a counter metric
   * @param {string} name - Metric name
   * @param {Object} tags - Metric tags
   * @param {number} value - Increment value
   */
  increment (name, tags = {}, value = 1) { const key = this.createKey(name, tags); const current = this.counters.get(key) || 0; this.counters.set(key, current + value); }

  /**
   * Records a value in a histogram
   * @param {string} name - Metric name
   * @param {number} value - Value to record
   * @param {Object} tags - Metric tags
   */
  histogram (name, value, tags = {}) { const key = this.createKey(name, tags); if (!this.histograms.has(key)) this.histograms.set(key, []); const values = this.histograms.get(key); values.push(value); if (values.length > 1000)values.splice(0, 500); }

  /**
   * Sets a gauge metric value
   * @param {string} name - Metric name
   * @param {number} value - Gauge value
   * @param {Object} tags - Metric tags
   */
  gauge (name, value, tags = {}) { this.gauges.set(this.createKey(name, tags), value); }

  /**
   * Times a synchronous function execution
   * @param {string} name - Timer name
   * @param {Function} fn - Function to time
   * @param {Object} tags - Metric tags
   * @returns {*} Function result
   */
  timer (name, fn, tags = {}) { const start = Date.now(); try { return fn(); } finally { this.histogram(name, Date.now() - start, tags); } }

  /**
   * Times an asynchronous function execution
   * @param {string} name - Timer name
   * @param {Function} fn - Async function to time
   * @param {Object} tags - Metric tags
   * @returns {Promise<*>} Function result
   */
  async timerAsync (name, fn, tags = {}) { const start = Date.now(); try { return await fn(); } finally { this.histogram(name, Date.now() - start, tags); } }

  /**
   * Creates a consistent key for metrics with tags
   * @param {string} name - Metric name
   * @param {Object} tags - Metric tags
   * @returns {string} Consistent key
   */
  createKey (name, tags) { return Object.keys(tags).sort().map(key => `${key}:${tags[key]}`).join(',') + ':' + name; }

  /**
   * Returns all collected metrics
   * @returns {Object} All metrics data
   */
  getMetrics () { return { counters: Object.fromEntries(this.counters), histograms: Object.fromEntries(this.histograms), gauges: Object.fromEntries(this.gauges) }; }

  /**
   * Gets counter value by name and tags
   * @param {string} name - Counter name
   * @param {Object} tags - Metric tags
   * @returns {number} Counter value
   */
  getCounter (name, tags = {}) { return this.counters.get(this.createKey(name, tags)) || 0; }

  /**
   * Gets histogram statistics including percentiles
   * @param {string} name - Histogram name
   * @param {Object} tags - Metric tags
   * @returns {Object|null} Histogram stats or null if no data
   */
  getHistogramStats (name, tags = {}) { const key = this.createKey(name, tags); const values = this.histograms.get(key) || []; if (values.length === 0) return null; values.sort((a, b) => a - b); return { count: values.length, min: values[0], max: values[values.length - 1], mean: values.reduce((a, b) => a + b, 0) / values.length, p50: values[Math.floor(values.length * 0.5)], p95: values[Math.floor(values.length * 0.95)], p99: values[Math.floor(values.length * 0.99)] }; }

  /**
   * Starts periodic metrics reporting
   * @param {number} intervalMs - Report interval in milliseconds
   * @param {Function} reporter - Reporter function
   */
  startPeriodicReporting (intervalMs, reporter) { const key = 'periodic:' + intervalMs; if (this.timerIntervals.has(key)) return; const timer = setInterval(() => reporter(this.getMetrics()), intervalMs).unref(); this.timerIntervals.set(key, timer); }

  /**
   * Stops periodic metrics reporting
   * @param {number} intervalMs - Report interval to stop
   */
  stopPeriodicReporting (intervalMs) { const key = 'periodic:' + intervalMs; const timer = this.timerIntervals.get(key); if (timer) { clearInterval(timer); this.timerIntervals.delete(key); } }

  /**
   * Cleans up all timers and intervals
   */
  cleanup () { this.timerIntervals.forEach(timer => clearInterval(timer)); this.timerIntervals.clear(); }

  /**
   * Resets all metrics
   */
  reset () { this.counters.clear(); this.histograms.clear(); this.gauges.clear(); }
}

const globalMetrics = new MetricsCollector();

module.exports = { MetricsCollector, metrics: globalMetrics };
