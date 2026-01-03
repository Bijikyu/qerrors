'use strict';

const crypto = require('crypto');
const config = require('./config');
const { getAIModelManager } = require('./aiModelManager');
const { ADVICE_CACHE_LIMIT } = require('./qerrorsConfig');
const { getAdviceFromCache, setAdviceInCache } = require('./qerrorsCache');
const { commonImports } = require('./shared/imports');
const { stringifyContext, verboseLog, sanitizeErrorMessage, sanitizeContextForLog } = commonImports.logging();

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
  stackLen > 0 && (hash ^= 0xFF, (() => {
    for (let i = 0; i < stackLen; i++) {
      hash ^= truncatedStk.charCodeAt(i);
      hash = (hash * 16777619) | 0;
    }
  })());
  return (hash & 0x7fffffff).toString(16).padStart(8, '0');
};

const generateSecureHash = (message, stack) => crypto.createHash('sha256').update(`${message}${stack}`).digest('hex');

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
      config.getBool('QERRORS_USE_SECURE_CACHE_KEYS', false) && (error.qerrorsKey = generateSecureHash(error.message, error.stack));
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
  
  try {
    const aiManager = getAIModelManager();
    const currentProvider = aiManager.getCurrentModelInfo().provider;
    let requiredApiKey, missingKeyMessage;
    
    currentProvider === 'google' ? (requiredApiKey = config.getEnv('GEMINI_API_KEY'), missingKeyMessage = 'Missing GEMINI_API_KEY in environment variables.') : (requiredApiKey = config.getEnv('OPENAI_API_KEY'), missingKeyMessage = 'Missing OPENAI_API_KEY in environment variables.');
    
    if (!requiredApiKey) {
      !warnedMissingToken && (console.error(missingKeyMessage), warnedMissingToken = true);
      return null;
    }
  } catch (managerError) {
    console.warn('AI model manager not available:', managerError.message);
    return null;
  }
  
  const truncatedStack = (error.stack || '').split('\n').slice(0, 20).join('\n');
  
  // Validate input sizes before processing
  const validateInputSize = (name, message, context, stack) => {
    const limits = {
      name: 200,
      message: 1000,
      context: 2000,
      stack: 5000,
      totalPrompt: 8000
    };
    
    const errors = [];
    
    if (name && name.length > limits.name) {
      errors.push(`Error name too long: ${name.length} > ${limits.name}`);
    }
    
    if (message && message.length > limits.message) {
      errors.push(`Error message too long: ${message.length} > ${limits.message}`);
    }
    
    if (context && context.length > limits.context) {
      errors.push(`Context too long: ${context.length} > ${limits.context}`);
    }
    
    if (stack && stack.length > limits.stack) {
      errors.push(`Stack trace too long: ${stack.length} > ${limits.stack}`);
    }
    
    const totalLength = (name?.length || 0) + (message?.length || 0) + 
                       (context?.length || 0) + (stack?.length || 0);
    
    if (totalLength > limits.totalPrompt) {
      errors.push(`Total prompt too long: ${totalLength} > ${limits.totalPrompt}`);
    }
    
    if (errors.length > 0) {
      throw new Error(`Input validation failed: ${errors.join(', ')}`);
    }
  };
  
  try {
    validateInputSize(error.name, error.message, contextString, truncatedStack);
  } catch (validationError) {
    verboseLog(`Input size validation failed: ${validationError.message}`);
    return null;
  }
  
  const sanitizePromptInput = (input, maxLength = 1000) => {
    if (!input || typeof input !== 'string') return '';
    
    // Truncate first to prevent memory issues
    if (input.length > maxLength) {
      input = input.substring(0, maxLength);
    }
    
    return input
      // Remove dangerous characters and patterns
      .replace(/[<>]/g, '')                    // Remove HTML tags
      .replace(/[\r\n]/g, ' ')                // Convert line breaks to spaces
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters (except tab)
      .replace(/[\t]{2,}/g, ' ')              // Limit consecutive tabs
      .replace(/[ ]{3,}/g, ' ')               // Limit consecutive spaces
      // Remove potential injection patterns
      .replace(/javascript:/gi, '')            // Remove JavaScript protocol
      .replace(/data:/gi, '')                  // Remove data protocol
      .replace(/vbscript:/gi, '')              // Remove VBScript protocol
      .replace(/on\w+\s*=/gi, '')             // Remove event handlers
      .replace(/expression\s*\(/gi, '')        // Remove CSS expressions
      // Remove excessive repeating characters
      .replace(/(.)\1{5,}/g, '$1')            // Limit character repetition
      .trim();
  };
  
  const sanitizedName = sanitizePromptInput(error.name || 'Unknown', 100);
  const sanitizedMessage = sanitizePromptInput(error.message || 'No message', 500);
  const sanitizedContext = sanitizePromptInput(contextString || 'No context', 800);
  const sanitizedStack = sanitizePromptInput(truncatedStack || 'No stack', 1500);
  
  const errorPrompt = `Analyze this error and provide debugging advice. You must respond with a valid JSON object containing an "advice" field with a concise solution. Error: ${sanitizedName} - ${sanitizedMessage} Context: ${sanitizedContext} Stack: ${sanitizedStack}`;
  
  try {
    const advice = await aiManager.analyzeError(errorPrompt);
    
    if (advice) {
      verboseLog(`qerrors advice returned for: ${String(error.uniqueErrorName || "").substring(0, 50)}`);
      verboseLog(`${error.uniqueErrorName} ${JSON.stringify(advice)}`);
      error.qerrorsKey && (await setAdviceInCache(error.qerrorsKey, advice));
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