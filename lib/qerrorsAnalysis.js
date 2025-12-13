'use strict';

const crypto = require('crypto');
const config = require('./config');
const { getAIModelManager } = require('./aiModelManager');
const { ADVICE_CACHE_LIMIT } = require('./qerrorsConfig');
const { getAdviceFromCache, setAdviceInCache } = require('./qerrorsCache');
const { stringifyContext, verboseLog } = require('./shared/logging');
const { sanitizeErrorMessage, sanitizeContextForLog } = require('./shared/security');

let warnedMissingToken = false;

async function analyzeError(error, contextString) {
  if (typeof error.name === 'string' && error.name.includes('AxiosError')) {
    verboseLog(`Axios Error`);
    return null;
  }
  
  verboseLog(`qerrors analysis: ${String(error.uniqueErrorName || "").substring(0, 50)} - ${sanitizeErrorMessage(error)}`);
  
  if (ADVICE_CACHE_LIMIT !== 0 && !error.qerrorsKey) {
    error.qerrorsKey = crypto.createHash('sha256').update(`${error.message}${error.stack}`).digest('hex');
  }
  
  if (ADVICE_CACHE_LIMIT !== 0) {
    const cached = getAdviceFromCache(error.qerrorsKey);
    if (cached) {
      verboseLog(`cache hit for ${error.uniqueErrorName}`);
      return cached;
    }
  }
  
  const aiManager = getAIModelManager();
  const currentProvider = aiManager.getCurrentModelInfo().provider;
  let requiredApiKey, missingKeyMessage;
  
  if (currentProvider === 'google') {
    requiredApiKey = config.getEnv('GEMINI_API_KEY');
    missingKeyMessage = 'Missing GEMINI_API_KEY in environment variables.';
  } else {
    requiredApiKey = config.getEnv('OPENAI_API_KEY');
    missingKeyMessage = 'Missing OPENAI_API_KEY in environment variables.';
  }
  
  if (!requiredApiKey) {
    if (!warnedMissingToken) {
      console.error(missingKeyMessage);
      warnedMissingToken = true;
    }
    return null;
  }
  
  const truncatedStack = (error.stack || '').split('\n').slice(0, 20).join('\n');
  const sanitizedName = String(error.name || 'Unknown').replace(/[<>]/g, '');
  const sanitizedMessage = String(error.message || 'No message').replace(/[<>]/g, '');
  const sanitizedContext = String(contextString || 'No context').replace(/[<>]/g, '');
  const sanitizedStack = String(truncatedStack || 'No stack').replace(/[<>]/g, '');
  const errorPrompt = `Analyze this error and provide debugging advice. You must respond with a valid JSON object containing an "advice" field with a concise solution: Error: ${sanitizedName} - ${sanitizedMessage} Context: ${sanitizedContext} Stack: ${sanitizedStack}`;
  
  try {
    const advice = await aiManager.analyzeError(errorPrompt);
    if (advice) {
      verboseLog(`qerrors advice returned for: ${String(error.uniqueErrorName || "").substring(0, 50)}`);
      verboseLog(`${error.uniqueErrorName} ${JSON.stringify(advice)}`);
      
      setAdviceInCache(error.qerrorsKey, advice);
      
      return advice;
    } else {
      verboseLog(`qerrors no advice for: ${String(error.uniqueErrorName || "").substring(0, 50)}`);
      return null;
    }
  } catch (aiError) {
    verboseLog(`qerrors analysis failed for: ${String(error.uniqueErrorName || "").substring(0, 50)}`);
    return null;
  }
}

module.exports = {
  analyzeError
};