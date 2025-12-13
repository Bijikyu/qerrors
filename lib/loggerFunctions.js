'use strict';

// Import shared logging utilities
const { createEnhancedLogEntry } = require('./shared/logging');
const { LOG_LEVELS } = require('./shared/constants');
const { sanitizeMessage, sanitizeContext } = require('./sanitization');

// Logging functions using shared utilities
const logStart = async (name, data, logger) => {
  const log = await logger;
  log.info(`${name} start ${JSON.stringify(data)}`);
};

const logReturn = async (name, data, logger) => {
  const log = await logger;
  log.info(`${name} return ${JSON.stringify(data)}`);
};

const logDebug = async (message, context = {}, requestId = null, logger) => {
  const log = await logger;
  const entry = createEnhancedLogEntry('DEBUG', message, context, requestId);
  log.debug(entry);
};

const logInfo = async (message, context = {}, requestId = null, logger) => {
  const log = await logger;
  const entry = createEnhancedLogEntry('INFO', message, context, requestId);
  log.info(entry);
};

const logWarn = async (message, context = {}, requestId = null, logger) => {
  const log = await logger;
  const entry = createEnhancedLogEntry('WARN', message, context, requestId);
  log.warn(entry);
};

const logError = async (message, context = {}, requestId = null, logger) => {
  const log = await logger;
  const entry = createEnhancedLogEntry('ERROR', message, context, requestId);
  log.error(entry);
};

const logFatal = async (message, context = {}, requestId = null, logger) => {
  const log = await logger;
  const entry = createEnhancedLogEntry('FATAL', message, context, requestId);
  log.error(entry);
};

const logAudit = async (message, context = {}, requestId = null, logger) => {
  const log = await logger;
  const entry = createEnhancedLogEntry('AUDIT', message, context, requestId);
  log.info(entry);
};

module.exports = {
  logStart,
  logReturn,
  logDebug,
  logInfo,
  logWarn,
  logError,
  logFatal,
  logAudit
};