/**
 * Express.js API server for qerrors demo and integration testing
 * 
 * This server provides a comprehensive backend API that demonstrates
 * qerrors functionality and provides the endpoints that frontend demos
 * expect. It integrates qerrors middleware for intelligent error handling
 * and includes various test scenarios for validation.
 * 
 * Key features:
 * - Full qerrors integration with AI-powered error analysis
 * - Multiple error type generation for testing
 * - Authentication and authorization testing endpoints
 * - Metrics and health check endpoints
 * - Static file serving for demo pages
 * - Comprehensive error scenario coverage
 */

// Core dependencies
const express = require('express');  // Web framework
const cors = require('cors');        // Cross-origin resource sharing
const path = require('path');        // Path utilities
const compression = require('compression'); // Response compression
const fs = require('fs');           // File system for pre-loading static content

// Import qerrors for intelligent error handling
const qerrorsModule = require('./index.js');
const qerrors = qerrorsModule.qerrors;  // Extract main qerrors function

// Pre-load static files for better performance with cache invalidation
const staticFilesCache = new Map();
const staticFileStats = new Map();
const staticPaths = [
  { path: './demo.html', name: 'demo' },
  { path: './demo-functional.html', name: 'demo-functional' },
  { path: './index.html', name: 'index' }
];

const getCachedStaticFile = (name) => {
  const staticPath = staticPaths.find(p => p.name === name);
  if (!staticPath) return null;
  
  try {
    const currentStats = fs.statSync(staticPath.path);
    const cachedStats = staticFileStats.get(name);
    
    // Check if file changed
    if (!cachedStats || currentStats.mtime > cachedStats.mtime || currentStats.size !== cachedStats.size) {
      // Reload file
      const content = fs.readFileSync(staticPath.path, 'utf8');
      staticFilesCache.set(name, content);
      staticFileStats.set(name, { mtime: currentStats.mtime, size: currentStats.size });
      console.log(`Reloaded static file: ${name}`);
    }
    
    return staticFilesCache.get(name);
  } catch (err) {
    console.warn(`Failed to load static file ${name}:`, err.message);
    return null;
  }
};

const preloadStaticFiles = () => {
  staticPaths.forEach(({ path: filePath, name }) => {
    try {
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      staticFilesCache.set(name, content);
      staticFileStats.set(name, { mtime: stats.mtime, size: stats.size });
      console.log(`Preloaded static file: ${name}`);
    } catch (err) {
      console.warn(`Failed to preload static file ${name}:`, err.message);
    }
  });
};

// Pre-load static files at startup
preloadStaticFiles();

// Security imports
const auth = require('./lib/auth');
const { rateLimiters, securityHeaders, cookieOptions } = require('./lib/securityMiddleware');
const privacyManager = require('./lib/privacyManager');
const dataRetentionService = require('./lib/dataRetentionService');

// Rate limiting for API endpoints
const rateLimit = require('express-rate-limit');

// General API rate limiting - optimized for scalability
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Increased limit for better scalability
  message: { error: 'Too many requests from this IP, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // Add memory-efficient options
  keyGenerator: (req) => req.ip, // Simple IP-based key generation
  skip: (req) => req.url.startsWith('/health') || req.url.startsWith('/metrics'), // Skip health checks
});

// Strict rate limiting for expensive operations - optimized for AI analysis
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased limit but still controlled for expensive operations
  message: { error: 'Rate limit exceeded for this endpoint' },
  standardHeaders: true,
  legacyHeaders: false,
  // Add memory-efficient options
  keyGenerator: (req) => req.ip, // Simple IP-based key generation
  requestWasSuccessful: (req, res) => res.statusCode < 400, // Only count successful requests
});

// Server configuration
const app = express();
const PORT = process.env.PORT || 3001;  // Configurable port with default

// Security middleware
app.use(securityHeaders);               // Apply security headers
app.use(rateLimiters.general);          // Apply general rate limiting

// Performance middleware
app.use(compression());                 // Enable response compression

// Rate limiting middleware
app.use('/api/', apiLimiter);           // Apply rate limiting to all API routes

// Express middleware configuration
app.use(cors());                        // Enable CORS for all routes
app.use(express.json({ limit: '10mb' })); // Parse JSON request bodies with size limit
app.use(express.static('.'));           // Serve static files from current directory

// Validate environment on startup
try {
  auth.validateEnvironment();
} catch (error) {
  console.error('SECURITY ERROR:', error.message);
  console.error('Please set proper environment variables before starting the server.');
  process.exit(1);
}

/**
 * Global error handling middleware with qerrors integration
 * 
 * This middleware catches all errors in the Express application and
 * routes them through qerrors for intelligent error handling with
 * AI-powered analysis. This ensures consistent error responses across
 * all endpoints and provides the full qerrors functionality.
 */
app.use((err, req, res, next) => {
  qerrors(err, 'Express middleware', req, res, next);
});

/**
 * Helper function to create test errors with type classification
 * 
 * This function creates Error objects with additional type information
 * that qerrors can use for proper classification and analysis. It's used
 * throughout the API endpoints to generate different error scenarios
 * for testing and demonstration purposes.
 * 
 * @param {string} type - Error type for classification
 * @param {string} message - Error message (optional, defaults to 'Test error')
 * @returns {Error} Configured error object with type property
 */
function createError(type, message = 'Test error') {
  const error = new Error(message);
  error.type = type;  // Add type property for qerrors classification
  return error;
}

// API Endpoints

// GET /api/data - Missing endpoint that frontend expects
app.get('/api/data', async (req, res, next) => {
  try {
    // Simulate some data response
    res.json({
      success: true,
      data: {
        message: 'Data from backend',
        timestamp: new Date().toISOString(),
        qerrors: 'integrated'
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/error - Trigger test error
app.get('/api/error', (req, res, next) => {
  const error = createError('test', 'This is a test error from API');
  next(error);
});

// POST /api/validate - Validation error testing
app.post('/api/validate', (req, res, next) => {
  try {
    const { data } = req.body;
    
    if (!data || typeof data !== 'string') {
      const error = createError('validation', 'Invalid data format');
      error.statusCode = 400;
      throw error;
    }
    
    if (data.length < 3) {
      const error = createError('validation', 'Data too short');
      error.statusCode = 400;
      throw error;
    }
    
    res.json({ success: true, validated: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/errors/trigger - Triggers various error types
app.post('/api/errors/trigger', (req, res, next) => {
  try {
    const { type, message, context } = req.body;
    
    const errorTypes = {
      validation: 'Validation error occurred',
      authentication: 'Authentication failed',
      authorization: 'Access denied',
      network: 'Network connection error',
      database: 'Database operation failed',
      system: 'System error occurred',
      configuration: 'Configuration error'
    };
    
    const errorType = type || 'validation';
    const errorMessage = message || errorTypes[errorType] || 'Unknown error';
    
    const error = createError(errorType, errorMessage);
    error.context = context || {};
    error.statusCode = errorType === 'validation' ? 400 : 
                     errorType === 'authentication' ? 401 :
                     errorType === 'authorization' ? 403 : 500;
    
    next(error);
  } catch (error) {
    next(error);
  }
});

// POST /api/errors/custom - Creates custom business errors
app.post('/api/errors/custom', (req, res, next) => {
  try {
    const { name, code, message, severity, context } = req.body;
    
    if (!name || !message) {
      const error = createError('validation', 'Error name and message are required');
      error.statusCode = 400;
      throw error;
    }
    
    const error = new Error(message);
    error.name = name;
    error.code = code || 'CUSTOM_ERROR';
    error.severity = severity || 'medium';
    error.context = context || {};
    error.isCustom = true;
    error.statusCode = 400;
    
    next(error);
  } catch (error) {
    next(error);
  }
});

// POST /api/errors/analyze - AI-powered error analysis
app.post('/api/errors/analyze', strictLimiter, async (req, res, next) => {
  // Set request timeout with AbortController for proper cleanup
  const abortController = new AbortController();
  let timeoutId = null;
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    abortController.abort();
  };

  timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      cleanup();
      res.status(408).json({
        success: false,
        error: 'Request timeout - AI analysis took too long',
        timestamp: new Date().toISOString()
      });
    }
  }, 30000);

  // Single cleanup registration to prevent memory leaks
  res.once('finish', cleanup);
  req.once('close', cleanup);

  try {
    const { error: errorData, context } = req.body;
    
    if (!errorData) {
      const error = createError('validation', 'Error data is required for analysis');
      error.statusCode = 400;
      throw error;
    }
    
    // Create a proper error object from the data
    const error = new Error(errorData.message || 'Sample error for analysis');
    error.name = errorData.name || 'Error';
    error.stack = errorData.stack || new Error().stack;
    error.context = context || {};
    
    // Trigger qerrors analysis with timeout protection
    if (qerrors) {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('AI analysis timeout'));
        }, 25000); // 25 second timeout for AI processing
      });

      // Race between qerrors analysis and timeout
      await Promise.race([
        new Promise((resolve) => {
          qerrors(error, 'AI Analysis Request', req, res, () => {
            if (!res.headersSent) {
              res.json({
                success: true,
                analysis: 'Error analysis triggered via qerrors AI system',
                errorId: error.uniqueErrorName,
                timestamp: new Date().toISOString()
              });
            }
            resolve();
          });
        }),
        timeoutPromise
      ]);
    } else {
      // Fallback if qerrors not available
      res.json({
        success: false,
        error: 'qerrors not available for analysis',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    if (error.message === 'AI analysis timeout') {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'AI analysis timeout - please try again',
          timestamp: new Date().toISOString()
        });
      }
    } else {
      next(error);
    }
  }
});

// GET /html/error - HTML error response
app.get('/html/error', (req, res, next) => {
  const error = createError('html', 'HTML error response test');
  error.isHtml = true;
  next(error);
});

// GET /html/escape - HTML escaping test
app.get('/html/escape', (req, res, next) => {
  try {
    const userInput = '<script>alert("xss")</script>';
    // This should be handled safely by qerrors
    res.json({ 
      input: userInput,
      escaped: userInput.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    });
  } catch (error) {
    next(error);
  }
});

// POST /controller/error - Controller error handling
app.post('/controller/error', (req, res, next) => {
  const error = createError('controller', 'Controller error test');
  error.controller = 'testController';
  error.action = 'testAction';
  next(error);
});

// POST /auth/login - Secure authentication with rate limiting
app.post('/auth/login', rateLimiters.auth, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      const error = qerrors.createTypedError('Missing credentials', qerrors.ErrorTypes.AUTHENTICATION, 'AUTH_ERROR');
      error.statusCode = 401;
      throw error;
    }
    
    const validUsername = process.env.ADMIN_USERNAME;
    
    // Validate credentials securely
    if (username !== validUsername) {
      const error = qerrors.createTypedError('Invalid credentials', qerrors.ErrorTypes.AUTHENTICATION, 'AUTH_ERROR');
      error.statusCode = 401;
      throw error;
    }
    
    // In a real application, you would retrieve the hashed password from a database
    // For this demo, we'll hash the environment password on startup
    const storedPasswordHash = await auth.hashPassword(process.env.ADMIN_PASSWORD);
    const isValidPassword = await auth.verifyPassword(password, storedPasswordHash);
    
    if (!isValidPassword) {
      const error = qerrors.createTypedError('Invalid credentials', qerrors.ErrorTypes.AUTHENTICATION, 'AUTH_ERROR');
      error.statusCode = 401;
      throw error;
    }
    
    const token = auth.generateToken({ username, id: 1 });
    
    // Set secure HTTP-only cookie
    res.cookie('authToken', token, cookieOptions);
    
    res.json({ 
      success: true, 
      user: { username, id: 1 }
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/logout - Logout endpoint
app.post('/auth/logout', (req, res, next) => {
  try {
    res.clearCookie('authToken', cookieOptions);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /critical - Critical error testing
app.get('/critical', (req, res, next) => {
  const error = createError('critical', 'Critical system error');
  error.severity = 'critical';
  error.statusCode = 500;
  next(error);
});

// GET /concurrent - Concurrent error testing (optimized for scalability)
app.get('/concurrent', async (req, res, next) => {
  try {
    // Further reduced concurrent limit for better resource management
    const CONCURRENT_LIMIT = 2; // Reduced from 5 to minimize memory usage
    const CONCURRENT_TIMEOUT = 3000; // 3 seconds max for faster response
    
    // Use AbortController for timeout management
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), CONCURRENT_TIMEOUT);
    
    // Create promises with bounded memory and async operations to prevent CPU blocking
    const promiseFactories = [];
    for (let i = 0; i < CONCURRENT_LIMIT; i++) {
      promiseFactories.push(() => {
        return new Promise((resolve, reject) => {
          // Use fixed timeout to prevent CPU-intensive random calculations
          const timeout = 200 + (i * 100); // Predictable timeout pattern
          
          // Check for abort signal early
          if (abortController.signal.aborted) {
            reject(new Error('Concurrent operation aborted due to timeout'));
            return;
          }
          
          const timeoutId = setTimeout(() => {
            // Double-check abort signal before processing
            if (abortController.signal.aborted) {
              reject(new Error('Concurrent operation aborted'));
              return;
            }
            
            // Use deterministic error generation instead of Math.random()
            const shouldError = (i % 2) === 0; // Simple deterministic pattern
            if (shouldError) {
              reject(new Error(`Concurrent error ${i}`));
            } else {
              resolve({ id: i, success: true });
            }
          }, timeout);
          
          // Handle abort signal
          abortController.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new Error('Concurrent operation aborted'));
          });
        });
      });
    }
    
    // Execute promises with controlled concurrency to prevent memory growth
    const results = await Promise.allSettled(
      promiseFactories.map(factory => factory())
    );
    clearTimeout(timeoutId);
    
    // Process results with bounded memory usage
    const errors = [];
    const successes = [];
    
    for (let i = 0; i < results.length && i < 10; i++) { // Bound processing to prevent memory issues
      const result = results[i];
      if (result.status === 'rejected') {
        errors.push(result.reason.message);
      } else {
        successes.push(result.value);
      }
    }
    
    if (errors.length > 0) {
      const error = createError('concurrent', `${errors.length} concurrent errors occurred`);
      error.errors = errors.slice(0, 3); // Further limit error messages to prevent memory growth
      throw error;
    }
    
    res.json({ 
      success: true, 
      results: successes,
      processed: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error.message === 'Concurrent operation aborted due to timeout' || 
        error.message === 'Concurrent operation aborted') {
      if (!res.headersSent) {
        res.status(408).json({ error: 'Concurrent operations timed out' });
      }
    } else {
      next(error);
    }
  }
});

// Metrics and Management Endpoints

// GET /api/metrics - System metrics with pagination and field selection
app.get('/api/metrics', (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      fields = 'uptime,memory,timestamp,qerrors' 
    } = req.query;
    
    const fullMetrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      qerrors: {
        queueLength: qerrors.getQueueLength ? qerrors.getQueueLength() : 0,
        rejectCount: qerrors.getQueueRejectCount ? qerrors.getQueueRejectCount() : 0
      },
      cpu: process.cpuUsage(),
      pid: process.pid,
      version: process.version,
      platform: process.platform
    };
    
    // Field selection
    const requestedFields = fields.split(',');
    const filteredMetrics = {};
    requestedFields.forEach(field => {
      if (field.includes('.')) {
        // Handle nested fields like 'qerrors.queueLength'
        const [parent, child] = field.split('.');
        if (fullMetrics[parent] && fullMetrics[parent][child] !== undefined) {
          if (!filteredMetrics[parent]) filteredMetrics[parent] = {};
          filteredMetrics[parent][child] = fullMetrics[parent][child];
        }
      } else if (fullMetrics[field] !== undefined) {
        filteredMetrics[field] = fullMetrics[field];
      }
    });
    
    // Pagination (for future expansion when metrics become arrays)
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    
    const response = {
      data: filteredMetrics,
      pagination: {
        page: pageNum,
        limit: limitNum,
        startIndex,
        totalItems: 1 // Single metrics object
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// POST /api/config - Configuration updates
app.post('/api/config', (req, res) => {
  try {
    const { config } = req.body;
    // In a real implementation, this would update qerrors config
    res.json({ success: true, message: 'Configuration updated' });
  } catch (error) {
    res.status(400).json({ error: 'Invalid configuration' });
  }
});

// GET /api/health - Ultra-optimized health check with caching and non-blocking I/O
const healthCache = {
  data: null,
  timestamp: 0,
  ttl: 5000 // 5 seconds cache
};

app.get('/api/health', async (req, res) => {
  const now = Date.now();
  
  // Return cached response if available and fresh
  if (healthCache.data && (now - healthCache.timestamp) < healthCache.ttl) {
    return res.status(200).json(healthCache.data);
  }

  try {
    const startTime = now;
    
    // Non-blocking system metrics collection with minimal overhead
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Ultra-fast qerrors component check with error safety
    let qerrorsHealth = { status: 'operational', queueLength: 0, rejectCount: 0 };
    try {
      qerrorsHealth = {
        status: 'operational',
        queueLength: qerrorsModule.getQueueLength ? Math.min(999, qerrorsModule.getQueueLength()) : 0,
        rejectCount: qerrorsModule.getQueueRejectCount ? Math.min(999, qerrorsModule.getQueueRejectCount()) : 0
      };
    } catch (err) {
      qerrorsHealth = { status: 'error', queueLength: 0, rejectCount: 0 };
    }
    
    // Minimal AI service check (no I/O operations)
    const aiHealth = {
      status: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured'
    };
    
    // Optimized system health metrics with bounds checking
    const systemHealth = {
      uptime: Math.round(uptime),
      memory: {
        rss: Math.min(9999, Math.round(memUsage.rss / 1024 / 1024)),
        heapUsed: Math.min(9999, Math.round(memUsage.heapUsed / 1024 / 1024)),
        heapTotal: Math.min(9999, Math.round(memUsage.heapTotal / 1024 / 1024))
      },
      responseTime: Math.min(999, Date.now() - startTime)
    };
    
    // Fast overall health determination with relaxed thresholds
    const overallStatus = (
      qerrorsHealth.queueLength < 200 &&
      systemHealth.responseTime < 200 && // Further reduced timeout
      systemHealth.memory.heapUsed < 1024 // Relaxed memory threshold
    ) ? 'healthy' : 'degraded';
    
    const health = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.2.7',
      services: {
        qerrors: qerrorsHealth,
        ai: aiHealth
      },
      system: systemHealth
    };
    
    // Cache the response
    healthCache.data = health;
    healthCache.timestamp = now;
    
    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
    
  } catch (error) {
    // Return minimal error response to prevent cascading failures
    res.status(503).json({ 
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// DELETE /api/cache - Cache management
app.delete('/api/cache', (req, res) => {
  try {
    // In a real implementation, this would clear qerrors cache
    res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// GET /api/logs/export - Log export functionality
app.get('/api/logs/export', (req, res) => {
  try {
    // In a real implementation, this would export logs from qerrors
    const logs = [
      { timestamp: new Date().toISOString(), level: 'info', message: 'Sample log entry' }
    ];
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to export logs' });
  }
});

// Privacy and GDPR/CCPA Compliance Endpoints

// GET /privacy/consent - Get consent request form
app.get('/privacy/consent', (req, res, next) => {
  try {
    const consentRequest = privacyManager.getConsentRequest({
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    res.json(consentRequest);
  } catch (error) {
    next(error);
  }
});

// POST /privacy/consent - Record user consent
app.post('/privacy/consent', rateLimiters.general, (req, res, next) => {
  try {
    const { userId, purposes, marketing, analytics, essential } = req.body;
    
    if (!userId) {
      const error = qerrors.createTypedError('User ID required', qerrors.errorTypes.VALIDATION, 'VALIDATION_ERROR');
      error.statusCode = 400;
      throw error;
    }

    const consent = privacyManager.recordConsent(userId, {
      purposes,
      marketing,
      analytics,
      essential,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({ success: true, consent });
  } catch (error) {
    next(error);
  }
});

// PUT /privacy/consent/:userId - Update user consent
app.put('/privacy/consent/:userId', rateLimiters.general, (req, res, next) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    const updatedConsent = privacyManager.updateConsent(userId, updates);
    res.json({ success: true, consent: updatedConsent });
  } catch (error) {
    next(error);
  }
});

// DELETE /privacy/consent/:userId - Withdraw consent (Right to be Forgotten)
app.delete('/privacy/consent/:userId', rateLimiters.general, (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const withdrawnConsent = privacyManager.withdrawConsent(userId);
    res.json({ success: true, message: 'Consent withdrawn', consent: withdrawnConsent });
  } catch (error) {
    next(error);
  }
});

// GET /privacy/data/:userId - Get user data (Data Portability)
app.get('/privacy/data/:userId', (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const userData = privacyManager.getUserData(userId);
    res.json(userData);
  } catch (error) {
    next(error);
  }
});

// GET /privacy/policy - Get privacy policy
app.get('/privacy/policy', (req, res, next) => {
  try {
    const policy = privacyManager.getPrivacyPolicy();
    res.json(policy);
  } catch (error) {
    next(error);
  }
});

// Data Retention Management Endpoints

// GET /admin/retention/stats - Get data retention statistics
app.get('/admin/retention/stats', (req, res, next) => {
  try {
    const stats = dataRetentionService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// POST /admin/retention/cleanup - Trigger manual cleanup
app.post('/admin/retention/cleanup', async (req, res, next) => {
  try {
    await dataRetentionService.triggerManualCleanup();
    res.json({ success: true, message: 'Manual cleanup triggered' });
  } catch (error) {
    next(error);
  }
});

// Serve demo pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'demo.html'));
});

/**
 * Graceful shutdown handler
 * 
 * Ensures all resources are properly cleaned up before process exit.
 * This includes stopping background timers, closing database connections,
 * and allowing in-flight requests to complete.
 */
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Stop accepting new requests
    server.close(() => {
      console.log('✅ HTTP server closed');
    });
    
    // Cleanup qerrors resources
    const { stopQueueMetrics, stopAdviceCleanup } = require('./lib/qerrorsCache');
    const { stopQueueMetrics: stopQMetrics } = require('./lib/qerrorsQueue');
    
    stopQueueMetrics && stopQueueMetrics();
    stopAdviceCleanup && stopAdviceCleanup();
    stopQMetrics && stopQMetrics();
    
    // Force exit after timeout
    setTimeout(() => {
      console.log('⏰ Shutdown timeout, forcing exit');
      process.exit(1);
    }, 5000);
    
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Server startup and module export
 * 
 * The server starts on the configured port and provides comprehensive
 * console output with URLs for all available demo interfaces and API
 * endpoints. The app is also exported for testing purposes and potential
 * module usage in other applications.
 */
const server = app.listen(PORT, () => {
  console.log(`🚀 QErrors API Server running on http://localhost:${PORT}`);
  console.log(`📊 Demo UI: http://localhost:${PORT}/demo.html`);
  console.log(`🔧 Functional Demo: http://localhost:${PORT}/demo-functional.html`);
  console.log(`📡 API Endpoints available at http://localhost:${PORT}/api/`);
  console.log(`🛡️ Graceful shutdown enabled`);
});

// Export the Express app and server for testing and module usage
module.exports = { app, server };