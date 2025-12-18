'use strict';

const errorTypes = require('./errorTypes');
const logger = require('./logger');
const { randomUUID } = require('crypto');
const escapeHtml = require('escape-html');
const localVars = require('../config/localVars');

// Import specialized modules
const { scheduleAnalysis, getQueueRejectCount, getQueueLength } = require('./qerrorsQueue');
const { clearAdviceCache, purgeExpiredAdvice, startAdviceCleanup, stopAdviceCleanup } = require('./qerrorsCache');
const { axiosInstance, postWithRetry } = require('./qerrorsHttpClient');
const { analyzeError } = require('./qerrorsAnalysis');
const { ADVICE_CACHE_LIMIT } = require('./qerrorsConfig');

// Import shared utilities
const { stringifyContext, verboseLog } = require('./shared/logging');
const { createErrorContext } = require('./shared/errorContext');
const { sanitizeErrorMessage, sanitizeContextForLog } = require('./shared/security');

// Helper function for async logger access
async function logAsync(level, message) {
  try {
    const log = await logger;
    log[level](message);
  } catch (err) {
    console.error("Logger error:", String(err.message || "").substring(0, 100));
  }
}

/**
 * Error logger middleware that logs errors and provides AI-powered suggestions.
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 * @param {Object} [req] - Express request object (optional)
 * @param {Object} [res] - Express response object (optional)
 * @param {Function} [next] - Express next function (optional)
 * @returns {Promise<void>}
 * @throws {Error} When logging system fails completely
 * @throws {TypeError} When error parameter is not an Error object
 */
async function qerrors(error, context, req, res, next) {
  if (!error) {
    console.warn('qerrors called without an error object');
    return;
  }
  
  context = context || 'unknown context';
  const contextString = stringifyContext(context);
  const uniqueErrorName = `ERROR:${error.name}_${randomUUID()}`;
  
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
  
  await logAsync('error', errorLog);
  
  if (res && !res.headersSent) {
    const acceptHeader = req?.headers?.['accept'] || null;
    
    if (acceptHeader && acceptHeader.includes('text/html')) {
      const safeMsg = escapeHtml(message);
      const safeStack = escapeHtml(error.stack || 'No stack trace available');
      const safeStatusCode = escapeHtml(String(statusCode));
      const htmlErrorPage = `<!DOCTYPE html><html><head><title>Error: ${safeStatusCode}</title><style>body { font-family: sans-serif; padding: 2em; } .error { color: #d32f2f; } pre { background: #f5f5f5; padding: 1em; border-radius: 4px; overflow: auto; }</style></head><body><h1 class="error">Error: ${safeStatusCode}</h1><h2>${safeMsg}</h2><pre>${safeStack}</pre></body></html>`;
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
    .then(() => scheduleAnalysis(error, contextString, analyzeError))
    .catch(async (analysisErr) => await logAsync('error', analysisErr));
  
  verboseLog(`qerrors ran`);
}

async function logErrorWithSeverity(error, functionName, context = {}, severity = errorTypes.ErrorSeverity.MEDIUM) {
  const logContext = createErrorContext(context, severity, context.req, errorTypes.getRequestId);
  
  await qerrors(error, functionName, logContext.req, logContext.res, logContext.next);
  
  if (severity === errorTypes.ErrorSeverity.CRITICAL) {
    console.error("CRITICAL ERROR in:", String(functionName || "unknown").substring(0, 50));
  } else if (severity === errorTypes.ErrorSeverity.HIGH) {
    console.error("HIGH SEVERITY ERROR in:", String(functionName || "unknown").substring(0, 50));
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
module.exports.getQueueLength = getQueueLength;
module.exports.logErrorWithSeverity = logErrorWithSeverity;
module.exports.handleControllerError = handleControllerError;
module.exports.withErrorHandling = withErrorHandling;
module.exports.errorTypes = errorTypes;

const getAdviceCacheLimit = () => ADVICE_CACHE_LIMIT;
module.exports.getAdviceCacheLimit = getAdviceCacheLimit;