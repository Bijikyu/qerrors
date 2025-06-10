
'use strict'; //enforce strict parsing and error handling across module

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

const qerrors = require('./lib/qerrors'); //load primary error handler implementation
const logger = require('./lib/logger'); //load configured winston logger used by qerrors

/**
 * Error logger middleware that logs errors and provides AI-powered suggestions.
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 * @param {Object} [req] - Express request object (optional)
 * @param {Object} [res] - Express response object (optional)
 * @param {Function} [next] - Express next function (optional)
 * @returns {Promise<void>}
 */

module.exports = { //(primary export object allows destructuring imports like { qerrors, logger } providing clear explicit imports while keeping related functionality grouped)
  qerrors, //(main error handling function users interact with)
  logger //(winston logger instance for consistent logging, exposes same configured logger qerrors uses internally)
};

module.exports.default = qerrors; //(default export for backward compatibility allowing both 'const qerrors = require("qerrors")' and destructuring patterns, dual strategy accommodates different developer preferences)
