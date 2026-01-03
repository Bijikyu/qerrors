'use strict';

const qerrors = require('./qerrors');

const safeQerrorsCall = (error, location, context = {}) => {
  try { return qerrors(error, location, context); } catch (qerror) { console.error('qerrors logging failed:', qerror.message); }
};

const safeAsyncQerrorsCall = async (error, location, context = {}) => {
  try { return await qerrors(error, location, context); } catch (qerror) { console.error('qerrors async logging failed:', qerror.message); }
};

const createSafeErrorHandler = (location) => (error, context = {}) => safeQerrorsCall(error, location, context);

const createSafeAsyncErrorHandler = (location) => async (error, context = {}) => safeAsyncQerrorsCall(error, location, context);

const wrapFunctionWithErrorHandling = (fn, location) => (...args) => {
  try { return fn(...args); } catch (error) { safeQerrorsCall(error, location, { args: args.slice(0, 3) }); throw error; }
};

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
