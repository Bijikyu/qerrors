'use strict';

/**
 * Environment Validation Module
 *
 * Validates required environment variables for qerrors configuration.
 * Provides functions to check API keys, logging settings, and other
 * critical configuration values before application startup.
 */

const localVars = require('../config/localVars');

/**
 * Validates all required environment variables
 * @returns {Object} Validation result with errors, warnings, and isValid flag
 */
const validateEnvironment = () => {
  const errors = [];
  const warnings = [];

  const requiredEnvVars = [];
  const aiProvider = localVars.QERRORS_AI_PROVIDER;

  if (aiProvider === localVars?.MODEL_PROVIDERS?.OPENAI) {
    requiredEnvVars.push('OPENAI_API_KEY');
  } else if (aiProvider === localVars?.MODEL_PROVIDERS?.GEMINI) {
    requiredEnvVars.push('GEMINI_API_KEY');
  }

  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  });

  if (localVars.QERRORS_LOG_MAX_DAYS === '0') {
    warnings.push('QERRORS_LOG_MAX_DAYS is 0 - log files may grow without bound');
  }

  if (!process.env.NODE_ENV) {
    warnings.push('NODE_ENV not set, defaulting to development');
  }

  return { errors, warnings, isValid: errors.length === 0 };
};

/**
 * Validates environment and exits process if validation fails
 * Prints all errors and warnings to console
 */
const validateEnvironmentOrExit = () => {
  const validation = validateEnvironment();
  if (!validation.isValid) {
    console.error('Environment validation failed:');
    validation.errors.forEach(error => console.error(`❌ ${error}`));
    if (validation.warnings.length > 0) {
      console.warn('Warnings:');
      validation.warnings.forEach(warning => console.warn(`⚠️ ${warning}`));
    }
    process.exit(1);
  }
  if (validation.warnings.length > 0) {
    console.warn('Environment warnings:');
    validation.warnings.forEach(warning => console.warn(`⚠️ ${warning}`));
  }
  console.log('Environment validation passed');
};

module.exports = { validateEnvironment, validateEnvironmentOrExit };
