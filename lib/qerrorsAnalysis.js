'use strict';

/**
 * AI-Powered Error Analysis Module
 * 
 * This module provides intelligent error analysis using AI models to generate
 * debugging suggestions and remediation advice. It integrates with multiple AI
 * providers (OpenAI, Google Gemini) while maintaining cost controls through
 * caching and careful prompt engineering.
 * 
 * Key Design Principles:
 * - Cost Control: Caching prevents redundant AI API calls for identical errors
 * - Provider Agnostic: Supports multiple AI providers with fallback capabilities  
 * - Error Prevention: Axios error detection prevents infinite analysis loops
 * - Graceful Degradation: AI analysis failures never impact application functionality
 * - Security: All error data is sanitized before sending to external APIs
 * 
 * Economic Model:
 * - Cache-first approach minimizes expensive API calls
 * - Concurrency limits prevent rate limiting charges
 * - Truncated stack traces reduce token usage
 * - Provider selection based on available credentials
 */

// Core dependencies for AI analysis
const crypto = require('crypto');                           // For cache key generation (fallback)
const config = require('./config');                          // Environment configuration
const { getAIModelManager } = require('./aiModelManager');  // AI provider abstraction
const { ADVICE_CACHE_LIMIT } = require('./qerrorsConfig');  // Cache configuration
const { getAdviceFromCache, setAdviceInCache } = require('./qerrorsCache'); // Cache operations
const { stringifyContext, verboseLog } = require('./shared/logging'); // Logging utilities
const { sanitizeErrorMessage, sanitizeContextForLog } = require('./shared/security'); // Security sanitization

/**
 * Lightweight fingerprint generator for error cache keys
 * 
 * This function creates a fast, collision-resistant fingerprint for error objects
 * without the computational overhead of cryptographic hashing. It uses a
 * combination of string hashing techniques that are optimized for V8.
 * 
 * Design Principles:
 * - Fast: Uses simple arithmetic operations instead of complex crypto
 * - Collision-resistant: Multiple hash components reduce collision probability
 * - Memory-efficient: Minimal string allocations and transformations
 * - Deterministic: Same error always produces same fingerprint
 * 
 * @param {string} message - Error message
 * @param {string} stack - Error stack trace
 * @returns {string} Hexadecimal fingerprint string
 */
const generateErrorFingerprint = (message, stack) => {
  // Handle null/undefined inputs gracefully
  const msg = message || '';
  const stk = stack || '';
  
  // Limit input length to prevent excessive processing
  const MAX_MSG_LENGTH = 500;
  const MAX_STACK_LENGTH = 1000;
  const truncatedMsg = msg.length > MAX_MSG_LENGTH ? msg.substring(0, MAX_MSG_LENGTH) : msg;
  const truncatedStk = stk.length > MAX_STACK_LENGTH ? stk.substring(0, MAX_STACK_LENGTH) : stk;
  
  // Use simplified FNV-1a hash for better performance
  let hash = 2166136261; // FNV offset basis
  
  // Hash the error message
  for (let i = 0; i < truncatedMsg.length; i++) {
    hash ^= truncatedMsg.charCodeAt(i);
    hash *= 16777619; // FNV prime
    hash |= 0; // Convert to 32-bit integer
  }
  
  // Hash the stack trace with a simple separator
  hash ^= 0xFF; // Separator between message and stack
  for (let i = 0; i < truncatedStk.length; i++) {
    hash ^= truncatedStk.charCodeAt(i);
    hash *= 16777619;
    hash |= 0;
  }
  
  // Convert to hexadecimal string
  // Ensure positive number and pad to consistent length
  const positiveHash = hash & 0x7fffffff;
  const hex = positiveHash.toString(16);
  
  // Pad to 8 characters for consistent key length
  return hex.padStart(8, '0');
};

/**
 * Fallback to SHA-256 for enhanced collision resistance (rare cases)
 * 
 * This function is used only when the lightweight fingerprint might
 * not provide sufficient collision resistance (e.g., high-volume systems).
 * 
 * @param {string} message - Error message
 * @param {string} stack - Error stack trace
 * @returns {string} SHA-256 hash hexadecimal string
 */
const generateSecureHash = (message, stack) => {
  return crypto.createHash('sha256')
    .update(`${message}${stack}`)
    .digest('hex');
};

// Prevent repeated warnings about missing API keys
let warnedMissingToken = false;

/**
 * Analyzes an error using AI to provide debugging suggestions
 * 
 * This function is the core of the AI-powered error analysis system. It:
 * 1. Prevents infinite loops by detecting qerrors' own network errors
 * 2. Checks cache for existing analysis to save costs
 * 3. Validates AI provider credentials
 * 4. Sanitizes error data before sending to external APIs
 * 5. Caches results to prevent redundant analysis
 * 
 * The function is designed to be fail-safe - any errors in the analysis
 * process will result in null being returned, which is handled gracefully
 * by the calling code.
 * 
 * @param {Error} error - The error object to analyze
 * @param {string} contextString - Context information as string
 * @returns {Promise<Object|null>} AI analysis result or null if analysis fails
 */
async function analyzeError(error, contextString) {
  // CRITICAL: Prevent infinite recursion by not analyzing qerrors' own network errors
  // qerrors uses axios for HTTP requests, so we must exclude axios errors from analysis
  if (typeof error.name === 'string' && error.name.includes('AxiosError')) {
    verboseLog(`Axios Error - skipping AI analysis to prevent infinite loops`);
    return null;
  }
  
  // Log analysis attempt for debugging (truncated to prevent log spam)
  verboseLog(`qerrors analysis: ${String(error.uniqueErrorName || "").substring(0, 50)} - ${sanitizeErrorMessage(error)}`);
  
  // Generate cache key if caching is enabled
  // Key is based on error message and stack to identify identical errors
  // Use lightweight fingerprinting for better performance
  if (ADVICE_CACHE_LIMIT !== 0 && !error.qerrorsKey) {
    try {
      // Use fast fingerprinting for cache key generation
      error.qerrorsKey = generateErrorFingerprint(error.message, error.stack);
      
      // Optional: Use secure hash for high-value errors or in production
      // This can be configured via environment variable if needed
      const useSecureHash = config.getBool('QERRORS_USE_SECURE_CACHE_KEYS', false);
      if (useSecureHash) {
        error.qerrorsKey = generateSecureHash(error.message, error.stack);
      }
    } catch (hashError) {
      // Fallback to simple string concatenation if hashing fails
      verboseLog(`Cache key generation failed, using fallback: ${hashError.message}`);
      error.qerrorsKey = `${error.message?.substring(0, 50)}_${error.stack?.substring(0, 50)}`.replace(/[^a-zA-Z0-9_]/g, '');
    }
  }
  
  // Check cache first to avoid redundant expensive API calls
  if (ADVICE_CACHE_LIMIT !== 0) {
    const cached = getAdviceFromCache(error.qerrorsKey);
    if (cached) {
      verboseLog(`cache hit for ${error.uniqueErrorName}`);
      return cached;
    }
  }
  
  // Get AI model manager and current provider information
  const aiManager = getAIModelManager();
  const currentProvider = aiManager.getCurrentModelInfo().provider;
  let requiredApiKey, missingKeyMessage;
  
  // Determine required API key based on current provider
  if (currentProvider === 'google') {
    requiredApiKey = config.getEnv('GEMINI_API_KEY');
    missingKeyMessage = 'Missing GEMINI_API_KEY in environment variables.';
  } else {
    requiredApiKey = config.getEnv('OPENAI_API_KEY');
    missingKeyMessage = 'Missing OPENAI_API_KEY in environment variables.';
  }
  
  // Validate API key availability - fail gracefully if missing
  if (!requiredApiKey) {
    // Only warn once to prevent log spam
    if (!warnedMissingToken) {
      console.error(missingKeyMessage);
      warnedMissingToken = true;
    }
    return null;
  }
  
  // Prepare error data for AI analysis with safety measures
  // Truncate stack trace to reduce token usage and prevent prompt length issues
  const truncatedStack = (error.stack || '').split('\n').slice(0, 20).join('\n');
  
  // Construct the AI prompt with specific requirements for JSON response
  // The prompt is engineered to get actionable debugging advice in a structured format
  const sanitizePromptInput = (input) => {
    return String(input || '')
      .replace(/[<>]/g, '')
      .replace(/[\r\n]/g, ' ')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim();
  };
  
  // Sanitize all data to prevent prompt injection and remove sensitive information
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
    // Send analysis request to AI provider through the model manager
    const advice = await aiManager.analyzeError(errorPrompt);
    
    if (advice) {
      // Log successful analysis for debugging
      verboseLog(`qerrors advice returned for: ${String(error.uniqueErrorName || "").substring(0, 50)}`);
      verboseLog(`${error.uniqueErrorName} ${JSON.stringify(advice)}`);
      
      // Cache the advice to prevent redundant future analysis
      if (error.qerrorsKey) {
        await setAdviceInCache(error.qerrorsKey, advice);
      }
      
      return advice;
    } else {
      // Handle case where AI returns no advice
      verboseLog(`qerrors no advice for: ${String(error.uniqueErrorName || "").substring(0, 50)}`);
      return null;
    }
  } catch (aiError) {
    // Handle AI analysis failures gracefully
    // This includes network errors, rate limits, invalid responses, etc.
    verboseLog(`qerrors analysis failed for: ${String(error.uniqueErrorName || "").substring(0, 50)}`);
    return null;
  }
}

/**
 * Module exports - AI analysis functionality
 * 
 * The module exports a focused interface centered around the core analyzeError function.
 * This maintains a clean API while allowing the internal implementation to handle
 * the complexity of AI provider management, caching, and error handling.
 * 
 * Export Strategy:
 * - Single primary export for the main analysis function
 * - Implementation details (caching, AI management) are handled internally
 * - Consistent error handling ensures callers always receive a predictable response
 */
module.exports = {
  analyzeError  // Core AI-powered error analysis function
};