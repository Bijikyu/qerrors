/**
 * Environment utilities for qerrors module
 * 
 * This module provides utilities for validating and managing environment variables
 * with proper error handling and validation.
 */

import dotenv from 'dotenv';
import { existsSync } from 'fs';

// Load environment variables
dotenv.config();

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';

/**
 * Get missing environment variables from an array
 * @param varArr - Array of environment variable names to check
 * @returns Array of missing environment variable names
 */
export const getMissingEnvVars = (varArr: string[]): string[] => {
  return varArr.filter(name => !process.env[name]);
};

/**
 * Throw error if required environment variables are missing
 * @param varArr - Array of required environment variable names
 * @returns Array of missing environment variables (empty if all present)
 * @throws Error if any required variables are missing
 */
export const throwIfMissingEnvVars = (varArr: string[]): string[] => {
  const missingEnvVars = getMissingEnvVars(varArr);
  if (missingEnvVars.length) {
    const errorMessage = `Missing required environment variables: ${missingEnvVars.join(', ')}`;
    console.error(errorMessage);
    const err = new Error(errorMessage);
    console.error(err);
    throw err;
  }
  return missingEnvVars;
};

/**
 * Warn if optional environment variables are missing
 * @param varArr - Array of optional environment variable names
 * @param customMessage - Custom warning message
 * @returns True if all variables are present, false otherwise
 */
export const warnIfMissingEnvVars = (varArr: string[], customMessage: string = ''): boolean => {
  const missingEnvVars = getMissingEnvVars(varArr);
  if (missingEnvVars.length) {
    console.warn(
      customMessage || 
      `Warning: Optional environment variables missing: ${missingEnvVars.join(', ')}. Some features may not work as expected.`
    );
  }
  return missingEnvVars.length === 0;
};

/**
 * Validate required environment variables (alias for throwIfMissingEnvVars)
 * @param vars - Array of required environment variable names
 * @returns Array of missing environment variables
 */
export const validateRequiredEnvVars = (vars: string[]): string[] => {
  return throwIfMissingEnvVars(vars);
};

/**
 * Warn about missing environment variables (alias for warnIfMissingEnvVars)
 * @param vars - Array of optional environment variable names
 * @returns True if all variables are present, false otherwise
 */
export const warnMissingEnvVars = (vars: string[]): boolean => {
  return warnIfMissingEnvVars(vars);
};

/**
 * Check if .env file exists
 * @returns True if .env file exists
 */
export const hasEnvFile = (): boolean => {
  return existsSync('.env');
};

/**
 * Get environment health status
 * @param requiredVars - Array of required environment variable names
 * @param optionalVars - Array of optional environment variable names
 * @returns Environment health status object
 */
export const getEnvHealth = (
  requiredVars: string[] = [], 
  optionalVars: string[] = []
): {
  environment: string;
  hasEnvFile: boolean;
  isHealthy: boolean;
  required: {
    total: number;
    configured: number;
    missing: string[];
  };
  optional: {
    total: number;
    configured: number;
    missing: string[];
  };
  summary: {
    totalVars: number;
    configuredVars: number;
  };
} => {
  const missingRequired = getMissingEnvVars(requiredVars);
  const missingOptional = getMissingEnvVars(optionalVars);
  
  return {
    environment: NODE_ENV,
    hasEnvFile: hasEnvFile(),
    isHealthy: missingRequired.length === 0,
    required: {
      total: requiredVars.length,
      configured: requiredVars.length - missingRequired.length,
      missing: missingRequired
    },
    optional: {
      total: optionalVars.length,
      configured: optionalVars.length - missingOptional.length,
      missing: missingOptional
    },
    summary: {
      totalVars: requiredVars.length + optionalVars.length,
      configuredVars: (requiredVars.length - missingRequired.length) + (optionalVars.length - missingOptional.length)
    }
  };
};

/**
 * Validate environment with options
 * @param options - Validation options
 * @returns Environment health status
 */
export const validateEnvironment = (options: {
  required?: string[];
  optional?: string[];
  throwOnError?: boolean;
} = {}): {
  environment: string;
  hasEnvFile: boolean;
  isHealthy: boolean;
  required: {
    total: number;
    configured: number;
    missing: string[];
  };
  optional: {
    total: number;
    configured: number;
    missing: string[];
  };
  summary: {
    totalVars: number;
    configuredVars: number;
  };
} => {
  const { required = [], optional = [], throwOnError = true } = options;
  const health = getEnvHealth(required, optional);
  
  if (throwOnError && !health.isHealthy) {
    throw new Error(`Environment validation failed. Missing required variables: ${health.required.missing.join(', ')}`);
  }
  
  return health;
};