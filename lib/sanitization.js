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
function sanitizeMessage(message, level = 'INFO') { //sanitize log messages to prevent sensitive data exposure
    if (typeof message !== 'string') {
        message = JSON.stringify(message); //convert objects to strings for sanitization
    }

    // Enhanced sensitive data patterns for comprehensive protection
    const sensitivePatterns = [
        { pattern: /(\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b)/g, replacement: '[CARD-REDACTED]' }, // Credit card numbers
        { pattern: /(\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b)/g, replacement: '[SSN-REDACTED]' }, // SSN patterns
        { pattern: /(cvv?[:=]\s*)\d{3,4}/gi, replacement: '$1[REDACTED]' }, // CVV codes
        { pattern: /(password[:=]\s*)[\w\W]+?(?=\s|$|,|\}|\])/gi, replacement: '$1[REDACTED]' }, // Passwords
        { pattern: /(api[_-]?key[:=]\s*)[\w\W]+?(?=\s|$|,|\}|\])/gi, replacement: '$1[REDACTED]' }, // API keys
        { pattern: /(token[:=]\s*)[\w\W]+?(?=\s|$|,|\}|\])/gi, replacement: '$1[REDACTED]' }, // Auth tokens
        { pattern: /(secret[:=]\s*)[\w\W]+?(?=\s|$|,|\}|\])/gi, replacement: '$1[REDACTED]' }, // Secrets
        { pattern: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, replacement: '[EMAIL-REDACTED]' }, // Email addresses
        { pattern: /(\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b)/g, replacement: '[PHONE-REDACTED]' } // Phone numbers
    ];

    let sanitized = message;
    sensitivePatterns.forEach(({ pattern, replacement }) => {
        sanitized = sanitized.replace(pattern, replacement);
    });

    return sanitized;
}

/**
 * Context Sanitization for Complex Objects
 * 
 * Purpose: Recursively sanitizes context objects while preserving structure
 * Handles nested objects and arrays that may contain sensitive information.
 */
function sanitizeContext(context, level = 'INFO') { //sanitize context objects recursively
    if (!context || typeof context !== 'object') {
        return context; //return primitive values as-is
    }

    if (Array.isArray(context)) {
        return context.map(item => {
            if (typeof item === 'string') {
                return sanitizeMessage(item, level); //sanitize string array items
            } else if (typeof item === 'object') {
                return sanitizeContext(item, level); //recursively sanitize object array items
            } else {
                return item; //preserve primitive array items
            }
        });
    }

    const sanitized = {};
    Object.keys(context).forEach(key => {
        const value = context[key];
        
        // Check if key itself suggests sensitive data
        const sensitiveKeys = ['password', 'token', 'secret', 'auth', 'credential', 'apikey', 'api_key'];
        const isSensitiveKey = sensitiveKeys.some(sensKey => key.toLowerCase().includes(sensKey));
        
        if (isSensitiveKey && typeof value === 'string') {
            sanitized[key] = '[REDACTED]'; //mask sensitive string values
        } else if (isSensitiveKey && typeof value === 'object') {
            sanitized[key] = sanitizeContext(value, level); //still recursively sanitize nested objects even if key is sensitive
        } else if (typeof value === 'string') {
            sanitized[key] = sanitizeMessage(value, level); //sanitize string values
        } else if (typeof value === 'object') {
            sanitized[key] = sanitizeContext(value, level); //recursively sanitize nested objects
        } else {
            sanitized[key] = value; //preserve non-string, non-object values
        }
    });

    return sanitized;
}

/**
 * Custom Sanitization Rule Registry
 * 
 * Purpose: Allows applications to register custom sanitization patterns
 * for domain-specific sensitive data formats.
 */
const customPatterns = []; //registry for application-specific patterns

function addCustomSanitizationPattern(pattern, replacement, description = '') { //register custom sanitization rule
    customPatterns.push({ pattern, replacement, description });
}

function clearCustomSanitizationPatterns() { //clear all custom patterns for reconfiguration
    customPatterns.length = 0;
}

/**
 * Advanced Sanitization with Custom Patterns
 * 
 * Purpose: Enhanced sanitization that includes custom application-specific patterns
 * in addition to the standard sensitive data patterns.
 */
function sanitizeWithCustomPatterns(message, level = 'INFO') { //sanitize with both standard and custom patterns
    let sanitized = sanitizeMessage(message, level); //apply standard sanitization first
    
    // Apply custom patterns
    customPatterns.forEach(({ pattern, replacement }) => {
        sanitized = sanitized.replace(pattern, replacement);
    });
    
    return sanitized;
}

module.exports = { //(export sanitization utilities for secure logging)
    sanitizeMessage, //(core message sanitization function)
    sanitizeContext, //(recursive context object sanitization)
    addCustomSanitizationPattern, //(register custom sanitization rules)
    clearCustomSanitizationPatterns, //(clear custom patterns for reconfiguration)
    sanitizeWithCustomPatterns //(enhanced sanitization with custom rules)
};