/**
 * API Server Middleware with Comprehensive Security
 * 
 * Purpose: Provides secure middleware configuration for Express.js API server
 * with input validation, rate limiting, compression, and security headers.
 * 
 * Security Features:
 * - Comprehensive input validation
 * - Rate limiting with adaptive controls
 * - CORS configuration
 * - Security headers
 * - Request/response compression
 * - Memory monitoring integration
 */

const cors = require('cors');
const compression = require('compression');
const express = require('express');
const { validateInput, validateJsonPayload, sanitizeInput, LENGTH_LIMITS } = require('../lib/inputValidation');

/**
 * Configure security middleware
 * @param {Object} app - Express app instance
 */
function configureSecurityMiddleware(app) {
  // CORS configuration with validation
  const corsOptions = {
    origin: (origin, callback) => {
      // Allow origins from environment or validate specific origins
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
      
      if (!origin) return callback(null, true); // Allow mobile apps, postman etc.
      
      if (allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        const originValidation = validateInput(origin, 'url', { maxLength: 2048 });
        if (!originValidation.isValid) {
          callback(new Error('Not allowed by CORS'));
        } else {
          callback(null, allowedOrigins.includes(origin));
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400 // 24 hours
  };
  
  app.use(cors(corsOptions));
  
  // Compression with security limits
  app.use(compression({
    threshold: 1024, // Only compress responses > 1KB
    level: 6, // Balance between CPU and compression
    chunkSize: 16 * 1024, // 16KB chunks
    filter: (req, res) => {
      // Don't compress responses that are already compressed
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Don't compress certain content types
      const type = res.getHeader('Content-Type');
      return type && !type.includes('image') && !type.includes('video');
    }
  }));
}

/**
 * Configure request parsing with validation
 * @param {Object} app - Express app instance
 */
function configureRequestParsing(app) {
  // JSON body parsing with validation
  app.use(express.json({
    limit: '1mb',
    strict: false,
    type: 'application/json',
    verify: (req, res, buf, encoding) => {
      try {
        // Validate raw JSON before parsing
        if (buf && buf.length > 0) {
          const jsonStr = buf.toString(encoding || 'utf8');
          const validation = validateInput(jsonStr, 'json', { maxLength: LENGTH_LIMITS.jsonPayload });
          
          if (!validation.isValid) {
            throw new Error(`Invalid JSON: ${validation.errors.join(', ')}`);
          }
        }
      } catch (error) {
        // Log security violation
        console.warn('JSON parsing security violation:', {
          error: error.message,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
        
        // Don't parse the body if validation fails
        req.invalidJson = true;
        req.jsonError = error.message;
      }
    }
  }));
  
  // URL-encoded body parsing
  app.use(express.urlencoded({
    extended: true,
    limit: '1mb',
    parameterLimit: 1000
  }));
}

/**
 * Configure security headers
 * @param {Object} app - Express app instance
 */
function configureSecurityHeaders(app) {
  app.use((req, res, next) => {
    // Content Security Policy
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Only for development
      "style-src 'self' 'unsafe-inline'", // Only for development
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');
    
    res.setHeader('Content-Security-Policy', 
      process.env.NODE_ENV === 'production' 
        ? "default-src 'self'; script-src 'self'; style-src 'self';" // Strict for production
        : csp // More lenient for development
    );
    
    // Other security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
    
    // Remove server information
    res.removeHeader('X-Powered-By');
    
    next();
  });
}

/**
 * Configure rate limiting with security
 * @param {Object} app - Express app instance
 */
function configureRateLimiting(app) {
  const rateLimit = require('express-rate-limit');
  
  // Main API rate limiter
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.API_RATE_LIMIT || 1000, // Default 1000 requests per 15 minutes
    message: {
      error: 'Too many requests',
      retryAfter: '15 minutes',
      timestamp: new Date().toISOString()
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Generate secure key from IP and user agent
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const combined = `${ip}:${userAgent}`;
      
      // Hash for privacy and consistency
      return require('crypto')
        .createHash('sha256')
        .update(combined)
        .digest('hex')
        .substring(0, 16);
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/metrics';
    },
    onLimitReached: (req, res) => {
      // Log rate limit violations for security monitoring
      console.warn('Rate limit exceeded:', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Apply to API routes
  app.use('/api/', apiLimiter);
}

/**
 * Configure request validation middleware
 * @param {Object} app - Express app instance
 */
function configureRequestValidation(app) {
  // Validate query parameters
  app.use((req, res, next) => {
    if (req.query && Object.keys(req.query).length > 0) {
      const validatedQuery = {};
      
      for (const [key, value] of Object.entries(req.query)) {
        const validation = validateInput(value, 'general', { maxLength: 1000 });
        
        if (!validation.isValid) {
          console.warn('Invalid query parameter:', {
            key,
            error: validation.errors,
            value: String(value).substring(0, 100), // Log first 100 chars
            ip: req.ip,
            timestamp: new Date().toISOString()
          });
          
          return res.status(400).json({
            error: 'Invalid query parameter',
            parameter: key,
            message: 'Query parameter contains invalid content'
          });
        }
        
        validatedQuery[key] = validation.sanitized;
      }
      
      req.query = validatedQuery;
    }
    
    next();
  });
  
  // Validate path parameters
  app.use('/api/:param', (req, res, next) => {
    if (req.params.param) {
      const validation = validateInput(req.params.param, 'general', { maxLength: 255 });
      
      if (!validation.isValid) {
        console.warn('Invalid path parameter:', {
          param: req.params.param,
          error: validation.errors,
          ip: req.ip,
          path: req.path,
          timestamp: new Date().toISOString()
        });
        
        return res.status(400).json({
          error: 'Invalid path parameter',
          message: 'Path parameter contains invalid content'
        });
      }
      
      req.params.param = validation.sanitized;
    }
    
    next();
  });
}

/**
 * Configure memory monitoring middleware
 * @param {Object} app - Express app instance
 */
function configureMemoryMonitoring(app) {
  app.use((req, res, next) => {
    // Track memory usage for security monitoring
    const memoryBefore = process.memoryUsage();
    req.memoryContext = {
      heapUsed: memoryBefore.heapUsed,
      heapTotal: memoryBefore.heapTotal,
      external: memoryBefore.external,
      rss: memoryBefore.rss,
      timestamp: Date.now()
    };
    
    // Override res.send to track memory after response
    const originalSend = res.send;
    res.send = function(data) {
      const memoryAfter = process.memoryUsage();
      res.memoryAfter = {
        heapUsed: memoryAfter.heapUsed,
        heapTotal: memoryAfter.heapTotal,
        external: memoryAfter.external,
        rss: memoryAfter.rss,
        timestamp: Date.now()
      };
      
      // Check for suspicious memory growth
      const memoryGrowth = memoryAfter.heapUsed - memoryBefore.heapUsed;
      if (memoryGrowth > 50 * 1024 * 1024) { // 50MB growth
        console.warn('Suspicious memory growth detected:', {
          memoryGrowth: Math.round(memoryGrowth / 1024 / 1024) + 'MB',
          path: req.path,
          method: req.method,
          ip: req.ip,
          timestamp: new Date().toISOString()
        });
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  });
}

/**
 * Configure all middleware for the API server
 * @param {Object} app - Express app instance
 */
function configureMiddleware(app) {
  // Security first
  configureSecurityHeaders(app);
  
  // Request parsing with validation
  configureRequestParsing(app);
  configureRequestValidation(app);
  
  // Rate limiting
  configureRateLimiting(app);
  
  // Compression and CORS
  configureSecurityMiddleware(app);
  
  // Memory monitoring
  configureMemoryMonitoring(app);
  
  console.log('🔒 Security middleware configured');
  console.log('📊 Request validation enabled');
  console.log('🚦 Rate limiting active');
  console.log('🧠 Memory monitoring enabled');
}

module.exports = {
  configureMiddleware,
  configureSecurityHeaders,
  configureRequestValidation,
  configureRateLimiting
};