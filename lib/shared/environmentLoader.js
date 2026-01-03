/**
 * Environment Loader Utility
 *
 * Purpose: Provides centralized dotenv loading and .env file existence checking
 * to eliminate duplication across config.js and envUtils.js modules.
 *
 * Design Rationale:
 * - Single source of truth for environment file operations
 * - Prevents redundant dotenv loading attempts
 * - Caches .env file existence to avoid repeated filesystem checks
 * - Provides consistent error handling across modules
 */

let dotenvLoaded = false;
let envFileExistsCache = null;

/**
 * Load dotenv configuration if not already loaded
 *
 * This function ensures dotenv is only loaded once per application lifecycle,
 * preventing redundant configuration attempts and associated errors.
 *
 * @returns {Promise<void>} Promise that resolves when dotenv is loaded (or failed gracefully)
 */
const loadDotenv = async () => {
  if (!dotenvLoaded) {
    try {
      require('dotenv').config();
      dotenvLoaded = true;
    } catch (error) {
      // Try to log with qerrors, fall back to console if unavailable
      try {
        const qerrors = require('./qerrors');
        qerrors(error, 'environmentLoader.loadDotenv', { operation: 'dotenv_loading' });
      } catch (qerrorsError) {
        console.error('Failed to log qerrors:', qerrorsError.message);
      }

      console.warn('Failed to load .env file:', error.message);
      dotenvLoaded = true; // Mark as loaded to avoid repeated attempts
    }
  }
};

/**
 * Check if .env file exists in the current working directory
 *
 * Uses caching to avoid repeated filesystem access calls. The cache is
 * initialized on first call and reused for subsequent calls.
 *
 * @returns {Promise<boolean>} Promise that resolves to true if .env file exists, false otherwise
 */
const checkEnvFileExists = async () => {
  if (envFileExistsCache === null) {
    try {
      const fs = require('fs').promises;
      await fs.access('.env');
      envFileExistsCache = true;
    } catch (error) {
      envFileExistsCache = false;
    }
  }
  return envFileExistsCache;
};

/**
 * Synchronous check for .env file existence (for backward compatibility)
 *
 * @returns {boolean} True if .env file exists, false otherwise
 */
const checkEnvFileSync = () => {
  if (envFileExistsCache === null) {
    try {
      const fs = require('fs');
      fs.accessSync('.env');
      envFileExistsCache = true;
    } catch (error) {
      envFileExistsCache = false;
    }
  }
  return envFileExistsCache;
};

/**
 * Reset cached state (useful for testing or environment changes)
 *
 * This function clears all cached values, forcing the next calls to
 * re-evaluate the current state. Primarily intended for testing scenarios.
 */
const resetCache = () => {
  dotenvLoaded = false;
  envFileExistsCache = null;
};

module.exports = {
  loadDotenv,
  checkEnvFileExists,
  checkEnvFileSync,
  resetCache
};
