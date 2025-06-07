# qerrors

A middleware module to log errors and analyze them via an external AI API. 
Error logger that prints error stack and AI advice in the actual logs
to resolve errors.

## Environment Variables


qerrors reads several environment variables to tune its behavior. A small configuration file in the library sets sensible defaults when these variables are not defined. Only `OPENAI_TOKEN` must be provided manually to enable AI analysis.

* `OPENAI_TOKEN` &ndash; your OpenAI API key.
* `QERRORS_CONCURRENCY` &ndash; maximum concurrent analyses (default `5`).
* `QERRORS_CACHE_LIMIT` &ndash; size of the advice cache (default `50`).

* `QERRORS_RETRIES` &ndash; attempts when calling OpenAI (default `3`).
* `QERRORS_RETRY_DELAY_MS` &ndash; base delay in ms for retries (default `500`).
* `QERRORS_TIMEOUT` &ndash; axios request timeout in ms (default `10000`).

* `QERRORS_LOG_MAXSIZE` &ndash; logger rotation size in bytes (default `1048576`).
* `QERRORS_LOG_MAXFILES` &ndash; number of rotated log files (default `5`).
* `QERRORS_VERBOSE` &ndash; enable console logging (`true` by default).


You will need to set OPENAI_TOKEN in your environment, get your key at [OpenAI](https://openai.com). //env variable for OpenAI access
Set QERRORS_CONCURRENCY to adjust how many analyses run simultaneously; //new variable controlling concurrency
if not set the default limit is 5. //explain fallback value


You will need to set OPENAI_TOKEN in your environment, get your key at [OpenAI](https://openai.com). //(mention required token)
The retry behaviour can be tuned with QERRORS_RETRY_ATTEMPTS and QERRORS_RETRY_BASE_MS which default to 2 and 100 respectively. //(document retry env vars)

You will need to set OPENAI_TOKEN in your environment, get your key at [OpenAI](https://openai.com).
You can optionally set `QERRORS_CACHE_LIMIT` to adjust how many advice entries are cached; the default is 50.

Additional options control the logger's file rotation:

* `QERRORS_LOG_MAXSIZE` - max log file size in bytes before rotation (default `1048576`)
* `QERRORS_LOG_MAXFILES` - number of rotated files to keep (default `5`)




## License

ISC

## Installation

```bash
npm install qerrors
```

## Usage

```javascript
// Import just qerrors:
const {qerrors} = require('qerrors');
// OR import both qerrors and logger: //(changed qErrors to qerrors for casing consistency)
const { qerrors, logger } = require('qerrors');

// Example of using qerrors as Express middleware:
app.use((err, req, res, next) => {
	qerrors(err, 'RouteName', req, res, next);
});

// Using qerrors in any catch block:
function doFunction(req, res, next) {
	try {
		//code
	} catch (error) {
		qerrors(error, "doFunction", req, res, next); //req res and next are optional
	}
}

// Example for javascript that is not express related (node / service code / biz logic)
function doFunction(param) {
	try {
		//code
	} catch (error) {
		qerrors(error, "doFunction", param);
	}
}

// ... or if multiple params:
function doFunction(param1, param2) {
	try {
		//code
	} catch (error) {
		qerrors(error, "doFunction", {param1, param2}); 
	}
}

// Using the Winston logger directly:
logger.info('Application started');
logger.warn('Something might be wrong');
logger.error('An error occurred', { errorDetails: error });
```

## Testing

Running `npm test` starts Node's built-in test runner using the `--test` flag.
The included tests rely on the `qtests` library to stub network requests, so the
suite can run entirely offline.


