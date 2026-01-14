/**
 * Safe logging utilities for qerrors module
 */

import qerrors from '../qerrors.js';
import { safeErrorMessage } from '../errorTypes.js';

/**
 * Type for the unified structured error logger
 */
export type LogError = (error: unknown, context: string, metadata?: Record<string, unknown>) => void;

/**
 * Unified structured error logger used across the library.
 * Centralizes qerrors invocation and prevents accidental throws
 * from the error reporter from breaking flows.
 */
export const logError: LogError = (error, context, metadata = {}) => {
  try {
    if (typeof (qerrors as any)?.qerrors === 'function') {
      (qerrors as any).qerrors(error as Error, context, metadata);
      return;
    }
    if (typeof (qerrors as any) === 'function') {
      (qerrors as any)(error as Error, context, metadata);
    }
  } catch {
    // Never throw from logging path - fall through to console
  }
};

export const safeLogError = (error: unknown, context: string, metadata?: Record<string, unknown>): void => {
  logError(error, context, metadata);
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

/**
 * Logs an error with context and returns a uniform error object containing a safe message.
 * Use for small catch-blocks that need to surface an { error } without duplicating boilerplate.
 */
export const logAndWrapError = (
  error: unknown,
  fallback: string,
  context: string,
  metadata: Record<string, unknown> = {},
): { error: string } => {
  const message = safeErrorMessage(error, fallback);
  logError(error, context, metadata);
  return { error: message };
};