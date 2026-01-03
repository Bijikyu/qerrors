/**
 * Security Utilities Module - Input Sanitization and Injection Prevention
 *
 * Purpose: Provides comprehensive input sanitization and security utilities to
 * prevent injection attacks, log poisoning, and XSS vulnerabilities. This module
 * implements defense-in-depth principles by sanitizing all user-provided data
 * before it's used in logs, HTML output, or other contexts.
 *
 * Design Rationale:
 * - Defense in depth: Multiple layers of input validation and sanitization
 * - Context-aware sanitization: Different sanitization for different output contexts
 * - Fail-safe defaults: All functions default to safe behavior
 * - Performance conscious: Efficient sanitization without unnecessary overhead
 * - Comprehensive coverage: Handles strings, objects, and various data types
 *
 * Security Threats Addressed:
 * - Log injection attacks via newline characters
 * - XSS attacks via HTML output
 * - Buffer overflow attacks via string length limits
 * - Information disclosure via error message sanitization
 */

// Import HTML escaping utility for XSS prevention
const escapeHtml = require('escape-html');

/**
 * Safely limit string length and remove dangerous characters
 *
 * Purpose: Provides basic string sanitization by removing dangerous characters
 * and limiting string length to prevent injection attacks and buffer overflows.
 * This is the foundation function used by other sanitization utilities.
 *
 * Security Measures:
 * - Removes carriage return (\r) and newline (\n) characters to prevent log injection
 * - Limits string length to prevent buffer overflow and DoS attacks
 * - Converts non-string inputs to strings for consistent handling
 * - Handles null/undefined inputs gracefully
 *
 * Use Cases:
 * - Sanitizing user input before logging
 * - Preparing data for display in console output
 * - Cleaning input data for processing
 * - Preventing log injection attacks
 *
 * @param {string} str - Input string to sanitize (can be any type)
 * @param {number} [maxLength=200] - Maximum allowed length after sanitization
 * @returns {string} Sanitized string safe for logging and processing
 */
function safeString (str, maxLength = 200) {
  // Convert non-string inputs to strings, handle null/undefined
  if (typeof str !== 'string') {
    str = String(str || '');
  }
  // Remove newlines and limit length to prevent log injection and buffer overflow
  return str.replace(/[\r\n]/g, '').substring(0, maxLength);
}

/**
 * Sanitize error messages for logging
 *
 * Purpose: Extracts and sanitizes error messages from Error objects or strings
 * to prevent injection attacks and information disclosure in logs. This function
 * handles both Error objects and raw string inputs consistently.
 *
 * Security Considerations:
 * - Prevents error message injection attacks
 * - Limits error message length to prevent log bloat
 * - Handles Error objects safely without exposing stack traces
 * - Removes dangerous characters that could corrupt log files
 *
 * Information Disclosure Prevention:
 * - Only extracts the message property from Error objects
 * - Does not include stack traces or internal error details
 * - Sanitizes the message to remove any injected content
 *
 * @param {Error|string} error - Error object or error message to sanitize
 * @returns {string} Sanitized error message safe for logging
 */
function sanitizeErrorMessage (error) {
  // Extract message from Error object or use string directly
  const message = error && typeof error === 'object' ? error.message : error;
  return safeString(message, 200);
}

/**
 * Sanitize context for logging
 *
 * Purpose: Safely converts context data of any type into a sanitized string
 * suitable for logging. This function handles strings, objects, arrays, and
 * primitive types while preventing injection attacks and log corruption.
 *
 * Data Type Handling:
 * - Strings: Direct sanitization with length limit
 * - Objects: JSON serialization with error handling
 * - Arrays: JSON serialization with error handling
 * - Primitives: String conversion and sanitization
 * - Null/Undefined: Graceful handling with default values
 *
 * Security Measures:
 * - Prevents JSON injection attacks via object serialization
 * - Limits serialized object size to prevent log bloat
 * - Handles circular references and serialization errors
 * - Removes dangerous characters from all output
 *
 * @param {any} context - Context data to sanitize (any type)
 * @returns {string} Sanitized context string safe for logging
 */
function sanitizeContextForLog (context) {
  if (typeof context === 'string') {
    return safeString(context, 200);
  }
  if (typeof context === 'object' && context !== null) {
    try {
      // Convert to JSON and limit size to prevent log bloat
      const json = JSON.stringify(context);
      return safeString(json, 500);
    } catch {
      // Fallback for circular references or serialization errors
      return '[Object]';
    }
  }
  return safeString(String(context), 200);
}

/**
 * Sanitize values for HTML output to prevent XSS
 *
 * Purpose: Provides XSS-safe HTML output by escaping all dangerous characters.
 * This function is specifically designed for HTML contexts where user-provided
 * data needs to be safely displayed without risking script injection.
 *
 * XSS Prevention:
 * - Escapes HTML special characters (<, >, &, ", ')
 * - Uses industry-standard escape-html library
 * - Handles all data types by converting to strings
 * - Provides null/undefined safety
 *
 * Use Cases:
 * - Displaying user input in HTML templates
 * - Rendering error messages in web interfaces
 * - Showing context data in admin panels
 * - Any HTML output that includes user-provided data
 *
 * @param {any} value - Value to sanitize for HTML output
 * @returns {string} HTML-safe string with all dangerous characters escaped
 */
function sanitizeForHtml (value) {
  return escapeHtml(String(value || ''));
}

/**
 * Create safe log message template
 *
 * Purpose: Provides a template-based approach to creating log messages with
 * interpolated values. This function safely replaces template variables with
 * sanitized values, preventing injection attacks through template substitution.
 *
 * Template Security:
 * - Sanitizes all interpolated values
 * - Prevents template injection attacks
 * - Handles missing keys gracefully
 * - Uses regex for safe variable replacement
 *
 * Template Format:
 * - Uses ${variableName} syntax for variable substitution
 * - All variables are sanitized before insertion
 * - Non-existent variables are left unchanged
 * - Supports any number of variables in template
 *
 * @param {string} template - Message template with ${variable} placeholders
 * @param {Object} values - Object containing values to substitute into template
 * @returns {string} Safe log message with sanitized interpolated values
 */
function safeLogTemplate (template, values) {
  let result = template;
  Object.keys(values).forEach(key => {
    // Sanitize each value before substitution
    const value = safeString(values[key]);
    // Replace all occurrences of the template variable
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  });
  return result;
}

/**
 * Module exports - Security utilities
 *
 * These utilities provide comprehensive input sanitization and security
 * measures for various contexts including logging, HTML output, and template
 * processing. Each function is designed to prevent specific attack vectors
 * while maintaining usability and performance.
 *
 * Security Functions:
 * - safeString: Foundation sanitization for all string inputs
 * - sanitizeErrorMessage: Error message sanitization for logging
 * - sanitizeContextForLog: Context data sanitization for logging
 * - sanitizeForHtml: XSS prevention for HTML output
 * - safeLogTemplate: Safe template variable substitution
 */
module.exports = {
  safeString,
  sanitizeErrorMessage,
  sanitizeContextForLog,
  sanitizeForHtml,
  safeLogTemplate
};
