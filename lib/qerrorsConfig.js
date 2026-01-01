'use strict';

const config = require('./config');
const localVars = require('../config/localVars');

const clampConfigValue = (rawValue, safeThreshold, configName) => {
  const valueToClamp = rawValue !== undefined && rawValue !== null && !Number.isNaN(rawValue) 
    ? rawValue 
    : safeThreshold;
  
  const clampedValue = Math.min(valueToClamp, safeThreshold);
  rawValue > safeThreshold && logSync('warn', `${configName} clamped from ${rawValue} to ${clampedValue}`);
  
  return clampedValue;
};

const logSync = (level, message) => console[level](message);

const os = require('os');
const cpuCount = os.cpus().length;
const totalMemory = os.totalmem();
const availableMemory = os.freemem();

const cpuBasedConcurrency = Math.max(5, Math.min(50, cpuCount * 3)), memoryBasedConcurrency = Math.max(5, Math.min(30, Math.floor(availableMemory / (100 * 1024 * 1024)))), dynamicConcurrency = Math.min(cpuBasedConcurrency, memoryBasedConcurrency);

const memoryBasedQueue = Math.max(100, Math.min(2000, Math.floor(availableMemory / (10 * 1024 * 1024)))), cpuBasedQueue = cpuCount * 100, dynamicQueue = Math.min(memoryBasedQueue, cpuBasedQueue);

const rawConc = config.getInt('QERRORS_CONCURRENCY', dynamicConcurrency), rawQueue = config.getInt('QERRORS_QUEUE_LIMIT', dynamicQueue), SAFE_THRESHOLD = config.getInt('QERRORS_SAFE_THRESHOLD', Math.max(2000, dynamicQueue * 2));

const CONCURRENCY_LIMIT = clampConfigValue(rawConc, SAFE_THRESHOLD, 'QERRORS_CONCURRENCY'), QUEUE_LIMIT = clampConfigValue(rawQueue, SAFE_THRESHOLD, 'QERRORS_QUEUE_LIMIT');

if (rawConc > SAFE_THRESHOLD || rawQueue > SAFE_THRESHOLD) {
  logSync('warn', `High qerrors limits clamped conc ${rawConc} queue ${rawQueue}`);
}

const rawSockets = config.getInt('QERRORS_MAX_SOCKETS'), MAX_SOCKETS = clampConfigValue(rawSockets, SAFE_THRESHOLD, 'QERRORS_MAX_SOCKETS');

const rawFreeSockets = config.getInt('QERRORS_MAX_FREE_SOCKETS'), MAX_FREE_SOCKETS = clampConfigValue(rawFreeSockets, SAFE_THRESHOLD, 'QERRORS_MAX_FREE_SOCKETS');

const parsedLimit = config.getInt('QERRORS_CACHE_LIMIT', 0), ADVICE_CACHE_LIMIT = parsedLimit === 0 ? 0 : clampConfigValue(parsedLimit, SAFE_THRESHOLD, 'QERRORS_CACHE_LIMIT');

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