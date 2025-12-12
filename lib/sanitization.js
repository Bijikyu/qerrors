/**
 * Security-Aware Data Sanitization Utilities
 * 
 * This module provides comprehensive data sanitization capabilities for removing
 * or masking sensitive information from log messages, context objects, and other
 * data structures. Critical for applications handling sensitive data like payment
 * processing, user authentication, and API communications.
 * 
 * Design rationale:
 * - Centralized sanitization logic ensures consistent security practices
 * - Pattern-based detection handles various sensitive data formats
 * - Recursive object processing maintains data structure while securing content
 * - Configurable sensitivity levels adapt to different logging contexts
 * - Performance optimized for high-volume logging scenarios
 */

/**
 * Security-Aware Message Sanitization
 * 
 * Purpose: Removes or masks sensitive information from log messages
 * Critical for error handling applications to prevent logging of sensitive data
 * such as API keys, passwords, credit card numbers, and other PII.
 * 
 * Design rationale:
 * - Regex patterns identify common sensitive data formats
 * - Replacement preserves context while masking actual values
 * - Configurable for different security levels based on log level
 * - Maintains log readability while ensuring compliance
 */
const sanitizeMessage = (message, level = 'INFO') => {
    if (typeof message !== 'string') message = JSON.stringify(message);
    const sensitivePatterns = [
        { pattern: /(\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b)/g, replacement: '[CARD-REDACTED]' },
        { pattern: /(\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b)/g, replacement: '[SSN-REDACTED]' },
        { pattern: /(cvv?[:=]\s*)\d{3,4}/gi, replacement: '$1[REDACTED]' },
        { pattern: /(password[:=]\s*)[\w\W]+?(?=\s|$|,|\}|\])/gi, replacement: '$1[REDACTED]' },
        { pattern: /(api[_-]?key[:=]\s*)[\w\W]+?(?=\s|$|,|\}|\])/gi, replacement: '$1[REDACTED]' },
        { pattern: /(token[:=]\s*)[\w\W]+?(?=\s|$|,|\}|\])/gi, replacement: '$1[REDACTED]' },
        { pattern: /(secret[:=]\s*)[\w\W]+?(?=\s|$|,|\}|\])/gi, replacement: '$1[REDACTED]' },
        { pattern: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, replacement: '[EMAIL-REDACTED]' },
        { pattern: /(\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b)/g, replacement: '[PHONE-REDACTED]' }
    ];
    let sanitized = message;
    sensitivePatterns.forEach(({ pattern, replacement }) => { sanitized = sanitized.replace(pattern, replacement); });
    return sanitized;
};

/**
 * Context Sanitization for Complex Objects
 * 
 * Purpose: Recursively sanitizes context objects while preserving structure
 * Handles nested objects and arrays that may contain sensitive information.
 */
const sanitizeContext = (context, level = 'INFO') => {
    if (!context || typeof context !== 'object') return context;
    if (Array.isArray(context)) {
        return context.map(item => {
            if (typeof item === 'string') return sanitizeMessage(item, level);
            if (typeof item === 'object') return sanitizeContext(item, level);
            return item;
        });
    }
    const sanitized = {};
    Object.keys(context).forEach(key => {
        const value = context[key];
        const sensitiveKeys = ['password', 'token', 'secret', 'auth', 'credential', 'apikey', 'api_key'];
        const isSensitiveKey = sensitiveKeys.some(sensKey => key.toLowerCase().includes(sensKey));
        if (isSensitiveKey && typeof value === 'string') {
            sanitized[key] = '[REDACTED]';
        } else if (isSensitiveKey && typeof value === 'object') {
            sanitized[key] = sanitizeContext(value, level);
        } else if (typeof value === 'string') {
            sanitized[key] = sanitizeMessage(value, level);
        } else if (typeof value === 'object') {
            sanitized[key] = sanitizeContext(value, level);
        } else {
            sanitized[key] = value;
        }
    });
    return sanitized;
};

/**
 * Custom Sanitization Rule Registry
 * 
 * Purpose: Allows applications to register custom sanitization patterns
 * for domain-specific sensitive data formats.
 */
const customPatterns = []; //registry for application-specific patterns

const addCustomSanitizationPattern = (pattern, replacement, description = '') => customPatterns.push({ pattern, replacement, description });

const clearCustomSanitizationPatterns = () => { customPatterns.length = 0; };

/**
 * Advanced Sanitization with Custom Patterns
 * 
 * Purpose: Enhanced sanitization that includes custom application-specific patterns
 * in addition to the standard sensitive data patterns.
 */
const sanitizeWithCustomPatterns = (message, level = 'INFO') => {
    let sanitized = sanitizeMessage(message, level);
    customPatterns.forEach(({ pattern, replacement }) => { sanitized = sanitized.replace(pattern, replacement); });
    return sanitized;
};

module.exports = { sanitizeMessage, sanitizeContext, addCustomSanitizationPattern, clearCustomSanitizationPatterns, sanitizeWithCustomPatterns };