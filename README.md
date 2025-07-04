# qerrors

Intelligent error handling middleware that combines traditional logging with AI-powered debugging assistance. When errors occur, qerrors automatically generates contextual suggestions using OpenAI's GPT models while maintaining fast response times through asynchronous analysis and intelligent caching.

## Environment Variables


qerrors reads several environment variables to tune its behavior. A small configuration file in the library sets sensible defaults when these variables are not defined. Only `OPENAI_TOKEN` must be provided manually to enable AI analysis. Obtain your key from [OpenAI](https://openai.com) and set the variable in your environment.

If `OPENAI_TOKEN` is omitted qerrors still logs errors, but AI-generated advice will be skipped.

**Security Note**: Keep your OpenAI API key secure. Never commit it to version control or expose it in client-side code. Use environment variables or secure configuration management.

**Dependencies**: This package includes production-grade security improvements with the `escape-html` library for safe HTML output.

* `OPENAI_TOKEN` &ndash; your OpenAI API key.

* `QERRORS_OPENAI_URL` &ndash; OpenAI API endpoint (default `https://api.openai.com/v1/chat/completions`).
* `QERRORS_CONCURRENCY` &ndash; maximum concurrent analyses (default `5`, raise for high traffic, values over `1000` are clamped).


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

* `QERRORS_METRIC_INTERVAL_MS` &ndash; interval for queue metric logging in milliseconds (default `30000`, set to `0` to disable).


* `QERRORS_LOG_MAXSIZE` &ndash; logger rotation size in bytes (default `1048576`).
* `QERRORS_LOG_MAXFILES` &ndash; number of rotated log files (default `5`).
  * `QERRORS_LOG_MAX_DAYS` &ndash; days to retain daily logs (default `0`). A value of `0` keeps all logs forever and emits a startup warning; set a finite number in production to manage disk usage.
* `QERRORS_VERBOSE` &ndash; enable console logging (`false` by default). Set `QERRORS_VERBOSE=false` for production deployments to keep logs from flooding the console and rely on file output instead.
* `QERRORS_LOG_DIR` &ndash; directory for logger output (default `logs`).
* `QERRORS_DISABLE_FILE_LOGS` &ndash; disable file transports when set.
* `QERRORS_LOG_LEVEL` &ndash; logger output level (default `info`).
* `QERRORS_SERVICE_NAME` &ndash; service name added to logger metadata (default `qerrors`).

For high traffic scenarios raise `QERRORS_CONCURRENCY`, `QERRORS_QUEUE_LIMIT`, `QERRORS_MAX_SOCKETS`, and `QERRORS_MAX_FREE_SOCKETS`. Set `QERRORS_VERBOSE=false` in production to reduce console overhead.


Set QERRORS_CONCURRENCY to adjust how many analyses run simultaneously;
if not set the default limit is 5; raise this for high traffic.

Use QERRORS_QUEUE_LIMIT to cap how many analyses can wait in line before rejection;
if not set the default limit is 100; increase when expecting heavy load.
The pending queue uses a double ended queue from the denque package for efficient O(1) dequeues.

Whenever the queue rejects an analysis the module increments an internal counter.
Check it with `qerrors.getQueueRejectCount()`.

Call `qerrors.clearAdviceCache()` to manually empty the advice cache.
Use `qerrors.startAdviceCleanup()` to begin automatic purging of expired entries.
Call `qerrors.stopAdviceCleanup()` if you need to halt the cleanup interval.
Call `qerrors.purgeExpiredAdvice()` to run a purge instantly.
After each purge or clear operation the module checks the cache size and stops cleanup when it reaches zero, restarting the interval when new advice is cached.
Check the current cache limit with `qerrors.getAdviceCacheLimit()`.

Use `qerrors.getQueueLength()` to monitor how many analyses are waiting.

The module logs `queueLength` and `queueRejects` at a regular interval (default `30s`). Use `QERRORS_METRIC_INTERVAL_MS` to change the period or set `0` to disable logging. Logging starts with the first queued analysis and stops automatically when no analyses remain.

Call `qerrors.startQueueMetrics()` to manually begin metric logging and `qerrors.stopQueueMetrics()` to halt it when needed.

QERRORS_MAX_SOCKETS lets you limit how many sockets the http agents open;
if not set the default is 50; raise this to handle high traffic.
QERRORS_MAX_FREE_SOCKETS caps idle sockets the agents keep for reuse;
if not set the default is 256 which matches Node's agent default.
QERRORS_MAX_TOKENS sets the token limit for OpenAI responses;
if not set the default is 2048 which balances cost and detail.



The retry behaviour can be tuned with QERRORS_RETRY_ATTEMPTS, QERRORS_RETRY_BASE_MS and QERRORS_RETRY_MAX_MS which default to 2, 100 and 2000 respectively.
When the API responds with 429 or 503 qerrors uses the `Retry-After` header to wait before retrying; if the header is missing the computed delay is doubled.

You can optionally set `QERRORS_CACHE_LIMIT` to adjust how many advice entries are cached; set `0` to disable caching (default is 50, values over `1000` are clamped). Use `QERRORS_CACHE_TTL` to control how long each entry stays valid in seconds (default is 86400).

Additional options control the logger's file rotation:

* `QERRORS_LOG_MAXSIZE` - max log file size in bytes before rotation (default `1048576`)
* `QERRORS_LOG_MAXFILES` - number of rotated files to keep (default `5`)
  * `QERRORS_LOG_MAX_DAYS` - number of days to keep daily logs (default `0`). A value of `0` retains logs forever and triggers a startup warning; specify a finite number in production to manage disk usage.
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

// Import centralized error handling utilities:
const { 
  qerrors, 
  handleControllerError, 
  withErrorHandling, 
  createTypedError,
  ErrorTypes,
  ErrorSeverity,
  ErrorFactory,
  errorMiddleware
} = require('qerrors');
```

## Centralized Error Handling

The module now includes centralized error handling utilities that provide standardized error classification, severity-based logging, and automated response formatting:

### Error Classification

```javascript
// Create typed errors with automatic classification
const validationError = createTypedError(
  'Invalid email format',
  ErrorTypes.VALIDATION,
  'INVALID_EMAIL'
);

const dbError = createTypedError(
  'Connection timeout',
  ErrorTypes.DATABASE,
  'DB_TIMEOUT'
);

// Available error types:
ErrorTypes.VALIDATION      // 400 - User input errors
ErrorTypes.AUTHENTICATION  // 401 - Auth failures  
ErrorTypes.AUTHORIZATION   // 403 - Permission errors
ErrorTypes.NOT_FOUND       // 404 - Resource not found
ErrorTypes.RATE_LIMIT      // 429 - Rate limiting
ErrorTypes.NETWORK         // 502 - External service errors
ErrorTypes.DATABASE        // 500 - Database errors
ErrorTypes.SYSTEM          // 500 - Internal system errors
ErrorTypes.CONFIGURATION   // 500 - Config/setup errors
```

### Convenient Error Factory

```javascript
// Use ErrorFactory for common error scenarios with consistent formatting
const validationError = ErrorFactory.validation('Email is required', 'email');
const authError = ErrorFactory.authentication('Invalid credentials');
const notFoundError = ErrorFactory.notFound('User');
const dbError = ErrorFactory.database('Connection failed', 'INSERT');

// All factory methods accept optional context
const networkError = ErrorFactory.network(
  'API timeout', 
  'payment-service', 
  { timeout: 5000, retries: 3 }
);
```

### Controller Error Handling

```javascript
// Standardized error handling in Express controllers
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      const error = createTypedError(
        'User not found',
        ErrorTypes.NOT_FOUND,
        'USER_NOT_FOUND'
      );
      return handleControllerError(res, error, 'getUserById', { userId: req.params.id });
    }
    res.json(user);
  } catch (error) {
    handleControllerError(res, error, 'getUserById', { userId: req.params.id });
  }
});
```

### Async Operation Wrapper

```javascript
// Wrap async operations with automatic error handling
const result = await withErrorHandling(
  async () => {
    return await complexAsyncOperation();
  },
  'complexAsyncOperation',
  { userId: req.user.id },
  { fallback: 'default_value' } // optional fallback
);
```

### Severity-Based Logging

```javascript
// Log errors with appropriate severity levels
await logErrorWithSeverity(
  error,
  'functionName',
  { context: 'additional info' },
  ErrorSeverity.CRITICAL
);

// Available severity levels:
ErrorSeverity.LOW       // Expected errors, user mistakes
ErrorSeverity.MEDIUM    // Operational issues, recoverable  
ErrorSeverity.HIGH      // Service degradation, requires attention
ErrorSeverity.CRITICAL  // Service disruption, immediate response needed
```

### Global Error Middleware

```javascript
// Add global error handling to your Express app
const express = require('express');
const app = express();

// Your routes here...
app.get('/api/users/:id', async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) {
    throw ErrorFactory.notFound('User');
  }
  res.json(user);
});

// Add error middleware as the last middleware
app.use(errorMiddleware);

// The middleware will automatically:
// - Log errors with qerrors AI analysis
// - Send standardized JSON responses
// - Map error types to appropriate HTTP status codes
// - Include request context for debugging
```

## Basic Usage

```javascript
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
// Optional helpers for consistent function logging
await logger.logStart('myFunction', {input});
await logger.logReturn('myFunction', {result});
```

### Environment Validation Helpers

Use the optional utilities in `lib/envUtils.js` to verify configuration before starting your application.

```javascript
const { throwIfMissingEnvVars, warnIfMissingEnvVars, getMissingEnvVars } = require('qerrors/lib/envUtils');

throwIfMissingEnvVars(['OPENAI_TOKEN']); // aborts if mandatory variables are missing
warnIfMissingEnvVars(['MY_OPTIONAL_VAR']); // logs a warning but continues
const missing = getMissingEnvVars(['OPTIONAL_ONE', 'OPTIONAL_TWO']);
```


### Features

- **AI-Powered Analysis**: Automatically generates debugging suggestions using OpenAI GPT-4o model
- **Express Middleware**: Seamless integration with Express.js applications
- **Content Negotiation**: Returns HTML pages for browsers, JSON for API clients
- **Intelligent Caching**: Prevents duplicate API calls for identical errors
- **Queue Management**: Handles high-traffic scenarios with configurable concurrency limits
- **Graceful Degradation**: Functions normally even without OpenAI API access
- **Comprehensive Logging**: Multi-transport Winston logging with file rotation

### Logging

File transports output JSON objects with timestamps and stack traces. Console
output, enabled when `QERRORS_VERBOSE=true`, uses a compact printf format for
readability.

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
Current test status: 87/87 tests passing (100% success rate).

Run tests from the project directory:
```bash
npm test
```
Or directly:
```bash
node -r ./setup.js --test
```

**Test Coverage Includes:**
- Core error handling and middleware functionality
- OpenAI API integration with mock responses
- Environment variable validation and configuration
- Cache management and TTL behavior
- Queue concurrency and rejection handling
- Logger configuration across different environments

GitHub Actions runs this test suite automatically on every push and pull request using Node.js LTS. The workflow caches npm dependencies to speed up subsequent runs.


