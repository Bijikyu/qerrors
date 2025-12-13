/**
 * Safe logging utilities for qerrors module
 */

export const safeLogError = (error: unknown, context: string, metadata?: Record<string, unknown>): void => {
  console.error(`[${context}] Error:`, error, metadata);
};

export const safeLogInfo = (message: string, metadata?: Record<string, unknown>): void => {
  console.info(`[INFO] ${message}`, metadata);
};

export const safeLogWarn = (message: string, metadata?: Record<string, unknown>): void => {
  console.warn(`[WARN] ${message}`, metadata);
};

export const safeLogDebug = (message: string, metadata?: Record<string, unknown>): void => {
  console.debug(`[DEBUG] ${message}`, metadata);
};

export const safeLogAudit = (message: string, metadata?: Record<string, unknown>): void => {
  console.info(`[AUDIT] ${message}`, metadata);
};