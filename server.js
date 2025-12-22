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
const jwt = require('jsonwebtoken');  // JWT token generation and validation

// Import qerrors for intelligent error handling
const qerrorsModule = require('./index.js');
const qerrors = qerrorsModule.qerrors;  // Extract main qerrors function

// Server configuration
const app = express();
const PORT = process.env.PORT || 3001;  // Configurable port with default

// Express middleware configuration
app.use(cors());                        // Enable CORS for all routes
app.use(express.json());                // Parse JSON request bodies
app.use(express.static('.'));           // Serve static files from current directory

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
app.post('/api/errors/analyze', async (req, res, next) => {
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
    
    // Trigger qerrors analysis
    if (qerrors) {
      await qerrors(error, 'AI Analysis Request', req, res, () => {
        // Send response after qerrors processing
        res.json({
          success: true,
          analysis: 'Error analysis triggered via qerrors AI system',
          errorId: error.uniqueErrorName,
          timestamp: new Date().toISOString()
        });
      });
    } else {
      // Fallback if qerrors not available
      res.json({
        success: false,
        error: 'qerrors not available for analysis',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    next(error);
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
    
    const validUsername = process.env.ADMIN_USERNAME || 'admin';
    const validPassword = process.env.ADMIN_PASSWORD || 'secure_password_change_me';
    
    if (username !== validUsername || password !== validPassword) {
      const error = createError('auth', 'Invalid credentials');
      error.statusCode = 401;
      throw error;
    }
    
    const token = jwt.sign(
      { username, id: 1 },
      process.env.JWT_SECRET || 'change_this_in_production_jwt_secret_key',
      { expiresIn: '1h' }
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
        queueLength: qerrors.getQueueLength ? qerrors.getQueueLength() : 0,
        rejectCount: qerrors.getQueueRejectCount ? qerrors.getQueueRejectCount() : 0
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
  res.sendFile(path.join(__dirname, 'demo.html'));
});

/**
 * Server startup and module export
 * 
 * The server starts on the configured port and provides comprehensive
 * console output with URLs for all available demo interfaces and API
 * endpoints. The app is also exported for testing purposes and potential
 * module usage in other applications.
 */
app.listen(PORT, () => {
  console.log(`🚀 QErrors API Server running on http://localhost:${PORT}`);
  console.log(`📊 Demo UI: http://localhost:${PORT}/demo.html`);
  console.log(`🔧 Functional Demo: http://localhost:${PORT}/demo-functional.html`);
  console.log(`📡 API Endpoints available at http://localhost:${PORT}/api/`);
});

// Export the Express app for testing and module usage
module.exports = app;