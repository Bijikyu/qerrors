'use strict'; //(enable strict mode for defaults module)

const defaults = { //default environment variable values
  QERRORS_CONCURRENCY: '5', //max concurrent analyses
  QERRORS_CACHE_LIMIT: '50', //LRU cache size
  QERRORS_CACHE_TTL: '86400', //seconds each cache entry remains valid //(new default ttl)
  QERRORS_QUEUE_LIMIT: '100', //max waiting analyses before rejecting //(new env default)

  QERRORS_RETRY_ATTEMPTS: '2', //number of API retries //(renamed env var and updated default)
  QERRORS_RETRY_BASE_MS: '100', //base delay for retries //(renamed env var and updated default)
  QERRORS_TIMEOUT: '10000', //axios request timeout in ms
  QERRORS_MAX_SOCKETS: '50', //max sockets per http/https agent

  QERRORS_LOG_MAXSIZE: String(1024 * 1024), //log file size in bytes
  QERRORS_LOG_MAXFILES: '5', //number of rotated log files
  QERRORS_LOG_MAX_DAYS: '0', //days to retain rotated logs //(0 disables time rotation)
  QERRORS_VERBOSE: 'true', //enable verbose console logs
  QERRORS_LOG_DIR: 'logs', //directory for rotated logs
  QERRORS_DISABLE_FILE_LOGS: '', //flag to disable file transports when set
  QERRORS_SERVICE_NAME: 'qerrors' //service identifier for logger //(new default)
};



module.exports = defaults; //export defaults for external use

function getEnv(name) { //return env var or default when undefined
  return process.env[name] !== undefined ? process.env[name] : defaults[name];
}

module.exports.getEnv = getEnv; //expose getEnv helper

function safeRun(name, fn, fallback, info) { //utility wrapper for try/catch //(added helper)
  try { return fn(); } catch (err) { console.error(`${name} failed`, info); return fallback; } //(log and fall back)
}

module.exports.safeRun = safeRun; //export safeRun for env utils //(make accessible)

function getInt(name, min = 1) { //parse env integer with minimum enforcement
  const int = parseInt(getEnv(name), 10); //attempt parse
  const val = Number.isNaN(int) ? parseInt(defaults[name], 10) : int; //default when NaN
  return val >= min ? val : min; //enforce allowed minimum
}

module.exports.getInt = getInt; //export helper for qerrors usage //(central helper)
