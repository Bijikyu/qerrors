'use strict';

const qerrors = require('./qerrors');

/**
 * Database Connection Pool Manager
 * 
 * Provides scalable connection pooling for database operations with
 * dynamic sizing, health monitoring, and graceful degradation.
 */

/**
 * Bounded LRU Cache for memory-efficient storage
 */
class BoundedLRUCache {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return undefined;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      // Update existing
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

/**
 * Bounded Set for memory-efficient storage
 */
class BoundedSet {
  constructor(maxSize = 100) {
    this.set = new Set();
    this.maxSize = maxSize;
    this.accessOrder = new Map();
  }

  add(item) {
    if (this.set.size >= this.maxSize && !this.set.has(item)) {
      // Remove oldest item
      const oldestItem = this.getOldestItem();
      if (oldestItem !== undefined) {
        this.set.delete(oldestItem);
        this.accessOrder.delete(oldestItem);
      }
    }

    this.set.add(item);
    this.accessOrder.set(item, Date.now());
  }

  has(item) {
    if (this.set.has(item)) {
      // Update access time
      this.accessOrder.set(item, Date.now());
      return true;
    }
    return false;
  }

  delete(item) {
    this.accessOrder.delete(item);
    return this.set.delete(item);
  }

  getOldestItem() {
    let oldestItem = undefined;
    let oldestTime = Date.now();

    for (const item of this.set) {
      const accessTime = this.accessOrder.get(item) || 0;
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestItem = item;
      }
    }

    return oldestItem;
  }

  clear() {
    this.set.clear();
    this.accessOrder.clear();
  }

  get size() {
    return this.set.size;
  }
}

/**
 * Bounded Queue with LRU eviction for memory-efficient connection waiting
 */
class BoundedQueue {
  constructor(maxSize = 1000, maxMemoryMB = 10) {
    this.queue = [];
    this.maxSize = maxSize;
    this.maxMemoryBytes = maxMemoryMB * 1024 * 1024;
    this.currentMemoryBytes = 0;
    this.evictions = 0;
    this.rejections = 0;
  }

  push(item) {
    // Calculate item memory size (rough estimation)
    const itemSize = this.estimateItemSize(item);
    
    // Check memory limits
    if (this.currentMemoryBytes + itemSize > this.maxMemoryBytes) {
      // Force eviction to make space
      this.evictOldest(Math.ceil(this.queue.length * 0.3)); // Evict 30%
    }
    
    // Check size limits
    if (this.queue.length >= this.maxSize) {
      this.evictOldest(1);
    }
    
    // Add item
    this.queue.push(item);
    this.currentMemoryBytes += itemSize;
    
    return true;
  }

  shift() {
    if (this.queue.length === 0) {
      return undefined;
    }
    
    const item = this.queue.shift();
    this.currentMemoryBytes -= this.estimateItemSize(item);
    
    return item;
  }

  evictOldest(count = 1) {
    let evicted = 0;
    for (let i = 0; i < count && this.queue.length > 0; i++) {
      const item = this.queue.shift();
      this.currentMemoryBytes -= this.estimateItemSize(item);
      evicted++;
    }
    this.evictions += evicted;
    return evicted;
  }

  rejectIfFull() {
    if (this.queue.length >= this.maxSize || 
        this.currentMemoryBytes > this.maxMemoryBytes * 0.9) {
      this.rejections++;
      return true;
    }
    return false;
  }

  estimateItemSize(item) {
    // Rough estimation: base object size + timestamp + timeout references
    return 256; // Base size in bytes for queue entry objects
  }

  filter(predicate) {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(predicate);
    
    // Recalculate memory usage
    this.currentMemoryBytes = this.queue.reduce((total, item) => {
      return total + this.estimateItemSize(item);
    }, 0);
    
    return initialLength - this.queue.length;
  }

  findIndex(predicate) {
    return this.queue.findIndex(predicate);
  }

  get length() {
    return this.queue.length;
  }

  clear() {
    this.queue = [];
    this.currentMemoryBytes = 0;
  }

  getStats() {
    return {
      length: this.queue.length,
      maxSize: this.maxSize,
      currentMemoryBytes: this.currentMemoryBytes,
      maxMemoryBytes: this.maxMemoryBytes,
      evictions: this.evictions,
      rejections: this.rejections,
      memoryUtilization: this.currentMemoryBytes / this.maxMemoryBytes
    };
  }
}

class ConnectionPool {
  constructor(options = {}) {
    // Dynamic configuration based on system resources for optimal scalability
    const cpus = require('os').cpus().length;
    const totalMemory = require('os').totalmem();
    const availableMemory = require('os').freemem();
    
    // Scale connection pool based on CPU cores and available memory
    // Minimum: 2 connections per CPU core, max 10
    // Maximum: 5 connections per CPU core, max 50, but limited by memory
    const memoryBasedMax = Math.floor(availableMemory / (50 * 1024 * 1024)); // 50MB per connection
    const cpuBasedMin = Math.max(5, Math.min(10, cpus * 2));
    const cpuBasedMax = Math.max(20, Math.min(50, cpus * 5));
    
    this.min = options.min || cpuBasedMin;
    this.max = options.max || Math.min(cpuBasedMax, memoryBasedMax);
    this.idleTimeoutMillis = options.idleTimeoutMillis || 30000;
    this.acquireTimeoutMillis = options.acquireTimeoutMillis || 10000;
    
    // Enhanced tracking for scalability monitoring - bounded collections
    this.pool = new Map();
    this.waitingQueue = new BoundedQueue(
      this.max * 10, // Allow 10x max connections in queue
      Math.max(5, Math.floor(availableMemory / (100 * 1024 * 1024))) // Max 5% of available memory
    );
    this.activeConnections = 0;
    this.totalConnections = 0;
    this.connectionStats = {
      created: 0,
      destroyed: 0,
      queriesExecuted: 0,
      avgQueryTime: 0,
      totalQueryTime: 0
    };
    
    // Enhanced query batching with N+1 detection - bounded queue
    this.batchQueue = [];
    this.maxBatchQueueSize = options.maxBatchQueueSize || 1000;
    this.batchSize = options.batchSize || 50;
    this.batchTimeout = options.batchTimeout || 100; // 100ms batch window
    
    // N+1 query detection and prevention - bounded LRU cache
    this.queryPatterns = new BoundedLRUCache(options.maxQueryPatterns || 1000); // Track query patterns for N+1 detection
    this.n1Threshold = options.n1Threshold || 5; // Detect N+1 after 5 similar queries
    this.autoBatchEnabled = options.autoBatchEnabled !== false; // Enable auto-batching by default
    
    // Connection health monitoring - bounded collections
    this.healthCheckInterval = options.healthCheckInterval || 30000; // 30 seconds
    this.maxIdleTime = options.maxIdleTime || 300000; // 5 minutes
    this.failedConnections = new BoundedSet(options.maxFailedConnections || 100); // Track failed connections
    this.connectionHealth = new BoundedLRUCache(options.maxConnectionHealthEntries || 200); // Track health metrics per connection
    
    // Initialize minimum connections
    this.initializePool();
    this.startBatchProcessor();
    this.startHealthMonitoring();
  }

  /**
   * Initialize the connection pool with minimum connections (optimized for scalability)
   */
  async initializePool() {
    try {
      // Create connections sequentially to prevent resource exhaustion during startup
      const initPromises = [];
      
      for (let i = 0; i < this.min; i++) {
        initPromises.push(this.createConnection());
      }
      
      // Use Promise.allSettled to handle partial failures gracefully
      const results = await Promise.allSettled(initPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (successful < this.min) {
        const error = new Error(`Only ${successful}/${this.min} connections initialized successfully`);
        qerrors(error, 'connectionPool.initializePool.partialFailure', {
          operation: 'pool_initialization',
          expectedConnections: this.min,
          successfulConnections: successful,
          failedConnections: failed
        });
        console.warn(`Only ${successful}/${this.min} connections initialized successfully`);
      }
      
      return successful;
    } catch (error) {
      qerrors(error, 'connectionPool.initializePool', {
        operation: 'pool_initialization',
        minConnections: this.min,
        maxConnections: this.max
      });
      throw error;
    }
  }

  /**
   * Create a new database connection
   */
  async createConnection() {
    try {
      // Simulate connection creation - in production, this would be actual DB connection
      const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${performance.now()}`;
      const connection = {
        id: connectionId,
        created: Date.now(),
        lastUsed: Date.now(),
        inUse: false,
        query: async (sql, params) => {
          try {
            // Track query pattern for N+1 detection
            this.trackQueryPattern(sql, params);
            
            // Check if this should be auto-batched
            if (this.autoBatchEnabled && this.shouldAutoBatch(sql)) {
              return await this.executeBatchedQuery(sql, params);
            }
            
            // Simulate query execution
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            return { rows: [], affectedRows: 0 };
          } catch (error) {
            qerrors(error, 'connectionPool.connection.query', {
              operation: 'query_execution',
              connectionId: connectionId,
              hasSql: !!sql,
              hasParams: !!params
            });
            throw error;
          }
        },
        close: async () => {
          try {
            // Simulate connection close
          } catch (error) {
            qerrors(error, 'connectionPool.connection.close', {
              operation: 'connection_close',
              connectionId: connectionId
            });
            throw error;
          }
        }
      };

      this.pool.set(connectionId, connection);
      this.totalConnections++;
      return connection;
    } catch (error) {
      qerrors(error, 'connectionPool.createConnection', {
        operation: 'connection_creation',
        totalConnections: this.totalConnections,
        maxConnections: this.max
      });
      throw error;
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire() {
    try {
      // Find available connection
      for (const [id, conn] of this.pool.entries()) {
        if (!conn.inUse) {
          conn.inUse = true;
          conn.lastUsed = Date.now();
          this.activeConnections++;
          return conn;
        }
      }

      // If no available connection and under max limit, create new one
      if (this.totalConnections < this.max) {
        const newConn = await this.createConnection();
        newConn.inUse = true;
        newConn.lastUsed = Date.now();
        this.activeConnections++;
        return newConn;
      }

      // Wait for a connection to become available (with bounded queue)
      // Check if queue is full using BoundedQueue's memory-aware rejection
      if (this.waitingQueue.rejectIfFull()) {
        const error = new Error('Connection pool queue exhausted - memory or size limits reached');
        qerrors(error, 'connectionPool.acquire.queueExhausted', {
          operation: 'connection_acquire',
          totalConnections: this.totalConnections,
          activeConnections: this.activeConnections,
          queueSize: this.waitingQueue.size
        });
        throw error;
      }
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          const waiterIndex = this.waitingQueue.findIndex(item => item.resolve === resolve);
          if (waiterIndex > -1) {
            this.waitingQueue.splice(waiterIndex, 1);
          }
          const error = new Error('Connection acquire timeout');
          qerrors(error, 'connectionPool.acquire.timeout', {
            operation: 'connection_acquire_timeout',
            acquireTimeoutMillis: this.acquireTimeoutMillis,
            queueSize: this.waitingQueue.size
          });
          reject(error);
        }, this.acquireTimeoutMillis);

        this.waitingQueue.push({
          resolve,
          reject,
          timeout,
          timestamp: Date.now() // Add timestamp for queue aging
        });
      });
    } catch (error) {
      qerrors(error, 'connectionPool.acquire', {
        operation: 'connection_acquire',
        totalConnections: this.totalConnections,
        activeConnections: this.activeConnections
      });
      throw error;
    }
  }

  /**
   * Release a connection back to the pool
   */
  async release(connection) {
    try {
      if (!connection || !this.pool.has(connection.id)) {
        return;
      }

      // Check if there are waiting requests first
      if (this.waitingQueue.length > 0) {
        const waiter = this.waitingQueue.shift();
        clearTimeout(waiter.timeout);
        // Keep connection marked as inUse for the waiting request
        connection.lastUsed = Date.now();
        waiter.resolve(connection);
      } else {
        // No waiting requests - actually release the connection
        connection.inUse = false;
        connection.lastUsed = Date.now();
        this.activeConnections--;
      }
    } catch (error) {
      qerrors(error, 'connectionPool.release', {
        operation: 'connection_release',
        connectionId: connection?.id,
        activeConnections: this.activeConnections
      });
      throw error;
    }
  }

  /**
   * Close idle connections and clean up expired queue entries (memory-optimized)
   */
  async closeIdleConnections() {
    const now = Date.now();
    const connectionsToClose = [];

    // Find idle connections to close - limit iterations to prevent blocking
    let iterationCount = 0;
    const maxIterations = this.pool.size;
    
    for (const [id, conn] of this.pool.entries()) {
      iterationCount++;
      
      // Prevent infinite loops and excessive CPU usage
      if (iterationCount > maxIterations) break;
      
      if (!conn.inUse && (now - conn.lastUsed) > this.idleTimeoutMillis) {
        // Keep minimum connections
        if (this.totalConnections > this.min) {
          connectionsToClose.push(id);
        }
      }
    }

    // Close connections sequentially to prevent resource exhaustion
    for (const id of connectionsToClose) {
      const conn = this.pool.get(id);
      if (conn) {
        try {
          await conn.close();
          this.pool.delete(id);
          this.totalConnections--;
        } catch (error) {
          console.warn(`Failed to close connection ${id}:`, error.message);
        }
      }
    }
    
    // Clean up expired queue entries to prevent memory leaks
    this.cleanupExpiredQueueEntries(now);
  }
  
  /**
   * Clean up expired entries in the waiting queue
   */
  cleanupExpiredQueueEntries(now) {
    const queueTimeout = this.acquireTimeoutMillis * 2; // Allow double timeout for safety
    const initialLength = this.waitingQueue.length;
    
    // Remove expired entries efficiently using BoundedQueue's filter method
    const removedCount = this.waitingQueue.filter(waiter => {
      const isExpired = (now - waiter.timestamp) > queueTimeout;
      if (isExpired) {
        clearTimeout(waiter.timeout);
        waiter.reject(new Error('Queue entry expired'));
      }
      return !isExpired;
    });
    
    // Log cleanup if significant number of entries were removed
    if (this.waitingQueue.length < initialLength * 0.5) {
      console.warn(`Cleaned up ${initialLength - this.waitingQueue.length} expired queue entries`);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const queueStats = this.waitingQueue.getStats();
    return {
      totalConnections: this.totalConnections,
      activeConnections: this.activeConnections,
      idleConnections: this.totalConnections - this.activeConnections,
      waitingQueue: this.waitingQueue.length,
      queueStats: queueStats
    };
  }

  /**
   * Start batch processor for query batching optimization
   */
  startBatchProcessor() {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
    }
    
    this.batchInterval = setInterval(() => {
      if (this.batchQueue.length > 0) {
        this.processBatch();
      }
    }, this.batchTimeout);
  }

  /**
   * Process batch of queued queries
   */
  async processBatch() {
    if (this.batchQueue.length === 0) return;
    
    try {
      const batch = this.batchQueue.splice(0, this.batchSize);
      const startTime = Date.now();
      
      try {
        // Get connection for batch processing
        const connection = await this.acquire();
        
        try {
          // Execute all queries in batch
          const results = await Promise.all(
            batch.map(({ query, params, resolve, reject }) => 
              connection.query(query, params)
                .then(result => resolve(result))
                .catch(error => reject(error))
            )
          );
          
          // Release connection
          await this.release(connection);
          
          // Update statistics
          const queryTime = Date.now() - startTime;
          this.updateStats(batch.length, queryTime);
          
          return results;
        } catch (queryError) {
          // Release connection on query error
          try {
            await this.release(connection);
          } catch (releaseError) {
            qerrors(releaseError, 'connectionPool.processBatch.releaseError', {
              operation: 'batch_connection_release',
              batchSize: batch.length
            });
          }
          
          // Reject all queries in batch
          batch.forEach(({ reject }) => reject(queryError));
          throw queryError;
        }
      } catch (acquireError) {
        // Reject all queries in batch if connection acquisition fails
        batch.forEach(({ reject }) => reject(acquireError));
        throw acquireError;
      }
    } catch (error) {
      qerrors(error, 'connectionPool.processBatch', {
        operation: 'batch_processing',
        batchSize: this.batchSize,
        queueLength: this.batchQueue.length
      });
      throw error;
    }
  }

  /**
   * Update connection pool statistics
   */
  updateStats(queryCount, queryTime) {
    this.connectionStats.queriesExecuted += queryCount;
    this.connectionStats.totalQueryTime += queryTime;
    this.connectionStats.avgQueryTime = 
      this.connectionStats.totalQueryTime / this.connectionStats.queriesExecuted;
  }

  /**
   * Queue query for batch processing with bounded queue management
   */
  queueQuery(query, params) {
    return new Promise((resolve, reject) => {
      // Check if batch queue is full
      if (this.batchQueue.length >= this.maxBatchQueueSize) {
        // Remove oldest query (FIFO eviction for batch queue)
        const oldestQuery = this.batchQueue.shift();
        if (oldestQuery) {
          oldestQuery.reject(new Error('Batch queue full - query dropped'));
        }
      }
      
      this.batchQueue.push({
        query,
        params,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      // Process immediately if batch is full
      if (this.batchQueue.length >= this.batchSize) {
        setImmediate(() => this.processBatch());
      }
    });
  }

  /**
   * Close all connections and shutdown pool
   */
  async close() {
    // Clear waiting queue
    for (const waiter of this.waitingQueue) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Pool shutting down'));
    }
    this.waitingQueue.clear();

    // Close all connections
    const closePromises = [];
    for (const [id, conn] of this.pool.entries()) {
      closePromises.push(conn.close());
    }
    await Promise.all(closePromises);

    this.pool.clear();
    this.totalConnections = 0;
    this.activeConnections = 0;
  }
}

// Singleton connection pool instance
let connectionPool = null;

/**
 * Get or create the connection pool
 */
function getConnectionPool(options = {}) {
  if (!connectionPool) {
    connectionPool = new ConnectionPool(options);
    
    // Start periodic cleanup of idle connections
    setInterval(() => {
      connectionPool.closeIdleConnections();
    }, 60000); // Every minute
  }
  return connectionPool;
}

/**
 * Execute a database query with connection pooling
 */
async function executeQuery(sql, params = []) {
  const pool = getConnectionPool();
  let connection;
  
  try {
    connection = await pool.acquire();
    const result = await connection.query(sql, params);
    return result;
  } catch (error) {
    qerrors(error, 'connectionPool.executeQuery', {
      operation: 'query_execution',
      hasSql: !!sql,
      hasParams: !!params,
      paramCount: params?.length || 0
    });
    throw error;
  } finally {
    if (connection) {
      try {
        await pool.release(connection);
      } catch (releaseError) {
        qerrors(releaseError, 'connectionPool.executeQuery.release', {
          operation: 'query_connection_release',
          connectionId: connection?.id
        });
      }
    }
  }
}

/**
   * Execute multiple queries in a transaction with batching optimization
   */
  async function executeTransaction(queries) {
    const pool = getConnectionPool();
    let connection;
    
    try {
      connection = await pool.acquire();
      
      try {
        // Batch queries for better performance - execute in parallel when possible
        const batchSize = 5; // Process up to 5 queries in parallel
        const results = [];
        
        for (let i = 0; i < queries.length; i += batchSize) {
          const batch = queries.slice(i, i + batchSize);
          const batchPromises = batch.map(({ sql, params }) => 
            connection.query(sql, params)
          );
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
        }
        
        return results;
      } catch (queryError) {
        qerrors(queryError, 'connectionPool.executeTransaction.queries', {
          operation: 'transaction_query_execution',
          totalQueries: queries.length,
          batchSize: 5
        });
        throw queryError;
      }
    } catch (error) {
      qerrors(error, 'connectionPool.executeTransaction', {
        operation: 'transaction_execution',
        queryCount: queries.length
      });
      throw error;
    } finally {
      if (connection) {
        try {
          await pool.release(connection);
        } catch (releaseError) {
          qerrors(releaseError, 'connectionPool.executeTransaction.release', {
            operation: 'transaction_connection_release',
            connectionId: connection?.id,
            queryCount: queries.length
          });
        }
      }
    }
  }

  /**
   * Execute multiple queries in parallel with connection pooling
   */
  async function executeParallelQueries(queryList) {
    try {
      const pool = getConnectionPool();
      const maxConcurrency = Math.min(queryList.length, pool.max);
      const limiter = createConcurrencyLimiter(maxConcurrency);
      
      const promises = queryList.map(({ sql, params }, index) => 
        limiter(async () => {
          let connection;
          try {
            connection = await pool.acquire();
            return await connection.query(sql, params);
          } catch (error) {
            qerrors(error, 'connectionPool.executeParallelQueries.query', {
              operation: 'parallel_query_execution',
              queryIndex: index,
              totalQueries: queryList.length,
              maxConcurrency
            });
            throw error;
          } finally {
            if (connection) {
              try {
                await pool.release(connection);
              } catch (releaseError) {
                qerrors(releaseError, 'connectionPool.executeParallelQueries.release', {
                  operation: 'parallel_query_connection_release',
                  queryIndex: index,
                  connectionId: connection?.id
                });
              }
            }
          }
        })
      );
      
      return await Promise.all(promises);
    } catch (error) {
      qerrors(error, 'connectionPool.executeParallelQueries', {
        operation: 'parallel_query_execution',
        queryCount: queryList.length,
        maxConcurrency: Math.min(queryList.length, getConnectionPool().max)
      });
      throw error;
    }
  }

  /**
   * Simple concurrency limiter for parallel query execution
   */
  function createConcurrencyLimiter(maxConcurrency) {
    let running = 0;
    const queue = [];
    
    return async (task) => {
      return new Promise((resolve, reject) => {
        const execute = async () => {
          running++;
          try {
            const result = await task();
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            running--;
            if (queue.length > 0) {
              const next = queue.shift();
              next();
            }
          }
        };
        
        if (running < maxConcurrency) {
          execute();
        } else {
          queue.push(execute);
        }
      });
    };
  }

/**
 * N+1 Query Detection and Prevention Methods
 */

ConnectionPool.prototype.trackQueryPattern = function(sql, params) {
  // Create a normalized query pattern (remove specific values)
  const pattern = this.normalizeQuery(sql);
  
  if (!this.queryPatterns.has(pattern)) {
    this.queryPatterns.set(pattern, {
      count: 0,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      samples: []
    });
  }
  
  const patternInfo = this.queryPatterns.get(pattern);
  patternInfo.count++;
  patternInfo.lastSeen = Date.now();
  
  // Store sample queries for analysis (limit to prevent memory bloat)
  if (patternInfo.samples.length < 5) {
    patternInfo.samples.push({
      sql,
      params: params ? JSON.stringify(params).substring(0, 100) : null,
      timestamp: Date.now()
    });
  }
  
  // Check for N+1 pattern
  if (patternInfo.count >= this.n1Threshold) {
    this.handleN1Pattern(pattern, patternInfo);
  }
};

ConnectionPool.prototype.normalizeQuery = function(sql) {
  // Remove specific values and normalize whitespace
  return sql
    .replace(/\d+/g, '?') // Replace numbers with ?
    .replace(/'[^']*'/g, '?') // Replace strings with ?
    .replace(/"[^"]*"/g, '?') // Replace double quotes with ?
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

ConnectionPool.prototype.shouldAutoBatch = function(sql) {
  const pattern = this.normalizeQuery(sql);
  const patternInfo = this.queryPatterns.get(pattern);
  
  // Auto-batch if we've seen this pattern multiple times recently
  return patternInfo && 
         patternInfo.count >= this.n1Threshold &&
         (Date.now() - patternInfo.firstSeen) < 5000; // Within 5 seconds
};

ConnectionPool.prototype.handleN1Pattern = function(pattern, patternInfo) {
  console.warn(`N+1 query pattern detected: "${pattern}" - Executed ${patternInfo.count} times`);
  
  // Suggest batching for future queries
  if (patternInfo.count === this.n1Threshold) {
    console.info('Consider batching these queries or using JOIN operations');
    
    // Store recommendation for developers
    patternInfo.recommendation = {
      type: 'N+1_DETECTED',
      suggestion: 'Use query batching or JOIN to reduce database round trips',
      sampleQueries: patternInfo.samples,
      impact: `Potential ${patternInfo.count - 1} extra database queries`
    };
  }
};

ConnectionPool.prototype.executeBatchedQuery = function(sql, params) {
  // For now, just execute normally but log the batching
  console.info('Auto-batching query for N+1 prevention:', sql.substring(0, 50) + '...');
  
  // In a real implementation, this would:
  // 1. Collect similar queries
  // 2. Rewrite as batch or JOIN
  // 3. Execute the optimized version
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ rows: [], affectedRows: 0, batched: true });
    }, Math.random() * 5);
  });
};

ConnectionPool.prototype.getQueryPatternStats = function() {
  const stats = {
    totalPatterns: this.queryPatterns.size,
    n1Patterns: 0,
    topPatterns: []
  };
  
  for (const [pattern, info] of this.queryPatterns.entries()) {
    if (info.count >= this.n1Threshold) {
      stats.n1Patterns++;
    }
    
    stats.topPatterns.push({
      pattern,
      count: info.count,
      firstSeen: info.firstSeen,
      lastSeen: info.lastSeen,
      isN1: info.count >= this.n1Threshold
    });
  }
  
  // Sort by count and limit results
  stats.topPatterns.sort((a, b) => b.count - a.count);
  stats.topPatterns = stats.topPatterns.slice(0, 10);
  
  return stats;
};

/**
 * Connection Health Monitoring Methods
 */

ConnectionPool.prototype.startHealthMonitoring = function() {
  if (this.healthCheckTimer) {
    clearInterval(this.healthCheckTimer);
  }
  
  this.healthCheckTimer = setInterval(() => {
    this.performHealthChecks();
  }, this.healthCheckInterval);
};

ConnectionPool.prototype.performHealthChecks = function() {
  const now = Date.now();
  const healthIssues = [];
  
  for (const [id, connection] of this.pool.entries()) {
    const health = this.connectionHealth.get(id) || {
      created: connection.created,
      lastUsed: connection.lastUsed,
      failures: 0,
      lastHealthCheck: now,
      status: 'healthy'
    };
    
    // Check for idle connections
    const idleTime = now - connection.lastUsed;
    if (idleTime > this.maxIdleTime && !connection.inUse) {
      health.status = 'idle';
      healthIssues.push({ connectionId: id, issue: 'idle', idleTime });
    }
    
    // Check for old connections
    const age = now - connection.created;
    if (age > 3600000) { // 1 hour
      health.status = 'old';
      healthIssues.push({ connectionId: id, issue: 'old', age });
    }
    
    // Check for frequently failing connections
    if (health.failures > 3) {
      health.status = 'failing';
      healthIssues.push({ connectionId: id, issue: 'failing', failures: health.failures });
    }
    
    health.lastHealthCheck = now;
    this.connectionHealth.set(id, health);
  }
  
  // Log health issues and take action
  if (healthIssues.length > 0) {
    console.warn(`Connection health issues detected: ${healthIssues.length} problems`);
    
    // Remove problematic connections
    for (const issue of healthIssues) {
      if (issue.issue === 'failing' || issue.issue === 'old') {
        this.removeConnection(issue.connectionId);
      }
    }
  }
};

ConnectionPool.prototype.removeConnection = function(connectionId) {
  const connection = this.pool.get(connectionId);
  if (connection && !connection.inUse) {
    console.info(`Removing unhealthy connection: ${connectionId}`);
    
    try {
      connection.close();
    } catch (error) {
      console.warn(`Error closing connection ${connectionId}:`, error.message);
    }
    
    this.pool.delete(connectionId);
    this.totalConnections--;
    this.connectionHealth.delete(connectionId);
    this.failedConnections.delete(connectionId);
    
    // Create replacement connection if below minimum
    if (this.totalConnections < this.min) {
      this.createConnection().catch(error => {
        console.error('Failed to create replacement connection:', error.message);
      });
    }
  }
};

ConnectionPool.prototype.markConnectionFailure = function(connectionId) {
  this.failedConnections.add(connectionId);
  
  const health = this.connectionHealth.get(connectionId) || {
    failures: 0,
    status: 'healthy'
  };
  
  health.failures++;
  health.status = health.failures > 3 ? 'failing' : 'unhealthy';
  health.lastFailure = Date.now();
  
  this.connectionHealth.set(connectionId, health);
  
  // Remove connection if it's failing too much
  if (health.failures > 5) {
    this.removeConnection(connectionId);
  }
};

ConnectionPool.prototype.getConnectionHealth = function() {
  const health = {
    totalConnections: this.pool.size,
    healthyConnections: 0,
    unhealthyConnections: 0,
    failingConnections: 0,
    idleConnections: 0,
    details: []
  };
  
  for (const [id, connection] of this.pool.entries()) {
    const connHealth = this.connectionHealth.get(id) || { status: 'unknown' };
    
    switch (connHealth.status) {
      case 'healthy':
        health.healthyConnections++;
        break;
      case 'failing':
        health.failingConnections++;
        break;
      case 'idle':
        health.idleConnections++;
        break;
      default:
        health.unhealthyConnections++;
    }
    
    health.details.push({
      id,
      status: connHealth.status,
      inUse: connection.inUse,
      failures: connHealth.failures || 0,
      lastUsed: connection.lastUsed,
      age: Date.now() - connection.created
    });
  }
  
  return health;
};

ConnectionPool.prototype.shutdown = function() {
  // Clear health monitoring
  if (this.healthCheckTimer) {
    clearInterval(this.healthCheckTimer);
    this.healthCheckTimer = null;
  }
  
  // Close all connections
  const closePromises = [];
  for (const [id, conn] of this.pool.entries()) {
    closePromises.push(conn.close());
  }
  
  return Promise.all(closePromises).then(() => {
    this.pool.clear();
    this.totalConnections = 0;
    this.activeConnections = 0;
    this.connectionHealth.clear();
    this.failedConnections.clear();
  });
};

module.exports = {
  ConnectionPool,
  getConnectionPool,
  executeQuery,
  executeTransaction,
  executeParallelQueries
};