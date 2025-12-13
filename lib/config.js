/**
 * Configuration defaults for qerrors module using dotenv
 * 
 * This module provides environment variable management using dotenv for loading
 * .env files and custom parsing utilities for type conversion and validation.
 * Maintains backward compatibility with the original config module while leveraging
 * industry-standard dotenv for environment file loading.
 * 
 * Design rationale:
 * - Uses dotenv for industry-standard .env file loading
 * - Maintains custom parsing utilities for type conversion and validation
 * - Preserves all original defaults and helper functions
 * - Provides enhanced error handling and validation
 */

require('dotenv').config();

/**
 * Configuration defaults for qerrors module
 * 
 * These defaults represent carefully balanced values for production use. Each setting
 * has been chosen based on practical experience and common deployment scenarios.
 * 
 * Design rationale:
 * - Conservative defaults prevent resource exhaustion while allowing customization
 * - String values maintain consistency with environment variable parsing
 * - Values scale appropriately for both development and production environments
 * - OpenAI integration defaults balance API cost with functionality
 */
const defaults={QERRORS_CONCURRENCY:'5',QERRORS_CACHE_LIMIT:'50',QERRORS_CACHE_TTL:'86400',QERRORS_QUEUE_LIMIT:'100',QERRORS_SAFE_THRESHOLD:'1000',QERRORS_RETRY_ATTEMPTS:'2',QERRORS_RETRY_BASE_MS:'100',QERRORS_RETRY_MAX_MS:'2000',QERRORS_TIMEOUT:'10000',QERRORS_MAX_SOCKETS:'50',QERRORS_MAX_FREE_SOCKETS:'256',QERRORS_MAX_TOKENS:'2048',QERRORS_OPENAI_URL:'https://api.openai.com/v1/chat/completions',QERRORS_LOG_MAXSIZE:String(1024*1024),QERRORS_LOG_MAXFILES:'5',QERRORS_LOG_MAX_DAYS:'0',QERRORS_VERBOSE:'true',QERRORS_LOG_DIR:'logs',QERRORS_DISABLE_FILE_LOGS:'',QERRORS_SERVICE_NAME:'qerrors',QERRORS_LOG_LEVEL:'info',QERRORS_METRIC_INTERVAL_MS:'60000'};

/**
 * Enhanced environment variable getter with explicit default support
 * 
 * Purpose: Retrieves environment variables with fallback to explicit default or module defaults
 * Supports both single-argument (uses module defaults) and two-argument (explicit default) patterns.
 * 
 * @param {string} name - Environment variable name to retrieve
 * @param {*} defaultVal - Optional explicit default value (falls back to module defaults if not provided)
 * @returns {*} Environment variable value or default
 */
const getEnv=(name,defaultVal)=>process.env[name]!==undefined?process.env[name]:defaultVal!==undefined?defaultVal:defaults[name];

/**
 * Safe execution utility for environment operations
 * 
 * Purpose: Provides safe execution with fallback for environment-related operations
 * 
 * @param {string} name - Operation name for logging
 * @param {Function} fn - Function to execute
 * @param {*} fallback - Fallback value on error
 * @param {Object} info - Additional info for logging
 * @returns {*} Function result or fallback
 */
const safeRun=(name,fn,fallback,info)=>{try{return fn();}catch(err){console.error(`${name} failed`,info);return fallback;}};

/**
 * Enhanced integer environment variable parser with explicit default support
 * 
 * Purpose: Parses integer environment variables with validation and explicit defaults
 * Supports multiple call patterns for backward compatibility:
 * - getInt(name) - uses module default, min=1
 * - getInt(name, min) - LEGACY: uses module default with custom min
 * - getInt(name, defaultVal, min) - NEW: explicit default and min
 * 
 * @param {string} name - Environment variable name to parse
 * @param {number} defaultValOrMin - When 3 args: explicit default. When 2 args: minimum (legacy pattern)
 * @param {number} min - Minimum allowed value (defaults to 1)
 * @returns {number} Parsed integer value with minimum enforcement
 */
const getInt=(name,defaultValOrMin,min)=>{const envValue=process.env[name],int=parseInt(envValue||'',10),moduleDefault=typeof defaults[name]==='number'?defaults[name]:parseInt(defaults[name]||'0',10);let fallbackVal,minVal;if(arguments.length<=1){fallbackVal=moduleDefault;minVal=1;}else if(arguments.length===2){fallbackVal=moduleDefault;minVal=typeof defaultValOrMin==='number'?defaultValOrMin:1;}else{fallbackVal=typeof defaultValOrMin==='number'?defaultValOrMin:moduleDefault;minVal=typeof min==='number'?min:1;}
const val=Number.isNaN(int)?fallbackVal:int;return val>=minVal?val:minVal;};

/**
 * Validate required environment variables
 * 
 * Purpose: Checks if all required environment variables are present
 * 
 * @param {string[]} varNames - Array of required variable names
 * @returns {Object} Validation result with missing variables
 */
const validateRequiredVars=varNames=>{const missing=varNames.filter(name=>!process.env[name]);return{isValid:missing.length===0,missing,present:varNames.filter(name=>process.env[name])};};

/**
 * Get environment configuration summary
 * 
 * Purpose: Provides a summary of current environment configuration
 * 
 * @returns {Object} Configuration summary
 */
const getConfigSummary=()=>({environment:process.env.NODE_ENV||'development',hasEnvFile:require('fs').existsSync('.env'),configuredVars:Object.keys(defaults).filter(key=>process.env[key]!==undefined),totalVars:Object.keys(defaults).length});

module.exports={defaults,getEnv,safeRun,getInt,validateRequiredVars,getConfigSummary};