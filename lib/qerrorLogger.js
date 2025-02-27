const logger = require('./logger');
const axios = require('axios');


async function analyzeError(error, context) {
	console.log(`analyzeError is running with context: ${context}`); // Log the call details
	if (!process.env.OPENAI_TOKEN) {
		console.error("analyzeError: Missing OPENAI_TOKEN in environment variables.");
		return null;
	}
	const errorPrompt = `Analyze this error and provide suggestions to fix it:\n\n${error.stack} 
	that happened in this context: ${context}. In your response, realize this is 
	being printed to console logging, so do not include punctuation or symbols 
	aimed at embedding or formatting such as quotation marks or markdown that will not work in an app's logging. 
	This response is intended to be read by a software developer debugging. Do not give basic advice such as 
	"test the fix"; the dev knows the basics of their job, advise on the error 
	and only the error. Do not use blank lines.`;
	const requestBody = {
		prompt: errorPrompt, 
		calledBy: context, // Provide the context where the error occurred
		config: {
			token: process.env.OPENAI_TOKEN, // Use the environment variable for your OpenAI API key
			model: 'o3-mini'
		}
	};
	try {
		const response = await axios.post('https://www.qsrc.work/chat/chat', requestBody);
		const advice = response.data || "No response received from API";
		console.log(`analyzeError is returning advice for the error in ${context}:`);
		
		// Check if advice has the expected structure
		if (advice && typeof advice === 'object') {
			if (advice.data) {
				console.log(advice.data);
				return advice;
			} else {
				console.log(advice);
				return advice;
			}
		} else {
			console.log(advice);
			return advice;
		}
	} catch (axiosError) {
		console.error('Error in analyzeError:', axiosError.message); // Log any issues with the GPT API call
		return null; // Gracefully return null if something goes wrong
	}
}

/**
 * Logs errors and provides AI-powered suggestions
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 * @param {Object} [req] - Express request object (optional)
 * @param {Object} [res] - Express response object (optional)
 * @param {Function} [next] - Express next function (optional)
 * @returns {Promise<void>}
 */
async function qerrorLogger(error, context, req, res, next) {
	if (!error) {
		console.warn('qerrorLogger called without an error object');
		return;
	}
	
	context = context || 'unknown context';
	console.log(`qerrorLogger is running with context: ${context}`);
	const timestamp = new Date().toISOString();
	const {
		message = 'An error occurred', // Default message
		statusCode = 500, // Default HTTP status code
		isOperational = true, // Flag if error is operational or programmer error
	} = error;
	const errorLog = {
		timestamp,
		message,
		statusCode,
		isOperational,
		context,
		stack: error.stack // Capture the stack trace
	};
	logger.error(errorLog);
	await analyzeError(error, context); // Analyze the error and provide suggestions
	console.log(`qerrorLogger has run`); // Logging completion
	if (res && !res.headersSent) {
		const acceptHeader = req && req.headers ? req.headers['accept'] : null;
		if (acceptHeader && acceptHeader.includes('text/html')) {
			// Send a HTML error page
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
					<h2>${message}</h2>
					<pre>${error.stack || 'No stack trace available'}</pre>
				</body>
				</html>
			`;
			res.status(statusCode).send(htmlErrorPage);
		} else {
			res.status(statusCode).json({ error: errorLog }); // Send JSON response
		}
	}
	if (next && !res.headersSent) {
		next(error);
	}
}

module.exports = qerrorLogger;
