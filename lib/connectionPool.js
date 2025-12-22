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
   * Initialize the connection pool with minimum connections
   */
  async initializePool() {
    const initPromises = [];
    for (let i = 0; i < this.min; i++) {
      initPromises.push(this.createConnection());
    }
    await Promise.all(initPromises);
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

    // Wait for a connection to become available
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
        timeout
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
   * Close idle connections
   */
  async closeIdleConnections() {
    const now = Date.now();
    const connectionsToClose = [];

    for (const [id, conn] of this.pool.entries()) {
      if (!conn.inUse && (now - conn.lastUsed) > this.idleTimeoutMillis) {
        // Keep minimum connections
        if (this.totalConnections > this.min) {
          connectionsToClose.push(id);
        }
      }
    }

    for (const id of connectionsToClose) {
      const conn = this.pool.get(id);
      if (conn) {
        await conn.close();
        this.pool.delete(id);
        this.totalConnections--;
      }
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
 * Execute multiple queries in a transaction
 */
async function executeTransaction(queries) {
  const pool = getConnectionPool();
  let connection;
  
  try {
    connection = await pool.acquire();
    
    // Simulate transaction
    const results = [];
    for (const { sql, params } of queries) {
      const result = await connection.query(sql, params);
      results.push(result);
    }
    
    return results;
  } finally {
    if (connection) {
      await pool.release(connection);
    }
  }
}

module.exports = {
  ConnectionPool,
  getConnectionPool,
  executeQuery,
  executeTransaction
};