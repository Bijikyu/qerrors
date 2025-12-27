const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const qerrors = require('./qerrors');

/**
 * Security Middleware Configuration
 * Implements rate limiting, security headers, and request throttling
 */

const createRateLimit = (windowMs, max, message) => {
  try {
    return rateLimit({
      windowMs,
      max,
      message: { error: message || 'Too many requests, please try again later' },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        // Log rate limit violation with qerrors
        setImmediate(() => {
          qerrors(new Error('Rate limit exceeded'), 'securityMiddleware.createRateLimit.handler', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            windowMs,
            max,
            message: message || 'Too many requests, please try again later',
            path: req.path,
            method: req.method,
            operation: 'security_rate_limit_violation'
          }).catch(qerror => {
            console.error('qerrors logging failed in security rate limit handler', qerror);
          });
        });
        
        res.status(429).json({ 
          error: message || 'Too many requests, please try again later' 
        });
      }
    });
  } catch (error) {
    // Log rate limit creation error asynchronously
    setImmediate(() => {
      qerrors(error, 'securityMiddleware.createRateLimit', {
        windowMs,
        max,
        message,
        operation: 'security_rate_limit_creation'
      }).catch(qerror => {
        console.error('qerrors logging failed in createRateLimit', qerror);
      });
    });
    throw error;
  }
};

const createSlowDown = (windowMs, delayAfter, delayMs) => {
  try {
    return slowDown({
      windowMs,
      delayAfter,
      delayMs,
      maxDelayMs: delayMs * 5, // Maximum delay
    });
  } catch (error) {
    // Log slowdown creation error asynchronously
    setImmediate(() => {
      qerrors(error, 'securityMiddleware.createSlowDown', {
        windowMs,
        delayAfter,
        delayMs,
        maxDelayMs: delayMs * 5,
        operation: 'security_slowdown_creation'
      }).catch(qerror => {
        console.error('qerrors logging failed in createSlowDown', qerror);
      });
    });
    throw error;
  }
};

// General rate limiting for all requests
const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  1000, // 1000 requests per window
  'Too many requests from this IP'
);

// Strict rate limiting for authentication endpoints
const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 login attempts per window
  'Too many login attempts, please try again later'
);

// Password reset rate limiting
const passwordResetRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  3, // 3 password reset attempts per hour
  'Too many password reset attempts, please try again later'
);

// API endpoint rate limiting
const apiRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 API requests per window
  'API rate limit exceeded'
);

// Progressive slowdown for suspicious activity
const progressiveSlowDown = createSlowDown(
  15 * 60 * 1000, // 15 minutes
  50, // Start slowing after 50 requests
  500 // Add 500ms delay per request
);

// Security headers configuration
let securityHeaders;
try {
  securityHeaders = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        childSrc: ["'none'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  });
} catch (error) {
  // Log security headers configuration error asynchronously
  setImmediate(() => {
    qerrors(error, 'securityMiddleware.securityHeaders', {
      nodeEnv: process.env.NODE_ENV,
      operation: 'security_headers_configuration'
    }).catch(qerror => {
      console.error('qerrors logging failed in securityHeaders configuration', qerror);
    });
  });
  throw error;
}

// Development security headers (still secure but more permissive for local development)
let devSecurityHeaders;
try {
  devSecurityHeaders = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", "'unsafe-eval'"], // Allow eval in dev for hot reload
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:", "http://localhost:*", "https://localhost:*"]
      }
    },
    crossOriginEmbedderPolicy: false
  });
} catch (error) {
  // Log development security headers configuration error asynchronously
  setImmediate(() => {
    qerrors(error, 'securityMiddleware.devSecurityHeaders', {
      nodeEnv: process.env.NODE_ENV,
      operation: 'dev_security_headers_configuration'
    }).catch(qerror => {
      console.error('qerrors logging failed in devSecurityHeaders configuration', qerror);
    });
  });
  throw error;
}

// Cookie security configuration
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS === 'true', // HTTPS in production or when forced
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/'
};

// Security validation middleware with error handling
const validateSecurityRequest = (req, res, next) => {
  try {
    // Validate request size
    const contentLength = req.get('content-length');
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
      const error = new Error('Request payload too large');
      setImmediate(() => {
        qerrors(error, 'securityMiddleware.validateSecurityRequest.size', {
          contentLength,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
          operation: 'security_request_size_validation'
        }).catch(qerror => {
          console.error('qerrors logging failed in security request size validation', qerror);
        });
      });
      return res.status(413).json({ error: 'Request payload too large' });
    }

    // Validate user agent
    const userAgent = req.get('User-Agent');
    if (!userAgent || userAgent.length > 500) {
      const error = new Error('Invalid or missing User-Agent');
      setImmediate(() => {
        qerrors(error, 'securityMiddleware.validateSecurityRequest.userAgent', {
          userAgentLength: userAgent ? userAgent.length : 0,
          ip: req.ip,
          path: req.path,
          method: req.method,
          operation: 'security_user_agent_validation'
        }).catch(qerror => {
          console.error('qerrors logging failed in security user agent validation', qerror);
        });
      });
      return res.status(400).json({ error: 'Invalid or missing User-Agent' });
    }

    next();
  } catch (error) {
    // Log validation error asynchronously
    setImmediate(() => {
      qerrors(error, 'securityMiddleware.validateSecurityRequest.error', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        operation: 'security_request_validation_error'
      }).catch(qerror => {
        console.error('qerrors logging failed in security request validation error', qerror);
      });
    });
    return next(error);
  }
};

// Security audit logging middleware
const auditSecurityEvent = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log security-relevant events
    if (res.statusCode >= 400) {
      setImmediate(() => {
        qerrors(new Error(`Security event: ${res.statusCode}`), 'securityMiddleware.auditSecurityEvent', {
          statusCode: res.statusCode,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
          contentLength: req.get('content-length'),
          operation: 'security_audit_event'
        }).catch(qerror => {
          console.error('qerrors logging failed in security audit event', qerror);
        });
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  rateLimiters: {
    general: generalRateLimit,
    auth: authRateLimit,
    passwordReset: passwordResetRateLimit,
    api: apiRateLimit
  },
  slowDown: progressiveSlowDown,
  securityHeaders: process.env.NODE_ENV === 'production' ? securityHeaders : devSecurityHeaders,
  cookieOptions,
  validateSecurityRequest,
  auditSecurityEvent
};