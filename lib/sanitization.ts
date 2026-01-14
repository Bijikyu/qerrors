/**
 * Sanitization module - placeholder implementation
 */

export const sanitizeMessage = (message: string): string => {
  // Simple password sanitization
  return message.replace(/password\s*[:=]\s*\S+/gi, 'password: [REDACTED]');
};

export const sanitizeContext = (context: Record<string, any>): Record<string, any> => {
  const sanitized = { ...context };
  
  // Redact sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
};

export const addCustomSanitizationPattern = (_pattern: RegExp, _replacement: string): void => {
  // Placeholder for custom patterns
};

export const clearCustomSanitizationPatterns = (): void => {
  // Placeholder for clearing patterns
};

export const sanitizeWithCustomPatterns = (text: string): string => {
  return sanitizeMessage(text);
};

/**
 * Partially hides sensitive keys for logging, exposing only the first four characters.
 * This prevents leaked credentials in logs while still allowing traceability.
 */
export const maskKey = (key: unknown): string | unknown => {
  if (typeof key === 'string') {
    if (key.length <= 4) {
      return '***';
    }
    return `${key.slice(0, 4)}***`;
  }
  return key;
};