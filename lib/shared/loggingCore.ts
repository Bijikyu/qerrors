/**
 * Core logging utilities for qerrors module
 */

export const createEnhancedLogEntry = (level: string, message: string, context?: Record<string, any>, requestId?: string | null) => {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: context || {},
    requestId,
    service: 'qerrors',
    environment: process.env.NODE_ENV || 'development',
    memoryUsage: process.memoryUsage()
  };
};

export const stringifyContext = (ctx: unknown): string => {
  try {
    if (typeof ctx === 'string') return ctx;
    if (typeof ctx === 'object' && ctx !== null) {
      const seen = new Set();
      return JSON.stringify(ctx, (_, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      });
    }
    return String(ctx);
  } catch {
    return 'unknown context';
  }
};