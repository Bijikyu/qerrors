'use strict';

const config = require('./config');
const localVars = require('../config/localVars');

// Helper function to clamp configuration values and log warnings
function clampConfigValue(rawValue, safeThreshold, configName) {
  // Handle undefined/null values by using safeThreshold as fallback
  const valueToClamp = rawValue !== undefined && rawValue !== null && !Number.isNaN(rawValue) ? rawValue : safeThreshold;
  const clampedValue = Math.min(valueToClamp, safeThreshold);
  if (rawValue > safeThreshold) {
    logSync('warn', `${configName} clamped from ${rawValue} to ${clampedValue}`);
  }
  return clampedValue;
}

// Synchronous logging for module-level initialization
function logSync(level, message) {
  console[level](message);
}

const rawConc = config.getInt('QERRORS_CONCURRENCY', 5);
const rawQueue = config.getInt('QERRORS_QUEUE_LIMIT', 100);
const SAFE_THRESHOLD = config.getInt('QERRORS_SAFE_THRESHOLD', 1000);

const CONCURRENCY_LIMIT = clampConfigValue(rawConc, SAFE_THRESHOLD, 'QERRORS_CONCURRENCY');
const QUEUE_LIMIT = clampConfigValue(rawQueue, SAFE_THRESHOLD, 'QERRORS_QUEUE_LIMIT');

if (rawConc > SAFE_THRESHOLD || rawQueue > SAFE_THRESHOLD) {
  logSync('warn', `High qerrors limits clamped conc ${rawConc} queue ${rawQueue}`);
}

const rawSockets = config.getInt('QERRORS_MAX_SOCKETS');
const MAX_SOCKETS = clampConfigValue(rawSockets, SAFE_THRESHOLD, 'QERRORS_MAX_SOCKETS');

const rawFreeSockets = config.getInt('QERRORS_MAX_FREE_SOCKETS');
const MAX_FREE_SOCKETS = clampConfigValue(rawFreeSockets, SAFE_THRESHOLD, 'QERRORS_MAX_FREE_SOCKETS');

const parsedLimit = config.getInt('QERRORS_CACHE_LIMIT', 0);
const ADVICE_CACHE_LIMIT = parsedLimit === 0 ? 0 : clampConfigValue(parsedLimit, SAFE_THRESHOLD, 'QERRORS_CACHE_LIMIT');

const CACHE_TTL_SECONDS = config.getInt('QERRORS_CACHE_TTL', 0);

module.exports = {
  CONCURRENCY_LIMIT,
  QUEUE_LIMIT,
  MAX_SOCKETS,
  MAX_FREE_SOCKETS,
  ADVICE_CACHE_LIMIT,
  CACHE_TTL_SECONDS,
  SAFE_THRESHOLD
};