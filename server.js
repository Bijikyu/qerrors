/**
 * Express.js API server for qerrors demo and integration testing - SCALABLE VERSION
 * 
 * This server provides a comprehensive backend API that demonstrates
 * qerrors functionality with all scalability bottlenecks fixed.
 */

'use strict';

// Core dependencies
const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

// Import scalable static file server
const { createStaticFileMiddleware } = require('./lib/scalableStaticFileServer');

// Import qerrors for intelligent error handling
const qerrorsModule = require('./index.js');
const qerrors = qerrorsModule.qerrors;

// Import performance monitoring
const { getPerformanceMonitor, monitorOperation } = require('./lib/performanceMonitor');

// Initialize scalable static file server
const staticFileMiddleware = createStaticFileMiddleware();

// Configurable timeout settings for AI analysis
const AI_ANALYSIS_TIMEOUTS = {
  REQUEST_TIMEOUT: parseInt(process.env.AI_REQUEST_TIMEOUT) || 30000,
  PROCESSING_TIMEOUT: parseInt(process.env.AI_PROCESSING_TIMEOUT) || 25000,
  CLEANUP_DELAY: 5000
};

// Security imports
const auth = require('./lib/auth');
const { rateLimiters, securityHeaders, cookieOptions } = require('./lib/securityMiddleware');
const privacyManager = require('./lib/privacyManager');
const dataRetentionService = require('./lib/dataRetentionService');

// Enhanced rate limiting for API endpoints
const { getEnhancedRateLimiter, dynamicRateLimiter, createRateLimitMiddleware } = require('./lib/enhancedRateLimiter');

// Distributed rate limiting with Redis backend
const { getDistributedRateLimiter, createDistributedRateLimitMiddleware } = require('./lib/distributedRateLimiter');

// Initialize distributed rate limiter
const distributedRateLimiter = getDistributedRateLimiter({
  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined,
  redisPassword: process.env.REDIS_PASSWORD,
  circuitBreakerThreshold: 5,
  circuitBreakerResetTimeout: 60000
});

// Fallback to enhanced rate limiter if Redis is not available
const useDistributedLimiter = process.env.ENABLE_DISTRIBUTED_RATE_LIMITING === 'true';

// Create specific limiters for different endpoint categories
const healthLimiter = useDistributedLimiter 
  ? createDistributedRateLimitMiddleware('/health', { max: 10000, windowMs: 60000 })
  : createRateLimitMiddleware('/health');

const metricsLimiter = useDistributedLimiter
  ? createDistributedRateLimitMiddleware('/metrics', { max: 5000, windowMs: 60000 })
  : createRateLimitMiddleware('/metrics');

const apiLimiter = useDistributedLimiter
  ? createDistributedRateLimitMiddleware('/api', { max: 1000, windowMs: 60000 })
  : createRateLimitMiddleware('/api');

const aiLimiter = useDistributedLimiter
  ? createDistributedRateLimitMiddleware('/api/analyze', { max: 100, windowMs: 60000 })
  : createRateLimitMiddleware('/api/analyze');

// Initialize Express app with security middleware
const app = express();

// Apply security headers first
app.use(securityHeaders);

// Apply compression for response size optimization
app.use(compression());

// Apply CORS with proper configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Parse JSON with size limits
app.use(express.json({ limit: '1mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Apply scalable static file serving for demo files
app.use('/demo.html', healthLimiter, staticFileMiddleware);
app.use('/demo-functional.html', healthLimiter, staticFileMiddleware);
app.use('/index.html', healthLimiter, staticFileMiddleware);

// Health check endpoint with rate limiting
app.get('/health', healthLimiter, (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      rateLimiter: useDistributedLimiter ? 'distributed' : 'enhanced'
    };
    
    res.json(healthStatus);
  } catch (error) {
    qerrors(error, 'server.health', {
      operation: 'health_check',
      ip: req.ip
    });
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Metrics endpoint with rate limiting
app.get('/metrics', metricsLimiter, (req, res) => {
  try {
    const { getQueueLength, getQueueRejectCount } = require('./lib/qerrorsQueue');
    const { getCacheStats } = require('./lib/qerrorsCache');
    const rateLimiter = getEnhancedRateLimiter();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      queue: {
        length: getQueueLength(),
        rejectCount: getQueueRejectCount()
      },
      cache: getCacheStats(),
      rateLimiter: rateLimiter.getStats(),
      staticFiles: require('./lib/scalableStaticFileServer').getStaticFileServer().getStats()
    };
    
    // Add performance metrics
    const performanceMonitor = getPerformanceMonitor();
    const performanceMetrics = performanceMonitor.getSummary();
    metrics.performance = performanceMetrics;
    
    res.json(metrics);
  } catch (error) {
    qerrors(error, 'server.metrics', {
      operation: 'metrics_collection',
      ip: req.ip
    });
    res.status(500).json({ error: error.message });
  }
});

// API routes with rate limiting
app.use('/api', apiLimiter);

// Error generation endpoints for testing
app.post('/api/errors/generate', (req, res) => {
  try {
    const { type, severity, message } = req.body;
    
    let error;
    switch (type) {
      case 'validation':
        error = new Error(message || 'Validation error');
        error.name = 'ValidationError';
        error.type = 'VALIDATION';
        break;
      case 'authentication':
        error = new Error(message || 'Authentication failed');
        error.name = 'AuthenticationError';
        error.type = 'AUTHENTICATION';
        break;
      case 'authorization':
        error = new Error(message || 'Access denied');
        error.name = 'AuthorizationError';
        error.type = 'AUTHORIZATION';
        break;
      case 'network':
        error = new Error(message || 'Network error');
        error.name = 'NetworkError';
        error.type = 'NETWORK';
        break;
      case 'database':
        error = new Error(message || 'Database error');
        error.name = 'DatabaseError';
        error.type = 'DATABASE';
        break;
      default:
        error = new Error(message || 'Generic error');
        error.name = 'GenericError';
        error.type = 'SYSTEM';
    }
    
    error.severity = severity || 'medium';
    
    // Use qerrors for intelligent error handling
    qerrors(error, 'api.errors.generate', {
      operation: 'error_generation',
      errorType: type,
      severity: severity,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      error: {
        name: error.name,
        message: error.message,
        type: error.type,
        severity: error.severity
      }
    });
    
  } catch (err) {
    qerrors(err, 'server.api.errors.generate', {
      operation: 'error_generation_failed',
      ip: req.ip
    });
    res.status(500).json({ error: err.message });
  }
});

// AI analysis endpoint with strict rate limiting
app.post('/api/analyze', aiLimiter, async (req, res) => {
  try {
    const { error, context } = req.body;
    
    if (!error) {
      return res.status(400).json({ error: 'Error object is required' });
    }
    
    // Create error object from request
    const errorObj = new Error(error.message || 'Unknown error');
    errorObj.name = error.name || 'Error';
    errorObj.stack = error.stack;
    errorObj.type = error.type || 'SYSTEM';
    errorObj.severity = error.severity || 'medium';
    
    // Use qerrors for analysis
    const result = await qerrors(errorObj, context || 'api.analyze', {
      operation: 'ai_analysis',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      analysis: result
    });
    
  } catch (err) {
    qerrors(err, 'server.api.analyze', {
      operation: 'ai_analysis_failed',
      ip: req.ip
    });
    res.status(500).json({ error: err.message });
  }
});

// Configuration endpoint
app.get('/api/config', (req, res) => {
  try {
    const config = {
      timeouts: AI_ANALYSIS_TIMEOUTS,
      rateLimiting: {
        type: useDistributedLimiter ? 'distributed' : 'enhanced',
        enabled: true
      },
      features: {
        aiAnalysis: true,
        errorHandling: true,
        staticFiles: true,
        metrics: true
      }
    };
    
    res.json(config);
  } catch (error) {
    qerrors(error, 'server.api.config', {
      operation: 'config_retrieval',
      ip: req.ip
    });
    res.status(500).json({ error: error.message });
  }
});

// Apply qerrors middleware for intelligent error handling
app.use(qerrors);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Server configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
  
  const shutdownState = {
    startTime: Date.now(),
    shutdownTimeout: 10000, // 10 seconds
    forceExit: false,
    resourcesCleaned: false
  };
  
  try {
    console.log('🧹 Cleaning up resources...');
    
    // Cleanup qerrors resources
    const { stopQueueMetrics, stopAdviceCleanup } = require('./lib/qerrorsCache');
    const { stopQueueMetrics: stopQMetrics, cleanupTimers } = require('./lib/qerrorsQueue');
    
    try {
      stopQueueMetrics && stopQueueMetrics();
      stopAdviceCleanup && stopAdviceCleanup();
      stopQMetrics && stopQMetrics();
      cleanupTimers && cleanupTimers();
    } catch (cleanupError) {
      console.error('Error during qerrors cleanup:', cleanupError.message);
    }
    
    // Cleanup rate limiters
    const rateLimiter = getEnhancedRateLimiter();
    try {
      rateLimiter.shutdown();
    } catch (rateLimitError) {
      console.error('Error during rate limiter shutdown:', rateLimitError.message);
    }
    
    // Cleanup distributed rate limiter
    if (useDistributedLimiter && distributedRateLimiter) {
      try {
        await distributedRateLimiter.shutdown();
      } catch (distributedError) {
        console.error('Error during distributed rate limiter shutdown:', distributedError.message);
      }
    }
    
    // Cleanup static file server
    const { getStaticFileServer } = require('./lib/scalableStaticFileServer');
    try {
      getStaticFileServer().shutdown();
    } catch (staticFileError) {
      console.error('Error during static file server shutdown:', staticFileError.message);
    }
    
    shutdownState.resourcesCleaned = true;
    console.log('✅ Resource cleanup completed');
    
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
  
  // Force exit after timeout
  const elapsed = Date.now() - shutdownState.startTime;
  const remainingTime = Math.max(0, shutdownState.shutdownTimeout - elapsed);
  
  setTimeout(() => {
    if (!shutdownState.forceExit) {
      shutdownState.forceExit = true;
      console.log(`⏰ Shutdown timeout after ${elapsed}ms, forcing exit`);
      process.exit(1);
    }
  }, remainingTime);
  
  console.log(`✅ Graceful shutdown completed in ${elapsed}ms`);
  process.exit(0);
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Server startup
const startServer = async () => {
  try {
    // Initialize async configuration
    const { initializeAsync } = require('./lib/asyncInit');
    await initializeAsync();
    
    // Initialize performance monitoring
    const performanceMonitor = getPerformanceMonitor({
      blockingThreshold: 20,
      memoryGrowthThreshold: 50,
      monitoringInterval: 30000
    });
    
    // Setup alert handling
    performanceMonitor.on('alert', (alert) => {
      qerrors(new Error(`Performance Alert: ${alert.type}`), 'server.performance', {
        alertType: alert.type,
        alertData: alert.data,
        timestamp: alert.timestamp
      });
    });
    
    // Start server
    const server = app.listen(PORT, HOST, () => {
      console.log(`🚀 QErrors API Server running on http://${HOST}:${PORT}`);
      console.log(`📊 Demo UI: http://${HOST}:${PORT}/demo.html`);
      console.log(`🔧 Functional Demo: http://${HOST}:${PORT}/demo-functional.html`);
      console.log(`📡 API Endpoints available at http://${HOST}:${PORT}/api/`);
      console.log(`🛡️ Graceful shutdown enabled`);
      console.log(`⚡ Scalability optimizations enabled`);
      console.log(`📈 Performance monitoring enabled`);
    });
    
    // Start monitoring after server is ready
    performanceMonitor.start();
    
    return server;
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
let server;
startServer().then(s => {
  server = s;
}).catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Export for testing
module.exports = { app, startServer };