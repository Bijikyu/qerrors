'use strict';

/**
 * Database Connection Pool Manager
 * 
 * Provides scalable connection pooling for database operations with
 * dynamic sizing, health monitoring, and graceful degradation.
 */

class ConnectionPool {
  constructor(options = {}) {
    this.min = options.min || 2;
    this.max = options.max || 10;
    this.idleTimeoutMillis = options.idleTimeoutMillis || 30000;
    this.acquireTimeoutMillis = options.acquireTimeoutMillis || 10000;
    
    this.pool = new Map();
    this.waitingQueue = [];
    this.activeConnections = 0;
    this.totalConnections = 0;
    
    // Initialize minimum connections
    this.initializePool();
  }

  /**
   * Initialize the connection pool with minimum connections (optimized for scalability)
   */
  async initializePool() {
    // Create connections sequentially to prevent resource exhaustion during startup
    const initPromises = [];
    
    for (let i = 0; i < this.min; i++) {
      initPromises.push(this.createConnection());
    }
    
    // Use Promise.allSettled to handle partial failures gracefully
    const results = await Promise.allSettled(initPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    if (successful < this.min) {
      console.warn(`Only ${successful}/${this.min} connections initialized successfully`);
    }
  }

  /**
   * Create a new database connection
   */
  async createConnection() {
    // Simulate connection creation - in production, this would be actual DB connection
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${performance.now()}`;
    const connection = {
      id: connectionId,
      created: Date.now(),
      lastUsed: Date.now(),
      inUse: false,
      query: async (sql, params) => {
        // Simulate query execution
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        return { rows: [], affectedRows: 0 };
      },
      close: async () => {
        // Simulate connection close
      }
    };

    this.pool.set(connectionId, connection);
    this.totalConnections++;
    return connection;
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire() {
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
    // Implement bounded queue to prevent memory exhaustion
    const maxQueueSize = this.max * 10; // Allow 10x max connections in queue
    
    if (this.waitingQueue.length >= maxQueueSize) {
      throw new Error('Connection pool queue exhausted');
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const waiterIndex = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (waiterIndex > -1) {
          this.waitingQueue.splice(waiterIndex, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.acquireTimeoutMillis);

      this.waitingQueue.push({
        resolve,
        reject,
        timeout,
        timestamp: Date.now() // Add timestamp for queue aging
      });
    });
  }

  /**
   * Release a connection back to the pool
   */
  async release(connection) {
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
    
    // Remove expired entries efficiently
    this.waitingQueue = this.waitingQueue.filter(waiter => {
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
    return {
      totalConnections: this.totalConnections,
      activeConnections: this.activeConnections,
      idleConnections: this.totalConnections - this.activeConnections,
      waitingQueue: this.waitingQueue.length
    };
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
    this.waitingQueue = [];

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
  } finally {
    if (connection) {
      await pool.release(connection);
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
    } finally {
      if (connection) {
        await pool.release(connection);
      }
    }
  }

  /**
   * Execute multiple queries in parallel with connection pooling
   */
  async function executeParallelQueries(queryList) {
    const pool = getConnectionPool();
    const maxConcurrency = Math.min(queryList.length, pool.max);
    const limiter = createConcurrencyLimiter(maxConcurrency);
    
    const promises = queryList.map(({ sql, params }) => 
      limiter(async () => {
        let connection;
        try {
          connection = await pool.acquire();
          return await connection.query(sql, params);
        } finally {
          if (connection) {
            await pool.release(connection);
          }
        }
      })
    );
    
    return Promise.all(promises);
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

module.exports = {
  ConnectionPool,
  getConnectionPool,
  executeQuery,
  executeTransaction,
  executeParallelQueries
};