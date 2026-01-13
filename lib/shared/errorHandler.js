'use strict';

/**
 * Safe Error Handler Module
 *
 * Provides wrapper functions to safely call qerror logging without
 * causing recursive errors. Ensures the error logging system
 * itself doesn't crash the application.
 */

const qerrors = require('./qerrors');

/**
 * Safely calls qerror logging with error catching
 * @param {Error} error - Error to log
 * @param {string} location - Error location identifier
 * @param {Object} context - Additional context
 */
const safeQerrorsCall = (error, location, context = {}) => {
  try { return qerrors(error, location, context); } catch (qerror) { console.error('qerrors logging failed:', qerror.message); }
};

/**
 * Safely calls async qerror logging with error catching
 * @param {Error} error - Error to log
 * @param {string} location - Error location identifier
 * @param {Object} context - Additional context
 * @returns {Promise<*>} Qerror result or undefined
 */
const safeAsyncQerrorsCall = async (error, location, context = {}) => {
  try { return await qerrors(error, location, context); } catch (qerror) { console.error('qerrors async logging failed:', qerror.message); }
};

/**
 * Creates a safe error handler function for a specific location
 * @param {string} location - Error location identifier
 * @returns {Function} Error handler function
 */
const createSafeErrorHandler = (location) => (error, context = {}) => safeQerrorsCall(error, location, context);

/**
 * Creates a safe async error handler function for a specific location
 * @param {string} location - Error location identifier
 * @returns {Function} Async error handler function
 */
const createSafeAsyncErrorHandler = (location) => async (error, context = {}) => safeAsyncQerrorsCall(error, location, context);

/**
 * Wraps a synchronous function with safe error handling
 * @param {Function} fn - Function to wrap
 * @param {string} location - Error location identifier
 * @returns {Function} Wrapped function
 */
const wrapFunctionWithErrorHandling = (fn, location) => (...args) => {
  try { return fn(...args); } catch (error) { safeQerrorsCall(error, location, { args: args.slice(0, 3) }); throw error; }
};

/**
 * Wraps an asynchronous function with safe error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} location - Error location identifier
 * @returns {Function} Wrapped async function
 */
const wrapAsyncFunctionWithErrorHandling = (fn, location) => async (...args) => {
  try { return await fn(...args); } catch (error) { await safeAsyncQerrorsCall(error, location, { args: args.slice(0, 3) }); throw error; }
};

module.exports = {
  safeQerrorsCall,
  safeAsyncQerrorsCall,
  createSafeErrorHandler,
  createSafeAsyncErrorHandler,
  wrapFunctionWithErrorHandling,
  wrapAsyncFunctionWithErrorHandling
};
