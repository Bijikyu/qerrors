/**
 * Express.js API server for qerrors demo and integration testing
 * Works with ES module setup
 */

/**
 * Express.js API server for qerrors demo and integration testing
 * 
 * This server provides a comprehensive API for testing qerrors functionality
 * including error generation, AI analysis, and various error scenarios.
 * It's designed to work with ES module setup and provides both REST endpoints
 * and static file serving for demo pages.
 * 
 * Key features:
 * - Multiple error type generation for testing
 * - AI-powered error analysis endpoints
 * - Authentication and authorization testing
 * - Concurrent error handling
 * - Metrics and health check endpoints
 * - Static file serving for demo UI
 */

import express from 'express';           // Web framework
import cors from 'cors';                 // Cross-origin resource sharing
import path from 'path';                 // Path utilities
import { createRequire } from 'module';  // Require function for ES modules
import compression from 'compression';   // Response compression
import rateLimit from 'express-rate-limit'; // Rate limiting for scalability

// Import memory management utilities for scalability
const { MemoryMonitor, MemoryUtils } = require('./lib/memoryManagement');

// Create require function to import CommonJS modules in ES module context
const require = createRequire(import.meta.url);
const qerrorsModule = require('./index.js');
const jwt = require('jsonwebtoken'); // Move JWT require to top-level to prevent per-request I/O

// Initialize memory monitoring for scalability
const memoryMonitor = new MemoryMonitor({
  warningThreshold: 50 * 1024 * 1024,  // 50MB warning
  criticalThreshold: 100 * 1024 * 1024, // 100MB critical
  checkInterval: 10000 // 10 seconds
});

memoryMonitor.start();

// Extract qerrors function from module (handle both export patterns)
const qerrors = qerrorsModule.qerrors || qerrorsModule.default;
const app = express();
const PORT = process.env.PORT || 3001;  // Configurable port with default

// Scalability middleware - Enhanced configuration for better performance
app.use(compression({ threshold: 1024 })); // Only compress responses > 1KB

// Request timeout middleware for all requests
app.use((req, res, next) => {
  req.setTimeout(30000, () => { // 30 second timeout
    if (!res.headersSent) {
      res.status(408).json({
        error: 'Request timeout',
        message: 'Request took too long to process'
      });
    }
  });
  next();
});

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Reduced limit for better resource management
  message: { error: 'Too many requests', retryAfter: '15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  skip: (req) => req.url.startsWith('/health') || req.url.startsWith('/metrics'),
  // Memory management options
  store: new Map(), // Use in-memory store with automatic cleanup
  resetExpiryOnChange: true, // Reset expiry window on successful requests
});

// Express middleware configuration with enhanced security and limits
app.use(cors());                        
app.use(express.json({ 
  limit: '1mb', // Reduced from 10mb for security and performance
  strict: true, // Only parse objects and arrays
  type: 'application/json'
})); 
app.use(express.urlencoded({ 
  extended: true, 
  limit: '1mb',
  parameterLimit: 100 // Limit URL parameters
}));

// Apply rate limiting to API routes only
app.use('/api/', apiLimiter);

// Static file serving with caching headers
app.use(express.static('.', {
  maxAge: '1h', // Cache static files for 1 hour
  etag: true, // Enable ETag for caching
  lastModified: true // Enable Last-Modified header
}));

/**
 * Memory-aware middleware for request context tracking
 */
app.use((req, res, next) => {
  // Add memory tracking to request
  req.memoryStart = process.memoryUsage();
  req.startTime = Date.now();
  
  // Add cleanup function to response
  res.on('finish', () => {
    const memoryEnd = process.memoryUsage();
    const duration = Date.now() - req.startTime;
    
    // Log if memory usage is high
    const memoryDelta = memoryEnd.heapUsed - req.memoryStart.heapUsed;
    if (memoryDelta > 10 * 1024 * 1024) { // 10MB increase
      console.warn(`High memory usage detected: ${Math.round(memoryDelta / 1024 / 1024)}MB for ${req.url}`);
    }
    
    // Check if request took too long
    if (duration > 10000) { // 10 seconds
      console.warn(`Slow request: ${duration}ms for ${req.method} ${req.url}`);
    }
  });
  
  next();
});

/**
 * Global error handling middleware - Integrates qerrors with Express
 * 
 * This middleware catches all errors in the Express application and
 * routes them through qerrors for intelligent error handling. It provides
 * fallback behavior if qerrors is not available, ensuring the server
 * remains functional even if the error handling system fails.
 */
app.use((err, req, res, next) => {
  // Check memory state before error handling
  const currentMemory = process.memoryUsage();
  if (currentMemory.heapUsed > 150 * 1024 * 1024) { // 150MB
    console.error('CRITICAL: High memory usage during error handling', {
      heapUsed: currentMemory.heapUsed,
      url: req.url,
      error: err.message
    });
  }
  
  if (qerrors) {
    // Use qerrors for intelligent error handling with AI analysis
    qerrors(err, 'Express middleware', req, res, next);
  } else {
    // Fallback to standard Express error handling
    next(err);
  }
});

/**
 * Helper function to create test errors with specific types
 * 
 * This function creates Error objects with additional type information
 * that qerrors can use for classification and analysis. It's used
 * throughout the API endpoints to generate different error scenarios.
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

// ====================================================================
// API ENDPOINTS - Comprehensive testing interface for qerrors
// ====================================================================

/**
 * GET /api/data - Basic data endpoint for frontend integration
 * 
 * This endpoint provides a simple success response that frontend
 * applications can use to verify backend connectivity. It demonstrates
 * normal operation without errors for comparison with error scenarios.
 */
app.get('/api/data', async (req, res, next) => {
  try {
    // Return sample data to demonstrate successful API operation
    res.json({
      success: true,
      data: {
        message: 'Data from backend',
        timestamp: new Date().toISOString(),
        qerrors: 'integrated'  // Indicate qerrors is active
      }
    });
  } catch (error) {
    next(error);  // Route any errors through qerrors middleware
  }
});

/**
 * GET /api/error - Simple test error endpoint
 * 
 * This endpoint triggers a basic test error to demonstrate qerrors
 * functionality. It's the simplest way to test error handling without
 * any complex logic or request parameters.
 */
app.get('/api/error', (req, res, next) => {
  const error = createError('test', 'This is a test error from API');
  next(error);  // Route through qerrors middleware
});

/**
 * POST /api/validate - Validation error testing endpoint
 * 
 * This endpoint demonstrates validation error handling by checking
 * request body data and throwing appropriate validation errors.
 * It tests multiple validation scenarios including missing data,
 * invalid types, and length constraints.
 */
app.post('/api/validate', (req, res, next) => {
  try {
    const { data } = req.body;
    
    // Check if data exists and is a string
    if (!data || typeof data !== 'string') {
      const error = createError('validation', 'Invalid data format');
      error.statusCode = 400;  // Bad Request for validation errors
      throw error;
    }
    
    // Check minimum length requirement
    if (data.length < 3) {
      const error = createError('validation', 'Data too short');
      error.statusCode = 400;
      throw error;
    }
    
    // Return success if validation passes
    res.json({ success: true, validated: true });
  } catch (error) {
    next(error);  // Route validation errors through qerrors
  }
});

/**
 * POST /api/errors/trigger - Flexible error type generation
 * 
 * This endpoint allows testing different error types by accepting
 * parameters that specify the error type, message, and context.
 * It maps error types to appropriate HTTP status codes and provides
 * a comprehensive way to test qerrors with various error scenarios.
 */
app.post('/api/errors/trigger', (req, res, next) => {
  try {
    const { type, message, context } = req.body;
    
    // Define supported error types with default messages
    const errorTypes = {
      validation: 'Validation error occurred',
      authentication: 'Authentication failed',
      authorization: 'Access denied',
      network: 'Network connection error',
      database: 'Database operation failed',
      system: 'System error occurred',
      configuration: 'Configuration error'
    };
    
    // Use provided type or default to validation
    const errorType = type || 'validation';
    const errorMessage = message || errorTypes[errorType] || 'Unknown error';
    
    // Create error with additional properties
    const error = createError(errorType, errorMessage);
    error.context = context || {};  // Add context information
    error.statusCode = errorType === 'validation' ? 400 : 
                     errorType === 'authentication' ? 401 :
                     errorType === 'authorization' ? 403 : 500;
    
    next(error);  // Route through qerrors middleware
  } catch (error) {
    next(error);  // Handle any errors in error generation
  }
});

/**
 * POST /api/errors/custom - Custom business error creation
 * 
 * This endpoint allows creation of fully customized errors with
 * specific names, codes, severity levels, and context. It's useful
 * for testing how qerrors handles business-specific errors and
 * custom error classifications.
 */
app.post('/api/errors/custom', (req, res, next) => {
  try {
    const { name, code, message, severity, context } = req.body;
    
    // Validate required fields
    if (!name || !message) {
      const error = createError('validation', 'Error name and message are required');
      error.statusCode = 400;
      throw error;
    }
    
    // Create fully customized error object
    const error = new Error(message);
    error.name = name;                    // Custom error name
    error.code = code || 'CUSTOM_ERROR';   // Custom error code
    error.severity = severity || 'medium'; // Custom severity level
    error.context = context || {};         // Custom context
    error.isCustom = true;                 // Mark as custom error
    error.statusCode = 400;                // Bad Request for custom errors
    
    next(error);  // Route through qerrors middleware
  } catch (error) {
    next(error);  // Handle any errors in custom error creation
  }
});

/**
 * POST /api/errors/analyze - AI-powered error analysis endpoint
 * 
 * This endpoint demonstrates the core AI analysis functionality of qerrors
 * by accepting error data and triggering intelligent analysis. It creates
 * a proper error object from the provided data and routes it through qerrors
 * for AI-powered debugging suggestions and analysis.
 */
app.post('/api/errors/analyze', async (req, res, next) => {
  try {
    const { error: errorData, context } = req.body;
    
    // Validate that error data is provided
    if (!errorData) {
      const error = createError('validation', 'Error data is required for analysis');
      error.statusCode = 400;
      throw error;
    }
    
    // Reconstruct a proper error object from the provided data
    const error = new Error(errorData.message || 'Sample error for analysis');
    error.name = errorData.name || 'Error';
    error.stack = errorData.stack || new Error().stack;  // Use provided stack or generate
    error.context = context || {};
    
    // Trigger qerrors AI analysis
    if (qerrors) {
      await qerrors(error, 'AI Analysis Request', req, res, () => {
        // Send response after qerrors processing completes
        res.json({
          success: true,
          analysis: 'Error analysis triggered via qerrors AI system',
          errorId: error.uniqueErrorName,  // Unique identifier for tracking
          timestamp: new Date().toISOString()
        });
      });
    } else {
      // Fallback response if qerrors is not available
      res.json({
        success: false,
        error: 'qerrors not available for analysis',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    next(error);  // Route any errors through qerrors middleware
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

// POST /auth/login - Authentication error testing
app.post('/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      const error = createError('auth', 'Missing credentials');
      error.statusCode = 401;
      throw error;
    }
    
    // For this API server, use environment variables with secure defaults
    const validUsername = process.env.ADMIN_USERNAME || 'admin';
    const validPassword = process.env.ADMIN_PASSWORD;
    
    if (!validPassword) {
      const error = createError('auth', 'Server not properly configured');
      error.statusCode = 500;
      throw error;
    }
    
    if (username !== validUsername || password !== validPassword) {
      const error = createError('auth', 'Invalid credentials');
      error.statusCode = 401;
      throw error;
    }
    
    // Generate proper JWT token with secure secret
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required for secure authentication');
    }
    
    const token = jwt.sign(
      { username, id: 1, iat: Math.floor(Date.now() / 1000) },
      jwtSecret,
      { expiresIn: '24h' }
    );
    
    res.json({ 
      success: true, 
      token,
      user: { username, id: 1 }
    });
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
  // Add request timeout for concurrent operations
  req.setTimeout(10000, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Concurrent operation timeout' });
    }
  });

  try {
    // Further reduced concurrent limit for better resource management
    const CONCURRENT_LIMIT = 2; // Reduced from 3 to minimize memory usage
    const CONCURRENT_TIMEOUT = 3000; // Reduced to 3 seconds for faster response
    
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

// GET /api/metrics - System metrics
app.get('/api/metrics', (req, res) => {
  try {
    const metrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      qerrors: {
        queueLength: qerrorsModule.getQueueLength ? qerrorsModule.getQueueLength() : 0,
        rejectCount: qerrorsModule.getQueueRejectCount ? qerrorsModule.getQueueRejectCount() : 0
      }
    };
    res.json(metrics);
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

// GET /api/health - AI model health checks
app.get('/api/health', (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        qerrors: 'operational',
        ai: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
        cache: 'operational'
      }
    };
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: 'Health check failed' });
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

// Serve demo pages
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'demo.html'));
});

// ====================================================================
// SERVER STARTUP - Initialize and start the API server
// ====================================================================

/**
 * Start the Express server and log available endpoints
 * 
 * The server starts on the configured port and provides helpful
 * console output with URLs for the demo interfaces and API endpoints.
 * This makes it easy for developers to find and test the available
 * functionality.
 */
app.listen(PORT, () => {
  console.log(`🚀 QErrors API Server running on http://localhost:${PORT}`);
  console.log(`📊 Demo UI: http://localhost:${PORT}/demo.html`);
  console.log(`🔧 Functional Demo: http://localhost:${PORT}/demo-functional.html`);
  console.log(`📡 API Endpoints available at http://localhost:${PORT}/api/`);
});

// Export the app for testing and potential module usage
export default app;