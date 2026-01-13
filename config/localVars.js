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
 */
const CircuitState = {
  CLOSED: 'CLOSED',      // Normal operation, calls pass through
  OPEN: 'OPEN',          // Circuit is open, calls fail fast
  HALF_OPEN: 'HALF_OPEN'  // Testing state, limited calls allowed
};

// ====================================================================
// ERROR CLASSIFICATION - Error types and severity levels
// ====================================================================

/**
 * Error type enumeration
 * 
 * Defines the categories of errors that can occur in the system.
 * Each error type maps to appropriate HTTP status codes and
 * handling strategies.
 */
const ErrorTypes = {
  VALIDATION: 'validation',        // Input validation failures
  AUTHENTICATION: 'authentication', // Authentication failures
  AUTHORIZATION: 'authorization',   // Authorization/permission failures
  NOT_FOUND: 'not_found',          // Resource not found
  RATE_LIMIT: 'rate_limit',        // Rate limiting exceeded
  NETWORK: 'network',              // Network service failures
  DATABASE: 'database',            // Database operation failures
  SYSTEM: 'system',                // Internal system failures
  CONFIGURATION: 'configuration'   // Configuration issues
};

/**
 * Error severity enumeration
 * 
 * Defines the severity levels for error classification.
 * Severity determines logging levels and operational priority.
 */
const ErrorSeverity = {
  LOW: 'low',        // Low impact, user-facing issues
  MEDIUM: 'medium',  // Medium impact, operational issues
  HIGH: 'high',      // High impact, system issues
  CRITICAL: 'critical' // Critical impact, system-wide issues
};

// ====================================================================
// HTTP PROTOCOL - Status codes and default messages
// ====================================================================

/**
 * HTTP status code constants
 * 
 * Standard HTTP status codes used throughout the application
 * for consistent response handling.
 */
const HTTP_STATUS = {
  // Success codes
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  
  // Redirection codes
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,
  
  // Client error codes
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  
  // Server error codes
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

/**
 * Default error messages
 * 
 * Standardized error messages for common scenarios.
 * These provide consistent user-facing error messages.
 */
const DEFAULT_MESSAGES = {
  VALIDATION_FAILED: 'Validation failed',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  INTERNAL_ERROR: 'Internal server error',
  RATE_LIMITED: 'Rate limit exceeded',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable'
};

// ====================================================================
// LOGGING SYSTEM - Log levels and configuration
// ====================================================================

/**
 * Logging level definitions
 * 
 * Defines the logging levels with priorities and formatting
 * for consistent log management throughout the system.
 */
const LOG_LEVELS = {
  DEBUG: { priority: 0, color: 'gray', name: 'DEBUG' },
  INFO: { priority: 1, color: 'blue', name: 'INFO' },
  WARN: { priority: 2, color: 'yellow', name: 'WARN' },
  ERROR: { priority: 3, color: 'red', name: 'ERROR' },
  FATAL: { priority: 4, color: 'magenta', name: 'FATAL' },
  AUDIT: { priority: 5, color: 'cyan', name: 'AUDIT' }
};

// ====================================================================
// ENVIRONMENT VARIABLES - Runtime configuration from environment
// ====================================================================

// Environment and Runtime
const NODE_ENV = process.env.NODE_ENV || 'development';
const DEFAULT_ERROR_MESSAGE = process.env.QERRORS_DEFAULT_MESSAGE || 'An error occurred';

// AI Model Environment Variables
const QERRORS_AI_PROVIDER = process.env.QERRORS_AI_PROVIDER || 'openai';
const QERRORS_AI_MODEL = process.env.QERRORS_AI_MODEL || 'gpt-4o';
const QERRORS_MAX_TOKENS = process.env.QERRORS_MAX_TOKENS || '4096';
const QERRORS_VERBOSE = process.env.QERRORS_VERBOSE === 'true';

// Logging Environment Variables
const QERRORS_LOG_MAXSIZE = process.env.QERRORS_LOG_MAXSIZE || '1048576';
const QERRORS_LOG_MAXFILES = process.env.QERRORS_LOG_MAXFILES || '5';
const QERRORS_LOG_MAX_DAYS = process.env.QERRORS_LOG_MAX_DAYS || '30';
const QERRORS_LOG_DIR = process.env.QERRORS_LOG_DIR || 'logs';
const QERRORS_DISABLE_FILE_LOGS = process.env.QERRORS_DISABLE_FILE_LOGS === 'true';
const QERRORS_SERVICE_NAME = process.env.QERRORS_SERVICE_NAME || 'qerrors';
const QERRORS_LOG_LEVEL = process.env.QERRORS_LOG_LEVEL || 'info';

// Performance and Limits
const QERRORS_CONCURRENCY = process.env.QERRORS_CONCURRENCY || '3';
const QERRORS_CACHE_LIMIT = process.env.QERRORS_CACHE_LIMIT || '1000';
const QERRORS_CACHE_TTL = process.env.QERRORS_CACHE_TTL || '300000';
const QERRORS_QUEUE_LIMIT = process.env.QERRORS_QUEUE_LIMIT || '100';
const QERRORS_SAFE_THRESHOLD = process.env.QERRORS_SAFE_THRESHOLD || '80';
const QERRORS_RETRY_ATTEMPTS = process.env.QERRORS_RETRY_ATTEMPTS || '3';
const QERRORS_RETRY_BASE_MS = process.env.QERRORS_RETRY_BASE_MS || '1000';
const QERRORS_RETRY_MAX_MS = process.env.QERRORS_RETRY_MAX_MS || '10000';
const QERRORS_TIMEOUT = process.env.QERRORS_TIMEOUT || '30000';
const QERRORS_MAX_SOCKETS = process.env.QERRORS_MAX_SOCKETS || '50';
const QERRORS_MAX_FREE_SOCKETS = process.env.QERRORS_MAX_FREE_SOCKETS || '10';
const QERRORS_OPENAI_URL = process.env.QERRORS_OPENAI_URL || 'https://api.openai.com/v1/chat/completions';
const QERRORS_METRIC_INTERVAL_MS = process.env.QERRORS_METRIC_INTERVAL_MS || '60000';

// ====================================================================
// CONFIGURATION DEFAULTS - Default values for AI models
// ====================================================================

const CONFIG_DEFAULTS = {
  [MODEL_PROVIDERS.OPENAI]: {
    models: {
      'gpt-3.5-turbo': { maxTokens: 4096, temperature: 0.1, topP: 1 },
      'gpt-4o': { maxTokens: 4096, temperature: 0.1, topP: 1 },
      'gpt-4o-mini': { maxTokens: 4096, temperature: 0.1, topP: 1 }
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

// ====================================================================
// LOGGING CONFIGURATION - Log rotation and file management
// ====================================================================

// Logging Rotation Options
const ROTATION_OPTS = {
  maxsize: Number(QERRORS_LOG_MAXSIZE) || 1024 * 1024,
  maxFiles: Number(QERRORS_LOG_MAXFILES) || 5,
  tailable: true
};

// File Paths and Directories
const LOG_DIR = QERRORS_LOG_DIR || 'logs';
const DISABLE_FILE_LOGS = !!QERRORS_DISABLE_FILE_LOGS;

// ====================================================================
// ERROR RESPONSE STANDARDS - Standardized error response format
// ====================================================================

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

// ====================================================================
// ASYNC CONFIGURATION - Default async operation settings
// ====================================================================

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

module.exports = {
  // AI Model Configuration
  MODEL_PROVIDERS,           // AI provider enumeration
  CONFIG_DEFAULTS,          // Configuration defaults
  
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
  QERRORS_MAX_SOCKETS,        // Max HTTP sockets
  QERRORS_MAX_FREE_SOCKETS,   // Max free sockets
  QERRORS_OPENAI_URL,         // OpenAI API URL
  QERRORS_METRIC_INTERVAL_MS, // Metrics collection interval
  
  // Error Response Standards
  STANDARD_ERROR_RESPONSE,     // Standardized error response format
  ERROR_SEVERITY_MAP_CONTRACTS, // Contract-based severity mapping
  
  // Async Operation Configuration
  DEFAULT_ASYNC_CONFIG,       // Default async operation settings
  
  // Retry Configuration Presets
  RetryConfigPresets          // Predefined retry configs for common workloads
};