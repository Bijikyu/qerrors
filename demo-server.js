import http from 'http';
import fs from 'fs';
import path from 'path';

// Simple static file server for the frontend demo (no Bun required)
// Serves files from the repository root. Access http://localhost:8080/demo.html

const PORT = process.env.DEMO_PORT ? Number(process.env.DEMO_PORT) : 8080;
const ROOT = process.cwd();

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0] || '/';
  if (urlPath === '/' || urlPath === '') urlPath = '/demo.html';

  const relativePath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
  const requestedPath = path.resolve(ROOT, relativePath);

  // Security: ensure requested path is within ROOT
  const relativePathGuard = path.relative(ROOT, requestedPath);
  if (relativePathGuard.startsWith('..') || path.isAbsolute(relativePathGuard)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // If a directory is requested, serve demo.html inside it (best effort)
  fs.stat(requestedPath, (err, stats) => {
    let filePath = requestedPath;
    if (!err && stats.isDirectory()) {
      filePath = path.join(requestedPath, 'demo.html');
    }

    fs.readFile(filePath, (err2, data) => {
      if (err2) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const mime = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Demo frontend server listening on http://localhost:${PORT}/demo.html`);
});
