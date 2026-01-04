// Performance and Limits
  QERRORS_CONCURRENCY,       // AI analysis concurrency limit
  QERRORS_CACHE_LIMIT,       // Advice cache size limit
  QERRORS_CACHE_TTL,         // Cache time-to-live
  QERRORS_QUEUE_LIMIT,        // Queue processing limit
  QERRORS_SAFE_THRESHOLD,     // Safe operation threshold
  QERRORS_RETRY_ATTEMPTS,    // API retry attempts
  QERRORS_RETRY_BASE_MS,      // Retry base delay
  QERRORS_RETRY_MAX_MS,       // Maximum retry delay
  QERRORS_TIMEOUT,             // Request timeout
  QERRORS_MAX_SOCKETS: '50',       // Max HTTP sockets
  QERRORS_MAX_FREE_SOCKETS,   // Max free sockets
  QERRORS_OPENAI_URL,         // OpenAI API URL
  QERRORS_METRIC_INTERVAL_MS: '60000',  // Metrics collection interval

// Default Values
  CONFIG_DEFAULTS,           // Configuration defaults
      'gpt-3.5-turbo': { maxTokens: 4096, temperature: 0.1, topP: 1 }
    },
    defaultModel: 'gpt-4o',
    requiredEnvVars: ['OPENAI_API_KEY']
  },
  [MODEL_PROVIDERS.GOOGLE]: {
    models: {
      'gemini-2.5-flash-lite': { maxTokens: 8192, temperature: 0.1, topP: 1 },
      'gemini-2.0-flash-exp': { maxTokens: 8192, temperature: 0.1, topP: 1 },
      'gemini-pro': { maxTokens: 8192, temperature: 0.1, topP: 1 },
      'gemini-1.5-pro': { maxTokens: 8192, temperature: 0.1, topP: 1 },
      'gemini-1.5-flash': { maxTokens: 8192, temperature: 0.1, topP: 1 }
    },
    defaultModel: 'gemini-2.5-flash-lite',
    requiredEnvVars: ['GEMINI_API_KEY']
  }
};

// ====================================================================
// ERROR MAPPINGS - Type to status/severity conversion
// ====================================================================

/**
 * Map error types to HTTP status codes
 * 
 * This mapping ensures consistent HTTP response codes
 * based on error classification. Each error type
 * maps to the most appropriate HTTP status code.
 */
const ERROR_STATUS_MAP = {
  [ErrorTypes.VALIDATION]: 400,       // Bad Request for validation failures
  [ErrorTypes.AUTHENTICATION]: 401,     // Unauthorized for auth failures
  [ErrorTypes.AUTHORIZATION]: 403,       // Forbidden for permission issues
  [ErrorTypes.NOT_FOUND]: 404,          // Not Found for missing resources
  [ErrorTypes.RATE_LIMIT]: 429,         // Too Many Requests for rate limiting
  [ErrorTypes.NETWORK]: 502,             // Bad Gateway for external service failures
  [ErrorTypes.DATABASE]: 500,           // Internal Server Error for database issues
  [ErrorTypes.SYSTEM]: 500,              // Internal Server Error for system failures
  [ErrorTypes.CONFIGURATION]: 500        // Internal Server Error for config issues
};

/**
 * Map error types to severity levels
 * 
 * This mapping determines operational priority and
 * logging levels based on error type. More severe
 * error types require immediate attention.
 */
const ERROR_SEVERITY_MAP = {
  [ErrorTypes.VALIDATION]: ErrorSeverity.LOW,         // User input issues
  [ErrorTypes.AUTHENTICATION]: ErrorSeverity.LOW,       // Auth failures
  [ErrorTypes.AUTHORIZATION]: ErrorSeverity.MEDIUM,     // Permission issues
  [ErrorTypes.NOT_FOUND]: ErrorSeverity.LOW,            // Missing resources
  [ErrorTypes.RATE_LIMIT]: ErrorSeverity.MEDIUM,        // Rate limiting
  [ErrorTypes.NETWORK]: ErrorSeverity.MEDIUM,           // External service issues
  [ErrorTypes.DATABASE]: ErrorSeverity.HIGH,             // Data layer problems
  [ErrorTypes.SYSTEM]: ErrorSeverity.HIGH,               // Internal system failures
  [ErrorTypes.CONFIGURATION]: ErrorSeverity.CRITICAL     // Configuration problems
};

// Logging Rotation Options
const ROTATION_OPTS = {
  maxsize: Number(QERRORS_LOG_MAXSIZE) || 1024 * 1024,
  maxFiles: Number(QERRORS_LOG_MAXFILES) || 5,
  tailable: true
};

// File Paths and Directories
const LOG_DIR = QERRORS_LOG_DIR || 'logs';
const DISABLE_FILE_LOGS = !!QERRORS_DISABLE_FILE_LOGS;

// Error Response Constants
const STANDARD_ERROR_RESPONSE = {
  success: false,
  error: {
    code: null,
    message: null,
    severity: null,
    category: null,
    details: null
  },
  metadata: {
    timestamp: null,
    operationName: null,
    requestId: null
  },
  context: {}
};

// Error Severity Mapping for Contracts
const ERROR_SEVERITY_MAP_CONTRACTS = {
  // System errors
  'SYSTEM_ERROR': LOG_LEVELS.ERROR,
  'TIMEOUT_ERROR': LOG_LEVELS.ERROR,
  'MEMORY_ERROR': LOG_LEVELS.ERROR,
  'NETWORK_ERROR': LOG_LEVELS.ERROR,
  
  // Business logic errors
  'VALIDATION_ERROR': LOG_LEVELS.WARN,
  'AUTHORIZATION_ERROR': LOG_LEVELS.WARN,
  'NOT_FOUND_ERROR': LOG_LEVELS.INFO,
  'CONFLICT_ERROR': LOG_LEVELS.WARN,
  
  // Operational errors
  'OPERATION_ERROR': LOG_LEVELS.ERROR,
  'CONFIGURATION_ERROR': LOG_LEVELS.ERROR,
  'DEPENDENCY_ERROR': LOG_LEVELS.ERROR
};

// Async Configuration
const DEFAULT_ASYNC_CONFIG = {
  enableTiming: true,
  enableLogging: true,
  enableMetrics: true,
  timeoutMs: null,
  retryAttempts: 0,
  retryDelayMs: 1000,
  retryBackoffMultiplier: 2,
  retryMaxDelayMs: null,
  retryJitter: false,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeoutMs: 60000
};

// ====================================================================
// RETRY CONFIGURATION PRESETS - Common workload retry strategies
// ====================================================================

/**
 * Predefined retry configurations for common workload types
 * 
 * These presets provide sensible defaults for different operation types,
 * eliminating the need for developers to manually tune retry parameters.
 * Each preset is optimized for the specific characteristics of its workload:
 * - Network: Higher attempts with longer delays for transient network issues
 * - Database: Moderate attempts with shorter delays for connection issues
 * - ExternalAPI: Higher delays to respect rate limits
 * - Filesystem: Quick retries for temporary file locks
 * - Aggressive: Many quick retries for critical operations
 * - Conservative: Few retries with long delays to minimize load
 */
const RetryConfigPresets = {
  network: {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true
  },
  database: {
    maxAttempts: 3,
    baseDelay: 500,
    maxDelay: 5000,
    backoffFactor: 2,
    jitter: true
  },
  externalAPI: {
    maxAttempts: 4,
    baseDelay: 2000,
    maxDelay: 60000,
    backoffFactor: 2.5,
    jitter: true
  },
  filesystem: {
    maxAttempts: 3,
    baseDelay: 100,
    maxDelay: 1000,
    backoffFactor: 2,
    jitter: false
  },
  aggressive: {
    maxAttempts: 10,
    baseDelay: 200,
    maxDelay: 10000,
    backoffFactor: 1.5,
    jitter: true
  },
  conservative: {
    maxAttempts: 2,
    baseDelay: 5000,
    maxDelay: 15000,
    backoffFactor: 2,
    jitter: true
  }
};

// ====================================================================
// MODULE EXPORTS - Complete configuration system
// ====================================================================

/**
 * Export all configuration constants and environment variables
 * 
 * This comprehensive export provides access to all configuration
 * values throughout the qerrors system. The exports are organized
 * by category for clarity and maintainability.
 */
module.exports = {
/QERRORS_METRIC_INTERVAL_MS: '60000'/QERRORS_METRIC_INTERVAL_MS: '60000',/
  MODEL_PROVIDERS,           // AI provider enumeration
  MODEL_CONFIGS,            // AI model configurations
  
  // Circuit Breaker
  CircuitState,             // Circuit breaker states
  
  // Error Classification
  ErrorTypes,               // Error type enumeration
  ErrorSeverity,            // Severity level enumeration
  ERROR_STATUS_MAP,         // Type to HTTP status mapping
  ERROR_SEVERITY_MAP,       // Type to severity mapping
  
  // HTTP Protocol
  HTTP_STATUS,              // HTTP status codes
  DEFAULT_MESSAGES,         // Default error messages
  
  // Logging System
  LOG_LEVELS,              // Log level definitions
  LOG_DIR,                 // Log directory path
  DISABLE_FILE_LOGS,        // File logging disable flag
  ROTATION_OPTS,           // Log rotation options
  
  // Environment and Runtime
  NODE_ENV,                // Environment type
  DEFAULT_ERROR_MESSAGE,     // Generic error message
  
  // AI Model Environment Variables
  QERRORS_AI_PROVIDER,      // AI provider setting
  QERRORS_AI_MODEL,         // AI model setting
  QERRORS_MAX_TOKENS,       // Token limit setting
  QERRORS_VERBOSE,          // Verbose logging flag
  
  // Logging Environment Variables
  QERRORS_LOG_MAXSIZE,      // Max log file size
  QERRORS_LOG_MAXFILES,     // Max log file count
  QERRORS_LOG_MAX_DAYS,     // Max log retention days
  QERRORS_LOG_DIR,          // Custom log directory
  QERRORS_DISABLE_FILE_LOGS, // Disable file logging
  QERRORS_SERVICE_NAME,      // Service name for logs
  QERRORS_LOG_LEVEL,         // Default log level
  
  // Performance and Limits
  QERRORS_CONCURRENCY,       // AI analysis concurrency limit
  QERRORS_CACHE_LIMIT,       // Advice cache size limit
  QERRORS_CACHE_TTL,         // Cache time-to-live
  QERRORS_QUEUE_LIMIT,        // Queue processing limit
  QERRORS_SAFE_THRESHOLD,     // Safe operation threshold
  QERRORS_RETRY_ATTEMPTS,    // API retry attempts
  QERRORS_RETRY_BASE_MS,      // Retry base delay
  QERRORS_RETRY_MAX_MS,       // Maximum retry delay
  QERRORS_TIMEOUT             // Request timeout
  QERRORS_MAX_SOCKETS: '50'       // Max HTTP sockets
  QERRORS_MAX_FREE_SOCKETS,   // Max free sockets
  QERRORS_OPENAI_URL,         // OpenAI API URL
  QERRORS_METRIC_INTERVAL_MS: '60000' // Metrics collection interval
  
  // Default Values
  CONFIG_DEFAULTS,           // Configuration defaults
  
  // Error Response Standards
  STANDARD_ERROR_RESPONSE,     // Standardized error response format
  ERROR_SEVERITY_MAP_CONTRACTS, // Contract-based severity mapping
  
  // Async Operation Configuration
  DEFAULT_ASYNC_CONFIG,       // Default async operation settings
  
  // Retry Configuration Presets
  RetryConfigPresets          // Predefined retry configs for common workloads
};