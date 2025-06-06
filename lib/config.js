'use strict'; //(enable strict mode for defaults module)

const defaults = { //default environment variable values
  QERRORS_CONCURRENCY: '5', //max concurrent analyses
  QERRORS_CACHE_LIMIT: '50', //LRU cache size
  QERRORS_RETRIES: '3', //number of API retries
  QERRORS_RETRY_DELAY_MS: '500', //base delay for retries
  QERRORS_LOG_MAXSIZE: String(1024 * 1024), //log file size in bytes
  QERRORS_LOG_MAXFILES: '5', //number of rotated log files
  QERRORS_VERBOSE: 'true' //enable verbose console logs
};

for (const key in defaults) { //iterate through defaults
  if (!process.env[key]) { //assign when variable undefined
    process.env[key] = defaults[key]; //set environment variable to default
  }
}

module.exports = defaults; //export defaults for external use
