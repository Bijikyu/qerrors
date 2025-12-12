'use strict';

const config = require('./config');
const errorTypes = require('./errorTypes');
const pLimit = require('p-limit').default;
const logger = require('./logger');
const axios = require('axios');
const http = require('http');
const https = require('https');
const { getAIModelManager } = require('./aiModelManager');
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const escapeHtml = require('escape-html');
const { LRUCache } = require('lru-cache');

// Import shared utilities
const { stringifyContext, verboseLog } = require('./shared/logging');

const rawConc = config.getInt('QERRORS_CONCURRENCY');
const rawQueue = config.getInt('QERRORS_QUEUE_LIMIT');
const SAFE_THRESHOLD = config.getInt('QERRORS_SAFE_THRESHOLD');

const CONCURRENCY_LIMIT = Math.min(rawConc, SAFE_THRESHOLD);
const QUEUE_LIMIT = Math.min(rawQueue, SAFE_THRESHOLD);

if (rawConc > SAFE_THRESHOLD || rawQueue > SAFE_THRESHOLD) {
  logger.then(l => l.warn(`High qerrors limits clamped conc ${rawConc} queue ${rawQueue}`));
}

const rawSockets = config.getInt('QERRORS_MAX_SOCKETS');
const MAX_SOCKETS = Math.min(rawSockets, SAFE_THRESHOLD);

if (rawSockets > SAFE_THRESHOLD) {
  logger.then(l => l.warn(`max sockets clamped ${rawSockets}`));
}

const rawFreeSockets = config.getInt('QERRORS_MAX_FREE_SOCKETS');
const MAX_FREE_SOCKETS = Math.min(rawFreeSockets, SAFE_THRESHOLD);

if (rawFreeSockets > SAFE_THRESHOLD) {
  logger.then(l => l.warn(`max free sockets clamped ${rawFreeSockets}`));
}

const parsedLimit = config.getInt('QERRORS_CACHE_LIMIT', 0);
const ADVICE_CACHE_LIMIT = parsedLimit === 0 ? 0 : Math.min(parsedLimit, SAFE_THRESHOLD);

if (parsedLimit > SAFE_THRESHOLD) {
  logger.then(l => l.warn(`cache limit clamped ${parsedLimit}`));
}

const CACHE_TTL_SECONDS = config.getInt('QERRORS_CACHE_TTL', 0);

const adviceCache = new LRUCache({
  max: ADVICE_CACHE_LIMIT || 0,
  ttl: CACHE_TTL_SECONDS * 1000
});

let warnedMissingToken = false;

const axiosInstance = axios.create({
  httpAgent: new http.Agent({
    keepAlive: true,
    maxSockets: MAX_SOCKETS,
    maxFreeSockets: MAX_FREE_SOCKETS
  }),
  httpsAgent: new https.Agent({
    keepAlive: true,
    maxSockets: MAX_SOCKETS,
    maxFreeSockets: MAX_FREE_SOCKETS
  }),
  timeout: config.getInt('QERRORS_TIMEOUT')
});

const limit = pLimit(CONCURRENCY_LIMIT);
let queueRejectCount = 0;
let cleanupHandle = null;
let metricHandle = null;

const METRIC_INTERVAL_MS = config.getInt('QERRORS_METRIC_INTERVAL_MS', 0);

const startAdviceCleanup = () => {
  if (CACHE_TTL_SECONDS === 0 || ADVICE_CACHE_LIMIT === 0 || cleanupHandle) return;
  cleanupHandle = setInterval(purgeExpiredAdvice, CACHE_TTL_SECONDS * 1000);
  cleanupHandle.unref();
};

const stopAdviceCleanup = () => {
  cleanupHandle && (clearInterval(cleanupHandle), cleanupHandle = null);
};

const logQueueMetrics = () => logger.then(l => l.info(
  `metrics queueLength=${getQueueLength()} queueRejects=${getQueueRejectCount()}`
));

const startQueueMetrics = () => {
  if (metricHandle || METRIC_INTERVAL_MS === 0) return;
  metricHandle = setInterval(logQueueMetrics, METRIC_INTERVAL_MS);
  metricHandle.unref();
};

const stopQueueMetrics = () => {
  metricHandle && (clearInterval(metricHandle), metricHandle = null);
};

async function scheduleAnalysis(err, ctx) {
  startAdviceCleanup();
  
  const idle = limit.activeCount === 0 && limit.pendingCount === 0;
  const total = limit.pendingCount + limit.activeCount;
  
  if (total >= QUEUE_LIMIT) {
    queueRejectCount++;
    (await logger).warn(`analysis queue full pending ${limit.pendingCount} active ${limit.activeCount}`);
    return Promise.reject(new Error('queue full'));
  }
  
  const run = limit(() => analyzeError(err, ctx));
  
  if (idle) startQueueMetrics();
  
  await run.finally(() => {
    if (limit.activeCount === 0 && limit.pendingCount === 0) stopQueueMetrics();
  });
  
  return run;
}

const getQueueRejectCount = () => queueRejectCount;

const clearAdviceCache = () => {
  adviceCache.clear();
  adviceCache.size === 0 && stopAdviceCleanup();
};

const purgeExpiredAdvice = () => {
  if (CACHE_TTL_SECONDS === 0 || ADVICE_CACHE_LIMIT === 0) return;
  adviceCache.purgeStale();
  adviceCache.size === 0 && stopAdviceCleanup();
};

const getQueueLength = () => limit.pendingCount;

async function postWithRetry(url, data, opts, capMs) {
  const retries = config.getInt('QERRORS_RETRY_ATTEMPTS');
  const base = config.getInt('QERRORS_RETRY_BASE_MS');
  const cap = capMs !== undefined ? capMs : config.getInt('QERRORS_RETRY_MAX_MS', 0);
  
  for (let i = 0; i <= retries; i++) {
    try {
      return await axiosInstance.post(url, data, opts);
    } catch (err) {
      if (i >= retries) throw err;
      
      const jitter = Math.random() * base;
      let wait = base * 2 ** i + jitter;
      
      if (err.response && (err.response.status === 429 || err.response.status === 503)) {
        const retryAfter = err.response.headers?.['retry-after'];
        if (retryAfter) {
          const secs = Number(retryAfter);
          if (!Number.isNaN(secs)) {
            wait = secs * 1000;
          } else {
            const date = Date.parse(retryAfter);
            if (!Number.isNaN(date)) {
              wait = date - Date.now();
            }
          }
        } else {
          wait *= 2;
        }
      }
      
      if (cap > 0 && wait > cap) {
        wait = cap;
      }
      
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

async function analyzeError(error, contextString) {
  if (typeof error.name === 'string' && error.name.includes('AxiosError')) {
    verboseLog(`Axios Error`);
    return null;
  }
  
  verboseLog(`qerrors error analysis is running for error name: "${error.uniqueErrorName}", error message: "${error.message}", with context: "${contextString}"`);
  
  if (ADVICE_CACHE_LIMIT !== 0 && !error.qerrorsKey) {
    error.qerrorsKey = crypto.createHash('sha256').update(`${error.message}${error.stack}`).digest('hex');
  }
  
  if (ADVICE_CACHE_LIMIT !== 0) {
    const cached = adviceCache.get(error.qerrorsKey);
    if (cached) {
      verboseLog(`cache hit for ${error.uniqueErrorName}`);
      return cached;
    }
  }
  
  const aiManager = getAIModelManager();
  const currentProvider = aiManager.getCurrentModelInfo().provider;
  let requiredApiKey, missingKeyMessage;
  
  if (currentProvider === 'google') {
    requiredApiKey = process.env.GEMINI_API_KEY;
    missingKeyMessage = 'Missing GEMINI_API_KEY in environment variables.';
  } else {
    requiredApiKey = process.env.OPENAI_API_KEY;
    missingKeyMessage = 'Missing OPENAI_API_KEY in environment variables.';
  }
  
  if (!requiredApiKey) {
    if (!warnedMissingToken) {
      console.error(missingKeyMessage);
      warnedMissingToken = true;
    }
    return null;
  }
  
  const truncatedStack = (error.stack || '').split('\n').slice(0, 20).join('\n');
  const errorPrompt = `Analyze this error and provide debugging advice. You must respond with a valid JSON object containing an "advice" field with a concise solution: Error: ${error.name} - ${error.message} Context: ${contextString} Stack: ${truncatedStack}`;
  
  try {
    const advice = await aiManager.analyzeError(errorPrompt);
    if (advice) {
      verboseLog(`qerrors is returning advice for the error name: "${error.uniqueErrorName}", with the error message: "${error.message}", with context: "${contextString}"`);
      verboseLog(`${error.uniqueErrorName} ${JSON.stringify(advice)}`);
      
      if (ADVICE_CACHE_LIMIT !== 0) {
        adviceCache.set(error.qerrorsKey, advice);
        startAdviceCleanup();
      }
      
      return advice;
    } else {
      verboseLog(`No advice generated by AI model for ${error.uniqueErrorName}: ${error.message}`);
      return null;
    }
  } catch (aiError) {
    verboseLog(`AI analysis failed for ${error.uniqueErrorName}: ${aiError.message}`);
    return null;
  }
}

async function qerrors(error, context, req, res, next) {
  if (!error) {
    console.warn('qerrors called without an error object');
    return;
  }
  
  context = context || 'unknown context';
  const contextString = stringifyContext(context);
  const uniqueErrorName = `ERROR:${error.name}_${randomUUID()}`;
  
  verboseLog(`qerrors is running for error message: "${error.message}", with context: "${contextString}", assigning it the unique error name: "${uniqueErrorName}"`);
  
  const timestamp = new Date().toISOString();
  const { message = 'An error occurred', statusCode = 500, isOperational = true } = error;
  
  const errorLog = {
    uniqueErrorName,
    timestamp,
    message,
    statusCode,
    isOperational,
    context: contextString,
    stack: error.stack
  };
  
  error.uniqueErrorName = uniqueErrorName;
  
  (await logger).error(errorLog);
  
  if (res && !res.headersSent) {
    const acceptHeader = req?.headers?.['accept'] || null;
    
    if (acceptHeader && acceptHeader.includes('text/html')) {
      const safeMsg = escapeHtml(message);
      const safeStack = escapeHtml(error.stack || 'No stack trace available');
      const htmlErrorPage = `<!DOCTYPE html><html><head><title>Error: ${statusCode}</title><style>body { font-family: sans-serif; padding: 2em; } .error { color: #d32f2f; } pre { background: #f5f5f5; padding: 1em; border-radius: 4px; overflow: auto; }</style></head><body><h1 class="error">Error: ${statusCode}</h1><h2>${safeMsg}</h2><pre>${safeStack}</pre></body></html>`;
      res.status(statusCode).send(htmlErrorPage);
    } else {
      res.status(statusCode).json({ error: errorLog });
    }
  }
  
  if (next) {
    if (!res || !res.headersSent) {
      next(error);
    }
  }
  
  Promise.resolve()
    .then(() => scheduleAnalysis(error, contextString))
    .catch(async (analysisErr) => (await logger).error(analysisErr));
  
  verboseLog(`qerrors ran`);
}

async function logErrorWithSeverity(error, functionName, context = {}, severity = errorTypes.ErrorSeverity.MEDIUM) {
  const logContext = {
    ...context,
    severity,
    timestamp: new Date().toISOString(),
    requestId: context.requestId || errorTypes.getRequestId(context.req)
  };
  
  await qerrors(error, functionName, logContext);
  
  if (severity === errorTypes.ErrorSeverity.CRITICAL) {
    console.error(`CRITICAL ERROR in ${functionName}:`, { error: error.message || error, context: logContext });
  } else if (severity === errorTypes.ErrorSeverity.HIGH) {
    console.error(`HIGH SEVERITY ERROR in ${functionName}:`, { error: error.message || error, context: logContext });
  }
}

async function handleControllerError(res, error, functionName, context = {}, userMessage = null) {
  const errorType = error.type || errorTypes.ErrorTypes.SYSTEM;
  const severity = errorTypes.ERROR_SEVERITY_MAP[errorType];
  const statusCode = errorTypes.ERROR_STATUS_MAP[errorType];
  
  await logErrorWithSeverity(error, functionName, context, severity);
  
  const errorResponse = errorTypes.createStandardError(
    error.code || 'INTERNAL_ERROR',
    userMessage || error.message || 'An internal error occurred',
    errorType,
    context
  );
  
  errorTypes.sendErrorResponse(res, statusCode, errorResponse);
}

async function withErrorHandling(operation, functionName, context = {}, fallback = null) {
  try {
    const result = await operation();
    verboseLog(`${functionName} completed successfully`);
    return result;
  } catch (error) {
    const severity = error.severity || errorTypes.ErrorSeverity.MEDIUM;
    await logErrorWithSeverity(error, functionName, context, severity);
    return fallback;
  }
}

module.exports = qerrors;
module.exports.analyzeError = analyzeError;
module.exports.axiosInstance = axiosInstance;
module.exports.postWithRetry = postWithRetry;
module.exports.getQueueRejectCount = getQueueRejectCount;
module.exports.clearAdviceCache = clearAdviceCache;
module.exports.purgeExpiredAdvice = purgeExpiredAdvice;
module.exports.startAdviceCleanup = startAdviceCleanup;
module.exports.stopAdviceCleanup = stopAdviceCleanup;
module.exports.startQueueMetrics = startQueueMetrics;
module.exports.stopQueueMetrics = stopQueueMetrics;
module.exports.getQueueLength = getQueueLength;
module.exports.logErrorWithSeverity = logErrorWithSeverity;
module.exports.handleControllerError = handleControllerError;
module.exports.withErrorHandling = withErrorHandling;
module.exports.errorTypes = errorTypes;

const getAdviceCacheLimit = () => ADVICE_CACHE_LIMIT;
module.exports.getAdviceCacheLimit = getAdviceCacheLimit;