'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { sanitizeMessage, sanitizeContext } = require('./sanitization');

// Import shared logging utilities
const { createEnhancedLogEntry } = require('./shared/logging');

const LOG_LEVELS = {
  DEBUG: { priority: 10, color: '\x1b[36m', name: 'DEBUG' },
  INFO: { priority: 20, color: '\x1b[32m', name: 'INFO' },
  WARN: { priority: 30, color: '\x1b[33m', name: 'WARN' },
  ERROR: { priority: 40, color: '\x1b[31m', name: 'ERROR' },
  FATAL: { priority: 50, color: '\x1b[35m', name: 'FATAL' },
  AUDIT: { priority: 60, color: '\x1b[34m', name: 'AUDIT' }
};

const rotationOpts = {
  maxsize: Number(process.env.QERRORS_LOG_MAXSIZE) || 1024 * 1024,
  maxFiles: Number(process.env.QERRORS_LOG_MAXFILES) || 5,
  tailable: true
};

const logDir = process.env.QERRORS_LOG_DIR || 'logs';
let disableFileLogs = !!process.env.QERRORS_DISABLE_FILE_LOGS;

const fileFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

const consoleFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.printf(({ timestamp, level, message, stack }) => 
    `${timestamp} ${level}: ${message}${stack ? '\n' + stack : ''}`
  )
);

const initLogDir = async () => {
  try {
    await fs.promises.mkdir(logDir, { recursive: true });
  } catch (err) {
    console.error(`Failed to create log directory ${logDir}: ${err.message}`);
    disableFileLogs = true;
  }
};

async function buildLogger() {
  await initLogDir();
  const maxDays = Number(process.env.QERRORS_LOG_MAX_DAYS) || 0;
  disableFileLogs = disableFileLogs || !!process.env.QERRORS_DISABLE_FILE_LOGS;
  
  const DailyRotateFile = require('winston-daily-rotate-file');
  
  const log = createLogger({
    level: config.getEnv('QERRORS_LOG_LEVEL'),
    defaultMeta: { service: config.getEnv('QERRORS_SERVICE_NAME') },
    transports: (() => {
      const arr = [];
      
      if (!disableFileLogs) {
        if (maxDays > 0) {
          arr.push(new DailyRotateFile({
            filename: path.join(logDir, 'error-%DATE%.log'),
            level: 'error',
            datePattern: 'YYYY-MM-DD',
            maxFiles: `${maxDays}d`,
            maxSize: rotationOpts.maxsize,
            format: fileFormat
          }));
          
          arr.push(new DailyRotateFile({
            filename: path.join(logDir, 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxFiles: `${maxDays}d`,
            maxSize: rotationOpts.maxsize,
            format: fileFormat
          }));
        } else {
          const fileCap = rotationOpts.maxFiles > 0 ? rotationOpts.maxFiles : 30;
          arr.push(new transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            ...rotationOpts,
            maxFiles: fileCap,
            format: fileFormat
          }));
          
          arr.push(new transports.File({
            filename: path.join(logDir, 'combined.log'),
            ...rotationOpts,
            maxFiles: fileCap,
            format: fileFormat
          }));
        }
      }
      
      if (process.env.QERRORS_VERBOSE === 'true') {
        arr.push(new transports.Console({ format: consoleFormat }));
      }
      
      if (arr.length === 0) {
        arr.push(new transports.Console({ format: consoleFormat }));
      }
      
      return arr;
    })()
  });
  
  if (process.env.QERRORS_VERBOSE === 'true') {
    log.warn('QERRORS_VERBOSE=true can impact performance at scale');
  }
  
  if (maxDays === 0 && !disableFileLogs) {
    log.warn('QERRORS_LOG_MAX_DAYS is 0; log files may grow without bound');
  }
  
  return log;
}

const logger = buildLogger();

// Logging functions using shared utilities
const logStart = async (name, data) => {
  const log = await logger;
  log.info(`${name} start ${JSON.stringify(data)}`);
};

const logReturn = async (name, data) => {
  const log = await logger;
  log.info(`${name} return ${JSON.stringify(data)}`);
};

const logDebug = async (message, context = {}, requestId = null) => {
  const log = await logger;
  const entry = createEnhancedLogEntry('DEBUG', message, context, requestId);
  log.debug(entry);
};

const logInfo = async (message, context = {}, requestId = null) => {
  const log = await logger;
  const entry = createEnhancedLogEntry('INFO', message, context, requestId);
  log.info(entry);
};

const logWarn = async (message, context = {}, requestId = null) => {
  const log = await logger;
  const entry = createEnhancedLogEntry('WARN', message, context, requestId);
  log.warn(entry);
};

const logError = async (message, context = {}, requestId = null) => {
  const log = await logger;
  const entry = createEnhancedLogEntry('ERROR', message, context, requestId);
  log.error(entry);
};

const logFatal = async (message, context = {}, requestId = null) => {
  const log = await logger;
  const entry = createEnhancedLogEntry('FATAL', message, context, requestId);
  log.error(entry);
};

const logAudit = async (message, context = {}, requestId = null) => {
  const log = await logger;
  const entry = createEnhancedLogEntry('AUDIT', message, context, requestId);
  log.info(entry);
};

// Performance timer using shared utilities
const { createPerformanceTimer } = require('./shared/logging');

// Simple logger utilities
const createSimpleWinstonLogger = () => createLogger({
  level: 'info',
  format: format.json(),
  transports: [new transports.Console({ format: format.simple() })]
});

const simpleLogger = createSimpleWinstonLogger();

module.exports = logger;
module.exports.logStart = logStart;
module.exports.logReturn = logReturn;
module.exports.logDebug = logDebug;
module.exports.logInfo = logInfo;
module.exports.logWarn = logWarn;
module.exports.logError = logError;
module.exports.logFatal = logFatal;
module.exports.logAudit = logAudit;
module.exports.createPerformanceTimer = createPerformanceTimer;
module.exports.sanitizeMessage = sanitizeMessage;
module.exports.sanitizeContext = sanitizeContext;
module.exports.createEnhancedLogEntry = createEnhancedLogEntry;
module.exports.LOG_LEVELS = LOG_LEVELS;
module.exports.simpleLogger = simpleLogger;
module.exports.createSimpleWinstonLogger = createSimpleWinstonLogger;