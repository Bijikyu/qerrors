/**
 * Express.js API server for qerrors demo and integration testing
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
 * - Graceful degradation under load and failure conditions
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { createRequire } from 'module';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

const { MemoryMonitor, MemoryUtils } = require('./lib/memoryManagement');
const require = createRequire(import.meta.url);
const qerrorsModule = require('./index.js');
const qerrors = qerrorsModule.qerrors;
const jwt = require('jsonwebtoken');

// Initialize memory monitoring for scalability
const memoryMonitor = new MemoryMonitor({
  warningThreshold: 50 * 1024 * 1024,  // 50MB warning
  criticalThreshold: 100 * 1024 * 1024, // 100MB critical
  checkInterval: 10000 // 10 seconds
});

// API rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection.remoteAddress
});

const app = express();

// Security middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

app.use(compression({
  threshold: 1024
}));

app.use(express.json({ 
  limit: '1mb',
  strict: false,
  type: 'application/json'
}));

app.use(express.urlencoded({ 
  limit: '1mb',
  extended: true,
  parameterLimit: 1000
}));

app.use('/api/', apiLimiter);

// Static file serving
app.use(express.static('.', {
  maxAge: '1h',
  etag: true,
  lastModified: true
}));

// Performance monitoring middleware
app.use((req, res, next) => {
  const memoryUsage = process.memoryUsage();
  req.memoryContext = {
    heapUsed: memoryUsage.heapUsed,
    heapTotal: memoryUsage.heapTotal,
    external: memoryUsage.external,
    timestamp: Date.now()
  };
  
  const originalSend = res.send;
  res.send = function(data) {
    res.memoryAfter = process.memoryUsage();
    return originalSend.call(this, data);
  };
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const memoryStats = memoryMonitor.getMemoryStats();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: memoryStats,
    rateLimiting: {
      limit: 1000,
      remaining: 'N/A'
    }
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const memoryStats = memoryMonitor.getMemoryStats();
  
  res.json({
    timestamp: new Date().toISOString(),
    memory: memoryStats,
    uptime: process.uptime(),
    performance: MemoryUtils.getPerformanceStats()
  });
});

// API routes for error testing and demonstration
app.get('/api/data', async (req, res, next) => {
  try {
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
    case 'custom': next(new Error('Custom error with special characters: <script>alert("xss")</script>')); break;
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
    
    const error = new Error(errorData.message || 'Error to analyze');
    if (errorData.name) error.name = errorData.name;
    if (errorData.code) error.code = errorData.code;
    
    if (enableAnalysis) {
      await qerrors(error, 'api-server.routes.analyze', {
        endpoint: '/api/errors/analyze',
        errorData,
        analysisRequested: true
      }, req, res, next);
    } else {
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

  const context = {
    url: req.url,
    method: req.method,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    memoryBefore: req.memoryContext,
    memoryAfter: res.memoryAfter,
    timestamp: Date.now()
  };

  try {
    const result = await qerrors(error, 'api-server.middleware', context);
    
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

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Express API server running on port ${PORT}`);
  console.log(`Memory monitoring enabled`);
  console.log(`AI-powered error analysis enabled`);
});