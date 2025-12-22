/**
 * Simple static file server for qerrors frontend demo
 * 
 * This server provides a lightweight way to serve the frontend demo files
 * without requiring complex dependencies like Bun or Express. It's designed
 * to be minimal and secure while providing the necessary functionality
 * for testing the qerrors frontend integration.
 * 
 * Key features:
 * - Serves static files from repository root
 * - Security checks against directory traversal attacks
 * - MIME type detection for proper content serving
 * - Default to demo.html for root requests
 * - No external dependencies required
 */

import http from 'http';  // Node.js HTTP server
import fs from 'fs';      // File system operations
import path from 'path';  // Path utilities

// Server configuration
const PORT = process.env.DEMO_PORT ? Number(process.env.DEMO_PORT) : 8080;  // Configurable port
const ROOT = process.cwd();  // Serve files from current working directory

/**
 * MIME type mapping for proper content serving
 * 
 * This mapping ensures that browsers receive the correct content type
 * for each file extension, enabling proper rendering and execution
 * of static assets like HTML, CSS, JavaScript, and images.
 */
const mimeTypes = {
  '.html': 'text/html',              // HTML documents
  '.css': 'text/css',                // Stylesheets
  '.js': 'application/javascript',   // JavaScript files
  '.json': 'application/json',       // JSON data files
  '.png': 'image/png',               // PNG images
  '.jpg': 'image/jpeg',              // JPEG images
  '.jpeg': 'image/jpeg',             // JPEG images (alternative extension)
  '.gif': 'image/gif',               // GIF images
  '.svg': 'image/svg+xml',           // SVG vector graphics
  '.ico': 'image/x-icon'             // Favicon files
};

/**
 * HTTP server request handler with security and routing
 * 
 * This handler processes all incoming requests, performs security checks,
 * determines the appropriate file to serve, and handles various edge cases
 * like directory requests and missing files.
 */
const server = http.createServer((req, res) => {
  // Extract URL path without query parameters
  let urlPath = req.url.split('?')[0] || '/';
  
  // Default to demo.html for root requests
  if (urlPath === '/' || urlPath === '') urlPath = '/demo.html';

  // Convert URL path to file system path
  const relativePath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
  const requestedPath = path.resolve(ROOT, relativePath);

  /**
   * Security check: Prevent directory traversal attacks
   * 
   * This ensures that requested files cannot escape the ROOT directory
   * by checking if the resolved path tries to go outside the serving directory.
   * This is a critical security measure for any static file server.
   */
  const relativePathGuard = path.relative(ROOT, requestedPath);
  if (relativePathGuard.startsWith('..') || path.isAbsolute(relativePathGuard)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');  // Reject attempts to access files outside ROOT
    return;
  }

  /**
   * File serving logic with directory handling
   * 
   * This section handles the actual file serving, including special
   * handling for directory requests and proper MIME type detection.
   * It uses asynchronous file operations to avoid blocking the event loop.
   */
  fs.stat(requestedPath, (err, stats) => {
    let filePath = requestedPath;
    
    // If directory is requested, try to serve demo.html within it
    // This provides a best-effort approach for directory requests
    if (!err && stats.isDirectory()) {
      filePath = path.join(requestedPath, 'demo.html');
    }

    // Attempt to read and serve the file
    fs.readFile(filePath, (err2, data) => {
      if (err2) {
        // File not found or unreadable - return 404
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      
      // Determine MIME type from file extension
      const ext = path.extname(filePath).toLowerCase();
      const mime = mimeTypes[ext] || 'application/octet-stream';  // Default to binary
      
      // Serve the file with proper content type
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
  });
});

/**
 * Start the server and log access information
 * 
 * The server begins listening on the configured port and provides
 * a helpful console message with the URL for accessing the demo.
 * This makes it easy for developers to know where to point their
 * browser for testing the qerrors frontend integration.
 */
server.listen(PORT, () => {
  console.log(`Demo frontend server listening on http://localhost:${PORT}/demo.html`);
});
