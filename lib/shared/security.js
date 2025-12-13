// Security utilities for input sanitization and injection prevention
const escapeHtml = require('escape-html');

/**
 * Safely limit string length and remove dangerous characters
 * @param {string} str - Input string
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Sanitized string
 */
function safeString(str, maxLength = 200) {
  if (typeof str !== 'string') {
    str = String(str || '');
  }
  // Remove newlines and limit length to prevent log injection
  return str.replace(/[\r\n]/g, '').substring(0, maxLength);
}

/**
 * Sanitize error messages for logging
 * @param {Error|string} error - Error object or message
 * @returns {string} Sanitized error message
 */
function sanitizeErrorMessage(error) {
  const message = error && typeof error === 'object' ? error.message : error;
  return safeString(message, 200);
}

/**
 * Sanitize context for logging
 * @param {any} context - Context object or string
 * @returns {string} Sanitized context
 */
function sanitizeContextForLog(context) {
  if (typeof context === 'string') {
    return safeString(context, 200);
  }
  if (typeof context === 'object' && context !== null) {
    try {
      // Convert to JSON and limit size
      const json = JSON.stringify(context);
      return safeString(json, 500);
    } catch {
      return '[Object]';
    }
  }
  return safeString(String(context), 200);
}

/**
 * Sanitize values for HTML output to prevent XSS
 * @param {any} value - Value to sanitize
 * @returns {string} HTML-safe string
 */
function sanitizeForHtml(value) {
  return escapeHtml(String(value || ''));
}

/**
 * Create safe log message template
 * @param {string} template - Message template
 * @param {Object} values - Values to insert
 * @returns {string} Safe log message
 */
function safeLogTemplate(template, values) {
  let result = template;
  Object.keys(values).forEach(key => {
    const value = safeString(values[key]);
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  });
  return result;
}

module.exports = {
  safeString,
  sanitizeErrorMessage,
  sanitizeContextForLog,
  sanitizeForHtml,
  safeLogTemplate
};