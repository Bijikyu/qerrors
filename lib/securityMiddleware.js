const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');

/**
 * Security Middleware Configuration
 * Implements rate limiting, security headers, and request throttling
 */

const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message || 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const createSlowDown = (windowMs, delayAfter, delayMs) => slowDown({
  windowMs,
  delayAfter,
  delayMs,
  maxDelayMs: delayMs * 5, // Maximum delay
});

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
const securityHeaders = helmet({
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

// Development security headers (still secure but more permissive for local development)
const devSecurityHeaders = helmet({
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

// Cookie security configuration
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS === 'true', // HTTPS in production or when forced
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/'
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
  cookieOptions
};