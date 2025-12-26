/**
 * Async initialization module for qerrors
 * 
 * This module handles asynchronous initialization tasks that should not block
 * the main thread during module loading, such as environment variable loading
 * and other async setup operations.
 */

const { loadDotenv: loadConfigDotenv } = require('./config');
const { loadDotenv: loadEnvDotenv } = require('./envUtils');

/**
 * Initialize all async configuration
 * 
 * This function should be called during application startup before any
 * qerrors functionality is used. It handles async initialization tasks
 * that were previously done synchronously during module loading.
 * 
 * @returns {Promise<void>} Promise that resolves when initialization is complete
 */
const initializeAsync = async () => {
  try {
    // Load environment variables asynchronously
    await Promise.all([
      loadConfigDotenv(),
      loadEnvDotenv()
    ]);
    
    console.log('✅ Async configuration initialization completed');
  } catch (error) {
    console.warn('⚠️  Async configuration initialization failed:', error.message);
    // Continue execution - don't block application startup
  }
};

module.exports = {
  initializeAsync
};