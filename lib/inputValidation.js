/**
 * Comprehensive Input Validation Module
 * 
 * Purpose: Provides secure input validation for all API endpoints
 * to prevent injection attacks, data corruption, and system abuse.
 * 
 * Security Features:
 * - XSS prevention
 * - SQL injection prevention  
 * - Command injection prevention
 * - Data type validation
 * - Length limits
 * - Pattern matching
 * - Encoding validation
 */

const crypto = require('crypto');

/**
 * Maximum allowed lengths for different input types
 */
const LENGTH_LIMITS = {
  name: 100,
  email: 254,        // RFC 5321 standard
  message: 10000,     // Error messages
  context: 5000,      // Context strings
  description: 2000,   // General descriptions
  stackTrace: 50000,   // Stack traces
  url: 2048,          // URLs
  apiKey: 256,        // API keys
  sessionId: 128,      // Session identifiers
  errorCode: 50,       // Error codes
  filename: 255,       // Filenames
  jsonPayload: 1048576 // 1MB JSON payload
};

/**
 * Dangerous patterns that should be blocked
 */
const DANGEROUS_PATTERNS = {
  // XSS and script injection
  xss: [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=\s*["']?[^"']*["']?/gi,
    /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
    /<object[^>]*>[\s\S]*?<\/object>/gi,
    /<embed[^>]*>[\s\S]*?<\/embed>/gi,
    /<link[^>]*>[\s\S]*?<\/link>/gi,
    /<meta[^>]*>[\s\S]*?<\/meta>/gi,
    /vbscript:/gi,
    /data:\s*(text\/html|application\/javascript)/gi,
    
    // Event handlers
    /onclick\s*=/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onmouseover\s*=/gi,
    /onfocus\s*=/gi,
    /onblur\s*=/gi,
    /onchange\s*=/gi,
    /onsubmit\s*=/gi,
    
    // CSS injection
    /expression\s*\(/gi,
    /@import\s+/gi,
    /<style[^>]*>[\s\S]*?<\/style>/gi,
    /behavior\s*:\s*url\(/gi,
    /-moz-binding\s*:/gi,
    
    // Protocol handlers
    /(?:https?|ftp|file|mailto|javascript|data|vbscript):\s*\/\/\S+/gi
  ],
  
  // SQL injection patterns
  sql: [
    /(?:drop\s+table|delete\s+from|insert\s+into|update\s+set|select\s+.*\s+from)\s+/gi,
    /(?:union\s+select|exec\s*\(|eval\s*\(|system\s*\()/gi,
    /(?:'\s*;\s*'|'\s*or\s*'1'\s*=\s*'1|'\s*or\s*1\s*=\s*1)/gi,
    /(?:xp_cmdshell|sp_executesql|openrowset|opendatasource)/gi
  ],
  
  // Command injection
  command: [
    /\|\s*(?:cat|ls|dir|type|more|less|head|tail)/gi,
    /;\s*(?:rm|del|format|fdisk|mkfs)/gi,
    /&&\s*(wget|curl|nc|netcat|telnet)/gi,
    /`[^`]*`/gi,         // Backticks
    /\$\([^)]*\)/g,      // Command substitution
    /<%\s*[\s\S]*?\s*%>/g  // ASP tags
  ],
  
  // Path traversal
  path: [
    /\.\.[\/\\]/,                   // ../ or ..\
    /%2e%2e[\/\\]/i,              // URL encoded ../
    /\x2e\x2e[\/\\]/,             // Hex encoded ../
    /[\/\\]\x2e[\/\\]/,           // /./ in path traversal
    /[\/\\]\x2e\x2e[\/\\]/,       // /../ in path traversal
    /\.\.%2f|\.\.%5c/i,           // Mixed encoding
    /%c0%af|%c1%9c/i             // UTF-8 overlong encoding
  ],
  
  // Control characters and null bytes
  control: [
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,  // Control characters
    /\0/,                                         // Null byte
    /\\r|\\n/,                                   // Carriage return, newline
    /\\t|\\v|\\f/                                // Tab, vertical tab, form feed
  ],
  
  // Encoding abuse
  encoding: [
    /\\u[0-9a-fA-F]{4}/g,        // Unicode escape
    /%[0-9a-fA-F]{2}/g,           // URL encoding
    /&#\d+;/g,                     // HTML entities
    /&#[xX][0-9a-fA-F]+;/g,        // Hex HTML entities
    /%\u[0-9a-fA-F]{4}/gi          // URL-encoded Unicode
  ],
  
  // Prompt injection for AI systems
  prompt: [
    /(?:ignore|forget|skip)\s+previous\b/gi,
    /(?:system|admin|root)\s+(?:prompt|command|access)/gi,
    /(?:act\s+as|pretend\s+to\s+be|roleplay\s+as)/gi,
    /(?:jailbreak|jail\s*break|bypass\s*restriction)/gi,
    /(?:DAN|daniel|assistant\s*name)/gi,
    /(?:developer\s+mode|debug\s+mode|override)/gi,
    /\${[^}]*}/g,                    // Template literal injection
    /{{[^}]*}}/g,                    // Handlebars injection
    /<<[^>]*>>/g                     // Heredoc injection
  ]
};

/**
 * Valid patterns for different input types
 */
const VALID_PATTERNS = {
  email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  url: /^https?:\/\/(?:[\w-]+\.)+[\w-]+(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/,
  apiKey: /^[a-zA-Z0-9\-_+=]{16,256}$/,
  sessionId: /^[a-zA-Z0-9\-_]{8,128}$/,
  errorCode: /^[A-Z0-9_]{1,50}$/,
  filename: /^[a-zA-Z0-9\-_. ]{1,255}$/,
  json: /^\s*(?:\{.*\}|\[.*\])\s*$/
};

/**
 * Sanitize input by removing dangerous content
 * @param {string} input - Input to sanitize
 * @param {string} type - Type of input for specific sanitization
 * @returns {string} Sanitized input
 */
function sanitizeInput(input, type = 'general') {
  if (typeof input !== 'string') {
    return '';
  }
  
  let sanitized = input;
  
  // Remove null bytes and control characters
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.control[0], '');
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.control[1], '');
  
  // Remove dangerous patterns based on type
  if (type === 'html' || type === 'message' || type === 'context') {
    DANGEROUS_PATTERNS.xss.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
  }
  
  if (type === 'database' || type === 'query') {
    DANGEROUS_PATTERNS.sql.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
  }
  
  if (type === 'command' || type === 'filename') {
    DANGEROUS_PATTERNS.command.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    DANGEROUS_PATTERNS.path.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
  }
  
  if (type === 'ai' || type === 'prompt') {
    DANGEROUS_PATTERNS.prompt.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
  }
  
  // Apply length limits
  const maxLength = LENGTH_LIMITS[type] || LENGTH_LIMITS.message;
  sanitized = sanitized.substring(0, maxLength);
  
  return sanitized.trim();
}

/**
 * Validate input against security rules
 * @param {*} input - Input to validate
 * @param {string} type - Type of input
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
function validateInput(input, type = 'general', options = {}) {
  const result = {
    isValid: true,
    errors: [],
    sanitized: input,
    warnings: []
  };
  
  // Type validation
  if (typeof input !== 'string' && type !== 'object' && type !== 'array') {
    result.isValid = false;
    result.errors.push(`Invalid input type: expected string, got ${typeof input}`);
    return result;
  }
  
  if (typeof input !== 'string') {
    // For non-string inputs, just validate the structure
    if (type === 'object' && input && typeof input === 'object') {
      result.sanitized = input;
      return result;
    }
    result.isValid = false;
    result.errors.push(`Invalid input for type ${type}`);
    return result;
  }
  
  // Length validation
  const maxLength = options.maxLength || LENGTH_LIMITS[type] || LENGTH_LIMITS.message;
  const minLength = options.minLength || 0;
  
  if (input.length < minLength) {
    result.isValid = false;
    result.errors.push(`Input too short: minimum ${minLength} characters`);
  }
  
  if (input.length > maxLength) {
    result.warnings.push(`Input too long: truncating to ${maxLength} characters`);
    input = input.substring(0, maxLength);
  }
  
  // Pattern validation for specific types
  if (VALID_PATTERNS[type] && !VALID_PATTERNS[type].test(input)) {
    result.isValid = false;
    result.errors.push(`Invalid format for type: ${type}`);
  }
  
  // Security pattern checks
  const securityChecks = ['xss', 'sql', 'command', 'encoding'];
  if (type === 'filename' || type === 'path') {
    securityChecks.push('path');
  }
  if (type === 'ai' || type === 'prompt') {
    securityChecks.push('prompt');
  }
  
  for (const check of securityChecks) {
    if (DANGEROUS_PATTERNS[check]) {
      for (const pattern of DANGEROUS_PATTERNS[check]) {
        if (pattern.test(input)) {
          result.isValid = false;
          result.errors.push(`Dangerous pattern detected: ${check} injection`);
          break;
        }
      }
    }
  }
  
  // Sanitize the input
  result.sanitized = sanitizeInput(input, type);
  
  // Additional checks for specific types
  if (type === 'email') {
    const emailParts = input.split('@');
    if (emailParts.length !== 2 || emailParts[0].length === 0 || emailParts[1].length === 0) {
      result.isValid = false;
      result.errors.push('Invalid email format');
    }
  }
  
  return result;
}

/**
 * Validate JSON payload
 * @param {string|Object} payload - JSON payload to validate
 * @param {Object} schema - Validation schema
 * @returns {Object} Validation result
 */
function validateJsonPayload(payload, schema = {}) {
  const result = {
    isValid: true,
    errors: [],
    sanitized: payload,
    warnings: []
  };
  
  try {
    // Parse if string
    if (typeof payload === 'string') {
      const parsed = JSON.parse(payload);
      payload = parsed;
    }
    
    // Check payload size
    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > LENGTH_LIMITS.jsonPayload) {
      result.isValid = false;
      result.errors.push(`JSON payload too large: ${payloadSize} bytes`);
      return result;
    }
    
    // Schema validation if provided
    if (schema.required && Array.isArray(schema.required)) {
      for (const required of schema.required) {
        if (!(required in payload)) {
          result.isValid = false;
          result.errors.push(`Missing required field: ${required}`);
        }
      }
    }
    
    if (schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        if (field in payload) {
          const fieldValidation = validateInput(
            payload[field], 
            fieldSchema.type || 'general',
            fieldSchema.options || {}
          );
          
          if (!fieldValidation.isValid) {
            result.isValid = false;
            result.errors.push(`Field '${field}': ${fieldValidation.errors.join(', ')}`);
          }
          
          payload[field] = fieldValidation.sanitized;
        }
      }
    }
    
    result.sanitized = payload;
    
  } catch (error) {
    result.isValid = false;
    result.errors.push(`Invalid JSON: ${error.message}`);
  }
  
  return result;
}

/**
 * Generate secure token
 * @param {number} length - Token length
 * @returns {string} Secure token
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
}

/**
 * Create hash of input for comparison
 * @param {string} input - Input to hash
 * @returns {string} SHA-256 hash
 */
function createInputHash(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

module.exports = {
  validateInput,
  validateJsonPayload,
  sanitizeInput,
  generateSecureToken,
  createInputHash,
  LENGTH_LIMITS,
  DANGEROUS_PATTERNS,
  VALID_PATTERNS
};