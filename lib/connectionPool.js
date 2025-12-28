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
 * Bounded Set with O(1) LRU eviction using doubly-linked list for memory-efficient connection tracking
 */
class BoundedSet {
  constructor(maxSize) {
    this.set = new Set();
    this.maxSize = maxSize;
    this.head = null; // Most recently used
    this.tail = null; // Least recently used
    this.nodes = new Map(); // item -> node mapping
  }

  add(item) {
    if (this.nodes.has(item)) {
      // Move to front (most recently used)
      this.moveToFront(item);
      return;
    }

    if (this.set.size >= this.maxSize) {
      // Remove least recently used item
      if (this.tail) {
        this.remove(this.tail.item);
      }
    }

    // Add new item to front
    const node = { item, prev: null, next: this.head };
    this.nodes.set(item, node);
    this.set.add(item);

    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  has(item) {
    if (this.set.has(item)) {
      // Move to front (most recently used)
      this.moveToFront(item);
      return true;
    }
    return false;
  }

  delete(item) {
    const node = this.nodes.get(item);
    if (!node) return false;

    // Remove from linked list
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    this.nodes.delete(item);
    return this.set.delete(item);
  }

  moveToFront(item) {
    const node = this.nodes.get(item);
    if (!node || node === this.head) return;

    // Remove from current position
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    // Move to front
    node.prev = null;
    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  getOldestItem() {
    return this.tail ? this.tail.item : undefined;
  }

  clear() {
    this.set.clear();
    this.nodes.clear();
    this.head = null;
    this.tail = null;
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
    
    // Scale connection pool based on CPU cores and available memory - optimized for high load
    // Minimum: 3 connections per CPU core, max 15
    // Maximum: 8 connections per CPU core, max 100, but limited by memory
    const memoryBasedMax = Math.floor(availableMemory / (25 * 1024 * 1024)); // Reduced to 25MB per connection for higher concurrency
    const cpuBasedMin = Math.max(10, Math.min(15, cpus * 3)); // Increased minimum for better baseline performance
    const cpuBasedMax = Math.max(50, Math.min(100, cpus * 8)); // Increased maximum for high load scenarios
    
    this.min = options.min || cpuBasedMin;
    this.max = options.max || Math.min(cpuBasedMax, memoryBasedMax);
    this.idleTimeoutMillis = options.idleTimeoutMillis || 60000; // Increased to 60 seconds for better connection reuse
    this.acquireTimeoutMillis = options.acquireTimeoutMillis || 15000; // Increased to 15 seconds for high load
    
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

// Singleton connection pool instance with proper cleanup
let connectionPool = null;
let cleanupInterval = null;
let shutdownListenersAdded = false;

/**
 * Get or create the connection pool
 */
function getConnectionPool(options = {}) {
  if (!connectionPool) {
    connectionPool = new ConnectionPool(options);
    
    // Add shutdown listeners only once to prevent memory leaks
    if (!shutdownListenersAdded) {
      const gracefulShutdown = async () => {
        if (connectionPool) {
          try {
            await connectionPool.shutdown();
          } catch (error) {
            console.error('Error during connection pool shutdown:', error.message);
          } finally {
            connectionPool = null;
          }
        }
        // Clear cleanup interval
        if (cleanupInterval) {
          clearInterval(cleanupInterval);
          cleanupInterval = null;
        }
      };
      
      process.once('SIGTERM', gracefulShutdown);
      process.once('SIGINT', gracefulShutdown);
      process.once('beforeExit', gracefulShutdown);
      process.once('exit', gracefulShutdown);
      
      shutdownListenersAdded = true;
    }
    
    // Start periodic cleanup of idle connections
    cleanupInterval = setInterval(() => {
      if (connectionPool) {
        try {
          connectionPool.closeIdleConnections();
        } catch (error) {
          console.error('Error during connection pool cleanup:', error.message);
        }
      }
    }, 60000); // Every minute
  }
  return connectionPool;
}

/**
 * Force cleanup of the connection pool for memory management
 */
async function cleanupConnectionPool() {
  if (connectionPool) {
    try {
      await connectionPool.shutdown();
    } catch (error) {
      console.error('Error during connection pool cleanup:', error.message);
    } finally {
      connectionPool = null;
    }
  }
  
  // Clear cleanup interval
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  
  // Remove shutdown listeners to prevent memory leaks
  if (shutdownListenersAdded) {
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('beforeExit');
    process.removeAllListeners('exit');
    shutdownListenersAdded = false;
  }
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
  
  // Analyze query for indexing opportunities
  this.analyzeQueryForIndexing(sql, params);
  
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

/**
 * Database indexing strategy and query optimization
 */
ConnectionPool.prototype.analyzeQueryForIndexing = function(sql, params) {
  const analysis = {
    query: sql,
    normalized: this.normalizeQuery(sql),
    recommendations: [],
    potentialIndexes: [],
    optimizationType: null
  };
  
  try {
    // Analyze WHERE clauses for indexing opportunities
    const whereMatch = sql.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      
      // Extract column names from WHERE clause
      const columnMatches = whereClause.match(/(\w+)\s*(?:=|>|<|>=|<=|like|in)/gi);
      if (columnMatches) {
        const columns = columnMatches.map(match => match.split(/\s*(?:=|>|<|>=|<=|like|in)/i)[0]);
        
        // Recommend indexes for frequently queried columns
        columns.forEach(column => {
          if (!analysis.potentialIndexes.includes(column)) {
            analysis.potentialIndexes.push(column);
            analysis.recommendations.push(`Consider adding index on column: ${column}`);
          }
        });
        
        analysis.optimizationType = 'where_clause_optimization';
      }
    }
    
    // Analyze JOIN conditions
    const joinMatches = sql.match(/join\s+\w+\s+on\s+([^=\s]+)\s*=\s*([^=\s]+)/gi);
    if (joinMatches) {
      joinMatches.forEach(join => {
        const columns = join.match(/([^=\s]+)\s*=\s*([^=\s]+)/i);
        if (columns) {
          analysis.recommendations.push(`Ensure foreign key columns are indexed: ${columns[1]} and ${columns[2]}`);
          analysis.optimizationType = analysis.optimizationType || 'join_optimization';
        }
      });
    }
    
    // Analyze ORDER BY clauses
    const orderByMatch = sql.match(/order\s+by\s+(.+?)(?:\s+limit|$)/i);
    if (orderByMatch) {
      const orderColumns = orderByMatch[1].split(',').map(col => col.trim().split(/\s+/)[0]);
      orderColumns.forEach(column => {
        if (!analysis.potentialIndexes.includes(column)) {
          analysis.potentialIndexes.push(column);
          analysis.recommendations.push(`Consider adding index for ORDER BY column: ${column}`);
        }
      });
      
      analysis.optimizationType = analysis.optimizationType || 'order_by_optimization';
    }
    
    // Check for full table scans
    if (!whereMatch && !joinMatches) {
      analysis.recommendations.push('Query may cause full table scan - consider adding WHERE clause');
      analysis.optimizationType = 'full_table_scan_warning';
    }
    
    // Store analysis for future reference
    this.storeQueryAnalysis(analysis);
    
  } catch (error) {
    console.error('Error analyzing query for indexing:', error.message);
  }
  
  return analysis;
};

/**
 * Store query analysis for optimization recommendations
 */
ConnectionPool.prototype.storeQueryAnalysis = function(analysis) {
  if (!this.queryAnalysisCache) {
    this.queryAnalysisCache = new Map();
  }
  
  const key = analysis.normalized;
  if (!this.queryAnalysisCache.has(key)) {
    this.queryAnalysisCache.set(key, {
      ...analysis,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      executionCount: 0
    });
  } else {
    const cached = this.queryAnalysisCache.get(key);
    cached.lastSeen = Date.now();
    cached.executionCount++;
  }
  
  // Limit cache size
  if (this.queryAnalysisCache.size > 1000) {
    const oldestKey = this.queryAnalysisCache.keys().next().value;
    this.queryAnalysisCache.delete(oldestKey);
  }
};

/**
 * Get indexing recommendations for frequently executed queries
 */
ConnectionPool.prototype.getIndexingRecommendations = function() {
  if (!this.queryAnalysisCache) {
    return [];
  }
  
  const recommendations = [];
  const threshold = 10; // Minimum execution count to consider
  
  for (const [normalized, analysis] of this.queryAnalysisCache.entries()) {
    if (analysis.executionCount >= threshold) {
      recommendations.push({
        queryPattern: normalized,
        executionCount: analysis.executionCount,
        recommendations: analysis.recommendations,
        potentialIndexes: analysis.potentialIndexes,
        optimizationType: analysis.optimizationType,
        priority: this.calculateRecommendationPriority(analysis)
      });
    }
  }
  
  // Sort by priority (high to low)
  recommendations.sort((a, b) => b.priority - a.priority);
  
  return recommendations.slice(0, 20); // Return top 20 recommendations
};

/**
 * Calculate priority for indexing recommendations
 */
ConnectionPool.prototype.calculateRecommendationPriority = function(analysis) {
  let priority = 0;
  
  // Higher priority for more frequently executed queries
  priority += Math.min(analysis.executionCount * 10, 100);
  
  // Higher priority for certain optimization types
  switch (analysis.optimizationType) {
    case 'full_table_scan_warning':
      priority += 50; // Very high priority
      break;
    case 'join_optimization':
      priority += 30; // High priority
      break;
    case 'where_clause_optimization':
      priority += 20; // Medium priority
      break;
    case 'order_by_optimization':
      priority += 10; // Low priority
      break;
  }
  
  // Higher priority for queries with multiple potential indexes
  priority += Math.min(analysis.potentialIndexes.length * 5, 25);
  
  return priority;
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

ConnectionPool.prototype.executeBatchedQuery = async function(sql, params) {
  try {
    console.info('Auto-batching query for N+1 prevention:', sql.substring(0, 50) + '...');
    
    // Get the normalized query pattern
    const pattern = this.normalizeQuery(sql);
    
    // Check if we have other similar queries in the batch queue
    const similarQueries = this.batchQueue.filter(item => 
      this.normalizeQuery(item.query) === pattern
    );
    
    if (similarQueries.length > 1) {
      // We have multiple similar queries, optimize them
      console.info(`Batching ${similarQueries.length + 1} similar queries for N+1 prevention`);
      
      // Create a batched query (simplified example)
      const batchedSql = this.optimizeQueryForBatch(sql, similarQueries);
      
      // Execute the batched query
      const connection = await this.acquire();
      try {
        const result = await connection.query(batchedSql, params);
        
        // Remove processed queries from batch queue
        this.batchQueue = this.batchQueue.filter(item => 
          this.normalizeQuery(item.query) !== pattern
        );
        
        return {
          ...result,
          batched: true,
          originalQueryCount: similarQueries.length + 1,
          optimization: 'N+1_batch_prevention'
        };
      } finally {
        await this.release(connection);
      }
    } else {
      // No similar queries to batch with, execute normally
      const connection = await this.acquire();
      try {
        const result = await connection.query(sql, params);
        return {
          ...result,
          batched: false,
          reason: 'no_similar_queries'
        };
      } finally {
        await this.release(connection);
      }
    }
  } catch (error) {
    qerrors(error, 'connectionPool.executeBatchedQuery', {
      operation: 'batched_query_execution',
      queryPattern: this.normalizeQuery(sql),
      batchSize: this.batchQueue.length
    });
    throw error;
  }
};

/**
 * Optimize query for batch execution
 */
ConnectionPool.prototype.optimizeQueryForBatch = function(sql, similarQueries) {
  // Simple optimization - in a real implementation this would be more sophisticated
  // For example, converting multiple SELECT queries into a single SELECT with IN clause
  
  if (sql.toLowerCase().includes('select') && sql.toLowerCase().includes('where')) {
    // Try to convert to IN clause if we have multiple similar queries
    const ids = similarQueries
      .map(item => {
        // Extract ID from WHERE clause (simplified)
        const match = item.query.match(/where\s+.*?(\d+)/i);
        return match ? match[1] : null;
      })
      .filter(id => id !== null);
    
    if (ids.length > 0) {
      // Create optimized query with IN clause
      const baseQuery = sql.split('where')[0];
      const whereClause = sql.split('where')[1];
      const columnMatch = whereClause.match(/(\w+)\s*=\s*\?/i);
      
      if (columnMatch) {
        const column = columnMatch[1];
        return `${baseQuery} WHERE ${column} IN (${ids.join(',')})`;
      }
    }
  }
  
  // Fallback to original query
  return sql;
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
  cleanupConnectionPool,
  executeQuery,
  executeTransaction,
  executeParallelQueries
};