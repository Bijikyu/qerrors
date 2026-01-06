const { loadDotenv, checkEnvFileExists } = require('./shared/environmentLoader');
const localVars = require('../config/localVars');
const { CONFIG_DEFAULTS } = localVars;
const defaults = CONFIG_DEFAULTS;

const getEnv = (name, defaultVal) => 
  process.env[name] !== undefined ? process.env[name] : 
  defaultVal !== undefined ? defaultVal : defaults[name];

const safeRun = (name, fn, fallback, info) => {
  try {
    return fn();
  } catch (err) {
    console.error(`${name} failed`, info);
    return fallback;
  }
};

const getInt = (name, defaultValOrMin, min) => {
  const envValue = process.env[name];
  const int = parseInt(envValue || '', 10);
  const moduleDefault = typeof defaults[name] === 'number' ? defaults[name] : parseInt(defaults[name] || '0', 10);
  
  let fallbackVal, minVal;
  if (arguments.length <= 1) {
    fallbackVal = moduleDefault;
    minVal = 1;
  } else if (arguments.length === 2) {
    fallbackVal = moduleDefault;
    minVal = typeof defaultValOrMin === 'number' ? defaultValOrMin : 1;
  } else {
    fallbackVal = typeof defaultValOrMin === 'number' ? defaultValOrMin : moduleDefault;
    minVal = typeof min === 'number' ? min : 1;
  }
  
  const val = Number.isNaN(int) ? fallbackVal : int;
  return val >= minVal ? val : minVal;
};

const getBool = (name, defaultVal) => {
  const parseBool = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value !== 'string') return null;

    const normalized = value.trim().toLowerCase();
    if (normalized === '') return null;
    if (['1', 'true', 'yes', 'y', 'on', 'enable', 'enabled'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off', 'disable', 'disabled'].includes(normalized)) return false;
    return null;
  };

  const envValue = process.env[name];
  const envParsed = envValue !== undefined ? parseBool(String(envValue)) : null;
  if (envParsed !== null) return envParsed;

  const moduleDefault = defaults[name];
  const fallback = defaultVal !== undefined ? defaultVal : moduleDefault;
  const fallbackParsed = parseBool(fallback);

  return fallbackParsed !== null ? fallbackParsed : false;
};

const validateRequiredVars = varNames => {
  const missing = [];
  const present = [];
  for (const name of varNames) {
    process.env.hasOwnProperty(name) ? present.push(name) : missing.push(name);
  }
  return { isValid: missing.length === 0, missing, present };
};

const getConfigSummary = async () => {
  const hasEnvFile = await checkEnvFileExists();
  
  return {
    environment: localVars.NODE_ENV || 'development',
    hasEnvFile,
    configuredVars: Object.keys(defaults).filter(key => process.env[key] !== undefined),
    totalVars: Object.keys(defaults).length
  };
};

const getConfigSummarySync = () => {
  console.warn('getConfigSummarySync is deprecated - use async getConfigSummary() instead');
  const fs = require('fs');
  let hasEnvFile = null;
  try {
    hasEnvFile = fs.existsSync('.env');
  } catch (error) {
    hasEnvFile = false;
  }
  
  return {
    environment: localVars.NODE_ENV || 'development',
    hasEnvFile,
    configuredVars: Object.keys(defaults).filter(key => process.env[key] !== undefined),
    totalVars: Object.keys(defaults).length
  };
};

module.exports = {
  defaults,
  getEnv,
  safeRun,
  getInt,
  getBool,
  validateRequiredVars,
  getConfigSummary,
  getConfigSummarySync,
  loadDotenv
};
