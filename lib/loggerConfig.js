'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('./config');

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
      
      if (process.env.QERRORS_VERBOSE !== 'false') {
        arr.push(new transports.Console({ format: consoleFormat }));
      }
      
      if (arr.length === 0) {
        arr.push(new transports.Console({ format: consoleFormat }));
      }
      
      return arr;
    })()
  });
  
  if (process.env.QERRORS_VERBOSE !== 'false') {
    log.warn('QERRORS_VERBOSE=true can impact performance at scale');
  }
  
  if (maxDays === 0 && !disableFileLogs) {
    log.warn('QERRORS_LOG_MAX_DAYS is 0; log files may grow without bound');
  }
  
  return log;
}

// Simple logger utilities
const createSimpleWinstonLogger = () => createLogger({
  level: 'info',
  format: format.json(),
  transports: [new transports.Console({ format: format.simple() })]
});

module.exports = {
  buildLogger,
  createSimpleWinstonLogger,
  initLogDir,
  rotationOpts,
  fileFormat,
  consoleFormat
};