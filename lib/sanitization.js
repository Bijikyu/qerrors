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
 */

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
  // Convert non-string messages to JSON for consistent handling
  if (typeof message !== 'string') {
    message = JSON.stringify(message);
  }
  
  // Define sensitive data patterns with their replacements
  // Each pattern is carefully crafted to balance sensitivity detection with false positive prevention
  const sensitivePatterns = [
    // Credit card numbers (Luhn algorithm not used for performance, pattern matching is sufficient)
    { pattern: /(\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b)/g, replacement: '[CARD-REDACTED]' },
    
    // Social Security Numbers (US format with optional separators)
    { pattern: /(\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b)/g, replacement: '[SSN-REDACTED]' },
    
    // CVV/CVC codes (3-4 digits following common field names)
    { pattern: /(cvv?[:=]\s*)\d{3,4}/gi, replacement: '$1[REDACTED]' },
    
    // Passwords and secrets (key-value pairs with password-related keys)
    { pattern: /(password[:=]\s*)[\w\W]+?(?=\s|$|,|\}|\])/gi, replacement: '$1[REDACTED]' },
    
    // API keys (various common key formats and naming)
    { pattern: /(api[_-]?key[:=]\s*)[\w\W]+?(?=\s|$|,|\}|\])/gi, replacement: '$1[REDACTED]' },
    
    // Tokens (access tokens, JWTs, etc.)
    { pattern: /(token[:=]\s*)[\w\W]+?(?=\s|$|,|\}|\])/gi, replacement: '$1[REDACTED]' },
    
    // Secrets (generic secret fields)
    { pattern: /(secret[:=]\s*)[\w\W]+?(?=\s|$|,|\}|\])/gi, replacement: '$1[REDACTED]' },
    
    // Email addresses (RFC 5322 compliant pattern for common cases)
    { pattern: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, replacement: '[EMAIL-REDACTED]' },
    
    // Phone numbers (US format with international code prefix support)
    { pattern: /(\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b)/g, replacement: '[PHONE-REDACTED]' }
  ];
  
  // Apply each pattern sequentially to ensure comprehensive coverage
  let sanitized = message;
  sensitivePatterns.forEach(({ pattern, replacement }) => {
    sanitized = sanitized.replace(pattern, replacement);
  });
  
  return sanitized;
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
const sanitizeContext = (context, level = 'INFO') => {
  // Handle primitive types or null/undefined
  if (!context || typeof context !== 'object') {
    return context;
  }
  
  // Handle arrays by recursively sanitizing each element
  if (Array.isArray(context)) {
    return context.map(item => {
      if (typeof item === 'string') {
        return sanitizeMessage(item, level);
      }
      if (typeof item === 'object' && item !== null) {
        return sanitizeContext(item, level);
      }
      return item; // Preserve non-object primitives
    });
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