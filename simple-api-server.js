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
import cors from 'cors';        // Cross-origin resource sharing
import path from 'path';        // Path utilities

// Server configuration
const app = express();
const PORT = process.env.PORT || 3001;  // Configurable port with default

// Express middleware configuration
app.use(cors());                        // Enable CORS for all routes
app.use(express.json());                // Parse JSON request bodies
app.use(express.static('.'));           // Serve static files from current directory

/**
 * Basic error handling middleware with content negotiation
 * 
 * This simplified error handler provides content negotiation to serve
 * either HTML or JSON error responses based on the Accept header.
 * It includes XSS protection through HTML escaping for security.
 * 
 * Note: This is a simplified version that doesn't include qerrors
 * AI analysis functionality.
 */
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Determine response format based on Accept header
  const isHtml = req.accepts('html') && !req.accepts('json');
  
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
      error.status = 401;
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
    const jwt = require('jsonwebtoken');
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

// GET /concurrent - Concurrent error testing
app.get('/concurrent', async (req, res, next) => {
  try {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        new Promise((resolve, reject) => {
          setTimeout(() => {
            if (Math.random() > 0.5) {
              reject(new Error(`Concurrent error ${i}`));
            } else {
              resolve({ id: i, success: true });
            }
          }, Math.random() * 100);
        })
      );
    }
    
    const results = await Promise.allSettled(promises);
    const errors = results.filter(r => r.status === 'rejected');
    
    if (errors.length > 0) {
      const error = createError('concurrent', `${errors.length} concurrent errors occurred`);
      error.errors = errors.map(e => e.reason.message);
      throw error;
    }
    
    res.json({ success: true, results: results.map(r => r.value) });
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