'use strict';

const crypto = require('crypto');
const config = require('./config');
const { getAIModelManager } = require('./aiModelManager');
const { ADVICE_CACHE_LIMIT } = require('./qerrorsConfig');
const { getAdviceFromCache, setAdviceInCache } = require('./qerrorsCache');
const { stringifyContext, verboseLog } = require('./shared/logging');
const { sanitizeErrorMessage, sanitizeContextForLog } = require('./shared/security');

const generateErrorFingerprint = (message, stack) => {
  const msg = message || '', stk = stack || '';
  
  if (!msg && !stk) return '00000000';
  
  const MAX_MSG_LENGTH = 200, MAX_STACK_LENGTH = 300;
  const truncatedMsg = msg.length > MAX_MSG_LENGTH ? msg.substring(0, MAX_MSG_LENGTH) : msg;
  const truncatedStk = stk.length > MAX_STACK_LENGTH ? stk.substring(0, MAX_STACK_LENGTH) : stk;
  
  let hash = 2166136261;
  
  const msgLen = Math.min(truncatedMsg.length, 50);
  for (let i = 0; i < msgLen; i++) {
    hash ^= truncatedMsg.charCodeAt(i);
    hash = (hash * 16777619) | 0;
  }
  
  const stackLen = Math.min(truncatedStk.length, 30);
  if (stackLen > 0) {
    hash ^= 0xFF;
    for (let i = 0; i < stackLen; i++) {
      hash ^= truncatedStk.charCodeAt(i);
      hash = (hash * 16777619) | 0;
    }
  }
  
  return (hash & 0x7fffffff).toString(16).padStart(8, '0');
};

const generateSecureHash = (message, stack) => crypto.createHash('sha256')
  .update(`${message}${stack}`)
  .digest('hex');

let warnedMissingToken = false;

const analyzeError = async (error, contextString) => {
  if (typeof error.name === 'string' && error.name.includes('AxiosError')) {
    verboseLog(`Axios Error - skipping AI analysis to prevent infinite loops`);
    return null;
  }
  
  verboseLog(`qerrors analysis: ${String(error.uniqueErrorName || "").substring(0, 50)} - ${sanitizeErrorMessage(error)}`);
  
  if (ADVICE_CACHE_LIMIT !== 0 && !error.qerrorsKey) {
    try {
      error.qerrorsKey = generateErrorFingerprint(error.message, error.stack);
      
      const useSecureHash = config.getBool('QERRORS_USE_SECURE_CACHE_KEYS', false);
      if (useSecureHash) {
        error.qerrorsKey = generateSecureHash(error.message, error.stack);
      }
    } catch (hashError) {
      verboseLog(`Cache key generation failed, using fallback: ${hashError.message}`);
      error.qerrorsKey = `${error.message?.substring(0, 50)}_${error.stack?.substring(0, 50)}`.replace(/[^a-zA-Z0-9_]/g, '');
    }
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
  
  const sanitizePromptInput = (input) => String(input || '')
    .replace(/[<>]/g, '')
    .replace(/[\r\n]/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
  
  const sanitizedName = sanitizePromptInput(error.name || 'Unknown');
  const sanitizedMessage = sanitizePromptInput(error.message || 'No message');
  const sanitizedContext = sanitizePromptInput(contextString || 'No context');
  const sanitizedStack = sanitizePromptInput(truncatedStack || 'No stack');
  
  const errorPrompt = [
    'Analyze this error and provide debugging advice.',
    'You must respond with a valid JSON object containing an "advice" field with a concise solution.',
    `Error: ${sanitizedName} - ${sanitizedMessage}`,
    `Context: ${sanitizedContext}`,
    `Stack: ${sanitizedStack}`
  ].join(' ');
  
  try {
    const advice = await aiManager.analyzeError(errorPrompt);
    
    if (advice) {
      verboseLog(`qerrors advice returned for: ${String(error.uniqueErrorName || "").substring(0, 50)}`);
      verboseLog(`${error.uniqueErrorName} ${JSON.stringify(advice)}`);
      
      if (error.qerrorsKey) {
        await setAdviceInCache(error.qerrorsKey, advice);
      }
      
      return advice;
    } else {
      verboseLog(`qerrors no advice for: ${String(error.uniqueErrorName || "").substring(0, 50)}`);
      return null;
    }
  } catch (aiError) {
    verboseLog(`qerrors analysis failed for: ${String(error.uniqueErrorName || "").substring(0, 50)}`);
    return null;
  }
};

module.exports = { analyzeError };