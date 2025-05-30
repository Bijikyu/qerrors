
'use strict';

/**
 * Main entry point for the qerrors package - an intelligent error handling middleware
 * that combines traditional error logging with AI-powered error analysis.
 * 
 * This module exports both the core qerrors function and the underlying logger,
 * providing flexibility for different use cases while maintaining a clean API.
 * 
 * Design rationale:
 * - Separates concerns by keeping qerrors logic and logging logic in separate modules
 * - Provides both individual exports and a default export for different import patterns
 * - Maintains backward compatibility through multiple export strategies
 * - Uses strict mode to catch common JavaScript pitfalls early
 */

const qerrors = require('./lib/qerrors');
const logger = require('./lib/logger');

/**
 * Error logger middleware that logs errors and provides AI-powered suggestions.
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 * @param {Object} [req] - Express request object (optional)
 * @param {Object} [res] - Express response object (optional)
 * @param {Function} [next] - Express next function (optional)
 * @returns {Promise<void>}
 */

// Primary export object - allows destructuring imports like { qerrors, logger }
// This pattern provides clear, explicit imports while keeping related functionality grouped
module.exports = { //exposes logger with qerrors so consumers use the same configured logger
  qerrors,
  logger
};

// Default export for backward compatibility and convenience
// Allows both 'const qerrors = require("qerrors")' and 'const { qerrors } = require("qerrors")'
// This dual export strategy accommodates different developer preferences and existing codebases
module.exports.default = qerrors;
