/**
 * Enhanced Error Message Filtering Module
 * 
 * Purpose: Provides comprehensive error message filtering to prevent
 * information disclosure in production environments while maintaining
 * useful debugging information for developers.
 * 
 * Security Features:
 * - Redacts sensitive information (API keys, passwords, tokens)
 * - Removes file paths and internal system details
 * - Filters personally identifiable information (PII)
 * - Sanitizes SQL injection attempts from error messages
 * - Limits error message length to prevent data leakage
 */

/**
 * Enhanced error message sanitization for production use
 * @param {string} message - Original error message
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized error message
 */
function sanitizeErrorMessage(message, options = {}) {
  const {
    includeStack = false,
    maxMessageLength = 500,
    environment = process.env.NODE_ENV || 'development',
    strictMode = environment === 'production'
  } = options;
  
  if (!message || typeof message !== 'string') {
    return 'An unexpected error occurred';
  }
  
  let sanitized = message;
  
  if (strictMode) {
    // Production mode - aggressive filtering
    
    // Remove file paths (Windows and Unix)
    sanitized = sanitized.replace(/[a-zA-Z]:\\[^\\s]*/g, '[PATH]');
    sanitized = sanitized.replace(/\/[^\\s]*\//g, '[PATH]');
    sanitized = sanitized.replace(/\\\\[^\\s]*\\\\/g, '[PATH]');
    
    // Remove potential secrets and tokens
    sanitized = sanitized.replace(/[A-Za-z0-9+/]{20,}={0,2}/g, '[REDACTED]'); // Base64
    sanitized = sanitized.replace(/[A-Fa-f0-9]{32,}/g, '[REDACTED]'); // Hashes
    sanitized = sanitized.replace(/[A-Z0-9]{15,}/g, '[REDACTED]'); // API keys
    
    // Remove database connection strings
    sanitized = sanitized.replace(/(mongodb|mysql|postgres|redis):\/\/[^\s]*/gi, '[DB_CONNECTION]');
    
    // Remove passwords and secrets
    const passwordPattern = /(password|pwd|pass|secret|token|api[_-]?key|auth)[\s]*[:=][\s]*[^\s,;}\)]+/gi;
    sanitized = sanitized.replace(passwordPattern, '$1 [REDACTED]');
    
    // Remove environment variable references
    sanitized = sanitized.replace(/\$\{[^}]+\}/g, '[ENV_VAR]');
    
    // Remove IP addresses (except localhost)
    const ipPattern = /\b(?!127\.0\.0\.1\b)(?!localhost\b)(\d{1,3}\.){3}\d{1,3}\b/g;
    sanitized = sanitized.replace(ipPattern, '[IP_ADDRESS]');
    
    // Remove URLs with parameters
    sanitized = sanitized.replace(/https?:\/\/[^\s]*[\?\#][^\s]*/gi, '[URL_WITH_PARAMS]');
    
    // Remove email addresses
    sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]');
    
    // Remove phone numbers
    sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
    
    // Remove SQL injection patterns
    const sqlPattern = /(['\\']|[;]|--|\s+(or|and)\s+[\d\s=]+|\s+(union|select|insert|update|delete|drop|create|alter|exec)\s+)/gi;
    sanitized = sanitized.replace(sqlPattern, '[SQL_ATTEMPT]');
    
    // Remove stack trace details
    sanitized = sanitized.replace(/:\d+:\d+/g, ':LINE:COL');
    sanitized = sanitized.replace(/node_modules[\\\/]/g, 'node_modules/');
    sanitized = sanitized.replace(/@[^\s]*[\\\/]/g, '@/');
    
    // Remove excessive repeated characters
    sanitized = sanitized.replace(/(.)\1{10,}/g, '$1$1$1');
    
  } else {
    // Development mode - basic filtering only
    
    // Only remove the most sensitive information
    sanitized = sanitized.replace(/(password|pwd|pass|secret|token|api[_-]?key)[\s]*[:=][\s]*[^\s,;}\)]+/gi, '$1 [REDACTED]');
    sanitized = sanitized.replace(/\$\{[^}]+\}/g, '[ENV_VAR]');
  }
  
  // Truncate very long messages
  if (sanitized.length > maxMessageLength) {
    sanitized = sanitized.substring(0, maxMessageLength - 3) + '...';
  }
  
  // Remove extra whitespace and normalize
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

/**
 * Classify error for appropriate response handling
 * @param {Error} error - Error object
 * @returns {Object} Classification result
 */
function classifyError(error) {
  const classification = {
    type: 'server',
    severity: 'medium',
    userFriendly: false,
    shouldLog: true,
    shouldAlert: false
  };
  
  // Classify by error name
  if (error.name) {
    switch (error.name.toLowerCase()) {
      case 'validationerror':
      case 'typeerror':
        classification.type = 'validation';
        classification.severity = 'low';
        classification.userFriendly = true;
        break;
        
      case 'authenticationerror':
      case 'unauthorizederror':
        classification.type = 'authentication';
        classification.severity = 'medium';
        classification.userFriendly = true;
        break;
        
      case 'authorizationerror':
      case 'forbiddenerror':
        classification.type = 'authorization';
        classification.severity = 'medium';
        classification.userFriendly = true;
        break;
        
      case 'notfounderror':
      case 'entitynotfounderror':
        classification.type = 'not_found';
        classification.severity = 'low';
        classification.userFriendly = true;
        break;
        
      case 'ratelimiterror':
      case 'toomanyrequestserror':
        classification.type = 'rate_limit';
        classification.severity = 'medium';
        classification.userFriendly = true;
        break;
        
      case 'timeouterror':
        classification.type = 'timeout';
        classification.severity = 'high';
        break;
        
      case 'connectionerror':
      case 'networkerror':
        classification.type = 'network';
        classification.severity = 'high';
        classification.shouldAlert = true;
        break;
        
      case 'databaseerror':
      case 'queryerror':
        classification.type = 'database';
        classification.severity = 'high';
        classification.shouldAlert = true;
        break;
        
      case 'criticalerror':
      case 'systemerror':
        classification.type = 'critical';
        classification.severity = 'critical';
        classification.shouldAlert = true;
        break;
    }
  }
  
  // Check for custom severity property
  if (error.severity) {
    classification.severity = error.severity;
  }
  
  // Check for HTTP status codes
  if (error.status || error.statusCode) {
    const status = error.status || error.statusCode;
    
    if (status >= 400 && status < 500) {
      classification.type = 'client';
      classification.userFriendly = true;
    } else if (status >= 500) {
      classification.type = 'server';
      classification.severity = 'high';
    }
  }
  
  return classification;
}

/**
 * Create user-friendly error message
 * @param {Error} error - Error object
 * @param {string} fallback - Fallback message
 * @returns {string} User-friendly error message
 */
function createUserFriendlyMessage(error, fallback = 'An error occurred') {
  const classification = classifyError(error);
  
  if (!classification.userFriendly) {
    return fallback;
  }
  
  // Map error types to user-friendly messages
  const userMessages = {
    validation: 'The provided information is not valid. Please check your input and try again.',
    authentication: 'Authentication failed. Please check your credentials and try again.',
    authorization: 'You do not have permission to perform this action.',
    not_found: 'The requested resource was not found.',
    rate_limit: 'Too many requests. Please wait a moment and try again.',
    timeout: 'The request took too long to complete. Please try again.',
    network: 'Network connection failed. Please check your internet connection.',
    database: 'A database error occurred. Please try again later.',
    critical: 'A critical system error occurred. Please contact support.'
  };
  
  return userMessages[classification.type] || fallback;
}

/**
 * Filter error stack trace for safe display
 * @param {string} stack - Stack trace string
 * @param {Object} options - Filtering options
 * @returns {string} Filtered stack trace
 */
function filterStackTrace(stack, options = {}) {
  const { includePaths = false, maxFrames = 10 } = options;
  
  if (!stack || typeof stack !== 'string') {
    return '';
  }
  
  const lines = stack.split('\n');
  const filteredLines = [];
  
  for (let i = 0; i < Math.min(lines.length, maxFrames); i++) {
    let line = lines[i];
    
    if (!includePaths) {
      // Remove file paths from stack frames
      line = line.replace(/[a-zA-Z]:\\[^\\s]*/g, '[PATH]');
      line = line.replace(/\/[^\\s]*/g, '[PATH]');
      line = line.replace(/node_modules[\\\/]/g, 'node_modules/');
      line = line.replace(/@[^\s]*[\\\/]/g, '@/');
    }
    
    filteredLines.push(line);
  }
  
  return filteredLines.join('\n');
}

module.exports = {
  sanitizeErrorMessage,
  classifyError,
  createUserFriendlyMessage,
  filterStackTrace
};