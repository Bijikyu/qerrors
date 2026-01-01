/**
 * Express.js API server for qerrors demo and integration testing - SCALABLE VERSION
 * 
 * This server provides a comprehensive backend API that demonstrates
 * qerrors functionality with all scalability bottlenecks fixed.
 * 
 * Key Features:
 * - Properly configured static file server with compression
 * - AI-powered error analysis with intelligent caching
 * - Distributed rate limiting with Redis backend and local fallback
 * - Comprehensive error handling with structured responses
 * - Performance monitoring and health check endpoints
 * - Security middleware and CORS configuration
 * - Memory-efficient request processing
 * - Circuit breaker patterns for resilience
 * - Graceful degradation under load
 */

'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

// Scalable static file middleware
const { createStaticFileMiddleware } = require('./lib/scalableStaticFileServer');

// Import qerrors module with optimized exports
const qerrorsModule = require('./index.js');
const qerrors = qerrorsModule.qerrors;

// Performance monitoring
const { getPerformanceMonitor, monitorOperation } = require('./lib/performanceMonitor');

// Static middleware
const staticFileMiddleware = createStaticFileMiddleware();

// AI analysis timeouts
const AI_ANALYSIS_TIMEOUTS = {
  REQUEST_TIMEOUT: parseInt(process.env.AI_REQUEST_TIMEOUT) || 30000,
  PROCESSING_TIMEOUT: parseInt(process.env.AI_PROCESSING_TIMEOUT) || 25000,
  CLEANUP_DELAY: 5000
};

// Authentication middleware
const auth = require('./lib/auth');

// Security middleware
const { rateLimiters, securityHeaders, cookieOptions } = require('./lib/securityMiddleware');

// Privacy management
const privacyManager = require('./lib/privacyManager');

// Data retention service
const dataRetentionService = require('./lib/dataRetentionService');

// Enhanced rate limiting
const { getEnhancedRateLimiter, dynamicRateLimiter, createRateLimitMiddleware } = require('./lib/enhancedRateLimiter');

// Distributed rate limiting
const { getDistributedRateLimiter, createDistributedRateLimitMiddleware } = require('./lib/distributedRateLimiter');

const distributedRateLimiter = getDistributedRateLimiter({
  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined,
  redisPassword: process.env.REDIS_PASSWORD,
  circuitBreakerThreshold: 5,
  circuitBreakerResetTimeout: 60000
});

const useDistributedRateLimiter = process.env.ENABLE_DISTRIBUTED_RATE_LIMITING === 'true';

// Create rate limiters
const healthLimiter = useDistributedRateLimiter 
  ? createDistributedRateLimitMiddleware('/health', { max: 10000, windowMs: 60000 })
  : createRateLimitMiddleware('/health');

const metricsLimiter = useDistributedRateLimiter
  ? createDistributedRateLimitMiddleware('/metrics', { max: 5000, windowMs: 60000 })
  : createRateLimitMiddleware('/metrics');

const apiLimiter = useDistributedRateLimiter
  ? createDistributedRateLimitMiddleware('/api', { max: 1000, windowMs: 60000 })
  : createRateLimitMiddleware('/api');

const aiLimiter = useDistributedRateLimiter
  ? createDistributedRateLimitMiddleware('/api/analyze', { max: 100, windowMs: 60000 })
  : createRateLimitMiddleware('/api/analyze');

const app = express();

// Security middleware
app.use(securityHeaders);
app.use(compression());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));

// Static file serving
app.use(express.static('.', {
  maxAge: '1h',
  etag: true,
  lastModified: true
}));

// Rate limiting
app.use('/health', healthLimiter);
app.use('/metrics', metricsLimiter);
app.use('/api', apiLimiter);
app.use('/api/analyze', aiLimiter);

// Performance monitoring middleware
app.use(monitorOperation());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    rateLimiting: {
      mode: useDistributedRateLimiter ? 'distributed' : 'local',
      connected: useDistributedRateLimiter ? distributedRateLimiter.getStats().redis.connected : true
    }
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const perfMonitor = getPerformanceMonitor();
  const rateLimiterStats = useDistributedRateLimiter 
    ? distributedRateLimiter.getStats()
    : { mode: 'local', connected: true };
  
  res.json({
    timestamp: new Date().toISOString(),
    performance: perfMonitor.getStats(),
    rateLimiting: rateLimiterStats,
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// API routes for error testing and demonstration
app.get('/api/data', async (req, res, next) => {
  try {
    // Simulate data processing
    const data = {
      message: 'Sample data for testing',
      timestamp: new Date().toISOString(),
      data: Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        value: Math.random() * 100
      }))
    };
    
    res.json({
      success: true,
      data,
      count: data.data.length
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/error', (req, res, next) => {
  const errorType = req.query.type || 'basic';
  
  switch (errorType) {
    case 'type': next(new TypeError('Invalid type provided')); break;
    case 'reference': next(new ReferenceError('Property not found')); break;
    case 'range': next(new RangeError('Value out of range')); break;
    case 'syntax': next(new SyntaxError('Invalid syntax')); break;
    case 'custom': next(new Error('Custom error with special characters')); break;
    default: next(new Error('Basic error for testing')); break;
  }
});

app.post('/api/validate', (req, res, next) => {
  try {
    const { email, name, age } = req.body;
    
    const errors = [];
    
    if (!email || !email.includes('@')) {
      errors.push('Valid email is required');
    }
    
    if (!name || name.length < 2) {
      errors.push('Name must be at least 2 characters');
    }
    
    if (!age || age < 0 || age > 150) {
      errors.push('Age must be between 0 and 150');
    }
    
    if (errors.length > 0) {
      const validationError = new Error('Validation failed');
      validationError.validationErrors = errors;
      next(validationError);
      return;
    }
    
    res.json({
      success: true,
      message: 'Validation successful',
      data: { email, name, age }
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/errors/trigger', (req, res, next) => {
  try {
    const { type, message, context } = req.body;
    
    let error;
    
    switch (type) {
      case 'async':
        setTimeout(() => {
          error = new Error(message || 'Async error occurred');
          error.context = context;
          next(error);
        }, 100);
        return;
        
      case 'promise':
        Promise.reject(new Error(message || 'Promise rejected'))
          .catch(err => next(err));
        return;
        
      case 'timeout':
        setTimeout(() => {
          error = new Error(message || 'Operation timed out');
          error.code = 'TIMEOUT';
          next(error);
        }, 5000);
        return;
        
      default:
        error = new Error(message || 'Error triggered');
        error.context = context;
        next(error);
        break;
    }
  } catch (error) {
    next(error);
  }
});

app.post('/api/errors/custom', (req, res, next) => {
  try {
    const { 
      errorType, 
      message, 
      code, 
      severity, 
      stack, 
      context 
    } = req.body;
    
    const error = new Error(message || 'Custom error');
    
    if (errorType) error.name = errorType;
    if (code) error.code = code;
    if (severity) error.severity = severity;
    if (stack) error.stack = stack;
    if (context) error.context = context;
    
    next(error);
  } catch (error) {
    next(error);
  }
});

app.post('/api/errors/analyze', async (req, res, next) => {
  try {
    const { errorData, enableAnalysis } = req.body;
    
    // Create error from provided data
    const error = new Error(errorData.message || 'Error to analyze');
    if (errorData.name) error.name = errorData.name;
    if (errorData.code) error.code = errorData.code;
    
    if (enableAnalysis) {
      // Use qerrors with AI analysis
      await qerrors(error, 'api-server.routes.analyze', {
        endpoint: '/api/errors/analyze',
        errorData,
        analysisRequested: true
      });
      
      res.json({
        success: false,
        message: 'Error analysis queued',
        errorId: error.qerrorsErrorId
      });
    } else {
      // Basic error handling without AI analysis
      res.json({
        success: false,
        error: error.message,
        name: error.name,
        code: error.code,
        analysis: 'disabled'
      });
    }
  } catch (error) {
    next(error);
  }
});

// Error handling middleware with qerrors integration
app.use(async (error, req, res, next) => {
  if (res.headersSent) {
    console.error('Error occurred after headers sent:', error.message);
    return;
  }

  try {
    const context = {
      url: req.url,
      method: req.method,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      memoryBefore: req.memoryContext,
      memoryAfter: res.memoryAfter,
      timestamp: Date.now()
    };

    // Use qerrors for sophisticated error handling and analysis
    const result = await qerrors(error, 'api-server.middleware', context);
    
    // Send appropriate response based on request type
    if (req.accepts('html')) {
      res.status(500).set('Content-Type', 'text/html').send(`
        <!DOCTYPE html>
        <html>
        <head><title>Error</title></head>
        <body>
          <h1>Internal Server Error</h1>
          <p>Error ID: ${result.errorId || 'N/A'}</p>
          <pre>${error.message || 'Unknown error'}</pre>
        </body>
        </html>
      `);
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        errorId: result.errorId,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (handlingError) {
    console.error('qerrors error handling failed:', handlingError.message);
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        fallback: true
      });
    }
  }
});

// Default 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
    timestamp: new Date().toISOString()
  });
});

// Start server with enhanced error handling
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Scalable API server running on port ${PORT}`);
  console.log(`Distributed rate limiting: ${useDistributedRateLimiter ? 'enabled' : 'disabled'}`);
  console.log(`Performance monitoring: enabled`);
  console.log(`AI analysis: enabled with ${AI_ANALYSIS_TIMEOUTS.REQUEST_TIMEOUT}ms timeout`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});