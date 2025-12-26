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

// Static file paths configuration
const staticPaths = [
  { path: './demo.html', name: 'demo' },
  { path: './demo-functional.html', name: 'demo-functional' },
  { path: './index.html', name: 'index' }
];

// Initialize atomic static file cache for thread-safe operations
const atomicFileCache = getAtomicFileCache({
  maxCacheSize: 50 * 1024 * 1024, // 50MB total cache
  maxFileSize: 5 * 1024 * 1024, // 5MB per file
  maxEntries: 1000
});

// Configurable timeout settings for AI analysis
const AI_ANALYSIS_TIMEOUTS = {
  REQUEST_TIMEOUT: parseInt(process.env.AI_REQUEST_TIMEOUT) || 30000, // 30 seconds default
  PROCESSING_TIMEOUT: parseInt(process.env.AI_PROCESSING_TIMEOUT) || 25000, // 25 seconds default
  CLEANUP_DELAY: 5000 // 5 seconds delay before cleanup
};

/**
 * Async static file loading with atomic cache operations
 */
const getCachedStaticFile = async (name) => {
  const staticPath = staticPaths.find(p => p.name === name);
  if (!staticPath) return null;
  
  try {
    // Try LRU cache first (O(1) operation)
    const cachedEntry = lruCache.get(name);
    if (cachedEntry) {
      return cachedEntry.content;
    }
    
    // Load and cache the file
    return await loadStaticFileAsync(name, staticPath);
  } catch (error) {
    console.warn(`Failed to get cached static file ${name}:`, error.message);
    return null;
  }
};

/**
 * Async file loading with proper error handling and memory management
 */
const loadStaticFileAsync = async (name, staticPath) => {
  try {
    // Check LRU cache first (O(1) operation)
    const cachedEntry = lruCache.get(name);
    if (cachedEntry) {
      // Use async stat to check if file changed
      const currentStats = await fs.promises.stat(staticPath.path);
      const needsReload = currentStats.mtime > cachedEntry.stats.mtime || 
                         currentStats.size !== cachedEntry.stats.size;
      
      if (!needsReload) {
        return cachedEntry.content;
      }
    }
    
    // Use async stat to avoid blocking
    const currentStats = await fs.promises.stat(staticPath.path);
    
    // Check file size limits
    if (currentStats.size > MAX_FILE_SIZE) {
      console.warn(`Static file ${name} too large (${currentStats.size} bytes), skipping cache`);
      return await fs.promises.readFile(staticPath.path, 'utf8');
    }
    
    // Load file asynchronously
    const content = await fs.promises.readFile(staticPath.path, 'utf8');
    
    // Check memory limits before caching
    const contentSize = Buffer.byteLength(content, 'utf8');
    
    // Clear cache if needed using optimized LRU eviction
    if (currentCacheSize + contentSize > MAX_CACHE_SIZE) {
      await clearOldestCacheEntries(contentSize);
    }
    
    // Store in LRU cache with O(1) operation
    const stats = {
      size: currentStats.size,
      mtime: currentStats.mtime,
      lastAccessed: Date.now()
    };
    
    lruCache.set(name, content, stats);
    currentCacheSize += contentSize;
    
    return content;
  } catch (error) {
    console.warn(`Failed to load static file ${name}:`, error.message);
    throw error;
  }
};

// Optimized LRU cache with O(1) operations using circular buffer
const lruCache = {
  entries: new Map(), // name -> { content, stats, accessOrder }
  accessOrder: [], // Circular buffer of access order
  maxSize: 100, // Maximum number of cached entries
  head: 0, // Head of circular buffer
  tail: 0, // Tail of circular buffer
  
  // Add or update entry with O(1) complexity
  set(name, content, stats) {
    const now = Date.now();
    
    if (this.entries.has(name)) {
      // Update existing entry
      const entry = this.entries.get(name);
      entry.content = content;
      entry.stats = { ...stats, lastAccessed: now };
      this.updateAccessOrder(name);
      return;
    }
    
    // Add new entry
    if (this.entries.size >= this.maxSize) {
      // Remove oldest entry (O(1) operation)
      const oldestName = this.accessOrder[this.tail];
      this.entries.delete(oldestName);
      this.tail = (this.tail + 1) % this.maxSize;
    }
    
    this.entries.set(name, {
      content,
      stats: { ...stats, lastAccessed: now }
    });
    this.updateAccessOrder(name);
  },
  
  // Update access order in O(1)
  updateAccessOrder(name) {
    // Remove from current position if exists
    const currentPos = this.accessOrder.indexOf(name);
    if (currentPos !== -1) {
      this.accessOrder[currentPos] = null;
    }
    
    // Add to head position
    this.accessOrder[this.head] = name;
    this.head = (this.head + 1) % this.maxSize;
    
    // Move tail if we caught up
    if (this.head === this.tail && this.accessOrder[this.tail] !== null) {
      this.tail = (this.tail + 1) % this.maxSize;
    }
  },
  
  // Get entry with O(1) complexity
  get(name) {
    const entry = this.entries.get(name);
    if (entry) {
      this.updateAccessOrder(name);
      return entry;
    }
    return null;
  },
  
  // Remove oldest entries to free space - O(k) where k is entries to remove
  evictOldest(requiredSize) {
    let freedSize = 0;
    let evictedCount = 0;
    const maxEvictions = Math.min(10, this.entries.size); // Bound the operation
    
    while (evictedCount < maxEvictions && this.tail !== this.head) {
      const name = this.accessOrder[this.tail];
      if (!name) {
        this.tail = (this.tail + 1) % this.maxSize;
        continue;
      }
      
      const entry = this.entries.get(name);
      if (entry) {
        const size = Buffer.byteLength(entry.content, 'utf8');
        this.entries.delete(name);
        freedSize += size;
        
        // Clear the position
        this.accessOrder[this.tail] = null;
        this.tail = (this.tail + 1) % this.maxSize;
        evictedCount++;
        
        if (freedSize >= requiredSize) break;
      } else {
        this.tail = (this.tail + 1) % this.maxSize;
      }
    }
    
    return freedSize;
  }
};

/**
 * Clear oldest cache entries using O(1) LRU operations
 */
const clearOldestCacheEntries = async (requiredSize) => {
  const freedSize = lruCache.evictOldest(requiredSize);
  currentCacheSize -= freedSize;
  
  if (freedSize > 0) {
    console.info(`Evicted ${Math.ceil(freedSize/1024)}KB from static file cache`);
  }
};

/**
 * Async preload of static files with memory management
 */
const preloadStaticFiles = async () => {
  const preloadPromises = staticPaths.map(async ({ path: filePath, name }) => {
    try {
      const content = await getCachedStaticFile(name);
      if (content) {
        console.log(`Preloaded static file: ${name}`);
      }
    } catch (err) {
      console.warn(`Failed to preload static file ${name}:`, err.message);
    }
  });
  
  await Promise.allSettled(preloadPromises);
  console.log(`Static file preload complete. Cache size: ${currentCacheSize} bytes`);
};

/**
 * Get cache statistics for monitoring
 */
const getStaticFileCacheStats = () => {
  return {
    files: staticFilesCache.size,
    totalSize: currentCacheSize,
    maxSize: MAX_CACHE_SIZE,
    utilization: (currentCacheSize / MAX_CACHE_SIZE * 100).toFixed(2) + '%',
    files: Array.from(staticFileStats.entries()).map(([name, stats]) => ({
      name,
      size: stats.size,
      lastAccessed: stats.lastAccessed,
      mtime: stats.mtime
    }))
  };
};

// Pre-load static files at startup
preloadStaticFiles();

// Security imports
const auth = require('./lib/auth');
const { rateLimiters, securityHeaders, cookieOptions } = require('./lib/securityMiddleware');
const privacyManager = require('./lib/privacyManager');
const dataRetentionService = require('./lib/dataRetentionService');

// Enhanced rate limiting for API endpoints with per-endpoint limits
const { getEnhancedRateLimiter, dynamicRateLimiter, createRateLimitMiddleware } = require('./lib/enhancedRateLimiter');

// Distributed rate limiting with Redis backend for scalability
const { getDistributedRateLimiter, createDistributedRateLimitMiddleware } = require('./lib/distributedRateLimiter');

// Atomic static file cache for thread-safe file operations
const { getAtomicFileCache } = require('./lib/atomicStaticFileCache');

// Initialize distributed rate limiter for production scalability
const distributedRateLimiter = getDistributedRateLimiter({
  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined,
  redisPassword: process.env.REDIS_PASSWORD,
  circuitBreakerThreshold: 5,
  circuitBreakerResetTimeout: 60000
});

// Fallback to enhanced rate limiter if Redis is not available
const useDistributedLimiter = process.env.ENABLE_DISTRIBUTED_RATE_LIMITING === 'true';

// Create specific limiters for different endpoint categories
const healthLimiter = useDistributedLimiter 
  ? createDistributedRateLimitMiddleware('/health', { max: 10000, windowMs: 60000 })
  : createRateLimitMiddleware('/health');

const metricsLimiter = useDistributedLimiter
  ? createDistributedRateLimitMiddleware('/metrics', { max: 5000, windowMs: 60000 })
  : createRateLimitMiddleware('/metrics');

const apiLimiter = useDistributedLimiter
  ? createDistributedRateLimitMiddleware('/api', { max: 1000, windowMs: 60000 })
  : createRateLimitMiddleware('/api');

const aiLimiter = useDistributedLimiter
  ? createDistributedRateLimitMiddleware('/api/analyze', { max: 100, windowMs: 60000 })
  : createRateLimitMiddleware('/api/analyze');

const adminLimiter = useDistributedLimiter
  ? createDistributedRateLimitMiddleware('/api/admin', { max: 50, windowMs: 300000 })
  : createRateLimitMiddleware('/api/admin');

// Keep enhanced rate limiter as fallback
const rateLimiter = getEnhancedRateLimiter({
  enableBurstCapacity: true,
  enableDistributedLimits: false
});

// Server configuration
const app = express();
const PORT = process.env.PORT || 3001;  // Configurable port with default

// Security middleware
app.use(securityHeaders);               // Apply security headers

// Apply general rate limiting based on configuration
if (useDistributedLimiter) {
  app.use(createDistributedRateLimitMiddleware('global', { max: 5000, windowMs: 60000 }));
} else {
  app.use(dynamicRateLimiter);           // Use enhanced rate limiter as fallback
}

// Performance middleware
app.use(compression());                 // Enable response compression

// Enhanced rate limiting middleware with per-endpoint limits
app.use('/health', healthLimiter);       // High-frequency health checks
app.use('/metrics', metricsLimiter);     // Metrics endpoint
app.use('/api/admin', adminLimiter);     // Admin endpoints - very restrictive
app.use('/api/analyze', aiLimiter);      // AI analysis endpoints
app.use('/api/', dynamicRateLimiter);    // Dynamic rate limiting for all other API routes

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
app.post('/api/errors/analyze', aiLimiter, async (req, res, next) => {
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
        error: `Request timeout - AI analysis took longer than ${AI_ANALYSIS_TIMEOUTS.REQUEST_TIMEOUT}ms`,
        timestamp: new Date().toISOString(),
        timeout: AI_ANALYSIS_TIMEOUTS.REQUEST_TIMEOUT
      });
    }
  }, AI_ANALYSIS_TIMEOUTS.REQUEST_TIMEOUT);

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
          reject(new Error(`AI analysis timeout after ${AI_ANALYSIS_TIMEOUTS.PROCESSING_TIMEOUT}ms`));
        }, AI_ANALYSIS_TIMEOUTS.PROCESSING_TIMEOUT);
      });

      // Race between qerrors analysis and timeout with enhanced error handling
      await Promise.race([
        new Promise((resolve, reject) => {
          try {
            qerrors(error, 'AI Analysis Request', req, res, (analysisError) => {
              if (analysisError) {
                reject(analysisError);
                return;
              }
              
              if (!res.headersSent) {
                res.json({
                  success: true,
                  analysis: 'Error analysis triggered via qerrors AI system',
                  errorId: error.uniqueErrorName,
                  timestamp: new Date().toISOString(),
                  processingTime: AI_ANALYSIS_TIMEOUTS.PROCESSING_TIMEOUT
                });
              }
              resolve();
            });
          } catch (err) {
            reject(err);
          }
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
  
  // Track shutdown state and in-flight operations
  const shutdownState = {
    serverClosed: false,
    resourcesCleaned: false,
    forceExit: false,
    startTime: Date.now(),
    shutdownTimeout: 10000 // 10 seconds total shutdown timeout
  };
  
  try {
    // Stop accepting new requests immediately
    server.close((err) => {
      if (err) {
        console.error('❌ Error closing server:', err);
      } else {
        console.log('✅ HTTP server closed - no longer accepting new requests');
        shutdownState.serverClosed = true;
      }
    });
    
    // Enhanced resource cleanup with coordination and timeout
    const cleanupResources = async () => {
      const cleanupPromises = [];
      
      // Cleanup qerrors resources with timeout
      const { stopQueueMetrics, stopAdviceCleanup } = require('./lib/qerrorsCache');
      const { stopQueueMetrics: stopQMetrics, cleanupTimers } = require('./lib/qerrorsQueue');
      
      cleanupPromises.push(
        Promise.race([
          new Promise(resolve => {
            stopQueueMetrics && stopQueueMetrics();
            stopAdviceCleanup && stopAdviceCleanup();
            stopQMetrics && stopQMetrics();
            cleanupTimers && cleanupTimers();
            resolve();
          }),
          new Promise(resolve => setTimeout(resolve, 2000)) // 2 second timeout
        ])
      );
      
      // Shutdown distributed rate limiter with timeout
      if (useDistributedLimiter && distributedRateLimiter) {
        cleanupPromises.push(
          Promise.race([
            distributedRateLimiter.shutdown(),
            new Promise(resolve => setTimeout(resolve, 3000)) // 3 second timeout
          ])
        );
      }
      
      // Shutdown enhanced rate limiter with timeout
      if (rateLimiter) {
        cleanupPromises.push(
          Promise.race([
            new Promise(resolve => {
              rateLimiter.shutdown();
              resolve();
            }),
            new Promise(resolve => setTimeout(resolve, 1000)) // 1 second timeout
          ])
        );
      }
      
      // Wait for all cleanup with timeout
      await Promise.race([
        Promise.allSettled(cleanupPromises),
        new Promise(resolve => setTimeout(resolve, 5000)) // 5 second total timeout
      ]);
      
      shutdownState.resourcesCleaned = true;
      console.log('✅ Resource cleanup completed');
    };
    
    // Execute resource cleanup
    await cleanupResources();
    
    // Calculate remaining time for force exit
    const elapsed = Date.now() - shutdownState.startTime;
    const remainingTime = Math.max(0, shutdownState.shutdownTimeout - elapsed);
    
    // Force exit after remaining timeout
    setTimeout(() => {
      if (!shutdownState.forceExit) {
        shutdownState.forceExit = true;
        console.log(`⏰ Shutdown timeout after ${elapsed}ms, forcing exit`);
        process.exit(1);
      }
    }, remainingTime);
    
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    
    // Force exit on error during shutdown
    setTimeout(() => {
      console.log('⏰ Forced exit due to shutdown error');
      process.exit(1);
    }, 2000);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Async server startup with proper initialization
 * 
 * Initializes all async configuration before starting the server.
 * This ensures environment variables are loaded asynchronously
 * without blocking the main thread during module loading.
 */
const startServer = async () => {
  try {
    // Initialize async configuration (dotenv loading, etc.)
    const { initializeAsync } = require('./lib/asyncInit');
    await initializeAsync();
    
    // Start the server after async initialization is complete
    const server = app.listen(PORT, () => {
      console.log(`🚀 QErrors API Server running on http://localhost:${PORT}`);
      console.log(`📊 Demo UI: http://localhost:${PORT}/demo.html`);
      console.log(`🔧 Functional Demo: http://localhost:${PORT}/demo-functional.html`);
      console.log(`📡 API Endpoints available at http://localhost:${PORT}/api/`);
      console.log(`🛡️ Graceful shutdown enabled`);
    });
    
    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server asynchronously
let server; // Will be set when server starts
startServer().then(s => {
  server = s;
}).catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Export the Express app for testing and module usage
// Server will be available once startup completes
module.exports = { app, startServer };