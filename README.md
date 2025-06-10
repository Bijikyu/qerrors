# qerrors

Intelligent error handling middleware that combines traditional logging with AI-powered debugging assistance. When errors occur, qerrors automatically generates contextual suggestions using OpenAI's GPT models while maintaining fast response times through asynchronous analysis and intelligent caching.

## Environment Variables


qerrors reads several environment variables to tune its behavior. A small configuration file in the library sets sensible defaults when these variables are not defined. Only `OPENAI_TOKEN` must be provided manually to enable AI analysis. Obtain your key from [OpenAI](https://openai.com) and set the variable in your environment.

**Security Note**: Keep your OpenAI API key secure. Never commit it to version control or expose it in client-side code. Use environment variables or secure configuration management.

**Dependencies**: This package includes production-grade security improvements with the `escape-html` library for safe HTML output.

* `OPENAI_TOKEN` &ndash; your OpenAI API key.

* `QERRORS_OPENAI_URL` &ndash; OpenAI API endpoint (default `https://api.openai.com/v1/chat/completions`).
* `QERRORS_CONCURRENCY` &ndash; maximum concurrent analyses (default `5`, raise for high traffic, values over `1000` are clamped). //(document clamp)


* `QERRORS_CACHE_LIMIT` &ndash; size of the advice cache (default `50`, set to `0` to disable caching, values over `1000` are clamped).
* `QERRORS_CACHE_TTL` &ndash; seconds before cached advice expires (default `86400`).
* `QERRORS_QUEUE_LIMIT` &ndash; maximum queued analyses before rejecting new ones (default `100`, raise when under heavy load, values over `QERRORS_SAFE_THRESHOLD` are clamped).
* `QERRORS_SAFE_THRESHOLD` &ndash; limit at which `QERRORS_CONCURRENCY` and `QERRORS_QUEUE_LIMIT` are clamped (default `1000`, increase to raise their allowed upper bound).


* `QERRORS_RETRY_ATTEMPTS` &ndash; attempts when calling OpenAI (default `2`).
* `QERRORS_RETRY_BASE_MS` &ndash; base delay in ms for retries (default `100`).
* `QERRORS_RETRY_MAX_MS` &ndash; cap on retry backoff in ms (default `2000`).
* `QERRORS_TIMEOUT` &ndash; axios request timeout in ms (default `10000`).
* `QERRORS_MAX_SOCKETS` &ndash; maximum sockets per agent (default `50`, increase for high traffic).
* `QERRORS_MAX_FREE_SOCKETS` &ndash; maximum idle sockets per agent (default `256`).

* `QERRORS_MAX_TOKENS` &ndash; max tokens for each OpenAI request (default `2048`). Uses GPT-4o model for error analysis.

* `QERRORS_METRIC_INTERVAL_MS` &ndash; interval for queue metric logging in milliseconds (default `30000`, set to `0` to disable). //(document metric variable)


* `QERRORS_LOG_MAXSIZE` &ndash; logger rotation size in bytes (default `1048576`).
* `QERRORS_LOG_MAXFILES` &ndash; number of rotated log files (default `5`).
  * `QERRORS_LOG_MAX_DAYS` &ndash; days to retain daily logs (default `0`). A value of `0` keeps all logs forever and emits a startup warning; set a finite number in production to manage disk usage. //(document startup warning behavior)
* `QERRORS_VERBOSE` &ndash; enable console logging (`true` by default). Set `QERRORS_VERBOSE=false` for production deployments to keep logs from flooding the console and rely on file output instead.
* `QERRORS_LOG_DIR` &ndash; directory for logger output (default `logs`).
* `QERRORS_DISABLE_FILE_LOGS` &ndash; disable file transports when set.
* `QERRORS_LOG_LEVEL` &ndash; logger output level (default `info`). //(document log level)
* `QERRORS_SERVICE_NAME` &ndash; service name added to logger metadata (default `qerrors`). //(document service variable)

For high traffic scenarios raise `QERRORS_CONCURRENCY`, `QERRORS_QUEUE_LIMIT`, `QERRORS_MAX_SOCKETS`, and `QERRORS_MAX_FREE_SOCKETS`. Set `QERRORS_VERBOSE=false` in production to reduce console overhead.


Set QERRORS_CONCURRENCY to adjust how many analyses run simultaneously; //new variable controlling concurrency
if not set the default limit is 5; raise this for high traffic. //explain fallback value

Use QERRORS_QUEUE_LIMIT to cap how many analyses can wait in line before rejection; //(explain queue limit)
if not set the default limit is 100; increase when expecting heavy load. //(explain queue default)
The pending queue uses a double ended queue from the denque package for efficient O(1) dequeues. //(document deque)

Whenever the queue rejects an analysis the module increments an internal counter. //(document reject counter)
Check it with `qerrors.getQueueRejectCount()`. //(usage note)

Call `qerrors.clearAdviceCache()` to manually empty the advice cache. //(document cache clearing)
Use `qerrors.startAdviceCleanup()` to begin automatic purging of expired entries. //(document cleanup scheduler)
Call `qerrors.stopAdviceCleanup()` if you need to halt the cleanup interval. //(document cleanup stop)
Call `qerrors.purgeExpiredAdvice()` to run a purge instantly. //(manual purge reminder)
After each purge or clear operation the module checks the cache size and stops cleanup when it reaches zero, restarting the interval when new advice is cached. //(document cleanup auto stop/start)

Use `qerrors.getQueueLength()` to monitor how many analyses are waiting. //(mention queue length)

The module logs `queueLength` and `queueRejects` at a regular interval (default `30s`). Use `QERRORS_METRIC_INTERVAL_MS` to change the period or set `0` to disable logging. Logging starts with the first queued analysis and stops automatically when no analyses remain. //(document metrics)

QERRORS_MAX_SOCKETS lets you limit how many sockets the http agents open; //document new env var usage
if not set the default is 50; raise this to handle high traffic. //state default behaviour
QERRORS_MAX_FREE_SOCKETS caps idle sockets the agents keep for reuse; //explain idle setting
if not set the default is 256 which matches Node's agent default. //state default value
QERRORS_MAX_TOKENS sets the token limit for OpenAI responses; //describe new env var
if not set the default is 2048 which balances cost and detail. //state default value



The retry behaviour can be tuned with QERRORS_RETRY_ATTEMPTS, QERRORS_RETRY_BASE_MS and QERRORS_RETRY_MAX_MS which default to 2, 100 and 2000 respectively. //(document retry env vars)
When the API responds with 429 or 503 qerrors uses the `Retry-After` header to wait before retrying; if the header is missing the computed delay is doubled. //(document rate limit behaviour)

You can optionally set `QERRORS_CACHE_LIMIT` to adjust how many advice entries are cached; set `0` to disable caching (default is 50, values over `1000` are clamped). Use `QERRORS_CACHE_TTL` to control how long each entry stays valid in seconds (default is 86400).

Additional options control the logger's file rotation:

* `QERRORS_LOG_MAXSIZE` - max log file size in bytes before rotation (default `1048576`)
* `QERRORS_LOG_MAXFILES` - number of rotated files to keep (default `5`)
  * `QERRORS_LOG_MAX_DAYS` - number of days to keep daily logs (default `0`). A value of `0` retains logs forever and triggers a startup warning; specify a finite number in production to manage disk usage. //(note about startup warning)
* `QERRORS_LOG_DIR` - path for log files (default `logs`)
* `QERRORS_DISABLE_FILE_LOGS` - omit file logs when set
* `QERRORS_SERVICE_NAME` - service name added to logger metadata (default `qerrors`)




## License

ISC

## Installation

**Requirements**: Node.js 18 or higher

```bash
npm install qerrors
```

## Usage

### Basic Setup

First, set your OpenAI API key:
```bash
export OPENAI_TOKEN="your-openai-api-key-here"
```

Import the module:
```javascript
// Import just qerrors:
const {qerrors} = require('qerrors');
// OR import both qerrors and logger:
const { qerrors, logger } = require('qerrors');
const log = await logger; //await logger initialization before use

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

// Response Format: qerrors automatically detects client type
// - Browser requests (Accept: text/html) receive HTML error pages
// - API requests receive JSON error responses with structured data

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
log.info('Application started');
log.warn('Something might be wrong');
log.error('An error occurred', { errorDetails: error });
```

### Features

- **AI-Powered Analysis**: Automatically generates debugging suggestions using OpenAI GPT-4o model
- **Express Middleware**: Seamless integration with Express.js applications
- **Content Negotiation**: Returns HTML pages for browsers, JSON for API clients
- **Intelligent Caching**: Prevents duplicate API calls for identical errors
- **Queue Management**: Handles high-traffic scenarios with configurable concurrency limits
- **Graceful Degradation**: Functions normally even without OpenAI API access
- **Comprehensive Logging**: Multi-transport Winston logging with file rotation

### Error Response Formats

**HTML Response** (for browsers):
```html
<!DOCTYPE html>
<html>
<head><title>Error: 500</title></head>
<body>
    <h1 class="error">Error: 500</h1>
    <h2>Internal Server Error</h2>
    <pre>Error stack trace...</pre>
</body>
</html>
```

**JSON Response** (for APIs):
```json
{
  "error": {
    "uniqueErrorName": "ERROR:TypeError_abc123",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "message": "Cannot read property 'foo' of undefined",
    "statusCode": 500,
    "context": "userController",
    "stack": "TypeError: Cannot read property..."
  }
}
```

## Testing

The test suite uses Node's built-in test runner with custom stubs for offline testing.
Tests include comprehensive coverage of error handling, AI integration, and middleware functionality.

Run tests from the project directory:
```bash
npm test
```
Or directly:
```bash
node -r ./setup.js --test
```

GitHub Actions runs this test suite automatically on every push and pull request using Node.js LTS. The workflow caches npm dependencies to speed up subsequent runs.


