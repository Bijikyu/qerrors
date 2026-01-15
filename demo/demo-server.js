const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.DEMO_PORT ? Number(process.env.DEMO_PORT) : 5000;
const ROOT = path.join(process.cwd(), 'demo');

let qerrors;
try {
  qerrors = require('../index.js');
} catch (e) {
  console.log('Note: qerrors library not available, using mock responses');
  qerrors = null;
}

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

let metrics = {
  totalErrors: 0,
  queueLength: 0,
  cacheHits: 0,
  aiRequests: 0,
  circuitState: 'closed'
};

function generateErrorId() {
  return 'ERR-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  });
  res.end(JSON.stringify(data, null, 2));
}

async function handleApiRequest(req, res, pathname) {
  const method = req.method;
  
  if (pathname === '/api/health' && method === 'GET') {
    sendJson(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      qerrors: {
        loaded: !!qerrors,
        version: qerrors ? '1.2.7' : null
      }
    });
    return true;
  }
  
  if (pathname === '/api/metrics' && method === 'GET') {
    const rawQueueStats = qerrors && qerrors.getQueueStats ? qerrors.getQueueStats() : null;
    const queueStats = rawQueueStats ? {
      queueLength: rawQueueStats.length || 0,
      rejectCount: rawQueueStats.rejectCount || 0,
      processed: metrics.totalErrors,
      cacheHits: metrics.cacheHits
    } : {
      queueLength: metrics.queueLength,
      processed: metrics.totalErrors,
      cacheHits: metrics.cacheHits
    };
    sendJson(res, {
      success: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      metrics: metrics,
      qerrors: queueStats
    });
    return true;
  }
  
  if (pathname === '/api/errors/trigger' && method === 'POST') {
    const body = await parseBody(req);
    metrics.totalErrors++;
    const errorId = generateErrorId();
    
    const errorInfo = {
      success: false,
      errorId: errorId,
      type: body.type || 'basic',
      message: body.message || 'Error triggered from demo',
      context: body.context || {},
      timestamp: new Date().toISOString(),
      handled: true,
      analysis: {
        severity: body.type === 'critical' ? 'critical' : 'medium',
        category: 'application',
        suggestion: 'This is a test error. In production, review the error context and stack trace.'
      }
    };
    
    if (qerrors) {
      try {
        const result = qerrors.extractContext ? qerrors.extractContext({ error: new Error(body.message) }) : {};
        errorInfo.libraryContext = result;
      } catch (e) {
        errorInfo.libraryError = e.message;
      }
    }
    
    sendJson(res, errorInfo);
    return true;
  }
  
  if (pathname === '/api/errors/custom' && method === 'POST') {
    const body = await parseBody(req);
    metrics.totalErrors++;
    const errorId = generateErrorId();
    
    sendJson(res, {
      success: false,
      errorId: errorId,
      name: body.name || body.errorType || 'CustomError',
      message: body.message || 'Custom error triggered',
      code: body.code || 'CUSTOM_ERROR',
      severity: body.severity || 'medium',
      context: body.context || {},
      timestamp: new Date().toISOString(),
      handled: true
    });
    return true;
  }
  
  if (pathname === '/api/errors/analyze' && method === 'POST') {
    const body = await parseBody(req);
    metrics.aiRequests++;
    const errorId = generateErrorId();
    
    const errorData = body.errorData || {};
    const scenario = body.scenario || 'general';
    
    let analysis = {
      errorId: errorId,
      summary: `Analysis of ${errorData.name || 'Error'}: ${errorData.message || 'Unknown error'}`,
      category: 'application',
      severity: 'medium',
      potentialCauses: [
        'Invalid input data',
        'Network connectivity issues',
        'Resource constraints'
      ],
      suggestedFixes: [
        'Validate input before processing',
        'Add proper error handling',
        'Implement retry logic for transient failures'
      ],
      confidence: 0.85
    };
    
    if (scenario === 'database') {
      analysis.category = 'database';
      analysis.potentialCauses = ['Connection timeout', 'Query syntax error', 'Constraint violation'];
      analysis.suggestedFixes = ['Check connection pool settings', 'Review query syntax', 'Verify data constraints'];
    } else if (scenario === 'network') {
      analysis.category = 'network';
      analysis.potentialCauses = ['DNS resolution failure', 'Connection refused', 'Timeout'];
      analysis.suggestedFixes = ['Check network configuration', 'Verify endpoint availability', 'Increase timeout values'];
    } else if (scenario === 'authentication') {
      analysis.category = 'security';
      analysis.potentialCauses = ['Invalid credentials', 'Expired token', 'Missing permissions'];
      analysis.suggestedFixes = ['Verify credentials', 'Refresh authentication token', 'Check user permissions'];
    }
    
    sendJson(res, {
      success: true,
      analysis: analysis,
      timestamp: new Date().toISOString(),
      aiProvider: body.provider || 'mock',
      cached: metrics.cacheHits > 0
    });
    return true;
  }
  
  if (pathname === '/api/logs/export' && method === 'GET') {
    sendJson(res, {
      success: true,
      logs: [
        { timestamp: new Date().toISOString(), level: 'info', message: 'Demo server started' },
        { timestamp: new Date().toISOString(), level: 'info', message: `Total errors processed: ${metrics.totalErrors}` },
        { timestamp: new Date().toISOString(), level: 'info', message: `AI requests: ${metrics.aiRequests}` }
      ],
      exportedAt: new Date().toISOString()
    });
    return true;
  }
  
  if (pathname === '/api/circuit/status' && method === 'GET') {
    sendJson(res, {
      success: true,
      state: metrics.circuitState,
      failures: 0,
      lastFailure: null,
      resetTimeout: 30000
    });
    return true;
  }
  
  if (pathname === '/api/circuit/test' && method === 'POST') {
    const body = await parseBody(req);
    const action = body.action || 'test';
    
    if (action === 'open') {
      metrics.circuitState = 'open';
    } else if (action === 'reset') {
      metrics.circuitState = 'closed';
    } else if (action === 'half-open') {
      metrics.circuitState = 'half-open';
    }
    
    sendJson(res, {
      success: true,
      state: metrics.circuitState,
      action: action,
      timestamp: new Date().toISOString()
    });
    return true;
  }
  
  if (pathname === '/api/cache/clear' && method === 'POST') {
    metrics.cacheHits = 0;
    sendJson(res, { success: true, message: 'Cache cleared' });
    return true;
  }
  
  if (pathname === '/api/metrics/reset' && method === 'POST') {
    metrics = {
      totalErrors: 0,
      queueLength: 0,
      cacheHits: 0,
      aiRequests: 0,
      circuitState: 'closed'
    };
    sendJson(res, { success: true, message: 'Metrics reset' });
    return true;
  }
  
  return false;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname || '/';
  
  if (pathname.startsWith('/api/')) {
    try {
      const handled = await handleApiRequest(req, res, pathname);
      if (!handled) {
        sendJson(res, { error: 'Not Found', path: pathname }, 404);
      }
    } catch (err) {
      console.error('API Error:', err);
      sendJson(res, { error: 'Internal Server Error', message: err.message }, 500);
    }
    return;
  }
  
  if (pathname === '/' || pathname === '') pathname = '/demo.html';
  
  const relativePath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const requestedPath = path.resolve(ROOT, relativePath);
  
  const relativePathGuard = path.relative(ROOT, requestedPath);
  if (relativePathGuard.startsWith('..') || path.isAbsolute(relativePathGuard)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  
  fs.promises.stat(requestedPath).then((stats) => {
    let filePath = requestedPath;
    
    if (stats.isDirectory()) {
      filePath = path.join(requestedPath, 'demo.html');
    }
    
    const readStream = fs.createReadStream(filePath);
    
    const cleanup = () => {
      readStream.destroy();
    };
    
    res.on('close', cleanup);
    req.on('close', cleanup);
    
    readStream.on('error', () => {
      cleanup();
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });
    
    const ext = path.extname(filePath).toLowerCase();
    const mime = mimeTypes[ext] || 'application/octet-stream';
    
    res.writeHead(200, { 
      'Content-Type': mime,
      'Cache-Control': 'no-cache'
    });
    readStream.pipe(res);
    
    readStream.on('end', cleanup);
  }).catch(() => {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Demo server with API listening on http://0.0.0.0:${PORT}/`);
  console.log(`qerrors library: ${qerrors ? 'loaded' : 'not available'}`);
});
