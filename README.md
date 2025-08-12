# qerrors

Intelligent error handling middleware that combines traditional logging with AI-powered debugging assistance. When errors occur, qerrors automatically generates contextual suggestions using Google Gemini AI models (with optional OpenAI support) while maintaining fast response times through asynchronous analysis and intelligent caching.

## Complete Export Reference

qerrors provides a comprehensive suite of utilities organized into logical groups:

### Core Error Handling
- `qerrors` - Main error handling middleware
- `handleControllerError` - Standardized controller error handler
- `withErrorHandling` - Async operation wrapper with error handling
- `errorMiddleware` - Express global error middleware
- `createTypedError`, `createStandardError` - Error factory functions
- `ErrorTypes`, `ErrorSeverity`, `ErrorFactory` - Error classification utilities

### Enhanced Logging
- `logger` - Configured Winston logger instance  
- `logDebug`, `logInfo`, `logWarn`, `logError`, `logFatal`, `logAudit` - Multi-level logging
- `createPerformanceTimer`, `createEnhancedLogEntry` - Performance monitoring
- `simpleLogger`, `createSimpleWinstonLogger` - Basic logging utilities
- `LOG_LEVELS` - Log level constants

### Data Security & Sanitization
- `sanitizeMessage`, `sanitizeContext` - Data sanitization utilities
- `addCustomSanitizationPattern`, `sanitizeWithCustomPatterns` - Custom sanitization rules
- `clearCustomSanitizationPatterns` - Pattern management

### Queue Management & Monitoring
- `createLimiter` - Concurrency limiting utility
- `getQueueLength`, `getQueueRejectCount` - Queue monitoring
- `startQueueMetrics`, `stopQueueMetrics` - Metrics management

### AI Model Management (LangChain)
- `getAIModelManager`, `resetAIModelManager` - AI model management
- `MODEL_PROVIDERS`, `createLangChainModel` - Provider configuration

### Utility Functions
- `generateUniqueId` - Unique identifier generation
- `createTimer` - Performance timing utilities
- `deepClone` - Object cloning
- `safeRun` - Safe function execution
- `verboseLog` - Conditional verbose logging

### Configuration & Environment
- `getEnv`, `getInt` - Environment variable parsing
- `getMissingEnvVars`, `throwIfMissingEnvVars`, `warnIfMissingEnvVars` - Environment validation

## Environment Variables


qerrors reads several environment variables to tune its behavior. A small configuration file in the library sets sensible defaults when these variables are not defined. The `GEMINI_API_KEY` must be provided to enable AI analysis with Google Gemini (default provider). Alternatively, you can use `OPENAI_API_KEY` for OpenAI models.

If both API keys are omitted, qerrors still logs errors, but AI-generated advice will be skipped.

**Security Note**: Keep your API keys secure. Never commit them to version control or expose them in client-side code. Use environment variables or secure configuration management.

**Dependencies**: This package includes production-grade security improvements with the `escape-html` library for safe HTML output.

* `GEMINI_API_KEY` &ndash; your Google Gemini API key (primary AI provider).
* `OPENAI_API_KEY` &ndash; your OpenAI API key (optional alternative provider).

* `QERRORS_AI_PROVIDER` &ndash; AI provider selection: 'google' (default) or 'openai'.
* `QERRORS_AI_MODEL` &ndash; specific AI model to use (optional, uses provider default if not set):
  - Google Gemini models: 'gemini-2.5-flash-lite' (default), 'gemini-2.0-flash-exp', 'gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'
  - OpenAI models: 'gpt-4o' (default), 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'
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
* `QERRORS_VERBOSE` &ndash; control console logging (`true` by default). Set `QERRORS_VERBOSE=false` for production deployments to suppress console output and rely on file logging only.
* `QERRORS_LOG_DIR` &ndash; directory for logger output (default `logs`).
* `QERRORS_DISABLE_FILE_LOGS` &ndash; disable file transports when set.
* `QERRORS_LOG_LEVEL` &ndash; logger output level (default `info`).
* `QERRORS_SERVICE_NAME` &ndash; service name added to logger metadata (default `qerrors`).

For high traffic scenarios raise `QERRORS_CONCURRENCY`, `QERRORS_QUEUE_LIMIT`, `QERRORS_MAX_SOCKETS`, and `QERRORS_MAX_FREE_SOCKETS`. Set `QERRORS_VERBOSE=false` in production to reduce console overhead and rely on file logging.


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

First, set your Google Gemini API key (or OpenAI as alternative):
```bash
# Primary provider - Google Gemini (recommended)
export GEMINI_API_KEY="your-gemini-api-key-here"
# Optional: specify specific model (defaults to gemini-2.5-flash-lite)
export QERRORS_AI_MODEL="gemini-2.5-flash-lite"

# Alternative provider - OpenAI
export OPENAI_API_KEY="your-openai-api-key-here"
export QERRORS_AI_PROVIDER="openai"
# Optional: specify specific model (defaults to gpt-4o)
export QERRORS_AI_MODEL="gpt-4o"
```

Import the module:
```javascript
// Import just qerrors:
const { qerrors } = require('qerrors');

// Import qerrors and logger:
const { qerrors, logger } = require('qerrors');
const log = await logger; // await logger initialization before use

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

// Import enhanced logging utilities:
const {
  logDebug,
  logInfo,
  logWarn,
  logError,
  logFatal,
  logAudit,
  createPerformanceTimer,
  simpleLogger
} = require('qerrors');

// Import data sanitization utilities:
const {
  sanitizeMessage,
  sanitizeContext,
  addCustomSanitizationPattern,
  sanitizeWithCustomPatterns
} = require('qerrors');

// Import queue management and monitoring:
const {
  createLimiter,
  getQueueLength,
  getQueueRejectCount,
  startQueueMetrics,
  stopQueueMetrics
} = require('qerrors');

// Import utility functions:
const {
  generateUniqueId,
  createTimer,
  deepClone,
  safeRun,
  verboseLog
} = require('qerrors');

// Import configuration and environment utilities:
const {
  getEnv,
  getInt,
  getMissingEnvVars,
  throwIfMissingEnvVars,
  warnIfMissingEnvVars
} = require('qerrors');

// Import AI model management (LangChain integration):
const {
  getAIModelManager,
  resetAIModelManager,
  MODEL_PROVIDERS,
  createLangChainModel
} = require('qerrors');
```
  getMissingEnvVars,
  throwIfMissingEnvVars,
  warnIfMissingEnvVars
} = require('qerrors');

// Import AI model management (LangChain integration):
const {
  getAIModelManager,
  resetAIModelManager,
  MODEL_PROVIDERS,
  createLangChainModel
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

throwIfMissingEnvVars(['OPENAI_API_KEY']); // aborts if mandatory variables are missing
warnIfMissingEnvVars(['MY_OPTIONAL_VAR']); // logs a warning but continues
const missing = getMissingEnvVars(['OPTIONAL_ONE', 'OPTIONAL_TWO']);
```


### Features

#### Core Error Handling
- **AI-Powered Analysis**: Automatically generates debugging suggestions using Google Gemini AI models
- **Multiple AI Providers**: Primary support for Google Gemini 2.5 Flash-lite with optional OpenAI GPT-4o via LangChain
- **Express Middleware**: Seamless integration with Express.js applications
- **Content Negotiation**: Returns HTML pages for browsers, JSON for API clients
- **Intelligent Caching**: Prevents duplicate API calls for identical errors with TTL support
- **Queue Management**: Handles high-traffic scenarios with configurable concurrency limits
- **Graceful Degradation**: Functions normally even without AI API access

#### Enhanced Logging System
- **Multi-Level Logging**: Debug, Info, Warn, Error, Fatal, and Audit logging levels
- **Security-Aware Sanitization**: Automatic removal of sensitive data from logs
- **Performance Monitoring**: Built-in timing and resource usage tracking
- **Request Correlation**: Unique request IDs for tracking across distributed systems
- **Structured Logging**: JSON-formatted logs with consistent metadata
- **File Rotation**: Automatic log rotation with configurable retention policies
- **Console and File Outputs**: Dual transport with environment-specific configuration

#### Data Security and Sanitization
- **Pattern-Based Sanitization**: Configurable patterns for removing sensitive data
- **Custom Sanitization Rules**: Add your own patterns for specific security requirements
- **HTML Escaping**: Safe error output for web applications
- **Context Sanitization**: Deep sanitization of error context and metadata

#### Queue and Performance Management
- **Concurrency Control**: Configurable limits for AI analysis requests
- **Queue Monitoring**: Real-time metrics for queue depth and processing rates
- **Backpressure Handling**: Graceful degradation when system is overloaded
- **Performance Timers**: Built-in utilities for measuring operation performance
- **Memory Management**: LRU cache with size limits and TTL-based cleanup

#### Utility Functions
- **Unique ID Generation**: Crypto-based unique identifiers for error tracking
- **Deep Object Cloning**: Safe object duplication utilities
- **Safe Function Execution**: Error-resilient function wrappers
- **Environment Validation**: Comprehensive environment variable checking
- **Configuration Management**: Type-safe environment variable parsing

### Logging

File transports output JSON objects with timestamps and stack traces. Console
output, enabled when `QERRORS_VERBOSE=true`, uses a compact printf format for
readability.

### AI Model Management (LangChain Integration)

qerrors supports multiple AI providers through LangChain integration, with Google Gemini as the primary provider for error analysis:

#### Supported Providers
- **Google Gemini**: Gemini 2.5 Flash-lite model (default, recommended)
- **OpenAI**: GPT-4o model (optional alternative)

#### Configuration
Set the AI provider and model using environment variables:
```bash
# For Google Gemini (default, recommended)
export GEMINI_API_KEY="your-gemini-api-key"
# Optional: specify a specific Gemini model
export QERRORS_AI_MODEL="gemini-2.5-flash-lite"

# For OpenAI (alternative provider)
export OPENAI_API_KEY="your-openai-api-key"
export QERRORS_AI_PROVIDER="openai"
# Optional: specify a specific OpenAI model
export QERRORS_AI_MODEL="gpt-4o"
```

#### Using AI Model Manager
```javascript
const { getAIModelManager, MODEL_PROVIDERS, createLangChainModel } = require('qerrors');

// Get the current AI model manager
const modelManager = getAIModelManager();

// Available providers
console.log(MODEL_PROVIDERS.GOOGLE);  // 'google' (primary)
console.log(MODEL_PROVIDERS.OPENAI);  // 'openai' (alternative)

// Create a specific LangChain model
const geminiModel = createLangChainModel('google'); // Primary provider
const openaiModel = createLangChainModel('openai'); // Alternative provider

// Create models with specific model names
const specificGeminiModel = createLangChainModel('google', 'gemini-2.5-flash-lite');
const specificOpenAIModel = createLangChainModel('openai', 'gpt-4o');

// Get current model information
const currentInfo = modelManager.getCurrentModelInfo();
console.log(`Using provider: ${currentInfo.provider}, model: ${currentInfo.model}`);
```

#### Complete Configuration Examples

**Using Google Gemini with specific model:**
```bash
export GEMINI_API_KEY="your-gemini-api-key"
export QERRORS_AI_PROVIDER="google"          # Optional (default)
export QERRORS_AI_MODEL="gemini-2.5-flash-lite"  # Optional (default)
```

**Using OpenAI with specific model:**
```bash
export OPENAI_API_KEY="your-openai-api-key"
export QERRORS_AI_PROVIDER="openai"
export QERRORS_AI_MODEL="gpt-4o"             # Optional (default for OpenAI)
```

**Available Models by Provider:**
- **Google Gemini**: `gemini-2.5-flash-lite` (default), `gemini-2.0-flash-exp`, `gemini-pro`, `gemini-1.5-pro`, `gemini-1.5-flash`
- **OpenAI**: `gpt-4o` (default), `gpt-4o-mini`, `gpt-4`, `gpt-3.5-turbo`

### Enhanced Logging Features

qerrors provides comprehensive logging capabilities beyond basic error logging:

#### Performance Monitoring
```javascript
const { createPerformanceTimer, logInfo } = require('qerrors');

// Create a performance timer
const timer = createPerformanceTimer('database-query');
// ... perform operation
timer.end(); // Automatically logs performance metrics
```

#### Security-Aware Sanitization
```javascript
const { 
  sanitizeMessage, 
  sanitizeContext, 
  addCustomSanitizationPattern 
} = require('qerrors');

// Basic sanitization
const safemessage = sanitizeMessage('User password: secret123');
// Result: 'User password: [REDACTED]'

// Add custom patterns
addCustomSanitizationPattern(/api[_-]?key[s]?\s*[:=]\s*[\w-]+/gi, '[API_KEY_REDACTED]');

// Sanitize complex objects
const safeContext = sanitizeContext({
  user: { id: 123, password: 'secret' },
  apiKey: 'sk-1234567890'
});
```

#### Multi-Level Logging
```javascript
const { logDebug, logInfo, logWarn, logError, logFatal, logAudit } = require('qerrors');

// Different log levels with automatic sanitization
logDebug('Debug information', { debugData: 'test' });
logInfo('Application started', { port: 3000 });
logWarn('Deprecated function used', { function: 'oldMethod' });
logError('Database connection failed', new Error('Connection timeout'));
logFatal('System critical error', { system: 'auth' });
logAudit('User action performed', { userId: 123, action: 'login' });
```

### Queue Management and Monitoring

Monitor and control the AI analysis queue:

```javascript
const { 
  getQueueLength, 
  getQueueRejectCount, 
  startQueueMetrics, 
  stopQueueMetrics 
} = require('qerrors');

// Monitor queue status
console.log(`Queue depth: ${getQueueLength()}`);
console.log(`Rejected requests: ${getQueueRejectCount()}`);

// Start periodic metrics logging
startQueueMetrics(30000); // Log every 30 seconds

// Stop metrics when done
stopQueueMetrics();
```

### Utility Functions

```javascript
const { 
  generateUniqueId, 
  createTimer, 
  deepClone, 
  safeRun 
} = require('qerrors');

// Generate unique identifiers
const id = generateUniqueId();

// Performance timing
const timer = createTimer();
// ... perform operation
const elapsed = timer.end();

// Safe object cloning
const cloned = deepClone(originalObject);

// Safe function execution
const result = await safeRun(async () => {
  // Potentially failing operation
  return await riskyFunction();
}, 'fallback value');
```

### Environment and Configuration

```javascript
const { 
  getEnv, 
  getInt, 
  getMissingEnvVars, 
  throwIfMissingEnvVars 
} = require('qerrors');

// Get environment variables with defaults
const port = getInt('PORT', 3000);
const dbUrl = getEnv('DATABASE_URL', 'localhost');

// Validate required API keys for AI providers
throwIfMissingEnvVars(['GEMINI_API_KEY']); // Primary AI provider
// or alternatively: throwIfMissingEnvVars(['OPENAI_API_KEY']);

// Check for missing optional variables
const missing = getMissingEnvVars(['GEMINI_API_KEY', 'OPENAI_API_KEY']);
if (missing.length > 0) {
  console.log(`AI provider keys not set: ${missing.join(', ')}`);
}
```

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

The test suite uses Node's built-in test runner with qtests integration for enhanced testing utilities and custom stubs for offline testing. Tests include comprehensive coverage of error handling, AI integration, middleware functionality, and all utility modules.

**Current test status: 157/157 tests passing (100% success rate)**

### Running Tests

Run tests from the project directory:
```bash
npm test
```

Use the dedicated test runner for enhanced output:
```bash
node test-runner.js
```

Or run tests directly:
```bash
node -r ./setup.js --test test/
```

### Test Coverage Includes:

#### Core Functionality
- Core error handling and middleware functionality
- LangChain AI integration with multiple providers (Google Gemini, OpenAI)
- Environment variable validation and configuration
- Cache management and TTL behavior
- Queue concurrency and rejection handling

#### Enhanced Features
- Enhanced logging system with security sanitization
- Performance monitoring and timing utilities
- Data sanitization with custom patterns
- Queue management and monitoring metrics
- Utility functions (ID generation, cloning, safe execution)
- Configuration and environment utilities
- AI model management and provider switching

#### Integration Testing
- Express middleware integration
- Real-world error scenarios
- Cross-module compatibility
- qtests integration and stubbing utilities

### Testing Infrastructure

The project uses **qtests** for enhanced testing capabilities:
- Reduced test boilerplate by ~30%
- Comprehensive stubbing utilities
- Conditional setup to avoid conflicts
- Hybrid stubbing approach for wrapped functions
- Built-in test environment management

### Continuous Integration

GitHub Actions runs this test suite automatically on every push and pull request using Node.js LTS. The workflow caches npm dependencies to speed up subsequent runs and ensures compatibility across different Node.js versions.


