# qerrors

[![npm version](https://badge.fury.io/js/qerrors.svg)](https://badge.fury.io/js/qerrors)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

**Intelligent error handling middleware with AI-powered analysis, queue-based processing, and production-ready monitoring.**

qerrors revolutionizes error handling by combining traditional logging with AI-powered debugging assistance. When errors occur, qerrors automatically generates contextual suggestions using AI models while maintaining fast response times through asynchronous analysis and intelligent caching.

## ✨ Features

- 🤖 **AI-Powered Analysis**: Get contextual debugging suggestions from AI models
- ⚡ **Non-Blocking Processing**: Queue-based error analysis with configurable concurrency
- 💾 **Intelligent Caching**: LRU cache to minimize API costs and improve performance
- 📊 **Production Monitoring**: Built-in health checks, metrics collection, and logging
- 🛡️ **Security-First**: Input sanitization and sensitive data protection
- 🔄 **Circuit Breaker**: Resilience patterns for external service calls
- 📝 **Comprehensive Logging**: Winston-based logging with daily rotation
- 🚀 **Production Ready**: Complete deployment automation and monitoring

## 🚀 Quick Start

### Installation

```bash
npm install qerrors
```

### Basic Usage

```javascript
const express = require('express');
const qerrors = require('qerrors');

const app = express();

// Use qerrors middleware
app.use(qerrors.middleware());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Error handling will be automatic
app.listen(3000);
```

### Direct Error Handling

```javascript
const qerrors = require('qerrors');

try {
  // Your code that might fail
  throw new Error('Something went wrong');
} catch (error) {
  qerrors(error, 'my.controller', { userId: 123 });
}
```

## 📋 Environment Configuration

```bash
# Required
NODE_ENV=production

# Optional AI provider configuration
OPENAI_API_KEY=your_openai_api_key       # or
GEMINI_API_KEY=your_gemini_api_key
QERRORS_AI_PROVIDER=google               # Options: openai, google (default: google)

# Logging
QERRORS_LOG_LEVEL=info
QERRORS_VERBOSE=false

# Performance tuning
QERRORS_QUEUE_LIMIT=100
QERRORS_CONCURRENCY=3
QERRORS_CACHE_LIMIT=1000
QERRORS_CACHE_TTL=300000
```

## 🏗️ Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Application│───▶│   qerrors    │───▶│   Response  │
│    Error     │    │  Middleware  │    │   (Fast)    │
└─────────────┘    └──────────────┘    └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │     Queue     │
                    │  (Non-blocking)│
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   AI Analysis│
                    │  (Background) │
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │     Cache    │
                    │   (LRU)      │
                    └──────────────┘
```

## 📊 Production Deployment

### Automated Deployment

```bash
# Clone and setup
git clone https://github.com/Bijikyu/qerrors.git
cd qerrors

# Full production deployment
npm run deploy:full

# Clean deployment (removes node_modules)
npm run deploy:clean
```

### Monitoring Endpoints

- **Health Check**: `GET /health`
- **Metrics**: `GET /metrics` (Prometheus format)
- **Application Logs**: `logs/app/app.log`
- **Error Logs**: `logs/error/error.log`

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

## 🔧 Configuration

### Main Configuration

```javascript
// config/production.json
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

### Middleware Options

```javascript
app.use(qerrors.middleware({
  enableAI: true,
  logLevel: 'info',
  sanitizeContext: true,
  includeStackTrace: false
}));
```

## 📈 Performance

### Queue Management

- **Non-blocking**: Error analysis doesn't block responses
- **Concurrency Control**: Configurable concurrent AI requests
- **Graceful Degradation**: Continues working without AI API
- **Memory Efficient**: Bounded queues with size limits

### Caching Strategy

- **LRU Cache**: Least Recently Used cache for AI results
- **Configurable TTL**: Cache expiration based on error patterns
- **Cost Optimization**: Reduces API calls for similar errors
- **Memory Protection**: Automatic cleanup of expired entries

### Benchmarks

- **Response Time**: < 10ms overhead for error handling
- **Memory Usage**: < 50MB for typical applications
- **Cache Hit Rate**: > 80% for common error patterns
- **Queue Throughput**: 100+ errors/second processing

## 🛡️ Security

### Input Sanitization

- **Automatic Sanitization**: Removes sensitive data from error contexts
- **HTML Escaping**: Prevents XSS in error responses
- **API Key Protection**: Never logs or exposes API keys
- **Configurable Patterns**: Custom sanitization rules

### Rate Limiting

- **API Protection**: Built-in rate limiting for AI requests
- **Circuit Breaker**: Automatic failover for external services
- **Request Throttling**: Prevents API abuse and cost spikes
- **Graceful Fallback**: Continues working when services are unavailable

## 🧪 Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Type checking
npm run test:ts

# Full validation
npm run validate
```

## 📚 API Reference

### Core Functions

#### `qerrors(error, location, context)`
Main error handling function
- `error`: Error object
- `location`: String describing where error occurred
- `context`: Object with additional context

```javascript
qerrors(error, 'user.controller', { userId: 123, action: 'login' });
```

#### `qerrors.middleware(options)`
Express middleware for error handling
- `options`: Configuration options object

```javascript
app.use(qerrors.middleware({
  enableAI: true,
  logLevel: 'info'
}));
```

### Utility Functions

#### `generateErrorId()`
Generate unique error identifier
```javascript
const errorId = qerrors.generateErrorId(); // "a1b2c3d4e5f6"
```

#### `getQueueStats()`
Get queue statistics
```javascript
const stats = qerrors.getQueueStats();
// { length: 5, rejectCount: 0 }
```

#### `cleanup()`
Cleanup resources and shutdown gracefully
```javascript
process.on('SIGTERM', () => {
  qerrors.cleanup();
  process.exit(0);
});
```

## 🔍 Monitoring

### Metrics Available

- `error_count_total`: Total number of errors
- `error_queue_length`: Current queue length
- `cache_hit_rate`: Cache hit rate percentage
- `ai_api_calls`: Number of AI API calls
- `response_time_ms`: Response time in milliseconds
- `memory_usage_bytes`: Memory usage in bytes

### Log Categories

- **Application Logs**: `logs/app/app.log`
- **Error Logs**: `logs/error/error.log`
- **Performance**: `logs/performance/perf.log`
- **Security**: `logs/security/security.log`
- **Audit**: `logs/audit/audit.log`

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Clone
git clone https://github.com/Bijikyu/qerrors.git
cd qerrors

# Install dependencies
npm install

# Development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 **Documentation**: [Full Documentation](HANDOFF.md)
- 🐛 **Issues**: [GitHub Issues](https://github.com/Bijikyu/qerrors/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Bijikyu/qerrors/discussions)
- 📧 **Email**: Support at qerrors.dev

## 🗺️ Roadmap

### Upcoming Features

- [ ] **Multi-Model AI Support**: Support for multiple AI providers
- [ ] **Custom Prompts**: Configurable AI prompts for different error types
- [ ] **Dashboard**: Web dashboard for error monitoring
- [ ] **Alerting**: Customizable alerting rules
- [ ] **Integrations**: Slack, Teams, and PagerDuty integrations
- [ ] **Machine Learning**: Pattern recognition for error prediction

### v1.3.0 (Planned)

- Enhanced AI model support
- Real-time error dashboard
- Advanced alerting system
- Multi-tenant support

## 📈 Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

---

**Built with ❤️ by the Qerrors Team**
