/**
 * Simple Express API server for demo integration testing
 * 
 * This server provides a lightweight backend API for testing qerrors
 * frontend integration without requiring the full qerrors middleware.
 * It includes basic error handling and serves as a fallback when the
 * main qerrors-integrated server is not available.
 * 
 * Key features:
 * - Basic Express server without qerrors dependency
 * - Simple error handling with HTML/JSON content negotiation
 * - XSS protection through HTML escaping
 * - Essential API endpoints for frontend testing
 * - Static file serving for demo pages
 */

// Core dependencies
import express from 'express';  // Web framework
import rateLimit from 'express-rate-limit';  // Rate limiting
import helmet from 'helmet';     // Security headers
import cors from 'cors';        // Cross-origin resource sharing
import path from 'path';        // Path utilities
import { createRequire } from 'module';  // Require function for ES modules

// Create require function and import JWT at top-level to prevent per-request I/O
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

// Server configuration
const app = express();
const PORT = process.env.PORT || 3001;  // Configurable port with default

// Security middleware (excluding CSP for API endpoints)
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP to avoid blocking API requests
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Express middleware configuration with security measures
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001', 'http://127.0.0.1:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Body parser with size limits for DoS protection
app.use(express.json({ 
  limit: '10mb',  // Reasonable limit for JSON payloads
  strict: true,
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 1000
}));

app.use(express.static('.', {
  maxAge: '1h',
  etag: true,
  lastModified: true
}));

/**
 * Input validation middleware for SQL injection prevention
 */
function validateInput(req, res, next) {
  // Check for SQL injection patterns in request body
  if (req.body) {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(--|\/\*|\*\/|;|'|")/,
      /(\b(UNION|JOIN|WHERE)\s+)/i
    ];
    
    const checkValue = (value) => {
      if (typeof value === 'string') {
        return sqlPatterns.some(pattern => pattern.test(value));
      }
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(v => checkValue(v));
      }
      return false;
    };
    
    if (checkValue(req.body)) {
      const error = new Error('Invalid input detected');
      error.status = 400;
      error.type = 'security';
      return next(error);
    }
  }
  
  next();
}

/**
 * Basic error handling middleware with content negotiation
 * 
 * This simplified error handler provides content negotiation to serve
 * either HTML or JSON error responses based on Accept header.
 * It includes XSS protection through HTML escaping for security.
 * 
 * Note: This is a simplified version that doesn't include qerrors
 * AI analysis functionality.
 */
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Proper content negotiation using Express accepts method
  const wantsJson = req.accepts('json');
  const isHtml = !wantsJson;
  console.error('Content negotiation - Accept:', req.get('Accept'), 'wantsJson:', wantsJson, 'isHtml:', isHtml);
  
  if (isHtml) {
    /**
     * HTML error response with XSS protection
     * 
     * The error message is escaped to prevent XSS attacks when displaying
     * user-provided error content in HTML responses.
     */
    const escapedMessage = String(err.message || 'Unknown error')
      .replace(/&/g, '&amp;')     // Escape ampersands
      .replace(/</g, '&lt;')      // Escape less-than signs
      .replace(/>/g, '&gt;')      // Escape greater-than signs
      .replace(/"/g, '&quot;')    // Escape double quotes
      .replace(/'/g, '&#39;');     // Escape single quotes
    
    // Send HTML error page
    res.status(err.status || 500).send(`<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body>
  <h1>Error</h1>
  <p>${escapedMessage}</p>
  <p>Timestamp: ${new Date().toISOString()}</p>
</body>
</html>`);
  } else {
    // Send JSON error response
    res.status(err.status || 500).json({
      error: {
        message: err.message,                    // Error message
        type: err.type || 'unknown',            // Error classification
        timestamp: new Date().toISOString(),     // Error occurrence time
        uniqueErrorName: err.name || 'Error'     // Error identifier
      }
    });
  }
});

/**
 * Helper function to create test errors with type classification
 * 
 * This function creates Error objects with type information for
 * basic error classification in the simple server. It mirrors the
 * interface used in the full qerrors-integrated server for consistency.
 * 
 * @param {string} type - Error type for classification
 * @param {string} message - Error message (optional, defaults to 'Test error')
 * @returns {Error} Configured error object with type property
 */
function createError(type, message = 'Test error') {
  const error = new Error(message);
  error.type = type;  // Add type property for classification
  return error;
}

// API Endpoints

// GET /api/data - Missing endpoint that frontend expects
app.get('/api/data', validateInput, async (req, res, next) => {
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

// GET /api/error-json - Explicit JSON error endpoint for testing
app.get('/api/error-json', (req, res, next) => {
  const error = createError('test', 'This is a JSON test error');
  error.status = 500;
  next(error);
});

// POST /api/validate - Validation error testing
app.post('/api/validate', validateInput, (req, res, next) => {
  try {
    const { data } = req.body;
    
    if (!data || typeof data !== 'string') {
      const error = createError('validation', 'Invalid data format');
      error.status = 400;
      throw error;
    }
    
    if (data.length < 3) {
      const error = createError('validation', 'Data too short');
      error.status = 400;
      throw error;
    }
    
    res.json({ success: true, validated: true });
  } catch (error) {
    next(error);
  }
});

// GET /html/error - HTML error response
app.get('/html/error', (req, res, next) => {
  const error = createError('html', 'HTML error response test');
  next(error);
});

// GET /html/escape - HTML escaping test
app.get('/html/escape', (req, res, next) => {
  try {
    const userInput = '<script>alert("xss")</script>';
    // This should be handled safely
    res.json({ 
      input: userInput,
      escaped: userInput
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    });
  } catch (error) {
    next(error);
  }
});

// POST /controller/error - Controller error handling
app.post('/controller/error', validateInput, (req, res, next) => {
  const error = createError('controller', 'Controller error test');
  error.controller = 'testController';
  error.action = 'testAction';
  next(error);
});

// POST /api/errors/trigger - Trigger specific error types
app.post('/api/errors/trigger', validateInput, (req, res, next) => {
  try {
    const { type, message } = req.body;
    
    if (!type) {
      const error = createError('validation', 'Error type is required');
      error.status = 400;
      throw error;
    }
    
    const error = createError(type, message || `Triggered ${type} error`);
    error.triggered = true;
    error.timestamp = new Date().toISOString();
    next(error);
  } catch (error) {
    next(error);
  }
});

// POST /api/errors/custom - Create custom errors with context
app.post('/api/errors/custom', validateInput, (req, res, next) => {
  try {
    const { name, message, context, severity } = req.body;
    
    if (!name || !message) {
      const error = createError('validation', 'Error name and message are required');
      error.status = 400;
      throw error;
    }
    
    const error = new Error(message);
    error.name = name;
    error.type = 'custom';
    error.context = context || {};
    error.severity = severity || 'medium';
    error.custom = true;
    error.timestamp = new Date().toISOString();
    
    next(error);
  } catch (error) {
    next(error);
  }
});

// POST /api/errors/analyze - Simulated AI error analysis
app.post('/api/errors/analyze', validateInput, async (req, res, next) => {
  try {
    const { error: errorData, context } = req.body;
    
    if (!errorData) {
      const error = createError('validation', 'Error data is required for analysis');
      error.status = 400;
      throw error;
    }
    
    // Simulate AI analysis delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock AI analysis response
    const analysis = {
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      analysis: {
        type: errorData.type || 'unknown',
        severity: errorData.severity || 'medium',
        probableCause: `Based on the error pattern, this appears to be a ${errorData.type || 'generic'} error.`,
        suggestions: [
          'Check the input parameters for validity',
          'Verify the system state and dependencies',
          'Review recent changes that might have affected this functionality'
        ],
        relatedIssues: [],
        debugSteps: [
          '1. Review the error stack trace',
          '2. Check system logs for additional context',
          '3. Verify the input data format',
          '4. Test with different parameters'
        ]
      },
      context: context || {},
      timestamp: new Date().toISOString(),
      aiModel: 'mock-analyzer-v1',
      confidence: 0.85
    };
    
    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/login - Authentication error testing
app.post('/auth/login', validateInput, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      const error = createError('auth', 'Missing credentials');
      error.status = 401;
      throw error;
    }
    
    // Input validation for SQL injection prevention
    if (typeof username !== 'string' || typeof password !== 'string') {
      const error = createError('validation', 'Invalid input type');
      error.status = 400;
      throw error;
    }
    
    if (username.length > 50 || password.length > 100) {
      const error = createError('validation', 'Input too long');
      error.status = 400;
      throw error;
    }
    
    // For this simple demo server, use environment variables with secure defaults
    const validUsername = process.env.ADMIN_USERNAME || 'admin';
    const validPassword = process.env.ADMIN_PASSWORD;
    
    if (!validPassword) {
      const error = createError('auth', 'Server not properly configured');
      error.status = 500;
      throw error;
    }
    
    if (username !== validUsername || password !== validPassword) {
      const error = createError('auth', 'Invalid credentials');
      error.status = 401;
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
  error.status = 500;
  next(error);
});

// GET /concurrent - Concurrent error testing (optimized for scalability)
app.get('/concurrent', async (req, res, next) => {
  try {
    // Fixed array size to prevent unbounded memory growth
    // Optimized concurrent operations with controlled limits and timeout management
    const CONCURRENT_LIMIT = 3; // Reduced from 5 for better resource management
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
          const timeout = 50 + (i * 10); // Predictable timeout pattern
          
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
      error.errors = errors.slice(0, 3); // Limit error messages to prevent memory growth
      throw error;
    }
    
    res.json({ 
      success: true, 
      results: successes,
      processed: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
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
        queueLength: 0,
        rejectCount: 0
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

/**
 * Server startup with ES module export
 * 
 * The server starts on the configured port and provides console output
 * with URLs for demo interfaces and API endpoints. The app is exported
 * as a default ES module for potential use in other applications.
 */
app.listen(PORT, () => {
  console.log(`🚀 QErrors API Server running on http://localhost:${PORT}`);
  console.log(`📊 Demo UI: http://localhost:${PORT}/demo.html`);
  console.log(`🔧 Functional Demo: http://localhost:${PORT}/demo-functional.html`);
  console.log(`📡 API Endpoints available at http://localhost:${PORT}/api/`);
});

// Export as default ES module
export default app;