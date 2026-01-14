# Production Deployment Guide & Runbooks

**Qerrors v1.2.7**  
**Last Updated:** 2026-01-03  
**Status:** Production Ready

---

## 🎯 Overview

This guide provides comprehensive deployment procedures, troubleshooting runbooks, and operational best practices for qerrors production deployments.

---

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Procedures](#deployment-procedures)
3. [Configuration Guide](#configuration-guide)
4. [Monitoring & Alerting](#monitoring--alerting)
5. [Troubleshooting Runbooks](#troubleshooting-runbooks)
6. [Performance Tuning](#performance-tuning)
7. [Maintenance Procedures](#maintenance-procedures)
8. [Emergency Procedures](#emergency-procedures)

---

## 🚀 Pre-Deployment Checklist

### ✅ Environment Validation

**Node.js Environment:**
- [ ] Node.js 18+ installed
- [ ] npm configured for production
- [ ] Sufficient memory (minimum 512MB, recommended 1GB+)
- [ ] Disk space for logs (minimum 1GB)
- [ ] Network connectivity for external services

**Application Dependencies:**
- [ ] All dependencies installed via `npm ci`
- [ ] No development dependencies in production
- [ ] Security audit passed: `npm audit`
- [ ] Build successful: `npm run build`

**Configuration:**
- [ ] Environment variables documented
- [ ] Required variables set
- [ ] Sensitive values properly secured
- [ ] Default values reviewed

**Infrastructure:**
- [ ] Load balancer configured (if needed)
- [ ] SSL/TLS certificates installed
- [ ] Firewall rules reviewed
- [ ] Monitoring endpoints accessible

---

## 🎮 Deployment Procedures

### Phase 1: Preparation

```bash
# 1. Clone and checkout correct version
git clone <repository-url>
cd qerrors
git checkout v1.2.7

# 2. Install production dependencies
npm ci --production

# 3. Build application
npm run build

# 4. Validate build
npm run lint
npm test
```

### Phase 2: Environment Setup

```bash
# Set production environment variables
export NODE_ENV=production

# Performance optimization
export QERRORS_QUEUE_LIMIT=2000
export QERRORS_CACHE_LIMIT=500
export QERRORS_CONCURRENCY=5

# Logging configuration
export QERRORS_LOG_MAX_DAYS=30
export QERRORS_VERBOSE=false
export QERRORS_LOG_LEVEL=info

# Optional AI configuration (if using)
export OPENAI_API_KEY=your_production_key
# export GEMINI_API_KEY=your_production_key
```

### Phase 3: Application Deployment

```bash
# 1. Deploy application code
rsync -avz --exclude='node_modules' ./ user@server:/path/to/app/

# 2. Start application
npm start

# 3. Verify deployment
curl -f http://localhost:3000/health || echo "Health check failed"
```

### Phase 4: Post-Deployment Validation

```bash
# 1. Check application logs
tail -f logs/qerrors.log | grep -E "(ERROR|WARN|INFO)"

# 2. Verify metrics collection
curl http://localhost:3000/metrics

# 3. Load test (optional)
node -e "
const qerrors = require('./lib/qerrors');
for (let i = 0; i < 100; i++) {
  await qerrors(new Error('Deployment test ' + i), 'deployment.validation');
}
console.log('Deployment validation complete');
"
```

---

## ⚙️ Configuration Guide

### Production Environment Variables

| Variable | Recommended Value | Description |
|----------|-------------------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `QERRORS_QUEUE_LIMIT` | `2000` | Max concurrent error processing |
| `QERRORS_CACHE_LIMIT` | `500` | AI advice cache size |
| `QERRORS_CONCURRENCY` | `5` | Parallel AI analysis limit |
| `QERRORS_LOG_MAX_DAYS` | `30` | Log retention period |
| `QERRORS_VERBOSE` | `false` | Reduce logging overhead |
| `QERRORS_LOG_LEVEL` | `info` | Minimum log level |
| `QERRORS_DISABLE_FILE_LOGS` | `false` | Enable file logging |

### AI Configuration (Optional)

| Variable | Example Value | Description |
|----------|----------------|-------------|
| `OPENAI_API_KEY` | `sk-...` | OpenAI API key |
| `GEMINI_API_KEY` | `AIza...` | Google AI API key |
| `QERRORS_AI_PROVIDER` | `openai` | Preferred AI provider |

### Express Integration Examples

#### Basic Setup:
```javascript
const qerrors = require('qerrors');

// Basic error handling middleware
app.use(qerrors.middleware());

// Error handler
app.use(qerrors.errorHandler());
```

#### Production Setup:
```javascript
const qerrors = require('qerrors');

// Production middleware with options
app.use(qerrors.middleware({
  enableLogging: true,
  logLevel: 'error',
  sanitizeErrors: true,
  includeStackTrace: false, // Production setting
  enableAI: true, // Optional AI analysis
  customContext: {
    service: 'my-service',
    version: '1.0.0'
  }
}));

// Enhanced error handler
app.use((error, req, res, next) => {
  const result = await qerrors(error, 'express.middleware', {
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  
  res.status(result.error?.httpStatus || 500).json({
    success: false,
    error: result.error,
    requestId: result.id,
    timestamp: result.timestamp
  });
});
```

---

## 📊 Monitoring & Alerting

### Built-in Metrics

```javascript
const qerrors = require('qerrors');
const { productionMonitor } = require('./lib/productionMonitoring');

// Start monitoring
productionMonitor.start();

// Get real-time metrics
const metrics = productionMonitor.getMetrics();
console.log('Queue stats:', qerrors.getQueueStats());
console.log('System metrics:', metrics);

// Get health status
const health = productionMonitor.getHealthMetrics();
console.log('System health:', health);

// Get alerts
const alerts = productionMonitor.getAlerts();
console.log('Active alerts:', alerts.active);
```

### Custom Monitoring Integration

#### Prometheus Integration:
```javascript
const express = require('express');
const { productionMonitor } = require('./lib/productionMonitoring');

const app = express();

// Metrics endpoint for Prometheus
app.get('/metrics', (req, res) => {
  const metrics = productionMonitor.getMetrics();
  
  const prometheusMetrics = `
# HELP qerrors_errors_total Total number of errors processed
# TYPE qerrors_errors_total counter
qerrors_errors_total ${metrics.errors.total}

# HELP qerrors_queue_length Current queue length
# TYPE qerrors_queue_length gauge
qerrors_queue_length ${metrics.queue.current}

# HELP qerrors_memory_heap_used_bytes Heap memory usage in bytes
# TYPE qerrors_memory_heap_used_bytes gauge
qerrors_memory_heap_used_bytes ${metrics.performance.memory.heapUsed}
  `;
  
  res.set('Content-Type', 'text/plain');
  res.send(prometheusMetrics.trim());
});
```

#### Grafana Dashboard Queries:
```promql
# Error rate over time
rate(qerrors_errors_total[5m]) * 60

# Queue length trend
qerrors_queue_length

# Memory usage
qerrors_memory_heap_used_bytes / 1024 / 1024

# Response time average
histogram_quantile(0.95)
```

### Alert Configuration

```javascript
const { productionMonitor } = require('./lib/productionMonitoring');

productionMonitor.on('alert', (alert) => {
  // Send to Slack
  if (alert.severity === 'critical') {
    sendSlackAlert(`🚨 Critical: ${alert.message}`);
  }
  
  // Send to PagerDuty
  if (alert.type === 'health' && alert.severity === 'critical') {
    sendPagerDutyAlert(alert);
  }
  
  // Log to monitoring system
  console.error('ALERT:', JSON.stringify(alert, null, 2));
});
```

---

## 🛠️ Troubleshooting Runbooks

### Runbook: High Memory Usage

**Symptoms:**
- Memory usage continuously increasing
- Application slows down
- Out of memory errors

**Diagnosis:**
```bash
# Check memory usage
node -e "
const { productionMonitor } = require('./lib/productionMonitoring');
const metrics = productionMonitor.getMetrics();
console.log('Memory usage:', metrics.performance.memory);
console.log('Memory percentage:', (metrics.performance.memory.percentage * 100).toFixed(1) + '%');
"

# Check for memory leaks
ps aux | grep node | grep -v grep
```

**Solutions:**

1. **Reduce Log Retention:**
```bash
export QERRORS_LOG_MAX_DAYS=7
```

2. **Enable Verbose Mode:**
```bash
export QERRORS_VERBOSE=false  # Disable for production
```

3. **Reduce Cache Size:**
```bash
export QERRORS_CACHE_LIMIT=100
```

4. **Restart Application:**
```bash
pm2 restart qerrors  # If using PM2
# or
systemctl restart qerrors  # If using systemd
```

---

### Runbook: Queue Overflow

**Symptoms:**
- "Queue at capacity" errors
- Increased response times
- Error rejections

**Diagnosis:**
```javascript
const qerrors = require('qerrors');
const stats = qerrors.getQueueStats();
console.log('Queue stats:', stats);
console.log('Reject count:', stats.rejectCount);
```

**Solutions:**

1. **Increase Queue Capacity:**
```bash
export QERRORS_QUEUE_LIMIT=5000
```

2. **Increase Concurrency:**
```bash
export QERRORS_CONCURRENCY=10
```

3. **Reduce Error Generation Rate:**
- Implement rate limiting
- Add caching at application level
- Optimize error-prone code paths

---

### Runbook: AI Analysis Failures

**Symptoms:**
- Missing AI advice in errors
- API key errors
- Slow response times

**Diagnosis:**
```javascript
const qerrors = require('qerrors');
const cache = qerrors.getAnalysisCache();
console.log('Cache status:', cache);

// Test AI connection
const testError = new Error('Test AI connection');
const result = await qerrors(testError, 'test.ai');
console.log('AI test result:', result.advice ? 'Working' : 'Failed');
```

**Solutions:**

1. **Check API Keys:**
```bash
# Test OpenAI key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \\
     https://api.openai.com/v1/models

# Test Gemini key
curl -H "x-goog-api-key: $GEMINI_API_KEY" \\
     https://generativelanguage.googleapis.com/v1/models
```

2. **Switch AI Provider:**
```bash
export QERRORS_AI_PROVIDER=google
export GEMINI_API_KEY=your_gemini_key
```

3. **Disable AI Analysis:**
```bash
export QERRORS_AI_PROVIDER=none
```

---

## 🎛️ Performance Tuning

### Environment-Specific Tuning

#### High-Traffic Applications:
```bash
export QERRORS_QUEUE_LIMIT=5000      # Larger queue
export QERRORS_CACHE_LIMIT=1000       # Bigger cache
export QERRORS_CONCURRENCY=10         # More parallelism
export QERRORS_LOG_MAX_DAYS=7         # Shorter retention
```

#### Memory-Constrained Environments:
```bash
export QERRORS_QUEUE_LIMIT=500        # Smaller queue
export QERRORS_CACHE_LIMIT=50         # Minimal cache
export QERRORS_CONCURRENCY=2         # Less parallelism
export QERRORS_LOG_MAX_DAYS=3         # Minimal retention
```

#### Development/Testing:
```bash
export QERRORS_VERBOSE=true            # Detailed logging
export QERRORS_LOG_LEVEL=debug         # Debug output
export QERRORS_QUEUE_LIMIT=100         # Small queue for testing
```

### Database Performance

If logging to database:
```javascript
// Use connection pooling
const pool = require('pg').Pool({
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Batch log writes
const logBatch = [];
setInterval(() => {
  if (logBatch.length > 0) {
    pool.query('INSERT INTO logs VALUES ($1)', [logBatch]);
    logBatch.length = 0;
  }
}, 5000);
```

---

## 🔧 Maintenance Procedures

### Daily Maintenance

```bash
#!/bin/bash
# daily-maintenance.sh

echo "Starting daily maintenance..."

# 1. Check disk space
df -h | grep -E "/$|/var$" | awk '{print $5}' | sed 's/%//' | \
while read usage; do
  if [ $usage -gt 85 ]; then
    echo "WARNING: Disk usage at ${usage}%"
  fi
done

# 2. Rotate logs if needed
if [ $(find /var/log/qerrors -name "*.log" -mtime +30 | wc -l) -gt 0 ]; then
  echo "Rotating old logs..."
  find /var/log/qerrors -name "*.log" -mtime +30 -delete
fi

# 3. Check error patterns
node -e "
const qerrors = require('./lib/qerrors');
const stats = qerrors.getQueueStats();
console.log('Daily stats:', JSON.stringify(stats, null, 2));
"

echo "Daily maintenance complete"
```

### Weekly Maintenance

```bash
#!/bin/bash
# weekly-maintenance.sh

echo "Starting weekly maintenance..."

# 1. Full system health check
curl -f http://localhost:3000/health || {
  echo "CRITICAL: Health check failed"
  # Send alert
  curl -X POST -H 'Content-Type: application/json' \
       -d '{"text":"❌ Qerrors health check failed"}' \
       $SLACK_WEBHOOK
}

# 2. Performance benchmark
node -e "
const { performance } = require('perf_hooks');
const qerrors = require('./lib/qerrors');

const start = performance.now();
for (let i = 0; i < 100; i++) {
  await qerrors(new Error('Benchmark ' + i), 'weekly.test');
}
const duration = performance.now() - start;
console.log('100 errors processed in ' + duration.toFixed(2) + 'ms');
console.log('Average: ' + (duration/100).toFixed(3) + 'ms per error');
"

# 3. Update dependencies
cd /opt/qerrors
npm audit
npm update --save

echo "Weekly maintenance complete"
```

---

## 🚨 Emergency Procedures

### Emergency Response Checklist

#### Step 1: Assessment (0-5 minutes)
- [ ] Identify affected systems
- [ ] Determine error scope
- [ ] Check recent deployments
- [ ] Review error logs

#### Step 2: Containment (5-15 minutes)
- [ ] Roll back if recent deployment
- [ ] Scale up resources if needed
- [ ] Enable verbose logging
- [ ] Notify stakeholders

#### Step 3: Resolution (15-60 minutes)
- [ ] Apply hotfix if available
- [ ] Restart affected services
- [ ] Verify fix effectiveness
- [ ] Document incident

#### Step 4: Recovery (60+ minutes)
- [ ] Monitor system stability
- [ ] Collect incident metrics
- [ ] Create post-mortem
- [ ] Update runbooks

### Emergency Scripts

```bash
#!/bin/bash
# emergency-response.sh

EMERGENCY_TYPE=$1
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

case $EMERGENCY_TYPE in
  "memory_leak")
    echo "🚨 MEMORY LEAK DETECTED"
    export QERRORS_LOG_MAX_DAYS=1
    export QERRORS_CACHE_LIMIT=10
    pm2 restart qerrors
    ;;
    
  "queue_overflow")
    echo "🚨 QUEUE OVERFLOW DETECTED"
    export QERRORS_QUEUE_LIMIT=10000
    export QERRORS_CONCURRENCY=20
    pm2 restart qerrors
    ;;
    
  "ai_failure")
    echo "🚨 AI ANALYSIS FAILURE"
    export QERRORS_AI_PROVIDER=none
    pm2 restart qerrors
    ;;
    
  *)
    echo "❓ UNKNOWN EMERGENCY: $EMERGENCY_TYPE"
    echo "Available types: memory_leak, queue_overflow, ai_failure"
    exit 1
    ;;
esac

# Create incident log
echo "[$TIMESTAMP] Emergency response executed: $EMERGENCY_TYPE" >> /var/log/qerrors/emergencies.log
```

### Communication Templates

#### Slack Alert:
```
🚨 **Qerrors Production Alert**

**Alert:** {alert_type}
**Severity:** {severity}
**Time:** {timestamp}
**Details:** {details}

**Actions:**
1. Check dashboard: {dashboard_url}
2. Review logs: {logs_url}
3. Contact on-call: {contact}
```

#### Email Alert:
```
Subject: [ALERT] Qerrors Production Issue - {severity}

Team,

A {severity} issue has been detected in the qerrors production environment:

Issue: {alert_type}
Time: {timestamp}
Details: {details}

Immediate Actions Required:
- [ ] Assess impact
- [ ] Review logs
- [ ] Apply emergency procedures

Dashboard: {dashboard_url}
Runbook: {runbook_url}
```

---

## 📞 Support & Escalation

### Support Channels

**Level 1: Development Team**
- **Response Time:** 30 minutes
- **Contact:** dev-team@company.com
- **Slack:** #qerrors-support

**Level 2: Operations Team**
- **Response Time:** 15 minutes
- **Contact:** ops@company.com
- **Slack:** #oncall-ops
- **Phone:** +1-555-EMERG1

**Level 3: Management**
- **Response Time:** 5 minutes
- **Contact:** cto@company.com
- **Slack:** @management
- **Phone:** +1-555-EXEC1

### Escalation Criteria

**Escalate to Level 2 if:**
- Service unavailable > 5 minutes
- Error rate > 20% for > 10 minutes
- Security incident suspected
- Critical production feature impacted

**Escalate to Level 3 if:**
- Service unavailable > 30 minutes
- Data loss or corruption suspected
- Revenue impact > $10,000/hour
- Media attention or customer complaints

---

## 📚 Additional Resources

### Documentation
- **API Documentation:** `/docs/api.md`
- **Configuration Guide:** `/docs/configuration.md`
- **Troubleshooting Guide:** `/docs/troubleshooting.md`

### Tools
- **Health Check:** `GET /health`
- **Metrics Endpoint:** `GET /metrics`
- **Queue Status:** `qerrors.getQueueStats()`
- **Configuration:** `qerrors.getConfiguration()`

### External Services
- **Status Page:** https://status.company.com
- **Monitoring:** https://grafana.company.com
- **Logs:** https://logs.company.com

---

## ✅ Deployment Verification

After deployment, verify:

```bash
# 1. Health check
curl -f http://localhost:3000/health

# 2. Metrics collection
curl -f http://localhost:3000/metrics

# 3. Error handling test
node -e "
const qerrors = require('./lib/qerrors');
qerrors(new Error('Deployment verification'), 'deploy.test')
  .then(() => console.log('✅ Error handling working'))
  .catch(err => console.error('❌ Error handling failed:', err.message));
"

# 4. Performance test
node tests/simple-integration.test.js

# 5. Configuration validation
node -e "
const config = require('./lib/config');
console.log('Queue limit:', config.getInt('QERRORS_QUEUE_LIMIT'));
console.log('Cache limit:', config.getInt('QERRORS_CACHE_LIMIT'));
"
```

---

## 📈 Success Metrics

**Deployment Success Indicators:**
- ✅ Health check passes
- ✅ Error rate < 5%
- ✅ Response time < 100ms average
- ✅ No critical alerts
- ✅ All integration tests pass
- ✅ Memory usage stable

**Performance Benchmarks:**
- 🎯 Error processing: < 0.1ms per error
- 🎯 Queue throughput: > 1000 errors/second
- 🎯 Memory efficiency: < 20MB base + 0.01MB/error
- 🎯 Availability: > 99.9%

---

**Last Updated:** 2026-01-03  
**Next Review:** 2026-04-03 or after major incidents  
**Document Version:** v1.2.7

---

*This deployment guide should be updated with lessons learned from each deployment and incident.*