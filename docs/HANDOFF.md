# Qerrors Project Handoff Guide

## Overview

Qerrors is an intelligent error handling middleware for Node.js applications that provides AI-powered error analysis, comprehensive logging, queue management, and production-ready monitoring capabilities.

### Key Features
- **AI-Powered Error Analysis**: Leverages OpenAI API for contextual debugging suggestions
- **Queue-Based Processing**: Non-blocking error analysis with concurrency limits
- **Caching System**: LRU cache to minimize API costs and improve performance
- **Production Logging**: Winston-based logging with daily rotation
- **Health Monitoring**: Built-in health checks and metrics collection
- **Circuit Breaker**: Resilience patterns for external service calls
- **Security**: Input sanitization and sensitive data protection

## Architecture

### Core Components

```
qerrors/
├── lib/                    # Core library modules
│   ├── qerrors.js         # Main error handler
│   ├── logger.js          # Winston logging configuration
│   ├── errorTypes.js      # Error type definitions
│   ├── sanitization.js    # Input sanitization
│   ├── utils.js           # Utility functions
│   ├── config.js          # Configuration management
│   ├── scalabilityFixes.js # Performance optimizations
│   ├── qerrorsQueue.js    # Queue management
│   ├── qerrorsCache.js    # Caching system
│   └── ...               # Other core modules
├── services/              # Production services
│   ├── healthCheck.js     # Health monitoring
│   └── metricsCollector.js # Metrics collection
├── scripts/               # Automation scripts
│   ├── build.js          # Build process
│   ├── deploy.js         # Deployment validation
│   ├── deploy.sh         # Full deployment script
│   ├── setup-monitoring.js # Monitoring setup
│   └── validate-config.js  # Configuration validation
├── test/                 # Test suites
├── config/               # Configuration files
├── logs/                 # Log files
└── dist/                 # Compiled output
```

### Data Flow

1. **Error Occurrence**: Application error caught by qerrors middleware
2. **Context Extraction**: Safe context extraction with sensitive data filtering
3. **Queue Processing**: Error queued for AI analysis (non-blocking)
4. **Cache Check**: Check for existing analysis to avoid redundant API calls
5. **AI Analysis**: Send to OpenAI if not cached, with retry logic
6. **Response Handling**: Immediate response to user, analysis in background
7. **Logging**: Comprehensive logging with Winston
8. **Monitoring**: Health checks and metrics collection

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/Bijikyu/qerrors.git
cd qerrors

# Install dependencies
npm install

# Build the project
npm run build

# Run validation
npm run validate
```

### Basic Usage

```javascript
const qerrors = require('qerrors');

// As middleware in Express
app.use(qerrors.middleware());

// Direct error handling
try {
  // Your code here
} catch (error) {
  qerrors(error, 'my.controller', { userId: 123 });
}
```

### Environment Configuration

```bash
# Required
NODE_ENV=production

# Optional (for AI analysis)
OPENAI_API_KEY=your_openai_api_key

# Logging
LOG_LEVEL=info

# Performance
MAX_QUEUE_SIZE=500
MAX_CONCURRENCY=5
CACHE_TTL=600000
```

## Deployment

### Automated Deployment

```bash
# Full deployment (recommended for production)
./scripts/deploy.sh

# Clean deployment (removes node_modules)
./scripts/deploy.sh --clean
```

### Manual Deployment Steps

1. **Validate Configuration**
   ```bash
   node scripts/validate-config.js
   ```

2. **Build Project**
   ```bash
   node scripts/build.js
   ```

3. **Setup Monitoring**
   ```bash
   node scripts/setup-monitoring.js
   ```

4. **Run Deployment Validation**
   ```bash
   node scripts/deploy.js
   ```

### Production Setup

1. **Environment Variables**
   - Set `NODE_ENV=production`
   - Configure `OPENAI_API_KEY` for AI features
   - Set appropriate `LOG_LEVEL`

2. **Monitoring Endpoints**
   - Health: `GET /health`
   - Metrics: `GET /metrics`

3. **Log Management**
   - Logs directory: `./logs/`
   - Daily rotation configured
   - Automatic compression

## Configuration

### Main Configuration (config/production.json)

```json
{
  "production": true,
  "logLevel": "info",
  "maxErrorHistory": 100,
  "queue": {
    "maxQueueSize": 500,
    "maxConcurrency": 5
  },
  "cache": {
    "maxSize": 200,
    "ttl": 600000
  },
  "monitoring": {
    "metricsInterval": 60000,
    "healthCheckInterval": 300000
  }
}
```

### Winston Configuration (config/winston.json)

```json
{
  "levels": {
    "error": 0,
    "warn": 1,
    "info": 2,
    "http": 3,
    "debug": 4
  },
  "transports": {
    "console": {
      "level": "info",
      "handleExceptions": true,
      "json": false,
      "colorize": true
    },
    "file": {
      "level": "info",
      "filename": "logs/app/app.log",
      "handleExceptions": true,
      "json": true,
      "maxsize": 5242880,
      "maxFiles": 10
    }
  }
}
```

## Monitoring and Logging

### Log Categories

- **App Logs**: `logs/app/` - General application logs
- **Error Logs**: `logs/error/` - Error-specific logs
- **Performance Logs**: `logs/performance/` - Performance metrics
- **Security Logs**: `logs/security/` - Security events
- **Audit Logs**: `logs/audit/` - Audit trails

### Health Monitoring

```javascript
const HealthCheckService = require('./services/healthCheck');
const healthChecker = new HealthCheckService();

// Start monitoring
healthChecker.startMonitoring();

// Use as middleware
app.use(healthChecker.getMiddleware());
```

### Metrics Collection

```javascript
const MetricsCollector = require('./services/metricsCollector');
const metrics = new MetricsCollector();

// Start collection
metrics.startCollection();

// Use as middleware
app.use(metrics.getMiddleware());

// Track custom metrics
metrics.increment('error_count', 1, { type: 'validation' });
metrics.timing('response_time', 150, { endpoint: '/api/users' });
```

## API Reference

### Core Functions

#### qerrors(error, location, context)
Main error handling function
- `error`: Error object
- `location`: String describing where error occurred
- `context`: Object with additional context

#### qerrors.middleware(options)
Express middleware for error handling
- `options`: Configuration options object

#### generateErrorId()
Generate unique error identifier
- Returns: String (12-character ID)

#### cleanup()
Cleanup resources and shutdown gracefully

### Queue Management

#### getQueueStats()
Get queue statistics
- Returns: Object with length and rejectCount

### Cache Management

#### getAnalysisCache()
Get cache control functions
- Returns: Object with clear, purgeExpired, startCleanup, stopCleanup

## Security Considerations

### Input Sanitization
- Automatic sanitization of error contexts
- Removal of sensitive data (passwords, tokens, API keys)
- HTML escaping for web responses

### API Security
- Rate limiting for AI analysis requests
- Circuit breaker for external service calls
- Request timeout handling

### Data Protection
- No logging of sensitive information
- Configurable log levels for different environments
- Secure error context extraction

## Performance Optimization

### Queue Configuration
- Non-blocking error processing
- Configurable concurrency limits
- Graceful degradation under load

### Caching Strategy
- LRU cache for AI analysis results
- Configurable TTL and size limits
- Automatic cleanup of expired entries

### Memory Management
- Bounded data structures
- Circular buffer for error history
- Memory monitoring and alerts

## Troubleshooting

### Common Issues

#### AI Analysis Not Working
1. Check `OPENAI_API_KEY` environment variable
2. Verify internet connectivity
3. Check queue metrics: `qerrors.getQueueStats()`
4. Review error logs in `logs/error/`

#### High Memory Usage
1. Check error history size in configuration
2. Verify cache limits
3. Review queue backlog
4. Monitor with metrics endpoint

#### Performance Issues
1. Check concurrency settings
2. Review queue length metrics
3. Verify cache hit rates
4. Monitor response times

### Debug Mode

```bash
# Enable verbose logging
LOG_LEVEL=debug npm start

# Monitor metrics in real-time
curl -s http://localhost:3000/metrics | grep qerrors
```

### Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "metrics": {
    "responseTime": 45,
    "checks": [
      { "healthy": true, "name": "fileSystem" },
      { "healthy": true, "name": "memory" },
      { "healthy": true, "name": "dependencies" }
    ],
    "uptime": 3600,
    "memory": {
      "rss": 52428800,
      "heapUsed": 20971520,
      "heapTotal": 41943040
    }
  },
  "version": "1.2.7"
}
```

## Maintenance

### Regular Tasks

1. **Log Rotation**: Automatic daily rotation with compression
2. **Backup Management**: Automatic cleanup of old backups (7 days)
3. **Cache Cleanup**: Automatic expired entry removal
4. **Health Monitoring**: Continuous health checks

### Update Procedures

1. **Minor Updates**
   ```bash
   git pull origin main
   npm ci
   npm run build
   ./scripts/deploy.sh
   ```

2. **Major Updates**
   ```bash
   git pull origin main
   ./scripts/deploy.sh --clean
   ```

### Monitoring Alerts

Configure alerts for:
- Error rate > 10%
- Response time > 1000ms
- Memory usage > 80%
- Queue length > 100

## Development

### Local Development Setup

```bash
# Install dependencies
npm install

# Development build with watching
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Type checking
npm run test:ts
```

### Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Run validation: `npm run validate`
5. Submit pull request

## Support

### Documentation
- API Reference: Inline code documentation
- Architecture Guide: This document
- Change Log: `CHANGELOG.md`

### Contact
- Issues: GitHub Issues
- Documentation: Repository Wiki
- Updates: Follow repository releases

## Version History

### v1.2.7 (Current)
- Production-ready deployment scripts
- Comprehensive monitoring setup
- Security enhancements
- Performance optimizations

### Key Changes from v1.2.6
- Added health monitoring service
- Implemented metrics collection
- Enhanced error sanitization
- Improved queue management
- Added automated deployment scripts

---

**This handoff guide provides comprehensive information for maintaining, deploying, and extending the qerrors project in production environments.**