'use strict'; //(enable strict mode for defaults module)

const defaults = { //default environment variable values
  QERRORS_CONCURRENCY: '5', //max concurrent analyses
  QERRORS_CACHE_LIMIT: '50', //LRU cache size

  QERRORS_RETRY_ATTEMPTS: '2', //number of API retries //(renamed env var and updated default)
  QERRORS_RETRY_BASE_MS: '100', //base delay for retries //(renamed env var and updated default)
  QERRORS_TIMEOUT: '10000', //axios request timeout in ms

  QERRORS_LOG_MAXSIZE: String(1024 * 1024), //log file size in bytes
  QERRORS_LOG_MAXFILES: '5', //number of rotated log files
  QERRORS_VERBOSE: 'true', //enable verbose console logs
  QERRORS_LOG_DIR: 'logs', //directory for rotated logs
  QERRORS_DISABLE_FILE_LOGS: '' //flag to disable file transports when set
};

for (const key in defaults) { //iterate through defaults
  if (!process.env[key]) { //assign when variable undefined
    process.env[key] = defaults[key]; //set environment variable to default
  }
}

module.exports = defaults; //export defaults for external use

function safeRun(name, fn, fallback, info) { //utility wrapper for try/catch //(added helper)
  try { return fn(); } catch (err) { console.error(`${name} failed`, info); return fallback; } //(log and fall back)
}

module.exports.safeRun = safeRun; //export safeRun for env utils //(make accessible)
