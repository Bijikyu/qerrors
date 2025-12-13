/**
 * Utility functions for qerrors module
 * 
 * This module provides various utility functions for logging, error handling,
 * and safe execution patterns.
 */

// Import from specialized shared modules
import {
  createUnifiedTimer,
  safeRun,
  deepClone,
  attempt,
  executeWithQerrors,
  formatErrorMessage
} from './shared/executionCore.js';

// Legacy logging functions - now deprecated but maintained for compatibility
const logError = async (error: unknown, context?: string, metadata?: Record<string, unknown>) => {
  console.error('Error:', error, context, metadata);
};

const logInfo = async (message: string, metadata?: Record<string, unknown>) => {
  console.info('Info:', message, metadata);
};

const logWarn = async (message: string, metadata?: Record<string, unknown>) => {
  console.warn('Warning:', message, metadata);
};

// Create timer utility
const createTimer = () => createUnifiedTimer('operation');

// Export all utilities
export {
  // Safe execution utilities
  safeRun,
  deepClone,
  createTimer,
  attempt,
  executeWithQerrors,
  formatErrorMessage,
  
  // Legacy exports
  logError,
  logInfo,
  logWarn
};