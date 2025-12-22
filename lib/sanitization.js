'use strict';

/**
 * Security Sanitization Module
 * 
 * This module provides comprehensive sanitization of sensitive data in log messages and context objects.
 * It's designed to prevent sensitive information leakage in logs while maintaining useful debugging
 * information. The sanitization is applied both to string content and object property names/values.
 * 
 * Security Rationale:
 * - Logs are often persisted indefinitely and may be accessible to multiple teams
 * - Sensitive data like passwords, tokens, and PII must never appear in logs
 * - Sanitization patterns cover common data formats and naming conventions
 * - The approach is defense-in-depth: sanitize both content and structure
 * 
 * Design Considerations:
 * - Patterns are conservative: better to over-sanitize than under-sanitize
 * - Performance optimized: single pass through data with minimal regex overhead
 * - Recursive object handling ensures nested objects are properly sanitized
* - Preserves data structure while only redacting sensitive content
 * - Memory efficient: bounded stringification and object traversal
 */

/**
 * Safe stringification with depth and length limits to prevent memory exhaustion
 * 
 * @param {any} obj - Object to stringify
 * @param {number} maxDepth - Maximum recursion depth
 * @param {number} maxLength - Maximum string length
 * @returns {string} Safely stringified representation
 */
const safeStringify = (obj, maxDepth = 2, maxLength = 200) => {
  if (maxDepth <= 0) return '[Object]';
  
  if (obj === null || obj === undefined) return '';
  if (typeof obj === 'string') return obj.length > maxLength ? obj.substring(0, maxLength) + '...' : obj;
  if (typeof obj !== 'object') return String(obj);
  
  try {
    let result = '{';
    let count = 0;
    const maxProps = 10; // Limit properties to prevent memory bloat
    
    for (const key in obj) {
      if (count >= maxProps) {
        result += '...';
        break;
      }
      
      if (obj.hasOwnProperty(key)) {
        if (count > 0) result += ',';
        result += `${key}:`;
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          result += safeStringify(obj[key], maxDepth - 1, maxLength);
        } else {
          result += String(obj[key]);
        }
        count++;
      }
    }
    
    result += '}';
    return result.length > maxLength ? result.substring(0, maxLength) + '...' : result;
  } catch (err) {
    return '[Object]';
  }
};

/**
 * Sanitizes a message string by removing or replacing sensitive information
 * 
 * This function applies multiple regex patterns to detect and redact sensitive data
 * such as credit card numbers, social security numbers, passwords, API keys, emails,
 * and phone numbers. The patterns are designed to be comprehensive while avoiding
 * false positives that could obscure useful debugging information.
 * 
 * @param {string|any} message - Message to sanitize (converted to string if not already)
 * @param {string} level - Log level (currently unused but reserved for future level-based rules)
 * @returns {string} Sanitized message with sensitive data redacted
 */
const sanitizeMessage = (message, level = 'INFO') => {
  // Convert non-string messages to string efficiently (avoid JSON.stringify in hot path)
  if (typeof message !== 'string') {
    if (message === null || message === undefined) {
      message = '';
    } else if (typeof message === 'object') {
      // Use safe stringification with depth limit to prevent stack overflow
      try {
        message = safeStringify(message, 2, 200); // Max 2 levels depth, 200 chars
      } catch (err) {
        message = '[Object]';
      }
    } else {
      message = String(message);
    }
  }
  
  // Early exit for short messages (unlikely to contain sensitive data)
  if (message.length < 10) {
    return message;
  }
  
  // Quick check for common sensitive keywords before expensive regex operations
  const hasSensitiveKeywords = /\b(password|token|secret|api|key|cvv|ssn|card|email|phone)\b/i.test(message);
  if (!hasSensitiveKeywords) {
    return message;
  }
  
  // Optimized sensitive data patterns with performance considerations
  // Patterns ordered by likelihood of match for early exit optimization
  const sensitivePatterns = [
    // High-frequency patterns first (emails, passwords)
    { pattern: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, replacement: '[EMAIL-REDACTED]' },
    { pattern: /(password[:=]\s*)[^\s\}]+/gi, replacement: '$1[REDACTED]' },
    
    // Medium-frequency patterns
    { pattern: /(token[:=]\s*)[^\s\}]+/gi, replacement: '$1[REDACTED]' },
    { pattern: /(api[_-]?key[:=]\s*)[^\s\}]+/gi, replacement: '$1[REDACTED]' },
    { pattern: /(secret[:=]\s*)[^\s\}]+/gi, replacement: '$1[REDACTED]' },
    
    // Lower-frequency patterns (more specific)
    { pattern: /(\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b)/g, replacement: '[CARD-REDACTED]' },
    { pattern: /(\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b)/g, replacement: '[SSN-REDACTED]' },
    { pattern: /(cvv?[:=]\s*)\d{3,4}/gi, replacement: '$1[REDACTED]' },
    { pattern: /(\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b)/g, replacement: '[PHONE-REDACTED]' }
  ];
  
  // Apply patterns with early exit if no changes
  let sanitized = message;
  let hasChanges = false;
  
  for (const { pattern, replacement } of sensitivePatterns) {
    const previous = sanitized;
    sanitized = sanitized.replace(pattern, replacement);
    if (sanitized !== previous) {
      hasChanges = true;
    }
  }
  
  // Return original if no changes (saves memory allocation)
  return hasChanges ? sanitized : message;
  
  return sanitized;
};

/**
 * Helper function to sanitize individual context items with depth tracking
 */
const sanitizeContextItem = (item, level, maxDepth, currentDepth) => {
  if (typeof item === 'string') {
    return sanitizeMessage(item, level);
  }
  if (typeof item === 'object' && item !== null) {
    return sanitizeContext(item, level, maxDepth, currentDepth + 1);
  }
  return item; // Preserve non-object primitives
};

/**
 * Recursively sanitizes an object context by redacting sensitive data
 * 
 * This function traverses object structures and applies sanitization to:
 * 1. String values containing sensitive patterns (via sanitizeMessage)
 * 2. Object properties with sensitive key names (complete redaction)
 * 3. Nested objects and arrays (recursive processing)
 * 
 * The approach is conservative: if a key contains any sensitive keyword, its value is
 * completely redacted regardless of content. This prevents edge cases where sensitive
 * data might be stored under unusual key names.
 * 
 * @param {Object|Array|string|any} context - Context object to sanitize
 * @param {string} level - Log level (currently unused but reserved for future rules)
 * @returns {Object|Array|string|any} Sanitized context with sensitive data redacted
 */
const sanitizeContext = (context, level = 'INFO', maxDepth = 3, currentDepth = 0) => {
  // Prevent infinite recursion and memory exhaustion
  if (currentDepth >= maxDepth) {
    return '[Depth-Limited]';
  }
  
  // Handle primitive types or null/undefined
  if (!context || typeof context !== 'object') {
    return context;
  }
  
  // Handle arrays with size limits to prevent memory exhaustion
  if (Array.isArray(context)) {
    const maxArraySize = 50; // Limit array size for memory efficiency
    if (context.length > maxArraySize) {
      // Truncate large arrays and indicate truncation
      const truncated = context.slice(0, maxArraySize);
      const sanitized = truncated.map(item => sanitizeContextItem(item, level, maxDepth, currentDepth));
      sanitized.push(`... and ${context.length - maxArraySize} more items`);
      return sanitized;
    }
    
    return context.map(item => sanitizeContextItem(item, level, maxDepth, currentDepth));
  }
  
  // Handle objects by processing each property
  const sanitized = {};
  
  // Comprehensive list of sensitive key patterns
  // Keywords are chosen to match common naming conventions across different APIs
  const sensitiveKeys = [
    'password', 'token', 'secret', 'auth', 'credential', 
    'apikey', 'api_key', 'privatekey', 'private_key',
    'ssn', 'socialsecurity', 'creditcard', 'cardnumber',
    'cvv', 'cvc', 'pin', 'accesscode'
  ];
  
  Object.keys(context).forEach(key => {
    const value = context[key];
    
    // Check if key contains any sensitive keywords (case-insensitive)
    const isSensitiveKey = sensitiveKeys.some(sensKey => 
      key.toLowerCase().includes(sensKey.toLowerCase())
    );
    
    if (isSensitiveKey && typeof value === 'string') {
      // Completely redact string values with sensitive keys
      sanitized[key] = '[REDACTED]';
    } else if (isSensitiveKey && typeof value === 'object' && value !== null) {
      // Recursively sanitize objects with sensitive keys
      sanitized[key] = sanitizeContext(value, level);
    } else if (typeof value === 'string') {
      // Apply message sanitization to regular string values
      sanitized[key] = sanitizeMessage(value, level);
    } else if (typeof value === 'object' && value !== null) {
      // Recursively process nested objects
      sanitized[key] = sanitizeContext(value, level);
    } else {
      // Preserve non-string primitives as-is
      sanitized[key] = value;
    }
  });
  
  return sanitized;
};

// Export the sanitization functions for use throughout the application
module.exports = {
  sanitizeMessage,
  sanitizeContext
};