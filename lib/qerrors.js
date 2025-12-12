/**
 * Core qerrors module - provides intelligent error analysis using OpenAI's API
 * 
 * This module implements a sophisticated error handling system that not only logs errors
 * but also provides AI-powered analysis and suggestions for resolution. The design balances
 * practical error handling needs with advanced AI capabilities.
 * 
 * Key design decisions:
 * - Uses OpenAI GPT models for error analysis to provide contextual debugging help
 * - Implements graceful degradation when AI services are unavailable
 * - Generates unique error identifiers for tracking and correlation
 * - Supports both Express middleware usage and standalone error handling
 */


'use strict'; //(enable strict mode for improved error detection)
const config = require('./config'); //load default environment variables and helpers
const errorTypes = require('./errorTypes'); //error classification and handling utilities
const pLimit = require('p-limit').default; //concurrency limiter with identical API

const logger = require('./logger'); //centralized winston logger configuration promise
const axios = require('axios'); //HTTP client used for OpenAI API calls (legacy support)
const http = require('http'); //node http for agent keep alive
const https = require('https'); //node https for agent keep alive
const { getAIModelManager } = require('./aiModelManager'); //LangChain-based AI model manager
const crypto = require('crypto'); //node crypto for hashing cache keys
const { randomUUID } = require('crypto'); //import UUID generator for unique names
const escapeHtml = require('escape-html'); //secure HTML escaping library
/**
 * Creates a custom concurrency limiter for controlling OpenAI API calls
 * 
 * This implementation replaces the p-limit npm package to reduce dependencies
 * while providing exactly the functionality needed for qerrors. The design
 * prioritizes simplicity and reliability over feature completeness.
 * 
 * Design rationale:
 * - Custom implementation reduces npm dependency footprint
 * - Simple queue structure using Denque provides O(1) operations
 * - Direct control over queuing logic enables specific behavior needed for error analysis
 * - Exposed metrics allow monitoring of queue health in production
 * 
 * @param {number} max - Maximum number of concurrent operations
 * @returns {Function} Limiter function that accepts async operations
 */
const { LRUCache } = require('lru-cache'); //LRU cache class used for caching advice


/**
 * Conditional logging utility for debugging and development feedback
 * 
 * This function provides optional verbose output that can be enabled via environment
 * variable. It's designed to help developers understand qerrors behavior without
 * impacting production performance when disabled.
 * 
 * Design rationale:
 * - Environment-controlled logging prevents performance impact in production
 * - Direct console.log usage avoids logger dependency cycles
 * - Simple boolean check minimizes overhead when disabled
 * - Centralized control allows easy debugging toggle across entire module
 */
function verboseLog(msg) { //conditional console output helper for debugging without logger dependency
        if (config.getEnv('QERRORS_VERBOSE') === 'true') console.log(msg); //only log when enabled to avoid production noise
}

const { stringifyContext } = require('./utils'); //import context stringification utility

const rawConc = config.getInt('QERRORS_CONCURRENCY'); //(raw concurrency from env)
const rawQueue = config.getInt('QERRORS_QUEUE_LIMIT'); //(raw queue limit from env)

const SAFE_THRESHOLD = config.getInt('QERRORS_SAFE_THRESHOLD'); //limit considered safe for concurrency and queue without enforced minimum //(configurable)
const CONCURRENCY_LIMIT = Math.min(rawConc, SAFE_THRESHOLD); //(clamp concurrency to safe threshold)
const QUEUE_LIMIT = Math.min(rawQueue, SAFE_THRESHOLD); //(clamp queue limit to safe threshold)
if (rawConc > SAFE_THRESHOLD || rawQueue > SAFE_THRESHOLD) { logger.then(l => l.warn(`High qerrors limits clamped conc ${rawConc} queue ${rawQueue}`)); } //(warn when original limits exceed threshold)

const rawSockets = config.getInt('QERRORS_MAX_SOCKETS'); //raw sockets from env
const MAX_SOCKETS = Math.min(rawSockets, SAFE_THRESHOLD); //clamp sockets to safe threshold
if (rawSockets > SAFE_THRESHOLD) { logger.then(l => l.warn(`max sockets clamped ${rawSockets}`)); } //warn on clamp when limit exceeded

const rawFreeSockets = config.getInt('QERRORS_MAX_FREE_SOCKETS'); //raw free socket count from env //(new env)
const MAX_FREE_SOCKETS = Math.min(rawFreeSockets, SAFE_THRESHOLD); //clamp free sockets to safe threshold //(new const)
if (rawFreeSockets > SAFE_THRESHOLD) { logger.then(l => l.warn(`max free sockets clamped ${rawFreeSockets}`)); } //warn when clamped //(new warn)


const parsedLimit = config.getInt('QERRORS_CACHE_LIMIT', 0); //parse limit with zero allowed
const ADVICE_CACHE_LIMIT = parsedLimit === 0 ? 0 : Math.min(parsedLimit, SAFE_THRESHOLD); //clamp to safe threshold when >0
if (parsedLimit > SAFE_THRESHOLD) { logger.then(l => l.warn(`cache limit clamped ${parsedLimit}`)); } //warn after logger ready
const CACHE_TTL_SECONDS = config.getInt('QERRORS_CACHE_TTL', 0); //expire advice after ttl seconds when nonzero //(new ttl env)

const adviceCache = new LRUCache({ max: ADVICE_CACHE_LIMIT || 0, ttl: CACHE_TTL_SECONDS * 1000 }); //create cache with ttl and max settings

let warnedMissingToken = false; //track if missing token message already logged

const axiosInstance = axios.create({ //axios instance with keep alive agents
        httpAgent: new http.Agent({ keepAlive: true, maxSockets: MAX_SOCKETS, maxFreeSockets: MAX_FREE_SOCKETS }), //reuse http connections with max free limit //(updated agent)
        httpsAgent: new https.Agent({ keepAlive: true, maxSockets: MAX_SOCKETS, maxFreeSockets: MAX_FREE_SOCKETS }), //reuse https connections with max free limit //(updated agent)
        timeout: config.getInt('QERRORS_TIMEOUT') //abort request after timeout
});



const limit = pLimit(CONCURRENCY_LIMIT); //create limiter with stored concurrency using p-limit

let queueRejectCount = 0; //track how many analyses the queue rejects
let cleanupHandle = null; //hold interval id for periodic cache purge
let metricHandle = null; //store interval id for queue metric logging
const METRIC_INTERVAL_MS = config.getInt('QERRORS_METRIC_INTERVAL_MS', 0); //interval for metrics, zero disables

function startAdviceCleanup() { //(kick off periodic advice cleanup)
        if (CACHE_TTL_SECONDS === 0 || ADVICE_CACHE_LIMIT === 0 || cleanupHandle) { return; } //(skip when ttl or cache disabled or already scheduled)
        cleanupHandle = setInterval(purgeExpiredAdvice, CACHE_TTL_SECONDS * 1000); //(run purge at ttl interval)
        cleanupHandle.unref(); //(allow process exit without clearing interval)
}

function stopAdviceCleanup() { //(stop periodic purge when needed)
        if (!cleanupHandle) { return; } //(do nothing when no interval)
        clearInterval(cleanupHandle); //(cancel interval)
        cleanupHandle = null; //(reset handle state)
}

function logQueueMetrics() { //(write queue metrics to logger)
        logger.then(l => l.info(`metrics queueLength=${getQueueLength()} queueRejects=${getQueueRejectCount()}`));
        //(info level ensures operators can monitor queue health without triggering qerrors recursion on logging errors)
}

function startQueueMetrics() { //(begin periodic queue metric logging)
        if (metricHandle || METRIC_INTERVAL_MS === 0) { return; } //(avoid multiple intervals or disabled)
        metricHandle = setInterval(logQueueMetrics, METRIC_INTERVAL_MS); //(schedule logging every interval)
        metricHandle.unref(); //(allow process exit without manual cleanup)
}

function stopQueueMetrics() { //(halt metric emission)
        if (!metricHandle) { return; } //(no-op when not running)
        clearInterval(metricHandle); //(cancel metrics interval)
        metricHandle = null; //(reset handle state)
}



async function scheduleAnalysis(err, ctx) { //limit analyzeError concurrency
        startAdviceCleanup(); //(ensure cleanup interval scheduled once)
        const idle = limit.activeCount === 0 && limit.pendingCount === 0; //track if queue idle before scheduling
        const total = limit.pendingCount + limit.activeCount; //sum queued and active analyses
        if (total >= QUEUE_LIMIT) { queueRejectCount++; (await logger).warn(`analysis queue full pending ${limit.pendingCount} active ${limit.activeCount}`); return Promise.reject(new Error('queue full')); } //(reject when queue limit reached)
        const run = limit(() => analyzeError(err, ctx)); //queue via limiter and get promise
        if (idle) startQueueMetrics(); //(start metrics when queue transitions from idle)
        await run.finally(() => { if (limit.activeCount === 0 && limit.pendingCount === 0) stopQueueMetrics(); }); //(await finally to ensure proper cleanup timing)
        return run; //return scheduled promise
}

function getQueueRejectCount() { return queueRejectCount; } //expose reject count


function clearAdviceCache() { adviceCache.clear(); if (adviceCache.size === 0) { stopAdviceCleanup(); } } //empty cache and stop interval when empty

function purgeExpiredAdvice() { //trigger lru-cache cleanup cycle
        if (CACHE_TTL_SECONDS === 0 || ADVICE_CACHE_LIMIT === 0) { return; } //skip when ttl or cache disabled
        adviceCache.purgeStale(); if (adviceCache.size === 0) { stopAdviceCleanup(); } //remove expired entries and stop interval when empty
} //lru-cache handles its own batch logic

function getQueueLength() { return limit.pendingCount; } //expose queue length




async function postWithRetry(url, data, opts, capMs) { //post wrapper with retry logic and cap
        const retries = config.getInt('QERRORS_RETRY_ATTEMPTS'); //default retry count
        const base = config.getInt('QERRORS_RETRY_BASE_MS'); //base delay ms
        const cap = capMs !== undefined ? capMs : config.getInt('QERRORS_RETRY_MAX_MS', 0); //choose cap
        for (let i = 0; i <= retries; i++) { //attempt request with retries
                try { return await axiosInstance.post(url, data, opts); } //(try post once)
                catch (err) { //handle failure and compute wait
                        if (i >= retries) throw err; //throw when out of retries
                        const jitter = Math.random() * base; //random jitter added to delay
                        let wait = base * 2 ** i + jitter; //compute exponential delay with jitter
                        if (err.response && (err.response.status === 429 || err.response.status === 503)) { //detect rate limit
                                const retryAfter = err.response.headers?.['retry-after']; //header with wait seconds
                                if (retryAfter) { //parse header when provided
                                        const secs = Number(retryAfter); //numeric seconds when parsed
                                        if (!Number.isNaN(secs)) { wait = secs * 1000; } //use parsed seconds
                                        else {
                                                const date = Date.parse(retryAfter); //parse HTTP date string
                                                if (!Number.isNaN(date)) { wait = date - Date.now(); } //ms until retry date
                                        }
                                } else { wait *= 2; } //double delay when header missing
                        }
                        if (cap > 0 && wait > cap) { wait = cap; } //enforce cap when provided
                        await new Promise(r => setTimeout(r, wait)); //pause before next attempt
                }
        }
}
/**
 * Analyzes an error using OpenAI's API to provide intelligent debugging suggestions
 * 
 * This function represents the core AI-powered feature of qerrors. It sends error details
 * to OpenAI's API and returns actionable advice for developers.
 * 
 * Design rationale:
 * - Early return for AxiosErrors prevents infinite loops when network issues occur
 * - Environment variable check ensures graceful degradation without API keys
 * - Prompt engineering optimizes for practical, console-readable advice
 * - Response validation handles various API response formats safely
 * - Temperature=1 provides creative but relevant suggestions
 * - Max tokens=2048 balances detail with cost considerations
 * 
 * @param {Error} error - The error object containing name, message, and stack trace
 * @param {string} contextString - Contextual information already stringified by qerrors
 * @returns {Promise<Object|null>} - AI-generated advice object or null if analysis fails or is skipped for Axios errors //(update return description)
 */
async function analyzeError(error, contextString) {
        if (typeof error.name === 'string' && error.name.includes('AxiosError')) { //(skip axios error objects early to prevent infinite loops when our API calls fail)
                verboseLog(`Axios Error`); //(log axios detection for analysis skip)
                return null; //(avoid API call when axios error encountered)
        };

        verboseLog(`qerrors error analysis is running for
                        error name: "${error.uniqueErrorName}",
                        error message: "${error.message}",
                        with context: "${contextString}"`); //(log analysis attempt for debugging with pre-stringified context)

        if (ADVICE_CACHE_LIMIT !== 0 && !error.qerrorsKey) { //generate hash key when caching
                error.qerrorsKey = crypto.createHash('sha256').update(`${error.message}${error.stack}`).digest('hex'); //create cache key from message and stack
        }

        if (ADVICE_CACHE_LIMIT !== 0) { //lookup cached advice when enabled
                const cached = adviceCache.get(error.qerrorsKey); //fetch entry from lru-cache
                if (cached) { verboseLog(`cache hit for ${error.uniqueErrorName}`); return cached; } //return when present and valid
        }

        // Check for required API key based on current provider
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
        
        if (!requiredApiKey) { //(graceful degradation when API token unavailable)
                if (!warnedMissingToken) { //(check if warning already logged to avoid console spam)
                        console.error(missingKeyMessage); //(inform developer about missing token for current provider)
                        warnedMissingToken = true; //(set flag so we do not warn again on subsequent calls)
                }
                return null; //(skip analysis when token absent)
        }
        
        const truncatedStack = (error.stack || '').split('\n').slice(0, 20).join('\n'); //(limit stack trace to 20 lines for smaller API payloads and faster processing)
        const errorPrompt = `Analyze this error and provide debugging advice. You must respond with a valid JSON object containing an "advice" field with a concise solution:

Error: ${error.name} - ${error.message}
Context: ${contextString}
Stack: ${truncatedStack}`; //(JSON format prompt for structured response with explicit instruction)
        
        // Use LangChain for AI analysis (supports multiple models and providers)
        try {
                const aiManager = getAIModelManager();
                const advice = await aiManager.analyzeError(errorPrompt);
                
                if (advice) {
                        verboseLog(`qerrors is returning advice for
                                        the error name: "${error.uniqueErrorName}",
                                        with the error message: "${error.message}",
                                        with context: "${contextString}"`);
                        
                        verboseLog(`${error.uniqueErrorName} ${JSON.stringify(advice)}`);
                        if (ADVICE_CACHE_LIMIT !== 0) { adviceCache.set(error.qerrorsKey, advice); startAdviceCleanup(); }
                        return advice;
                } else {
                        verboseLog(`No advice generated by AI model for ${error.uniqueErrorName}: ${error.message}`);
                        return null;
                }
        } catch (aiError) {
                verboseLog(`AI analysis failed for ${error.uniqueErrorName}: ${aiError.message}`);
                return null; //(graceful failure allows application to continue without AI dependency)
        }
}

/**
 * Main qerrors function - comprehensive error handling with AI analysis and smart response handling
 * 
 * This is the primary entry point for error processing. It handles the complete error lifecycle:
 * logging, analysis, response generation, and middleware chain continuation.
 * 
 * Design philosophy:
 * - Works as both Express middleware and standalone error handler
 * - Generates unique identifiers for error tracking and correlation
 * - Provides intelligent response format detection (HTML vs JSON)
 * - Maintains Express middleware contract while adding AI capabilities
 * - Implements defensive programming to prevent secondary errors
 * 
 * @param {Error} error - The error object to process
 * @param {string|Object} context - Descriptive context about where/when error occurred; objects are JSON stringified
 * @param {Object} [req] - Express request object (optional, enables middleware features)
 * @param {Object} [res] - Express response object (optional, enables automatic responses)
 * @param {Function} [next] - Express next function (optional, enables middleware chaining)
 * @returns {Promise<void>}
 */
async function qerrors(error, context, req, res, next) {
        // Input validation - prevent processing null/undefined errors
        // Early return prevents downstream errors and provides clear feedback
        if (!error) {
                console.warn('qerrors called without an error object');
                return;
        }

        // Context defaulting ensures we always have meaningful error context
        // This helps with debugging and error correlation across logs
        context = context || 'unknown context';
        const contextString = stringifyContext(context); //normalize context using helper to avoid circular errors
        
        // Generate unique error identifier for tracking and correlation
        // Format: "ERROR: " + errorType + timestamp + randomString
        // This allows linking related log entries and tracking error resolution
        const uniqueErrorName = `ERROR:${error.name}_${randomUUID()}`; //generate identifier via crypto uuid
        
        // Log error processing start with full context
        // Multi-line format improves readability in log aggregation systems
        verboseLog(`qerrors is running for error message: "${error.message}",
                        with context: "${contextString}",
                        assigning it the unique error name: "${uniqueErrorName}"`);
        
        // Generate ISO timestamp for consistent log timing across time zones
        // This is critical for distributed systems and log correlation
        const timestamp = new Date().toISOString(); //create standardized timestamp for logs
        
        // Destructure error properties with sensible defaults
        // This pattern handles custom error objects that may lack standard properties
        // Default values prevent undefined fields in logs and responses
        const {
                message = 'An error occurred', // Generic fallback message
                statusCode = 500, // HTTP 500 for unspecified server errors
                isOperational = true, // Assume operational error unless specified otherwise
        } = error;
        
        // Create comprehensive error log object
        // Structure designed for JSON logging systems and error tracking services
        // Includes all essential debugging information in a standardized format
        const errorLog = {
                uniqueErrorName, // For correlation and tracking
                timestamp, // For chronological analysis
                message, // Human-readable error description
                statusCode, // HTTP status for web context
                isOperational, // Distinguishes expected vs unexpected errors
                context: contextString, // Contextual information for debugging now stringified
                stack: error.stack // Full stack trace for technical debugging
        };
        
        // Augment original error object with unique identifier
        // This allows downstream code to reference this specific error instance
        error.uniqueErrorName = uniqueErrorName;
        
        // Log error through winston logger for persistent storage and processing
        // Uses structured logging format compatible with log aggregation systems
        (await logger).error(errorLog);
        

        
        // HTTP response handling - only if Express response object is available
        // Check headersSent prevents "Cannot set headers after they are sent" errors
        if (res && !res.headersSent) { //(send response only if headers not already sent to prevent double response errors)
                const acceptHeader = req?.headers?.['accept'] || null; //(inspect client preference for HTML via content negotiation for appropriate response format)
                
                if (acceptHeader && acceptHeader.includes('text/html')) { //(browser client detected via Accept header)
                        const safeMsg = escapeHtml(message); //(escape message for safe HTML display preventing XSS)
                        const safeStack = escapeHtml(error.stack || 'No stack trace available'); //(escape stack trace for safe HTML rendering)
                        const htmlErrorPage = `
                                <!DOCTYPE html>
                                <html>
                                <head>
                                        <title>Error: ${statusCode}</title>
                                        <style>
                                                body { font-family: sans-serif; padding: 2em; }
                                                .error { color: #d32f2f; }
                                                pre { background: #f5f5f5; padding: 1em; border-radius: 4px; overflow: auto; }
                                        </style>
                                </head>
                                <body>
                                        <h1 class="error">Error: ${statusCode}</h1>
                                        <h2>${safeMsg}</h2>
                                        <pre>${safeStack}</pre>
                                </body>
                                </html>
                        `; //(generate HTML error page for browser requests with inline CSS to avoid external dependencies)
                        res.status(statusCode).send(htmlErrorPage); //(send user-friendly HTML error page with technical details for developers)
                } else {
                        res.status(statusCode).json({ error: errorLog }); //(JSON response for API clients and AJAX requests with structured format for programmatic error handling)
                }
        }
        if (next) { //(Express middleware chain continuation when next function provided)
                if (!res || !res.headersSent) { //(only call next if headers not sent to prevent response conflicts)
                        next(error); //(pass error to next middleware for additional processing while maintaining Express contract)
                }
        }

        Promise.resolve() //(start async analysis without blocking response to maintain fast error handling)
                .then(() => scheduleAnalysis(error, contextString)) //(invoke queued analysis after sending response with context string)
                .catch(async (analysisErr) => (await logger).error(analysisErr)); //(log any scheduleAnalysis failures to prevent silent errors)

        verboseLog(`qerrors ran`); //(log completion after scheduling analysis for debugging flow)
}

/**
 * Logs error with appropriate severity and context using qerrors integration
 * 
 * Design rationale: Centralized error logging ensures consistent log format
 * and enables proper monitoring and alerting. Different severities enable
 * appropriate routing to different logging destinations.
 * 
 * @param {Object} error - Error object or Error instance
 * @param {string} functionName - Name of function where error occurred
 * @param {Object} context - Request context and additional information
 * @param {string} severity - Error severity level from ErrorSeverity
 */
async function logErrorWithSeverity(error, functionName, context = {}, severity = errorTypes.ErrorSeverity.MEDIUM) { //log with severity context using qerrors
        const logContext = { //build enhanced context with severity information
                ...context,
                severity, //attach severity for filtering and alerting
                timestamp: new Date().toISOString(), //standardized timestamp
                requestId: context.requestId || errorTypes.getRequestId(context.req) //ensure request correlation
        };

        // Use existing qerrors for consistent logging and AI analysis
        await qerrors(error, functionName, logContext);

        // Additional console logging based on severity for immediate visibility
        if (severity === errorTypes.ErrorSeverity.CRITICAL) {
                console.error(`CRITICAL ERROR in ${functionName}:`, { //immediate critical error visibility
                        error: error.message || error,
                        context: logContext
                });
        } else if (severity === errorTypes.ErrorSeverity.HIGH) {
                console.error(`HIGH SEVERITY ERROR in ${functionName}:`, { //immediate high severity visibility
                        error: error.message || error,
                        context: logContext
                });
        }
}

/**
 * Handles controller errors with standardized response using qerrors integration
 * 
 * Design rationale: Provides consistent error handling across all controllers
 * while maintaining existing qerrors functionality. Automatically determines
 * appropriate status codes and response format based on error classification.
 * 
 * @param {Object} res - Express response object
 * @param {Object} error - Error object or Error instance
 * @param {string} functionName - Name of function where error occurred
 * @param {Object} context - Request context
 * @param {string} userMessage - Optional user-friendly message override
 */
async function handleControllerError(res, error, functionName, context = {}, userMessage = null) { //send standardized error response with qerrors integration
        const errorType = error.type || errorTypes.ErrorTypes.SYSTEM; //default to system error when type missing
        const severity = errorTypes.ERROR_SEVERITY_MAP[errorType]; //determine severity from error type
        const statusCode = errorTypes.ERROR_STATUS_MAP[errorType]; //determine HTTP status from error type

        // Log the error with appropriate severity using qerrors
        await logErrorWithSeverity(error, functionName, context, severity);

        // Create standardized error response object
        const errorResponse = errorTypes.createStandardError(
                error.code || 'INTERNAL_ERROR', //error code for programmatic handling
                userMessage || error.message || 'An internal error occurred', //user-friendly message
                errorType, //error classification
                context //debugging context
        );

        // Send standardized JSON response using errorTypes utility
        errorTypes.sendErrorResponse(res, statusCode, errorResponse);
}

/**
 * Wraps async operations with standardized error handling using qerrors
 * 
 * Design rationale: Reduces boilerplate code in controllers while ensuring
 * consistent error handling through qerrors. Automatically catches and handles
 * errors according to their type and severity.
 * 
 * @param {Function} operation - Async operation to execute
 * @param {string} functionName - Name for logging purposes
 * @param {Object} context - Request context
 * @param {*} fallback - Fallback value on error (optional)
 * @returns {*} Operation result or fallback value
 */
async function withErrorHandling(operation, functionName, context = {}, fallback = null) { //execute operation with qerrors safety net
        try {
                const result = await operation(); //execute provided async operation
                verboseLog(`${functionName} completed successfully`); //log successful completion when verbose
                return result; //return operation result
        } catch (error) {
                // Determine error severity and log through qerrors
                const severity = error.severity || errorTypes.ErrorSeverity.MEDIUM; //use error severity or default
                await logErrorWithSeverity(error, functionName, context, severity); //log with qerrors integration
                return fallback; //return fallback value on error
        }
}

module.exports = qerrors; //(export main qerrors function as default export providing primary interface most users interact with)

module.exports.analyzeError = analyzeError; //(expose analyzeError for advanced usage scenarios)
module.exports.axiosInstance = axiosInstance; //export axios instance for advanced usage
module.exports.postWithRetry = postWithRetry; //export retry helper for advanced usage
module.exports.getQueueRejectCount = getQueueRejectCount; //export queue reject count

module.exports.clearAdviceCache = clearAdviceCache; //export cache clearing function
module.exports.purgeExpiredAdvice = purgeExpiredAdvice; //export ttl cleanup function
module.exports.startAdviceCleanup = startAdviceCleanup; //export cleanup scheduler
module.exports.stopAdviceCleanup = stopAdviceCleanup; //export cleanup canceller

module.exports.startQueueMetrics = startQueueMetrics; //export metrics scheduler
module.exports.stopQueueMetrics = stopQueueMetrics; //export metrics canceller

module.exports.getQueueLength = getQueueLength; //export queue length
function getAdviceCacheLimit() { return ADVICE_CACHE_LIMIT; } //expose clamped cache limit for advanced usage
module.exports.getAdviceCacheLimit = getAdviceCacheLimit; //export clamp accessor

module.exports.logErrorWithSeverity = logErrorWithSeverity; //export severity-based logging function
module.exports.handleControllerError = handleControllerError; //export standardized controller error handler
module.exports.withErrorHandling = withErrorHandling; //export async operation wrapper
module.exports.errorTypes = errorTypes; //export error classification utilities

