/**
 * Local Variables Configuration - Centralized constants and environment variables
 * 
 * This file serves as the central configuration hub for the qerrors system,
 * containing all constants, environment variable definitions, default values,
 * and configuration mappings. It eliminates scattered environment access
 * throughout the codebase and provides a single source of truth for
 * configuration management.
 * 
 * Design principles:
 * - Centralize all configuration in one location
 * - Provide sensible defaults for all settings
 * - Support environment variable overrides
 * - Group related configurations together
 * - Maintain backward compatibility
 * - Document all configuration options thoroughly
 */

// ====================================================================
// AI MODEL CONFIGURATION - AI provider and model definitions
// ====================================================================

/**
 * Supported AI model providers
 * 
 * This enumeration defines the AI providers that qerrors can use for
 * error analysis. Each provider has specific configuration requirements
 * and supported models.
 */
const MODEL_PROVIDERS = {
  OPENAI: 'openai',  // OpenAI GPT models
  GOOGLE: 'google'    // Google Gemini models
};

// ====================================================================
// CIRCUIT BREAKER CONFIGURATION - Resilience pattern states
// ====================================================================

/**
 * Circuit breaker states for fault tolerance
 * 
 * The circuit breaker pattern prevents cascading failures by
 * monitoring external service calls and temporarily stopping
 * calls when failure rate exceeds threshold.
 */
const CircuitState = {
  CLOSED: 'CLOSED',      // Normal operation, calls pass through
  OPEN: 'OPEN',          // Circuit is open, calls fail fast
  HALF_OPEN: 'HALF_OPEN'  // Testing state, limited calls allowed
};

// ====================================================================
// ERROR CLASSIFICATION SYSTEM - Error types and severity levels
// ====================================================================

/**
 * Standardized error types for consistent classification
 * 
 * These error types are used throughout the system to categorize
 * errors and determine appropriate handling strategies, logging levels,
 * and HTTP status codes.
 */
const ErrorTypes = {
  VALIDATION: 'validation',       // Input validation failures
  AUTHENTICATION: 'authentication', // Authentication failures
  AUTHORIZATION: 'authorization',   // Permission/authorization failures
  NOT_FOUND: 'not_found',          // Resource not found
  RATE_LIMIT: 'rate_limit',        // Rate limiting exceeded
  NETWORK: 'network',             // Network connectivity issues
  DATABASE: 'database',           // Database operation failures
  SYSTEM: 'system',               // Internal system errors
  CONFIGURATION: 'configuration'   // Configuration issues
};

/**
 * Error severity levels for prioritization
 * 
 * Severity levels determine logging levels, monitoring alerts,
 * and operational response priorities. Higher severity requires
 * immediate attention and potentially automated responses.
 */
const ErrorSeverity = {
  LOW: 'low',         // Informational errors, low impact
  MEDIUM: 'medium',   // Operational issues, moderate impact
  HIGH: 'high',       // Significant issues, high impact
  CRITICAL: 'critical' // Critical failures, immediate attention required
};

// ====================================================================
// HTTP PROTOCOL CONSTANTS - Standard status codes and messages
// ====================================================================

/**
 * Standard HTTP status codes
 * 
 * These constants ensure consistent HTTP status code usage
 * throughout the application and provide semantic clarity
 * when setting response codes.
 */
const HTTP_STATUS = {
  OK: 200,                     // Successful request
  CREATED: 201,                // Resource created successfully
  BAD_REQUEST: 400,            // Client request error
  UNAUTHORIZED: 401,            // Authentication required
  FORBIDDEN: 403,              // Insufficient permissions
  NOT_FOUND: 404,               // Resource not found
  INTERNAL_SERVER_ERROR: 500    // Internal server error
};

/**
 * Default error messages for HTTP responses
 * 
 * These messages provide consistent error messaging for
 * common HTTP error scenarios while still allowing
 * custom messages when needed.
 */
const DEFAULT_MESSAGES = {
  VALIDATION_FAILED: 'Validation failed',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  INTERNAL_ERROR: 'Internal server error'
};

// ====================================================================
// LOGGING SYSTEM CONFIGURATION - Log levels and formatting
// ====================================================================

/**
 * Log levels with priority and formatting
 * 
 * Each log level has a priority number for filtering, a color code
 * for console output, and a name for identification. Priority
 * determines which messages are shown based on configured level.
 */
const LOG_LEVELS = {
  DEBUG: { priority: 10, color: '\x1b[36m', name: 'DEBUG' }, // Cyan - Development info
  INFO: { priority: 20, color: '\x1b[32m', name: 'INFO' },   // Green - General information
  WARN: { priority: 30, color: '\x1b[33m', name: 'WARN' },   // Yellow - Warning conditions
  ERROR: { priority: 40, color: '\x1b[31m', name: 'ERROR' }, // Red - Error conditions
  FATAL: { priority: 50, color: '\x1b[35m', name: 'FATAL' }, // Magenta - Critical failures
  AUDIT: { priority: 60, color: '\x1b[34m', name: 'AUDIT' }  // Blue - Security/audit events
};

// ====================================================================
// ENVIRONMENT VARIABLES - Core configuration
// ====================================================================

/**
 * Runtime environment and basic configuration
 * 
 * These variables control fundamental behavior like error messages,
 * logging verbosity, and operational mode.
 */
const NODE_ENV = process.env.NODE_ENV || 'development';      // Environment type
const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';  // Generic error message

/**
 * AI model configuration variables
 * 
 * These settings control which AI provider and model to use for
 * error analysis, along with request limits and verbosity.
 */
const QERRORS_AI_PROVIDER = process.env.QERRORS_AI_PROVIDER;  // AI provider selection
const QERRORS_AI_MODEL = process.env.QERRORS_AI_MODEL;        // Specific AI model
const QERRORS_MAX_TOKENS = process.env.QERRORS_MAX_TOKENS;    // Token limit for AI requests
const QERRORS_VERBOSE = process.env.QERRORS_VERBOSE;          // Enable verbose logging

// Environment Variables - Logging Configuration
const QERRORS_LOG_MAXSIZE = process.env.QERRORS_LOG_MAXSIZE;
const QERRORS_LOG_MAXFILES = process.env.QERRORS_LOG_MAXFILES;
const QERRORS_LOG_MAX_DAYS = process.env.QERRORS_LOG_MAX_DAYS;
const QERRORS_LOG_DIR = process.env.QERRORS_LOG_DIR;
const QERRORS_DISABLE_FILE_LOGS = process.env.QERRORS_DISABLE_FILE_LOGS;
const QERRORS_SERVICE_NAME = process.env.QERRORS_SERVICE_NAME;
const QERRORS_LOG_LEVEL = process.env.QERRORS_LOG_LEVEL;

// Environment Variables - Performance and Limits
const QERRORS_CONCURRENCY = process.env.QERRORS_CONCURRENCY;
const QERRORS_CACHE_LIMIT = process.env.QERRORS_CACHE_LIMIT;
const QERRORS_CACHE_TTL = process.env.QERRORS_CACHE_TTL;
const QERRORS_QUEUE_LIMIT = process.env.QERRORS_QUEUE_LIMIT;
const QERRORS_SAFE_THRESHOLD = process.env.QERRORS_SAFE_THRESHOLD;
const QERRORS_RETRY_ATTEMPTS = process.env.QERRORS_RETRY_ATTEMPTS;
const QERRORS_RETRY_BASE_MS = process.env.QERRORS_RETRY_BASE_MS;
const QERRORS_RETRY_MAX_MS = process.env.QERRORS_RETRY_MAX_MS;
const QERRORS_TIMEOUT = process.env.QERRORS_TIMEOUT;
const QERRORS_MAX_SOCKETS = process.env.QERRORS_MAX_SOCKETS;
const QERRORS_MAX_FREE_SOCKETS = process.env.QERRORS_MAX_FREE_SOCKETS;
const QERRORS_OPENAI_URL = process.env.QERRORS_OPENAI_URL;
const QERRORS_METRIC_INTERVAL_MS = process.env.QERRORS_METRIC_INTERVAL_MS;

// Default Configuration Values
const CONFIG_DEFAULTS = {
  QERRORS_CONCURRENCY: '5',
  QERRORS_CACHE_LIMIT: '50',
  QERRORS_CACHE_TTL: '86400',
  QERRORS_QUEUE_LIMIT: '100',
  QERRORS_SAFE_THRESHOLD: '1000',
  QERRORS_RETRY_ATTEMPTS: '2',
  QERRORS_RETRY_BASE_MS: '100',
  QERRORS_RETRY_MAX_MS: '2000',
  QERRORS_TIMEOUT: '10000',
  QERRORS_MAX_SOCKETS: '50',
  QERRORS_MAX_FREE_SOCKETS: '256',
  QERRORS_MAX_TOKENS: '2048',
  QERRORS_OPENAI_URL: 'https://api.openai.com/v1/chat/completions',
  QERRORS_LOG_MAXSIZE: String(1024 * 1024),
  QERRORS_LOG_MAXFILES: '5',
  QERRORS_LOG_MAX_DAYS: '0',
  QERRORS_VERBOSE: 'true',
  QERRORS_LOG_DIR: 'logs',
  QERRORS_DISABLE_FILE_LOGS: '',
  QERRORS_SERVICE_NAME: 'qerrors',
  QERRORS_LOG_LEVEL: 'info',
  QERRORS_METRIC_INTERVAL_MS: '60000'
};

// Model Configuration
const MODEL_CONFIGS = {
  [MODEL_PROVIDERS.OPENAI]: {
    models: {
      'gpt-4o': { maxTokens: 4096, temperature: 0.1, topP: 1 },
      'gpt-4o-mini': { maxTokens: 4096, temperature: 0.1, topP: 1 },
      'gpt-4': { maxTokens: 4096, temperature: 0.1, topP: 1 },
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
  maxsize: Number(QERRORS_LOG_MAXSIZE || '') || 1024 * 1024,
  maxFiles: Number(QERRORS_LOG_MAXFILES || '') || 5,
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
  // AI Model Configuration
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
  QERRORS_TIMEOUT,            // Request timeout
  QERRORS_MAX_SOCKETS,       // Max HTTP sockets
  QERRORS_MAX_FREE_SOCKETS,   // Max free sockets
  QERRORS_OPENAI_URL,         // OpenAI API URL
  QERRORS_METRIC_INTERVAL_MS, // Metrics collection interval
  
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