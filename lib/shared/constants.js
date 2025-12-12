'use strict';

// HTTP Status Code Constants
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};

// Standard Response Messages
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

module.exports = {
  HTTP_STATUS,
  DEFAULT_MESSAGES,
  LOG_LEVELS
};