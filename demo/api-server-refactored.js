/**
 * Express.js API Server - Main Entry Point
 * 
 * Simplified main server file with modular architecture
 * Extracted components for better maintainability and code organization
 */

import express from 'express';
import { configureMiddleware } from '../middleware/apiServerMiddleware.js';
import { configureErrorHandling } from '../middleware/apiServerErrorHandler.js';
import { setupRoutes } from '../routes/apiServerRoutes.js';

/**
 * Main server function
 */
function createServer() {
  const app = express();
  
  // Configure all middleware
  configureMiddleware(app);
  
  // Setup all API routes
  setupRoutes(app);
  
  // Configure error handling
  configureErrorHandling(app);
  
  return app;
}

/**
 * Start server with proper error handling
 */
function startServer(port = 3000) {
  const app = createServer();
  
  const server = app.listen(port, () => {
    console.log(`🚀 API Server running on port ${port}`);
    console.log(`📊 API endpoints available at http://localhost:${port}/api/`);
    console.log(`🔍 Error testing UI at http://localhost:${port}/demo.html`);
    console.log(`📈 Health check at http://localhost:${port}/api/health`);
  });
  
  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', error.message);
      process.exit(1);
    }
  });
  
  // Graceful shutdown handling
  const gracefulShutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    
    server.close(() => {
      console.log('✅ Server closed successfully');
      process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.log('❌ Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  return server;
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.PORT || '3000');
  startServer(port);
}

export {
  createServer,
  startServer
};