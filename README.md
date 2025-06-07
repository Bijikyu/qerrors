# qerrors

A middleware module to log errors and analyze them via an external AI API. 
Error logger that prints error stack and AI advice in the actual logs
to resolve errors.

## Environment Variables


qerrors reads several environment variables to tune its behavior. A small configuration file in the library sets sensible defaults when these variables are not defined. Only `OPENAI_TOKEN` must be provided manually to enable AI analysis.

* `OPENAI_TOKEN` &ndash; your OpenAI API key.
* `QERRORS_CONCURRENCY` &ndash; maximum concurrent analyses (default `5`, raise for high traffic).

* `QERRORS_CACHE_LIMIT` &ndash; size of the advice cache (default `50`, set to `0` to disable caching).
* `QERRORS_CACHE_TTL` &ndash; seconds before cached advice expires (default `86400`).
* `QERRORS_QUEUE_LIMIT` &ndash; maximum queued analyses before rejecting new ones (default `100`, raise when under heavy load). //(note queue tuning for traffic)


* `QERRORS_RETRY_ATTEMPTS` &ndash; attempts when calling OpenAI (default `2`).
* `QERRORS_RETRY_BASE_MS` &ndash; base delay in ms for retries (default `100`).
* `QERRORS_TIMEOUT` &ndash; axios request timeout in ms (default `10000`).
* `QERRORS_MAX_SOCKETS` &ndash; maximum sockets per agent (default `50`, increase for high traffic).

* `QERRORS_LOG_MAXSIZE` &ndash; logger rotation size in bytes (default `1048576`).
* `QERRORS_LOG_MAXFILES` &ndash; number of rotated log files (default `5`).
* `QERRORS_LOG_MAX_DAYS` &ndash; days to retain daily logs (default `0`).
* `QERRORS_VERBOSE` &ndash; enable console logging (`true` by default). Set `QERRORS_VERBOSE=false` for production deployments to keep logs from flooding the console and rely on file output instead.
* `QERRORS_LOG_DIR` &ndash; directory for logger output (default `logs`).
* `QERRORS_DISABLE_FILE_LOGS` &ndash; disable file transports when set.
* `QERRORS_SERVICE_NAME` &ndash; service name added to logger metadata (default `qerrors`). //(document service variable)

For high traffic scenarios raise `QERRORS_CONCURRENCY`, `QERRORS_QUEUE_LIMIT`, and `QERRORS_MAX_SOCKETS`. Set `QERRORS_VERBOSE=false` in production to reduce console overhead.


You will need to set OPENAI_TOKEN in your environment, get your key at [OpenAI](https://openai.com). //env variable for OpenAI access
Set QERRORS_CONCURRENCY to adjust how many analyses run simultaneously; //new variable controlling concurrency
if not set the default limit is 5; raise this for high traffic. //explain fallback value

Use QERRORS_QUEUE_LIMIT to cap how many analyses can wait in line before rejection; //(explain queue limit)
if not set the default limit is 100; increase when expecting heavy load. //(explain queue default)

Whenever the queue rejects an analysis the module increments an internal counter. //(document reject counter)
Check it with `qerrors.getQueueRejectCount()`. //(usage note)

Call `qerrors.clearAdviceCache()` to manually empty the advice cache. //(document cache clearing)

Use `qerrors.getQueueLength()` to monitor how many analyses are waiting. //(mention queue length)


QERRORS_MAX_SOCKETS lets you limit how many sockets the http agents open; //document new env var usage
if not set the default is 50; raise this to handle high traffic. //state default behaviour



You will need to set OPENAI_TOKEN in your environment, get your key at [OpenAI](https://openai.com). //(mention required token)
The retry behaviour can be tuned with QERRORS_RETRY_ATTEMPTS and QERRORS_RETRY_BASE_MS which default to 2 and 100 respectively. //(document retry env vars)

You will need to set OPENAI_TOKEN in your environment, get your key at [OpenAI](https://openai.com).
You can optionally set `QERRORS_CACHE_LIMIT` to adjust how many advice entries are cached; set `0` to disable caching (default is 50). Use `QERRORS_CACHE_TTL` to control how long each entry stays valid in seconds (default is 86400).

Additional options control the logger's file rotation:

* `QERRORS_LOG_MAXSIZE` - max log file size in bytes before rotation (default `1048576`)
* `QERRORS_LOG_MAXFILES` - number of rotated files to keep (default `5`)
* `QERRORS_LOG_MAX_DAYS` - number of days to keep daily logs (default `0`)
* `QERRORS_LOG_DIR` - path for log files (default `logs`)
* `QERRORS_DISABLE_FILE_LOGS` - omit file logs when set
* `QERRORS_SERVICE_NAME` - service name added to logger metadata (default `qerrors`)




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


