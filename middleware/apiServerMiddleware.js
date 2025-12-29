/**
 * API Server Middleware Configuration
 * 
 * Extracted middleware setup for api-server.js to improve maintainability
 */

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';

/**
 * API rate limiting configuration
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
  skip: (req) => {
    // Skip rate limiting for health checks and static files
    return req.path === '/api/health' || req.path.startsWith('/html/') || req.path.startsWith('/demo');
  }
});

/**
 * Configure compression middleware
 */
function configureCompression(app) {
  // Scalability middleware - Enhanced configuration for better performance
  app.use(compression({ threshold: 1024 })); // Only compress responses > 1KB
}

/**
 * Configure request timeout middleware
 */
function configureTimeout(app) {
  // Request timeout middleware for all requests
  app.use((req, res, next) => {
    res.setTimeout(30000, () => { // 30 second timeout
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Request timeout',
          message: 'Request took too long to process',
          timeout: 30000
        });
      }
    });
    next();
  });
}

/**
 * Configure Express middleware
 */
function configureExpressMiddleware(app) {
  // Express middleware configuration with enhanced security and limits
  app.use(cors());                        
  app.use(express.json({ 
    limit: '1mb', // Reduced limit for security and performance
    strict: false, // Allow JSON with some flexibility
    type: 'application/json'
  })); 
  app.use(express.urlencoded({ 
    limit: '1mb',
    extended: true,
    parameterLimit: 1000
  }));
}

/**
 * Configure rate limiting
 */
function configureRateLimiting(app) {
  app.use('/api/', apiLimiter);
}

/**
 * Configure static file serving
 */
function configureStaticFiles(app) {
  app.use(express.static('.', {
    maxAge: '1h', // Cache static files for 1 hour
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // Security headers for static files
      if (path.endsWith('.html')) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }
    }
  }));
}

/**
 * Memory-aware middleware for request context tracking
 */
function configureMemoryTracking(app) {
  app.use((req, res, next) => {
    // Add memory usage context for better error tracking
    const memUsage = process.memoryUsage();
    req.memoryContext = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      timestamp: Date.now()
    };

    // Add response cleanup to track memory after request
    const originalSend = res.send;
    res.send = function(data) {
      res.memoryAfter = process.memoryUsage();
      return originalSend.call(this, data);
    };

    next();
  });
}

/**
 * Configure all middleware for the application
 */
function configureMiddleware(app) {
  configureCompression(app);
  configureTimeout(app);
  configureExpressMiddleware(app);
  configureRateLimiting(app);
  configureStaticFiles(app);
  configureMemoryTracking(app);
}

export {
  configureMiddleware,
  configureCompression,
  configureTimeout,
  configureExpressMiddleware,
  configureRateLimiting,
  configureStaticFiles,
  configureMemoryTracking,
  apiLimiter
};