const logger = require('./logger');
const axios = require('axios');


async function analyzeError(error, context, origin) {
	console.log(`analyzeError is running with context: ${context} and origin: ${origin}`); // Log the call details
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
		origin: origin, // Specify the origin of the error (e.g., function name, API route)
		config: {
			token: process.env.OPENAI_TOKEN, // Use the environment variable for your OpenAI API key
			model: 'o3-mini'
		}
	};
	try {
		const response = await axios.post('https://www.qsrc.work/chat/chat', requestBody);
		console.log(response);
		console.log(response.data);
		const advice = response.data || "No response received from API";
		console.log(`analyzeError is returning advice for the error in ${context} in ${origin}:`);
		console.log(advice);
		console.log(`Advice text is: ${advice.data}`);
		return advice;
	} catch (axiosError) {
		console.error('Error in analyzeError:', axiosError.message); // Log any issues with the GPT API call
		return null; // Gracefully return null if something goes wrong
	}
}

async function qerrorLogger(error, context, req, res, next) {
	console.log(`qerrorLogger is running with simple context: ${context}`); // Simple context log
	//console.log(`errorLogger is running with detailed context: ${util.inspect(context)}`); // Inspect for detailed object logging
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
	let origin;
	siteName ? origin = siteName : origin = 'unknown';
	await analyzeError(error, context, origin); // Analyze the error and provide suggestions
	console.log(`qerrorLogger has run`); // Logging completion
	if (res && !res.headersSent) {
		const acceptHeader = req.headers['accept'];
		if (acceptHeader && acceptHeader.includes('text/html')) {
			res.status(statusCode).render('error', { error: errorLog }); // Render error page
		} else {
			res.status(statusCode).json({ error: errorLog }); // Send JSON response
		}
	};
	if (next && !res.headersSent) {
		next(error);
	}
}

module.exports = qerrorLogger;
