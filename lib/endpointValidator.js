/**
 * Comprehensive Endpoint Validation and Management
 * 
 * Purpose: Provides unified endpoint validation, documentation, and management
 * across all qerrors server implementations. This ensures consistent API
 * contracts and enables automatic endpoint discovery.
 * 
 * Design Rationale:
 * - Consistency: Standardized endpoint structure across all servers
 * - Validation: Comprehensive request/response validation
 * - Documentation: Auto-generated API documentation
 * - Discovery: Enable frontend to discover available endpoints
 * - Health: Real-time endpoint health monitoring
 * 
 * Features:
 * - Request schema validation with JSON schemas
 * - Response format standardization
 * - Rate limiting per endpoint
 * - Endpoint health checks
 * - API documentation generation
 */

const { verboseLog } = require('./utils');
const { createErrorResponse, createSuccessResponse, ERROR_TYPES } = require('./standardizedResponses');

/**
 * Endpoint registry to track all available endpoints
 */
class EndpointRegistry {
  constructor() {
    this.endpoints = new Map();
    this.healthStatus = new Map();
    this.initDefaultEndpoints();
  }
  
  /**
   * Initialize with default qerrors endpoints
   */
  initDefaultEndpoints() {
    const defaultEndpoints = [
      {
        path: '/api/data',
        method: 'GET',
        description: 'Get sample data from backend',
        category: 'data',
        requiresAuth: false,
        rateLimit: { max: 100, windowMs: 60000 },
        requestSchema: null,
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            timestamp: { type: 'string' }
          }
        }
      },
      
      {
        path: '/api/error',
        method: 'GET',
        description: 'Trigger test error',
        category: 'testing',
        requiresAuth: false,
        rateLimit: { max: 50, windowMs: 60000 },
        requestSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['basic', 'type', 'reference', 'range', 'syntax', 'custom'] }
          }
        },
        responseSchema: null // Error response
      },
      
      {
        path: '/api/validate',
        method: 'POST',
        description: 'Validate input data',
        category: 'validation',
        requiresAuth: false,
        rateLimit: { max: 200, windowMs: 60000 },
        requestSchema: {
          type: 'object',
          properties: {
            data: { type: 'string', minLength: 3, maxLength: 1000 }
          },
          required: ['data']
        },
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            validated: { type: 'boolean' },
            originalData: { type: 'string' }
          }
        }
      },
      
      {
        path: '/api/errors/trigger',
        method: 'POST',
        description: 'Trigger specific error types',
        category: 'testing',
        requiresAuth: false,
        rateLimit: { max: 100, windowMs: 60000 },
        requestSchema: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            message: { type: 'string', maxLength: 500 },
            context: { type: 'object' }
          },
          required: ['type']
        },
        responseSchema: null // Error response
      },
      
      {
        path: '/api/errors/custom',
        method: 'POST',
        description: 'Create custom errors with context',
        category: 'testing',
        requiresAuth: false,
        rateLimit: { max: 100, windowMs: 60000 },
        requestSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            message: { type: 'string', minLength: 1, maxLength: 500 },
            context: { type: 'object' },
            severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
          },
          required: ['name', 'message']
        },
        responseSchema: null // Error response
      },
      
      {
        path: '/api/errors/analyze',
        method: 'POST',
        description: 'Analyze error using AI',
        category: 'ai',
        requiresAuth: false,
        rateLimit: { max: 20, windowMs: 60000 },
        requestSchema: {
          type: 'object',
          properties: {
            errorData: { type: 'object' },
            context: { type: 'object' }
          },
          required: ['errorData']
        },
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            analysis: {
              type: 'object',
              properties: {
                errorId: { type: 'string' },
                analysis: { type: 'object' },
                timestamp: { type: 'string' }
              }
            }
          }
        }
      },
      
      {
        path: '/api/metrics',
        method: 'GET',
        description: 'Get system metrics',
        category: 'monitoring',
        requiresAuth: false,
        rateLimit: { max: 50, windowMs: 60000 },
        requestSchema: null,
        responseSchema: {
          type: 'object',
          properties: {
            uptime: { type: 'number' },
            memory: { type: 'object' },
            timestamp: { type: 'string' }
          }
        }
      },
      
      {
        path: '/api/health',
        method: 'GET',
        description: 'System health check',
        category: 'monitoring',
        requiresAuth: false,
        rateLimit: { max: 100, windowMs: 60000 },
        requestSchema: null,
        responseSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'unhealthy', 'degraded'] },
            timestamp: { type: 'string' },
            services: { type: 'object' }
          }
        }
      },
      
      {
        path: '/api/config',
        method: 'POST',
        description: 'Update configuration',
        category: 'management',
        requiresAuth: true,
        rateLimit: { max: 10, windowMs: 60000 },
        requestSchema: {
          type: 'object',
          additionalProperties: true
        },
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      },
      
      {
        path: '/api/cache',
        method: 'DELETE',
        description: 'Clear cache',
        category: 'management',
        requiresAuth: true,
        rateLimit: { max: 5, windowMs: 60000 },
        requestSchema: null,
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      },
      
      {
        path: '/api/logs/export',
        method: 'GET',
        description: 'Export logs',
        category: 'management',
        requiresAuth: true,
        rateLimit: { max: 10, windowMs: 60000 },
        requestSchema: {
          type: 'object',
          properties: {
            level: { type: 'string', enum: ['error', 'warn', 'info', 'debug'] },
            limit: { type: 'number', minimum: 1, maximum: 1000 }
          }
        },
        responseSchema: {
          type: 'object',
          properties: {
            logs: {
              type: 'array',
              items: { type: 'object' }
            }
          }
        }
      },
      
      {
        path: '/api/docs',
        method: 'GET',
        description: 'Get API documentation',
        category: 'documentation',
        requiresAuth: false,
        rateLimit: { max: 50, windowMs: 60000 },
        requestSchema: null,
        responseSchema: {
          type: 'object',
          properties: {
            endpoints: { type: 'array' },
            version: { type: 'string' },
            generated: { type: 'string' }
          }
        }
      }
    ];
    
    defaultEndpoints.forEach(endpoint => {
      this.registerEndpoint(endpoint);
    });
  }
  
  /**
   * Register an endpoint
   * @param {Object} endpoint - Endpoint configuration
   */
  registerEndpoint(endpoint) {
    const key = `${endpoint.method}:${endpoint.path}`;
    this.endpoints.set(key, {
      ...endpoint,
      registered: new Date().toISOString(),
      callCount: 0,
      lastCalled: null,
      errors: 0,
      lastError: null
    });
    
    // Initialize health status
    this.healthStatus.set(key, {
      status: 'unknown',
      lastCheck: new Date().toISOString(),
      responseTime: null,
      errorRate: 0
    });
    
    verboseLog(`Endpoint registered: ${key}`);
  }
  
  /**
   * Get endpoint configuration
   * @param {string} method - HTTP method
   * @param {string} path - Endpoint path
   * @returns {Object|null} Endpoint configuration
   */
  getEndpoint(method, path) {
    const key = `${method}:${path}`;
    return this.endpoints.get(key) || null;
  }
  
  /**
   * Get all endpoints
   * @param {Object} filters - Optional filters
   * @returns {Array} Array of endpoint configurations
   */
  getAllEndpoints(filters = {}) {
    const endpoints = Array.from(this.endpoints.values());
    
    if (filters.category) {
      return endpoints.filter(ep => ep.category === filters.category);
    }
    
    if (filters.requiresAuth !== undefined) {
      return endpoints.filter(ep => ep.requiresAuth === filters.requiresAuth);
    }
    
    return endpoints;
  }
  
  /**
   * Update endpoint statistics
   * @param {string} method - HTTP method
   * @param {string} path - Endpoint path
   * @param {Object} stats - Statistics to update
   */
  updateStats(method, path, stats) {
    const key = `${method}:${path}`;
    const endpoint = this.endpoints.get(key);
    
    if (endpoint) {
      if (stats.called) {
        endpoint.callCount++;
        endpoint.lastCalled = new Date().toISOString();
      }
      
      if (stats.error) {
        endpoint.errors++;
        endpoint.lastError = {
          message: stats.error.message,
          timestamp: new Date().toISOString()
        };
      }
      
      // Update health status
      const health = this.healthStatus.get(key);
      if (health) {
        health.lastCheck = new Date().toISOString();
        
        if (stats.responseTime) {
          health.responseTime = stats.responseTime;
        }
        
        health.errorRate = endpoint.callCount > 0 ? endpoint.errors / endpoint.callCount : 0;
        health.status = health.errorRate > 0.5 ? 'unhealthy' : 
                       health.errorRate > 0.1 ? 'degraded' : 'healthy';
      }
    }
  }
  
  /**
   * Generate API documentation
   * @returns {Object} API documentation object
   */
  generateDocs() {
    const endpoints = this.getAllEndpoints();
    
    return {
      version: '1.0.0',
      generated: new Date().toISOString(),
      baseUrl: process.env.BASE_URL || 'http://localhost:3001',
      categories: {
        data: { description: 'Data retrieval and manipulation endpoints' },
        testing: { description: 'Error testing and validation endpoints' },
        ai: { description: 'AI-powered analysis endpoints' },
        monitoring: { description: 'System monitoring and health endpoints' },
        management: { description: 'System management endpoints' },
        documentation: { description: 'API documentation endpoints' }
      },
      endpoints: endpoints.map(endpoint => ({
        method: endpoint.method,
        path: endpoint.path,
        description: endpoint.description,
        category: endpoint.category,
        requiresAuth: endpoint.requiresAuth,
        rateLimit: endpoint.rateLimit,
        requestSchema: endpoint.requestSchema,
        responseSchema: endpoint.responseSchema,
        stats: {
          callCount: endpoint.callCount,
          errors: endpoint.errors,
          errorRate: endpoint.callCount > 0 ? endpoint.errors / endpoint.callCount : 0,
          lastCalled: endpoint.lastCalled
        },
        health: this.healthStatus.get(`${endpoint.method}:${endpoint.path}`)
      }))
    };
  }
}

// Global endpoint registry instance
const endpointRegistry = new EndpointRegistry();

/**
 * Request validation middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
function validateRequest(req, res, next) {
  const endpoint = endpointRegistry.getEndpoint(req.method, req.path);
  
  if (!endpoint) {
    return res.status(404).json(createErrorResponse(
      new Error(`Endpoint ${req.method} ${req.path} not found`),
      { type: ERROR_TYPES.NOT_FOUND, httpStatus: 404 }
    ));
  }
  
  // Validate request schema if defined
  if (endpoint.requestSchema) {
    const validation = validateSchema(req.body, endpoint.requestSchema);
    
    if (!validation.valid) {
      const error = new Error(`Validation failed: ${validation.errors.join(', ')}`);
      error.name = 'ValidationError';
      return res.status(400).json(createErrorResponse(
        error,
        { type: ERROR_TYPES.VALIDATION, httpStatus: 400 }
      ));
    }
  }
  
  // Update call statistics
  const startTime = Date.now();
  endpointRegistry.updateStats(req.method, req.path, { called: true });
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    endpointRegistry.updateStats(req.method, req.path, { responseTime });
    originalEnd.apply(this, args);
  };
  
  next();
}

/**
 * Simple JSON schema validator
 * @param {any} data - Data to validate
 * @param {Object} schema - JSON schema
 * @returns {Object} Validation result
 */
function validateSchema(data, schema) {
  if (!schema) {
    return { valid: true, errors: [] };
  }
  
  const errors = [];
  
  // Type validation
  if (schema.type && typeof data !== schema.type) {
    errors.push(`Expected type ${schema.type}, got ${typeof data}`);
  }
  
  // Required properties validation
  if (schema.required && Array.isArray(schema.required)) {
    for (const required of schema.required) {
      if (!data || !(required in data)) {
        errors.push(`Missing required property: ${required}`);
      }
    }
  }
  
  // Properties validation
  if (schema.properties && typeof data === 'object' && data !== null) {
    for (const [prop, propSchema] of Object.entries(schema.properties)) {
      if (prop in data) {
        const value = data[prop];
        
        // Type validation for property
        if (propSchema.type && typeof value !== propSchema.type) {
          errors.push(`Property ${prop} should be ${propSchema.type}, got ${typeof value}`);
        }
        
        // String validation
        if (typeof value === 'string') {
          if (propSchema.minLength && value.length < propSchema.minLength) {
            errors.push(`Property ${prop} must be at least ${propSchema.minLength} characters`);
          }
          if (propSchema.maxLength && value.length > propSchema.maxLength) {
            errors.push(`Property ${prop} must be at most ${propSchema.maxLength} characters`);
          }
          
          // Enum validation
          if (propSchema.enum && !propSchema.enum.includes(value)) {
            errors.push(`Property ${prop} must be one of: ${propSchema.enum.join(', ')}`);
          }
        }
        
        // Number validation
        if (typeof value === 'number') {
          if (propSchema.minimum !== undefined && value < propSchema.minimum) {
            errors.push(`Property ${prop} must be at least ${propSchema.minimum}`);
          }
          if (propSchema.maximum !== undefined && value > propSchema.maximum) {
            errors.push(`Property ${prop} must be at most ${propSchema.maximum}`);
          }
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * API documentation endpoint
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
function getApiDocs(req, res) {
  try {
    const docs = endpointRegistry.generateDocs();
    res.json(createSuccessResponse(docs, {
      message: 'API documentation retrieved successfully'
    }));
  } catch (error) {
    res.status(500).json(createErrorResponse(
      error,
      { type: ERROR_TYPES.SERVER }
    ));
  }
}

/**
 * Health check endpoint with endpoint status
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
function getSystemHealth(req, res) {
  try {
    const allEndpoints = endpointRegistry.getAllEndpoints();
    const unhealthyEndpoints = allEndpoints.filter(ep => {
      const health = endpointRegistry.healthStatus.get(`${ep.method}:${ep.path}`);
      return health && health.status === 'unhealthy';
    });
    
    const health = {
      status: unhealthyEndpoints.length > 0 ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      endpoints: {
        total: allEndpoints.length,
        healthy: allEndpoints.length - unhealthyEndpoints.length,
        unhealthy: unhealthyEndpoints.length
      },
      services: {
        qerrors: 'operational',
        ai: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY ? 'configured' : 'not_configured',
        cache: 'operational',
        registry: 'operational'
      }
    };
    
    res.json(createSuccessResponse(health, {
      message: 'System health check completed'
    }));
  } catch (error) {
    res.status(500).json(createErrorResponse(
      error,
      { type: ERROR_TYPES.SERVER }
    ));
  }
}

module.exports = {
  EndpointRegistry,
  endpointRegistry,
  validateRequest,
  validateSchema,
  getApiDocs,
  getSystemHealth
};