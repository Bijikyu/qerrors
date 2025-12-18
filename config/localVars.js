/**
 * Local Variables Configuration
 * 
 * This file contains centralized constants and environment variables
 * moved from global scope across the codebase to improve maintainability
 * and reduce direct environment variable access.
 */

// AI Model Configuration
const MODEL_PROVIDERS = {
  OPENAI: 'openai',
  GOOGLE: 'google'
};

// Circuit Breaker Configuration
const CircuitState = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

// Error Types and Severity
const ErrorTypes = {
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  NOT_FOUND: 'not_found',
  RATE_LIMIT: 'rate_limit',
  NETWORK: 'network',
  DATABASE: 'database',
  SYSTEM: 'system',
  CONFIGURATION: 'configuration'
};

const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// HTTP Status Constants
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};

// Default Messages
const DEFAULT_MESSAGES = {
  VALIDATION_FAILED: 'Validation failed',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  INTERNAL_ERROR: 'Internal server error'
};

// Log Levels Configuration
const LOG_LEVELS = {
  DEBUG: { priority: 10, color: '\x1b[36m', name: 'DEBUG' },
  INFO: { priority: 20, color: '\x1b[32m', name: 'INFO' },
  WARN: { priority: 30, color: '\x1b[33m', name: 'WARN' },
  ERROR: { priority: 40, color: '\x1b[31m', name: 'ERROR' },
  FATAL: { priority: 50, color: '\x1b[35m', name: 'FATAL' },
  AUDIT: { priority: 60, color: '\x1b[34m', name: 'AUDIT' }
};

// Environment Variables - Configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';

// Environment Variables - AI Model Settings
const QERRORS_AI_PROVIDER = process.env.QERRORS_AI_PROVIDER;
const QERRORS_AI_MODEL = process.env.QERRORS_AI_MODEL;
const QERRORS_MAX_TOKENS = process.env.QERRORS_MAX_TOKENS;
const QERRORS_VERBOSE = process.env.QERRORS_VERBOSE;

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

// Error Status and Severity Mappings
const ERROR_STATUS_MAP = {
  [ErrorTypes.VALIDATION]: 400,
  [ErrorTypes.AUTHENTICATION]: 401,
  [ErrorTypes.AUTHORIZATION]: 403,
  [ErrorTypes.NOT_FOUND]: 404,
  [ErrorTypes.RATE_LIMIT]: 429,
  [ErrorTypes.NETWORK]: 502,
  [ErrorTypes.DATABASE]: 500,
  [ErrorTypes.SYSTEM]: 500,
  [ErrorTypes.CONFIGURATION]: 500
};

const ERROR_SEVERITY_MAP = {
  [ErrorTypes.VALIDATION]: ErrorSeverity.LOW,
  [ErrorTypes.AUTHENTICATION]: ErrorSeverity.LOW,
  [ErrorTypes.AUTHORIZATION]: ErrorSeverity.MEDIUM,
  [ErrorTypes.NOT_FOUND]: ErrorSeverity.LOW,
  [ErrorTypes.RATE_LIMIT]: ErrorSeverity.MEDIUM,
  [ErrorTypes.NETWORK]: ErrorSeverity.MEDIUM,
  [ErrorTypes.DATABASE]: ErrorSeverity.HIGH,
  [ErrorTypes.SYSTEM]: ErrorSeverity.HIGH,
  [ErrorTypes.CONFIGURATION]: ErrorSeverity.CRITICAL
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
  circuitBreakerThreshold: 5,
  circuitBreakerTimeoutMs: 60000
};

// Export all constants
module.exports = {
  MODEL_PROVIDERS,
  CircuitState,
  ErrorTypes,
  ErrorSeverity,
  HTTP_STATUS,
  DEFAULT_MESSAGES,
  LOG_LEVELS,
  NODE_ENV,
  DEFAULT_ERROR_MESSAGE,
  QERRORS_AI_PROVIDER,
  QERRORS_AI_MODEL,
  QERRORS_MAX_TOKENS,
  QERRORS_VERBOSE,
  QERRORS_LOG_MAXSIZE,
  QERRORS_LOG_MAXFILES,
  QERRORS_LOG_MAX_DAYS,
  QERRORS_LOG_DIR,
  QERRORS_DISABLE_FILE_LOGS,
  QERRORS_SERVICE_NAME,
  QERRORS_LOG_LEVEL,
  QERRORS_CONCURRENCY,
  QERRORS_CACHE_LIMIT,
  QERRORS_CACHE_TTL,
  QERRORS_QUEUE_LIMIT,
  QERRORS_SAFE_THRESHOLD,
  QERRORS_RETRY_ATTEMPTS,
  QERRORS_RETRY_BASE_MS,
  QERRORS_RETRY_MAX_MS,
  QERRORS_TIMEOUT,
  QERRORS_MAX_SOCKETS,
  QERRORS_MAX_FREE_SOCKETS,
  QERRORS_OPENAI_URL,
  QERRORS_METRIC_INTERVAL_MS,
  CONFIG_DEFAULTS,
  MODEL_CONFIGS,
  ERROR_STATUS_MAP,
  ERROR_SEVERITY_MAP,
  ROTATION_OPTS,
  LOG_DIR,
  DISABLE_FILE_LOGS,
  STANDARD_ERROR_RESPONSE,
  ERROR_SEVERITY_MAP_CONTRACTS,
  DEFAULT_ASYNC_CONFIG
};