const logger = require('./logger');
const axios = require('axios');


async function analyzeError(error, context) {
	if (error.name.includes("AxiosError")) {
		console.log("Axios Error");
		return
	};
	console.log(`qerrors error analysis is running for
			error name: "${error.uniqueErrorName}",
			error message: "${error.message}", 
			with context: "${context}"`); // Log the call details
	if (!process.env.OPENAI_TOKEN) {
		console.error("Missing OPENAI_TOKEN in environment variables.");
		return null;
	}
	const errorPrompt = `Analyze this error (${error.name}) that gave this message (${error.message}) and provide suggestions to fix it:\n\n${error.stack} 
	that happened in this context: ${context}. In your response, realize this is 
	being printed to console logging, so do not include punctuation or symbols 
	aimed at embedding or formatting such as quotation marks or markdown that will not work in an app's logging. 
	This response is intended to be read by a software developer debugging. Do not give basic advice such as 
	"test the fix"; the dev knows the basics of their job, advise on the error 
	and only the error. Do not use blank lines.`;
	
	const response = await axios.post('https://omnichat.use-api.com/api/chatCompletion', {
		prompt: errorPrompt,
		calledBy: context,
		config: {model: 'o3-mini'}
	}, {
		headers: {
			'x-api-key': process.env.OPENAI_TOKEN
		}
	});
	const advice = response.data || "No response received from API";
	console.log(`qerrors is returning advice for 
			the error name: "${error.uniqueErrorName}",
			with the error message: "${error.message}", 
			with context: "${context}"`);
	// Check if advice has the expected structure
	if (advice && typeof advice === 'object') {
		if (advice.data) {
			console.log(error.uniqueErrorName + " " + advice.data);
			return advice;
		} else if (advice) {
			console.log(error.uniqueErrorName + " " + advice);
			return advice;
		}
	} else {
		console.log(`Problem in analyzeError function of qerrors for ${error.uniqueErrorName}:', ${axiosError.message}`); // Log any issues with the GPT API call
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
async function qerrors(error, context, req, res, next) {

	if (!error) {
		console.warn('qerrors called without an error object');
		return;
	}
	
	context = context || 'unknown context';
	const uniqueErrorName = "ERROR: "+ error.name + "_" + Date.now() + "_" + Math.random().toString(36).slice(2);
	console.log(`qerrors is running for error message: "${error.message}", 
			with context: "${context}", 
			assigning it the unique error name: "${uniqueErrorName}"`);
	const timestamp = new Date().toISOString();
	const {
		message = 'An error occurred', // Default message
		statusCode = 500, // Default HTTP status code
		isOperational = true, // Flag if error is operational or programmer error
	} = error;
	const errorLog = {
		uniqueErrorName,
		timestamp,
		message,
		statusCode,
		isOperational,
		context,
		stack: error.stack // Capture the stack trace
	};
	error.uniqueErrorName = uniqueErrorName; // Add the unique error name to the error object
	logger.error(errorLog);
	await analyzeError(error, context); // Analyze the error and provide suggestions
	console.log(`qerrors ran`); // Logging completion
	if (res && !res.headersSent) {
		const acceptHeader = req?.headers?.['accept'] || null;
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
	if (next) {
		if (!res || !res.headersSent) {
			next(error);
		}
	}
}

module.exports = qerrors;
