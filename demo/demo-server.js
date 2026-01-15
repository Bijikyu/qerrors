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
  console.error('FATAL: qerrors library failed to load:', e.message);
  process.exit(1);
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

const demoOperation = async (data) => {
  if (data && data.shouldFail) throw new Error('Simulated failure for circuit breaker test');
  return { success: true, data: 'Operation completed successfully', timestamp: new Date().toISOString() };
};

const circuitBreakerInstance = qerrors.circuitBreaker.createCircuitBreaker(demoOperation, 'demo-service', {
  failureThreshold: 3,
  recoveryTimeoutMs: 30000,
  timeoutMs: 10000,
  monitoringPeriodMs: 60000
});

let limiter = qerrors.createLimiter(5);
let serverMetrics = { totalErrors: 0, aiRequests: 0, sanitizations: 0, validations: 0 };
const logBuffer = [];
const MAX_LOG_BUFFER = 100;

function bufferLog(level, message, data = {}) {
  const entry = { timestamp: new Date().toISOString(), level, message, ...data };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_BUFFER) logBuffer.shift();
  return entry;
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
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(JSON.stringify(data, null, 2));
}

async function handleApiRequest(req, res, pathname) {
  const method = req.method;
  
  if (pathname === '/api/health' && method === 'GET') {
    const aiManager = qerrors.getAIModelManager();
    const modelInfo = aiManager.getCurrentModelInfo();
    sendJson(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      qerrors: {
        loaded: true,
        version: '1.2.7',
        aiModel: modelInfo.model,
        aiProvider: modelInfo.provider,
        aiAvailable: modelInfo.available
      }
    });
    return true;
  }
  
  if (pathname === '/api/metrics' && method === 'GET') {
    const queueStats = qerrors.getQueueStats();
    const cache = qerrors.getAnalysisCache();
    const circuitState = circuitBreakerInstance.getState();
    sendJson(res, {
      success: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      serverMetrics: serverMetrics,
      queueStats: queueStats,
      cacheSize: cache ? cache.size : 0,
      circuitBreaker: circuitState
    });
    return true;
  }
  
  if (pathname === '/api/errors/trigger' && method === 'POST') {
    const body = await parseBody(req);
    serverMetrics.totalErrors++;
    const errorId = qerrors.generateErrorId();
    const testError = new Error(body.message || 'Demo triggered error');
    testError.name = body.type === 'critical' ? 'CriticalError' : 'ApplicationError';
    const context = qerrors.extractContext({ error: testError, request: { path: pathname, method }, additionalContext: body.context || {} });
    const sanitizedMessage = qerrors.sanitizeMessage(testError.message);
    const sanitizedContext = qerrors.sanitizeContext(context);
    bufferLog('error', sanitizedMessage, { errorId, type: body.type });
    sendJson(res, {
      success: false,
      errorId: errorId,
      type: body.type || 'basic',
      message: sanitizedMessage,
      context: sanitizedContext,
      timestamp: new Date().toISOString(),
      handled: true,
      libraryFunctions: ['generateErrorId', 'extractContext', 'sanitizeMessage', 'sanitizeContext']
    });
    return true;
  }
  
  if (pathname === '/api/errors/custom' && method === 'POST') {
    const body = await parseBody(req);
    serverMetrics.totalErrors++;
    const errorId = qerrors.generateErrorId();
    const typedError = qerrors.createTypedError(body.errorType || 'validation', body.message || 'Custom error', body.code || 'CUSTOM_ERR', body.context || {});
    const sanitizedContext = qerrors.sanitizeContext(typedError);
    bufferLog('error', typedError.message, { errorId, code: typedError.code });
    sendJson(res, {
      success: false,
      errorId: errorId,
      name: typedError.name,
      message: typedError.message,
      code: typedError.code,
      severity: body.severity || 'medium',
      context: sanitizedContext,
      timestamp: new Date().toISOString(),
      handled: true,
      libraryFunctions: ['generateErrorId', 'createTypedError', 'sanitizeContext']
    });
    return true;
  }
  
  if (pathname === '/api/errors/standard' && method === 'POST') {
    const body = await parseBody(req);
    serverMetrics.totalErrors++;
    const standardError = qerrors.createStandardError(body.message || 'Standard error occurred', body.code || 'STD_ERR', body.details || {});
    const sanitizedMessage = qerrors.sanitizeMessage(standardError.message);
    sendJson(res, {
      success: false,
      error: { name: standardError.name, message: sanitizedMessage, code: standardError.code, details: standardError.details },
      timestamp: new Date().toISOString(),
      libraryFunctions: ['createStandardError', 'sanitizeMessage']
    });
    return true;
  }
  
  if (pathname === '/api/errors/analyze' && method === 'POST') {
    const body = await parseBody(req);
    serverMetrics.aiRequests++;
    const errorData = body.errorData || { message: 'Unknown error', name: 'Error' };
    const promptText = `Analyze this error and provide a JSON response with fields: summary, category, severity, potentialCauses (array), suggestedFixes (array), confidence (number 0-1). Error: ${errorData.name || 'Error'}: ${errorData.message || 'Unknown error'}${errorData.stack ? '\nStack: ' + errorData.stack.substring(0, 500) : ''}`;
    
    try {
      const aiManager = qerrors.getAIModelManager();
      const analysis = await aiManager.analyzeError(promptText);
      const modelInfo = aiManager.getCurrentModelInfo();
      bufferLog('info', 'AI analysis completed', { provider: modelInfo.provider, model: modelInfo.model, hasAnalysis: !!analysis });
      sendJson(res, {
        success: true,
        analysis: analysis,
        note: analysis === null ? 'AI returned non-JSON response (library expects structured JSON)' : null,
        timestamp: new Date().toISOString(),
        aiProvider: modelInfo.provider,
        aiModel: modelInfo.model,
        cached: false,
        libraryFunctions: ['getAIModelManager', 'analyzeError', 'getCurrentModelInfo']
      });
    } catch (err) {
      bufferLog('error', 'AI analysis failed', { error: err.message });
      sendJson(res, {
        success: false,
        error: qerrors.sanitizeMessage(err.message),
        timestamp: new Date().toISOString(),
        libraryFunctions: ['getAIModelManager', 'sanitizeMessage']
      }, 500);
    }
    return true;
  }
  
  if (pathname === '/api/ai/raw-analyze' && method === 'POST') {
    const body = await parseBody(req);
    serverMetrics.aiRequests++;
    const prompt = body.prompt || 'What is an error?';
    
    try {
      const aiManager = qerrors.getAIModelManager();
      const modelInfo = aiManager.getCurrentModelInfo();
      const model = qerrors.createLangChainModel(modelInfo.provider, modelInfo.model);
      const { HumanMessage } = require('@langchain/core/messages');
      const response = await model.invoke([new HumanMessage(prompt)]);
      const content = response.content;
      bufferLog('info', 'Raw AI analysis completed', { provider: modelInfo.provider, contentLength: content?.length || 0 });
      sendJson(res, {
        success: true,
        response: content,
        timestamp: new Date().toISOString(),
        aiProvider: modelInfo.provider,
        aiModel: modelInfo.model,
        libraryFunctions: ['getAIModelManager', 'createLangChainModel', 'getCurrentModelInfo']
      });
    } catch (err) {
      bufferLog('error', 'Raw AI analysis failed', { error: err.message });
      sendJson(res, {
        success: false,
        error: qerrors.sanitizeMessage(err.message),
        timestamp: new Date().toISOString(),
        libraryFunctions: ['createLangChainModel', 'sanitizeMessage']
      }, 500);
    }
    return true;
  }
  
  if (pathname === '/api/logs/export' && method === 'GET') {
    sendJson(res, {
      success: true,
      logs: logBuffer,
      count: logBuffer.length,
      exportedAt: new Date().toISOString(),
      libraryFunctions: ['logDebug', 'logInfo', 'logWarn', 'logError', 'logFatal', 'logAudit']
    });
    return true;
  }
  
  if (pathname === '/api/logs/create' && method === 'POST') {
    const body = await parseBody(req);
    const level = body.level || 'info';
    const message = body.message || 'Log entry';
    const sanitizedMessage = qerrors.sanitizeMessage(message);
    const entry = bufferLog(level, sanitizedMessage, body.data || {});
    
    if (level === 'debug') qerrors.logDebug(sanitizedMessage, body.data);
    else if (level === 'info') qerrors.logInfo(sanitizedMessage, body.data);
    else if (level === 'warn') qerrors.logWarn(sanitizedMessage, body.data);
    else if (level === 'error') qerrors.logError(sanitizedMessage, body.data);
    else if (level === 'fatal') qerrors.logFatal(sanitizedMessage, body.data);
    else if (level === 'audit') qerrors.logAudit(sanitizedMessage, body.data);
    
    sendJson(res, {
      success: true,
      entry: entry,
      libraryFunctions: ['sanitizeMessage', `log${level.charAt(0).toUpperCase() + level.slice(1)}`]
    });
    return true;
  }
  
  if (pathname === '/api/circuit/status' && method === 'GET') {
    const state = circuitBreakerInstance.getState();
    const stats = circuitBreakerInstance.getStats();
    sendJson(res, {
      success: true,
      state: state,
      stats: stats,
      config: { failureThreshold: 3, resetTimeout: 30000 },
      libraryFunctions: ['circuitBreaker.createCircuitBreaker', 'circuitBreaker.getState', 'circuitBreaker.getStats']
    });
    return true;
  }
  
  if (pathname === '/api/circuit/execute' && method === 'POST') {
    const body = await parseBody(req);
    const shouldFail = body.shouldFail === true;
    
    try {
      const result = await circuitBreakerInstance.execute({ shouldFail });
      sendJson(res, {
        success: true,
        result: result,
        circuitState: circuitBreakerInstance.getState(),
        circuitStats: circuitBreakerInstance.getStats(),
        libraryFunctions: ['circuitBreaker.execute', 'circuitBreaker.getState', 'circuitBreaker.getStats']
      });
    } catch (err) {
      sendJson(res, {
        success: false,
        error: err.message,
        circuitState: circuitBreakerInstance.getState(),
        circuitStats: circuitBreakerInstance.getStats(),
        libraryFunctions: ['circuitBreaker.execute', 'circuitBreaker.getState', 'circuitBreaker.getStats']
      }, 500);
    }
    return true;
  }
  
  if (pathname === '/api/circuit/reset' && method === 'POST') {
    circuitBreakerInstance.forceState('close');
    sendJson(res, {
      success: true,
      message: 'Circuit breaker reset to closed state',
      state: circuitBreakerInstance.getState(),
      libraryFunctions: ['circuitBreaker.forceState']
    });
    return true;
  }
  
  if (pathname === '/api/queue/status' && method === 'GET') {
    const stats = qerrors.getQueueStats();
    const rejectCount = qerrors.getQueueRejectCount();
    sendJson(res, {
      success: true,
      stats: stats,
      rejectCount: rejectCount,
      libraryFunctions: ['getQueueStats', 'getQueueRejectCount']
    });
    return true;
  }
  
  if (pathname === '/api/queue/execute' && method === 'POST') {
    const body = await parseBody(req);
    const taskCount = Math.min(body.taskCount || 1, 10);
    const taskDelay = Math.min(body.taskDelay || 100, 5000);
    
    const tasks = [];
    for (let i = 0; i < taskCount; i++) {
      tasks.push(limiter(async () => {
        await new Promise(resolve => setTimeout(resolve, taskDelay));
        return { taskId: i, completed: true };
      }));
    }
    
    try {
      const results = await Promise.all(tasks);
      sendJson(res, {
        success: true,
        results: results,
        queueStats: qerrors.getQueueStats(),
        libraryFunctions: ['createLimiter', 'getQueueStats']
      });
    } catch (err) {
      sendJson(res, {
        success: false,
        error: err.message,
        libraryFunctions: ['createLimiter']
      }, 500);
    }
    return true;
  }
  
  if (pathname === '/api/sanitize' && method === 'POST') {
    const body = await parseBody(req);
    serverMetrics.sanitizations++;
    const inputMessage = body.message || '';
    const inputContext = body.context || {};
    const sanitizedMessage = qerrors.sanitizeMessage(inputMessage);
    const sanitizedContext = qerrors.sanitizeContext(inputContext);
    sendJson(res, {
      success: true,
      original: { message: inputMessage, context: inputContext },
      sanitized: { message: sanitizedMessage, context: sanitizedContext },
      libraryFunctions: ['sanitizeMessage', 'sanitizeContext']
    });
    return true;
  }
  
  if (pathname === '/api/sanitize/custom-pattern' && method === 'POST') {
    const body = await parseBody(req);
    const pattern = body.pattern;
    const replacement = body.replacement || '[REDACTED]';
    
    if (!pattern) {
      sendJson(res, { success: false, error: 'Pattern is required' }, 400);
      return true;
    }
    
    try {
      qerrors.addCustomSanitizationPattern(new RegExp(pattern, 'gi'), replacement);
      const testResult = qerrors.sanitizeWithCustomPatterns(body.testInput || 'test input');
      sendJson(res, {
        success: true,
        patternAdded: pattern,
        replacement: replacement,
        testResult: testResult,
        libraryFunctions: ['addCustomSanitizationPattern', 'sanitizeWithCustomPatterns']
      });
    } catch (err) {
      sendJson(res, { success: false, error: err.message }, 400);
    }
    return true;
  }
  
  if (pathname === '/api/sanitize/clear-patterns' && method === 'POST') {
    qerrors.clearCustomSanitizationPatterns();
    sendJson(res, {
      success: true,
      message: 'Custom sanitization patterns cleared',
      libraryFunctions: ['clearCustomSanitizationPatterns']
    });
    return true;
  }
  
  if (pathname === '/api/entity-guards/test' && method === 'POST') {
    const body = await parseBody(req);
    serverMetrics.validations++;
    const entity = body.entity;
    const entityName = body.entityName || 'Entity';
    const results = {};
    
    results.entityExists = qerrors.entityExists(entity);
    
    try {
      qerrors.throwIfNotFound(entity, entityName);
      results.throwIfNotFound = { passed: true };
    } catch (err) {
      results.throwIfNotFound = { passed: false, error: err.message };
    }
    
    try {
      qerrors.assertEntityExists(entity, entityName);
      results.assertEntityExists = { passed: true };
    } catch (err) {
      results.assertEntityExists = { passed: false, error: err.message };
    }
    
    sendJson(res, {
      success: true,
      input: { entity, entityName },
      results: results,
      libraryFunctions: ['entityExists', 'throwIfNotFound', 'assertEntityExists', 'throwIfNotFoundObj', 'throwIfNotFoundMany', 'throwIfNotFoundWithMessage']
    });
    return true;
  }
  
  if (pathname === '/api/utils/safe-run' && method === 'POST') {
    const body = await parseBody(req);
    const shouldFail = body.shouldFail === true;
    
    const result = await qerrors.safeRun(async () => {
      if (shouldFail) throw new Error('Intentional failure for safeRun demo');
      return { computed: true, value: body.value || 42 };
    });
    
    sendJson(res, {
      success: !result.error,
      result: result,
      libraryFunctions: ['safeRun']
    });
    return true;
  }
  
  if (pathname === '/api/utils/attempt' && method === 'POST') {
    const body = await parseBody(req);
    const shouldFail = body.shouldFail === true;
    
    const [error, data] = await qerrors.attempt(async () => {
      if (shouldFail) throw new Error('Intentional failure for attempt demo');
      return { success: true, value: body.value || 'default' };
    });
    
    sendJson(res, {
      success: !error,
      error: error ? error.message : null,
      data: data,
      libraryFunctions: ['attempt']
    });
    return true;
  }
  
  if (pathname === '/api/utils/deep-clone' && method === 'POST') {
    const body = await parseBody(req);
    const original = body.object || { test: 'value', nested: { deep: true } };
    const cloned = qerrors.deepClone(original);
    cloned._cloneMarker = 'This was added to the clone';
    
    sendJson(res, {
      success: true,
      original: original,
      cloned: cloned,
      areEqual: JSON.stringify(original) === JSON.stringify(cloned),
      libraryFunctions: ['deepClone']
    });
    return true;
  }
  
  if (pathname === '/api/utils/timer' && method === 'POST') {
    const body = await parseBody(req);
    const delay = Math.min(body.delay || 100, 2000);
    
    const timer = qerrors.createTimer();
    await new Promise(resolve => setTimeout(resolve, delay));
    const elapsed = timer.elapsed();
    
    sendJson(res, {
      success: true,
      requestedDelay: delay,
      actualElapsed: elapsed,
      libraryFunctions: ['createTimer']
    });
    return true;
  }
  
  if (pathname === '/api/utils/performance-timer' && method === 'POST') {
    const body = await parseBody(req);
    const operationName = body.operation || 'demo-operation';
    const delay = Math.min(body.delay || 100, 2000);
    
    const timer = qerrors.createPerformanceTimer(operationName);
    await new Promise(resolve => setTimeout(resolve, delay));
    const result = timer.stop();
    
    sendJson(res, {
      success: true,
      operation: operationName,
      timing: result,
      libraryFunctions: ['createPerformanceTimer']
    });
    return true;
  }
  
  if (pathname === '/api/utils/format-error' && method === 'POST') {
    const body = await parseBody(req);
    const testError = new Error(body.message || 'Test error message');
    testError.code = body.code || 'TEST_ERR';
    const formatted = qerrors.formatErrorMessage(testError);
    
    sendJson(res, {
      success: true,
      formatted: formatted,
      libraryFunctions: ['formatErrorMessage']
    });
    return true;
  }
  
  if (pathname === '/api/config/env' && method === 'GET') {
    const nodeEnv = qerrors.NODE_ENV;
    const defaultErrorMsg = qerrors.DEFAULT_ERROR_MESSAGE;
    
    sendJson(res, {
      success: true,
      nodeEnv: nodeEnv,
      defaultErrorMessage: defaultErrorMsg,
      libraryFunctions: ['NODE_ENV', 'DEFAULT_ERROR_MESSAGE', 'getEnv', 'getInt']
    });
    return true;
  }
  
  if (pathname === '/api/config/validate-env' && method === 'POST') {
    const body = await parseBody(req);
    const requiredVars = body.vars || ['NODE_ENV'];
    const missing = qerrors.getMissingEnvVars(requiredVars);
    
    sendJson(res, {
      success: missing.length === 0,
      required: requiredVars,
      missing: missing,
      libraryFunctions: ['getMissingEnvVars', 'throwIfMissingEnvVars', 'warnIfMissingEnvVars', 'validateRequiredEnvVars']
    });
    return true;
  }
  
  if (pathname === '/api/ai/model-info' && method === 'GET') {
    const aiManager = qerrors.getAIModelManager();
    const modelInfo = aiManager.getCurrentModelInfo();
    
    sendJson(res, {
      success: true,
      modelInfo: modelInfo,
      providers: Object.keys(qerrors.MODEL_PROVIDERS),
      libraryFunctions: ['getAIModelManager', 'getCurrentModelInfo', 'MODEL_PROVIDERS', 'resetAIModelManager', 'createLangChainModel']
    });
    return true;
  }
  
  if (pathname === '/api/error-types' && method === 'GET') {
    const errorTypes = qerrors.ErrorTypes;
    const severities = qerrors.ErrorSeverity;
    
    sendJson(res, {
      success: true,
      errorTypes: Object.keys(errorTypes),
      severities: Object.keys(severities),
      libraryFunctions: ['ErrorTypes', 'ErrorSeverity', 'ErrorFactory', 'ServiceError', 'errorUtils', 'safeUtils']
    });
    return true;
  }
  
  if (pathname === '/api/module-init' && method === 'GET') {
    const shouldInit = qerrors.shouldInitialize('demo-module');
    
    sendJson(res, {
      success: true,
      shouldInitialize: shouldInit,
      libraryFunctions: ['initializeModule', 'initializeModuleESM', 'shouldInitialize', 'logModuleInit']
    });
    return true;
  }
  
  if (pathname === '/api/dependency-interfaces' && method === 'GET') {
    const defaultDeps = qerrors.getDefaultQerrorsCoreDeps();
    
    sendJson(res, {
      success: true,
      defaultDepsAvailable: !!defaultDeps,
      libraryFunctions: ['createQerrorsCoreDeps', 'getDefaultQerrorsCoreDeps', 'createDefaultErrorHandlingDeps', 'qerr', 'getErrorSeverity', 'logErrorWithSeverityDI', 'withErrorHandlingDI', 'resetDefaultQerrorsCoreDeps']
    });
    return true;
  }
  
  if (pathname === '/api/response-helpers/demo' && method === 'POST') {
    const body = await parseBody(req);
    const responseType = body.type || 'success';
    
    const mockRes = {
      statusCode: null,
      headers: {},
      body: null,
      req: { headers: { accept: 'application/json' } },
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
      setHeader(k, v) { this.headers[k] = v; return this; },
      writeHead(status, headers) { this.statusCode = status; this.headers = headers; return this; },
      end(data) { if (data) this.body = typeof data === 'string' ? JSON.parse(data) : data; return this; }
    };
    
    try {
      if (responseType === 'success') qerrors.sendSuccessResponse(mockRes, { demo: true });
      else if (responseType === 'created') qerrors.sendCreatedResponse(mockRes, { id: 123 });
      else if (responseType === 'error') qerrors.sendErrorResponse(mockRes, 400, 'Something went wrong');
      else if (responseType === 'validation') qerrors.sendValidationErrorResponse(mockRes, [{ field: 'email', message: 'Invalid' }]);
      else if (responseType === 'notFound') qerrors.sendNotFoundResponse(mockRes, 'Resource');
      else if (responseType === 'unauthorized') qerrors.sendUnauthorizedResponse(mockRes);
      else if (responseType === 'forbidden') qerrors.sendForbiddenResponse(mockRes);
      else if (responseType === 'serverError') qerrors.sendServerErrorResponse(mockRes, new Error('Server error'));
      
      sendJson(res, {
        success: true,
        responseType: responseType,
        generatedResponse: { statusCode: mockRes.statusCode, body: mockRes.body },
        libraryFunctions: ['sendJsonResponse', 'sendSuccessResponse', 'sendCreatedResponse', 'sendErrorResponse', 'sendValidationErrorResponse', 'sendNotFoundResponse', 'sendUnauthorizedResponse', 'sendForbiddenResponse', 'sendServerErrorResponse', 'createResponseHelper', 'globalErrorHandler']
      });
    } catch (err) {
      sendJson(res, {
        success: false,
        error: 'Response helper demo failed: ' + err.message,
        note: 'Response helpers are designed for Express.js - this demo uses a mock res object',
        libraryFunctions: ['sendSuccessResponse', 'sendCreatedResponse', 'sendErrorResponse', 'sendNotFoundResponse']
      }, 500);
    }
    return true;
  }
  
  if (pathname === '/api/log-levels' && method === 'GET') {
    sendJson(res, {
      success: true,
      logLevels: qerrors.LOG_LEVELS,
      libraryFunctions: ['LOG_LEVELS', 'simpleLogger', 'createSimpleWinstonLogger', 'createEnhancedLogEntry']
    });
    return true;
  }
  
  if (pathname === '/api/unique-id' && method === 'GET') {
    const uuid = qerrors.generateUniqueId();
    const errorId = qerrors.generateErrorId();
    
    sendJson(res, {
      success: true,
      uuid: uuid,
      errorId: errorId,
      libraryFunctions: ['generateUniqueId', 'generateErrorId']
    });
    return true;
  }
  
  if (pathname === '/api/cache/clear' && method === 'POST') {
    const cache = qerrors.getAnalysisCache();
    const sizeBefore = cache ? cache.size : 0;
    if (cache) cache.clear();
    sendJson(res, {
      success: true,
      message: 'Analysis cache cleared',
      sizeBefore: sizeBefore,
      sizeAfter: 0,
      libraryFunctions: ['getAnalysisCache']
    });
    return true;
  }
  
  if (pathname === '/api/cleanup' && method === 'POST') {
    qerrors.cleanup();
    sendJson(res, {
      success: true,
      message: 'Qerrors cleanup completed',
      libraryFunctions: ['cleanup']
    });
    return true;
  }
  
  if (pathname === '/api/metrics/reset' && method === 'POST') {
    serverMetrics = { totalErrors: 0, aiRequests: 0, sanitizations: 0, validations: 0 };
    logBuffer.length = 0;
    sendJson(res, {
      success: true,
      message: 'Server metrics and log buffer reset'
    });
    return true;
  }
  
  if (pathname === '/api/library-functions' && method === 'GET') {
    const exports = Object.keys(qerrors);
    const functions = exports.filter(key => typeof qerrors[key] === 'function');
    const objects = exports.filter(key => typeof qerrors[key] === 'object' && qerrors[key] !== null);
    const constants = exports.filter(key => typeof qerrors[key] !== 'function' && typeof qerrors[key] !== 'object');
    
    const subModuleDetails = {};
    const subModuleNames = ['logger', 'errorTypes', 'sanitization', 'queueManager', 'utils', 'config', 'envUtils', 'aiModelManager', 'moduleInitializer', 'dependencyInterfaces', 'entityGuards', 'responseHelpers', 'circuitBreaker'];
    subModuleNames.forEach(name => {
      if (qerrors[name]) {
        subModuleDetails[name] = Object.keys(qerrors[name]).filter(k => typeof qerrors[name][k] === 'function');
      }
    });
    
    sendJson(res, {
      success: true,
      source: 'dynamic enumeration of qerrors exports',
      totalExports: exports.length,
      functions: functions,
      functionCount: functions.length,
      objects: objects,
      objectCount: objects.length,
      constants: constants,
      subModules: subModuleNames,
      subModuleCount: subModuleNames.length,
      subModuleDetails: subModuleDetails
    });
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
        sendJson(res, { success: false, error: 'Not Found', path: pathname }, 404);
      }
    } catch (err) {
      console.error('API Error:', err);
      bufferLog('error', 'API request failed', { path: pathname, error: err.message });
      sendJson(res, { success: false, error: 'Internal Server Error', message: qerrors.sanitizeMessage(err.message) }, 500);
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
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    readStream.pipe(res);
    
    readStream.on('end', cleanup);
  }).catch(() => {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Demo server with REAL qerrors integration listening on http://0.0.0.0:${PORT}/`);
  console.log('qerrors library: loaded with full functionality');
  const aiManager = qerrors.getAIModelManager();
  const modelInfo = aiManager.getCurrentModelInfo();
  console.log(`AI Model: ${modelInfo.provider}/${modelInfo.model} (available: ${modelInfo.available})`);
});
