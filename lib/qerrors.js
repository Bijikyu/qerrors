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

const logger = require('./logger'); //centralized winston logger configuration
const axios = require('axios'); //HTTP client used for OpenAI API calls
const http = require('http'); //node http for agent keep alive
const https = require('https'); //node https for agent keep alive
const crypto = require('crypto'); //node crypto for hashing cache keys
const { randomUUID } = require('crypto'); //import UUID generator for unique names
const pLimit = require('p-limit'); //lightweight promise queue for concurrency control


function verboseLog(msg) { //conditional console output helper
        if (config.getEnv('QERRORS_VERBOSE') === 'true') console.log(msg); //only log when enabled
}


const parsedLimit = config.getInt('QERRORS_CACHE_LIMIT', 0); //parse limit with zero allowed
const ADVICE_CACHE_LIMIT = parsedLimit === 0 ? 0 : parsedLimit; //0 disables cache otherwise use parsed limit

const adviceCache = new Map(); //Map used for LRU cache implementation

let warnedMissingToken = false; //track if missing token message already logged

const axiosInstance = axios.create({ //axios instance with keep alive agents
        httpAgent: new http.Agent({ keepAlive: true, maxSockets: config.getInt('QERRORS_MAX_SOCKETS') }), //reuse http connections with limit
        httpsAgent: new https.Agent({ keepAlive: true, maxSockets: config.getInt('QERRORS_MAX_SOCKETS') }), //reuse https connections with limit
        timeout: config.getInt('QERRORS_TIMEOUT') //abort request after timeout
});



const limit = pLimit(config.getInt('QERRORS_CONCURRENCY')); //create limiter with env based concurrency

let queueRejectCount = 0; //track how many analyses the queue rejects



async function scheduleAnalysis(err, ctx) { //limit analyzeError concurrency
        const conc = config.getInt('QERRORS_CONCURRENCY'); //read concurrency limit
        if (limit.pendingCount >= config.getInt('QERRORS_QUEUE_LIMIT') && limit.activeCount >= conc) { queueRejectCount++; logger.warn('analysis queue full'); return Promise.reject(new Error('queue full')); } //(reject when queue and active exceed limits)
        return limit(() => analyzeError(err, ctx)); //queue via p-limit and return its promise

}

function getQueueRejectCount() { return queueRejectCount; } //expose reject count

function escapeHtml(str) { //escape characters for safe html insertion
        return String(str).replace(/[&<>"]/g, (ch) => { //(replace &,<,>," with entities)
                if (ch === '&') { return '&amp;'; }
                if (ch === '<') { return '&lt;'; }
                if (ch === '>') { return '&gt;'; }
                if (ch === '"') { return '&quot;'; }
                return ch;
        });
}

async function postWithRetry(url, data, opts) { //post wrapper with retry logic
        const retries = config.getInt('QERRORS_RETRY_ATTEMPTS'); //default retry count
        const base = config.getInt('QERRORS_RETRY_BASE_MS'); //base delay ms
        for (let i = 0; i <= retries; i++) { //attempt request with retries
                try { return await axiosInstance.post(url, data, opts); } //(try post once)
                catch (err) { if (i >= retries) throw err; } //throw when out of retries
                const jitter = Math.random() * base; //random jitter added to delay
                const wait = base * 2 ** i + jitter; //compute exponential delay with jitter
                await new Promise(r => setTimeout(r, wait)); //pause before next attempt
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
 * @param {string} context - Contextual information about where/when the error occurred
 * @returns {Promise<Object|null>} - AI-generated advice object or null if analysis fails or is skipped for Axios errors //(update return description)
 */
async function analyzeError(error, context) {
	// Prevent infinite loops by avoiding analysis of network errors from our own API calls
	// This is critical because axios errors during AI analysis would trigger more analysis
        if (typeof error.name === 'string' && error.name.includes('AxiosError')) { //(skip axios error objects early)
                verboseLog(`Axios Error`); //(log axios detection for analysis skip)
                return null; //(avoid API call when axios error encountered)
        };

        // Log analysis attempt for debugging and tracking purposes
        // Multi-line format improves readability in console output
        verboseLog(`qerrors error analysis is running for
                        error name: "${error.uniqueErrorName}",
                        error message: "${error.message}",
                        with context: "${context}"`);

        if (ADVICE_CACHE_LIMIT !== 0 && !error.qerrorsKey) { //skip hashing when cache disabled then generate key
                error.qerrorsKey = crypto.createHash('sha256').update(`${error.message}${error.stack}`).digest('hex'); //hash message and stack for caching
        }

        if (ADVICE_CACHE_LIMIT !== 0 && adviceCache.has(error.qerrorsKey)) { //skip api call when caching enabled and hit
                const cached = adviceCache.get(error.qerrorsKey); //retrieve cached entry
                adviceCache.delete(error.qerrorsKey); //move to most recent for LRU
                adviceCache.set(error.qerrorsKey, cached); //reinsert to maintain order
                verboseLog(`cache hit for ${error.uniqueErrorName}`); //log cache usage
                return cached; //return cached advice
        }

        // Graceful degradation when API token is not available
        // Only log once to avoid repeated console noise on subsequent calls
        if (!process.env.OPENAI_TOKEN) {
                if (!warnedMissingToken) { //check if warning already logged
                        console.error(`Missing OPENAI_TOKEN in environment variables.`); //inform developer about missing token
                        warnedMissingToken = true; //set flag so we do not warn again
                }
                return null; //skip analysis when token absent
        }
	
        // Carefully crafted prompt that optimizes for practical debugging advice
        // Specific instructions prevent unhelpful generic responses and formatting issues
        // Context inclusion helps AI understand the error's environment
        const truncatedStack = (error.stack || '').split('\n').slice(0, 20).join('\n'); // (limit stack trace to 20 lines for smaller payloads)
        const errorPrompt = `Analyze this error (${error.name}) that gave this message (${error.message}) and provide suggestions to fix it:\n\n${truncatedStack}
	that happened in this context: ${context}. In your response, realize this is 
	being printed to console logging, so do not include punctuation or symbols 
	aimed at embedding or formatting such as quotation marks or markdown that will not work in an app's logging. 
	This response is intended to be read by a software developer debugging. Do not give basic advice such as 
	"test the fix"; the dev knows the basics of their job, advise on the error 
	and only the error. Do not use blank lines.`;
	
	// OpenAI API call with optimized parameters for error analysis
	// Model choice balances capability with cost and response time
	// Parameters tuned for creative but focused debugging suggestions

	
        // Extract advice with fallback for API response failures
        let response; //will hold axios response
        const openaiBody = { //payload for OpenAI API
                model: 'gpt-4.1', // latest model for best analysis quality
                messages: [{ role: 'user', content: errorPrompt }], //prompt to analyze error
                response_format: { type: 'json_object' }, //structured response expected
                temperature: 1, //creative but focused suggestions
                max_tokens: 2048, //limit response length
                top_p: 1, //full vocabulary access
                frequency_penalty: 0, //allow repetition when useful
                presence_penalty: 0 //permit technical term usage
        };
        try {
                response = await module.exports.postWithRetry('https://api.openai.com/v1/chat/completions', openaiBody, { //use helper for retries
                        headers: {
                                'Authorization': `Bearer ${process.env.OPENAI_TOKEN}`,
                                'Content-Type': 'application/json'
                        }
                });
        } catch (apiErr) {
                verboseLog(`OpenAI request failed after retries`); //log final failure
                return null; //abort analysis when request fails entirely
        }
        // Default message ensures function always returns something useful
        let advice = response?.data?.choices?.[0]?.message?.content || null; //capture raw advice which may be JSON string
        if (typeof advice === 'string') { //convert string to object when possible
                try { advice = JSON.parse(advice); } catch { advice = null; }; //ignore parse errors gracefully

        }
	
	// Validate response structure and handle different API response formats
	// This defensive programming handles potential API changes or unexpected responses
        if (advice && typeof advice === 'object') {
                verboseLog(`qerrors is returning advice for
                                the error name: "${error.uniqueErrorName}",
                                with the error message: "${error.message}",
                                with context: "${context}"`);
		
		// Handle structured response with data property
                if (advice.data) {
                        verboseLog(`${error.uniqueErrorName} ${JSON.stringify(advice.data)}`); //(stringify advice.data for consistent logging)
                        if (ADVICE_CACHE_LIMIT !== 0) { //only cache when limit not zero
                                adviceCache.set(error.qerrorsKey, advice); //store new advice in cache
                                if (adviceCache.size > ADVICE_CACHE_LIMIT) { adviceCache.delete(adviceCache.keys().next().value); } //evict oldest when limit exceeded
                        }
                        return advice;
                } else if (advice) {
                        // Handle direct advice object
                        verboseLog(`${error.uniqueErrorName} ${JSON.stringify(advice)}`); //(stringify advice object for consistent logging)
                        if (ADVICE_CACHE_LIMIT !== 0) { //cache only if enabled
                                adviceCache.set(error.qerrorsKey, advice); //cache direct advice
                                if (adviceCache.size > ADVICE_CACHE_LIMIT) { adviceCache.delete(adviceCache.keys().next().value); } //keep cache size
                        }
                        return advice;
                }
	} else {
		// Log analysis failure for debugging and monitoring
		// Provides enough detail to diagnose API issues without exposing sensitive data
                verboseLog(`Problem in analyzeError function of qerrors for ${error.uniqueErrorName}: ${error.message}`); //log analysis failure
		return null; // Graceful failure allows application to continue
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
 * @param {string} context - Descriptive context about where/when error occurred
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
	
	// Generate unique error identifier for tracking and correlation
	// Format: "ERROR: " + errorType + timestamp + randomString
	// This allows linking related log entries and tracking error resolution
        const uniqueErrorName = `ERROR:${error.name}_${randomUUID()}`; //generate identifier via crypto uuid
	
	// Log error processing start with full context
	// Multi-line format improves readability in log aggregation systems
        verboseLog(`qerrors is running for error message: "${error.message}",
                        with context: "${context}",
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
		context, // Contextual information for debugging
		stack: error.stack // Full stack trace for technical debugging
	};
	
	// Augment original error object with unique identifier
	// This allows downstream code to reference this specific error instance
	error.uniqueErrorName = uniqueErrorName;
	
	// Log error through winston logger for persistent storage and processing
	// Uses structured logging format compatible with log aggregation systems
	logger.error(errorLog);
	

	
	// HTTP response handling - only if Express response object is available
	// Check headersSent prevents "Cannot set headers after they are sent" errors
	if (res && !res.headersSent) {
		// Content negotiation based on client's Accept header
		// Provides appropriate response format for different client types
                const acceptHeader = req?.headers?.['accept'] || null; //inspect client preference for HTML
		
                if (acceptHeader && acceptHeader.includes('text/html')) {
                        const safeMsg = escapeHtml(message); //(escape message for html page)
                        const safeStack = escapeHtml(error.stack || 'No stack trace available'); //(escape stack for html)
                        // Generate HTML error page for browser requests
                        // Provides user-friendly error display with technical details for developers
                        // Inline CSS ensures styling works without external dependencies
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
                        `;
			res.status(statusCode).send(htmlErrorPage);
		} else {
			// JSON response for API clients and AJAX requests
			// Structured format enables programmatic error handling
			res.status(statusCode).json({ error: errorLog });
		}
	}
	
	// Express middleware chain continuation
	// Only call next if headers haven't been sent to prevent response conflicts
	// This maintains Express middleware contract while preventing double responses
        if (next) {
                if (!res || !res.headersSent) {
                        next(error); // Pass error to next middleware for additional processing
                }
        }

        Promise.resolve() //start async analysis without blocking response
                .then(() => scheduleAnalysis(error, context)) //invoke queued analysis after sending response
                .catch((analysisErr) => logger.error(analysisErr)); //log any scheduleAnalysis failures

        verboseLog(`qerrors ran`); //log completion after scheduling analysis
}

// Export main qerrors function as default export
// This provides the primary interface that most users will interact with
module.exports = qerrors;

// Expose analyzeError for testing and advanced usage scenarios
// This allows unit testing of the AI analysis functionality in isolation
// Also enables advanced users to call error analysis without full qerrors processing
module.exports.analyzeError = analyzeError;
module.exports.axiosInstance = axiosInstance; //export axios instance for testing
module.exports.postWithRetry = postWithRetry; //export retry helper for tests
module.exports.getQueueRejectCount = getQueueRejectCount; //export queue reject count
