'use strict'; //(enable strict mode for defaults module)

/**
 * Configuration defaults for qerrors module
 * 
 * These defaults represent carefully balanced values for production use. Each setting
 * has been chosen based on practical testing and common deployment scenarios.
 * 
 * Design rationale:
 * - Conservative defaults prevent resource exhaustion while allowing customization
 * - String values maintain consistency with environment variable parsing
 * - Values scale appropriately for both development and production environments
 * - OpenAI integration defaults balance API cost with functionality
 */

const defaults = { //default environment variable values for all qerrors configuration options
  QERRORS_CONCURRENCY: '5', //max concurrent analyses
  QERRORS_CACHE_LIMIT: '50', //LRU cache size
  QERRORS_CACHE_TTL: '86400', //seconds each cache entry remains valid //(new default ttl)
  QERRORS_QUEUE_LIMIT: '100', //max waiting analyses before rejecting //(new env default)
  QERRORS_SAFE_THRESHOLD: '1000', //upper limit for concurrency and queue //(new config default)

  QERRORS_RETRY_ATTEMPTS: '2', //number of API retries //(renamed env var and updated default)
  QERRORS_RETRY_BASE_MS: '100', //base delay for retries //(renamed env var and updated default)
  QERRORS_RETRY_MAX_MS: '2000', //cap wait time for exponential backoff //(new env default)
  QERRORS_TIMEOUT: '10000', //axios request timeout in ms
  QERRORS_MAX_SOCKETS: '50', //max sockets per http/https agent
  QERRORS_MAX_FREE_SOCKETS: '256', //max idle sockets per agent //(new env default)
  QERRORS_MAX_TOKENS: '2048', //max tokens for openai responses //(new env default)
  QERRORS_OPENAI_URL: 'https://api.openai.com/v1/chat/completions', //endpoint used for analysis //(new openai url default)

  QERRORS_LOG_MAXSIZE: String(1024 * 1024), //log file size in bytes
  QERRORS_LOG_MAXFILES: '5', //number of rotated log files
  QERRORS_LOG_MAX_DAYS: '0', //days to retain rotated logs //(0 disables time rotation)
  QERRORS_VERBOSE: 'false', //default off so unset env won't spam console
  QERRORS_LOG_DIR: 'logs', //directory for rotated logs
  QERRORS_DISABLE_FILE_LOGS: '', //flag to disable file transports when set
  QERRORS_SERVICE_NAME: 'qerrors', //service identifier for logger //(new default)

  QERRORS_LOG_LEVEL: 'info', //logger output severity default

  QERRORS_METRIC_INTERVAL_MS: '30000' //interval for queue metrics in ms //(new default)

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
  const defaultVal = typeof defaults[name] === 'number' ? defaults[name] : parseInt(defaults[name], 10); //(handle numeric defaults safely)
  const val = Number.isNaN(int) ? defaultVal : int; //default when NaN
  return val >= min ? val : min; //enforce allowed minimum
}

module.exports.getInt = getInt; //export helper for qerrors usage //(central helper)
