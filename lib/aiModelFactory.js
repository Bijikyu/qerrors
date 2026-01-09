'use strict';

/**
 * AI Model Factory - LangChain Integration for Error Analysis
 * 
 * Purpose: Provides a centralized factory for creating AI model instances using
 * LangChain for error analysis and debugging assistance. This module abstracts
 * the complexity of different AI providers (OpenAI, Google) and provides a
 * unified interface for model creation and configuration.
 * 
 * Design Rationale:
 * - Provider abstraction: Hide differences between AI providers
 * - Configuration management: Centralized model configuration and validation
 * - Error handling: Comprehensive validation and error reporting
 * - Security: API key validation and secure configuration
 * - Flexibility: Support for multiple models and providers
 * - Performance: Optimized settings for error analysis use case
 * 
 * Supported Providers:
 * - OpenAI: GPT-4, GPT-4 Turbo, GPT-4o Mini with JSON response format
 * - Google: Gemini Pro with safety settings and content filtering
 * 
 * Security Features:
 * - API key format validation
 * - Required environment variable checking
 * - Safe default configurations
 * - Content safety filtering for Google models
 */

// Import LangChain model classes for different AI providers
const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage } = require('@langchain/core/messages');

// Google Generative AI is optional - require dynamically if available
let ChatGoogleGenerativeAI;
try {
  ChatGoogleGenerativeAI = require('@langchain/google-genai').ChatGoogleGenerativeAI;
} catch (error) {
  // Google Generative AI not available, will fallback to OpenAI
  ChatGoogleGenerativeAI = null;
}

// Import utility functions and configuration
const { verboseLog } = require('./utils');
const localVars = require('../config/localVars');
const { MODEL_PROVIDERS, CONFIG_DEFAULTS: MODEL_CONFIGS, QERRORS_MAX_TOKENS, QERRORS_VERBOSE } = localVars;
const { getApiKey, isEncryptionAvailable } = require('./secureApiKeyManager');

/**
 * Create LangChain model instance with comprehensive configuration
 * 
 * Purpose: Creates and configures AI model instances for error analysis with
 * provider-specific optimizations and security validations. This function handles
 * all the complexity of model creation including environment validation,
 * configuration management, and provider-specific settings.
 * 
 * Provider-Specific Optimizations:
 * - OpenAI: JSON response format for structured output, temperature settings for analysis
 * - Google: Safety settings for content filtering, optimized for error analysis
 * 
 * Security Validations:
 * - Environment variable presence checking
 * - API key format validation for OpenAI
 * - Model availability verification
 * - Configuration parameter validation
 * 
 * @param {string} [provider=MODEL_PROVIDERS.GOOGLE] - AI provider to use
 * @param {string} [modelName=null] - Specific model name (uses provider default if null)
 * @returns {ChatOpenAI|ChatGoogleGenerativeAI} Configured LangChain model instance
 * @throws {Error} When provider is unsupported, environment variables missing, or model invalid
 */
const createLangChainModel = (provider = MODEL_PROVIDERS.GOOGLE, modelName = null) => {
  // Validate provider support and get configuration
  const providerConfig = MODEL_CONFIGS[provider];
  if (!providerConfig) {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
  
  // Get API key using secure manager (with fallback to environment variables)
  const apiKey = getApiKey(provider, { fallbackToEnv: true, checkExpiration: true });
  
  if (!apiKey) {
    const providerName = provider === MODEL_PROVIDERS.OPENAI ? 'OpenAI' : 
                       provider === MODEL_PROVIDERS.GOOGLE ? 'Google' : provider;
    throw new Error(`No valid API key found for ${providerName}. Please set the appropriate environment variable or use secure key storage.`);
  }
  
  // Validate API key format for security
  if (provider === MODEL_PROVIDERS.OPENAI && !apiKey.startsWith('sk-')) {
    throw new Error('Invalid OpenAI API key format. Expected key starting with "sk-"');
  }
  
  if (isEncryptionAvailable()) {
    verboseLog(`Using encrypted API key storage for provider: ${provider}`);
  } else {
    verboseLog(`Using environment variable for API key (encryption not available)`);
  }
  
  // Determine which model to use (specified or provider default)
  const selectedModel = modelName || providerConfig.defaultModel;
  const modelConfig = providerConfig.models[selectedModel];
  if (!modelConfig) {
    throw new Error(`Unsupported model ${selectedModel} for provider ${provider}`);
  }
  
  // Provider-specific model creation with optimized configurations
  switch (provider) {
    case MODEL_PROVIDERS.OPENAI:
      /**
       * OpenAI model configuration with JSON response support
       * 
       * Optimizations for error analysis:
       * - JSON response format for structured debugging output
       * - Configurable token limits for cost control
       * - Temperature settings for balanced creativity/reliability
       * - Verbose logging for debugging model interactions
       */
      const openaiConfig = {
        modelName: selectedModel,
        temperature: modelConfig.temperature,
        maxCompletionTokens: parseInt(QERRORS_MAX_TOKENS || '0') || modelConfig.maxTokens,
        topP: modelConfig.topP,
        apiKey: apiKey,
        verbose: (QERRORS_VERBOSE || 'true') !== 'false',
        apiVersion: process.env.OPENAI_API_VERSION || "2024-06-01"
      };
      
      // Enable JSON response format for models that support structured output
      // This ensures consistent, parseable responses for error analysis
      const supportsJsonFormat = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'].includes(selectedModel);
      if (supportsJsonFormat) {
        openaiConfig.responseFormat = { type: 'json_object' };
      }
      
      return new ChatOpenAI(openaiConfig);
      
    case MODEL_PROVIDERS.GOOGLE:
      // Validate required environment variables for Google
      if (!apiKey) {
        throw new Error(`GOOGLE_AI_API_KEY environment variable required for ${provider} provider`);
      }
      
      // Check if Google Generative AI is available
      if (!ChatGoogleGenerativeAI) {
        throw new Error(`Google Generative AI not available. Please install @langchain/google-genai package or use OpenAI provider`);
      }
      
      /**
       * Google Gemini model configuration with safety settings
       * 
       * Optimizations for error analysis:
       * - Comprehensive safety filtering for appropriate content
       * - Configurable token limits and temperature settings
       * - Verbose logging for model interaction debugging
       * - Content filtering to prevent harmful responses
       */
      return new ChatGoogleGenerativeAI({
        modelName: selectedModel,
        temperature: modelConfig.temperature,
        maxOutputTokens: parseInt(QERRORS_MAX_TOKENS) || modelConfig.maxTokens,
        topP: modelConfig.topP,
        apiKey: apiKey,
        verbose: (QERRORS_VERBOSE || 'true') !== 'false',
        // Safety settings to filter harmful content while allowing error analysis
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      });
      
    default:
      throw new Error(`Model creation not implemented for provider: ${provider}`);
  }
};

/**
 * Create analysis-optimized AI model for error analysis
 * 
 * Purpose: Creates a specialized model instance optimized for error analysis
 * with specific parameter settings that enhance analytical capabilities while
 * maintaining consistency and reliability. This differs from the general model
 * creation by using analysis-specific temperature and sampling settings.
 * 
 * Analysis Optimizations:
 * - Maximum temperature (1.0) for diverse analytical perspectives
 * - TopP set to 1.0 for full sampling range
 * - No frequency or presence penalties to allow natural analysis
 * - JSON response format for structured debugging output
 * - Enhanced token limits for comprehensive analysis
 * 
 * Rationale for Settings:
 * - Higher temperature encourages more creative problem-solving approaches
 * - Full sampling range allows exploration of different analytical angles
 * - No penalties prevent the model from avoiding necessary repetitive content
 * - Structured output ensures consistent, parseable analysis results
 */

/**
 * Create OpenAI analysis model configuration
 */
function createOpenAIAnalysisConfig(selectedModel, modelConfig, apiKey) {
  const analysisConfig = {
    modelName: selectedModel,
    temperature: 1, // Maximum creativity for diverse analytical approaches
    maxCompletionTokens: parseInt(QERRORS_MAX_TOKENS || '0') || modelConfig.maxTokens,
    topP: 1, // Full sampling range for comprehensive analysis
    frequencyPenalty: 0, // Allow natural repetition in analysis
    presencePenalty: 0, // Encourage exploration of all relevant topics
    apiKey: apiKey,
    verbose: (QERRORS_VERBOSE || 'true') !== 'false',
    apiVersion: process.env.OPENAI_API_VERSION || "2024-06-01"
  };
  
  // Enable JSON response format for structured analysis output
  const supportsJsonFormat = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'].includes(selectedModel);
  if (supportsJsonFormat) {
    analysisConfig.responseFormat = { type: 'json_object' };
  }
  
  return analysisConfig;
}

/**
 * Create Google analysis model configuration
 */
function createGoogleAnalysisConfig(selectedModel, modelConfig, apiKey) {
  return {
    modelName: selectedModel,
    temperature: 1, // Maximum creativity for analytical diversity
    maxOutputTokens: parseInt(QERRORS_MAX_TOKENS) || modelConfig.maxTokens,
    topP: 1, // Full sampling range for comprehensive analysis
    apiKey: apiKey,
    verbose: (QERRORS_VERBOSE || 'true') !== 'false',
    // Maintain safety settings while allowing analytical freedom
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH", 
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ]
  };
}

/**
 * Create an analysis-optimized AI model for error analysis
 * 
 * Analysis models are configured with maximum creativity settings to encourage
 * diverse problem-solving approaches and comprehensive debugging assistance.
 * 
 * Security Validations:
 * - Provider support verification
 * - Model configuration validation  
 * - Environment variable requirements inherited from base model creation
 * 
 * @param {string} provider - AI provider to use
 * @param {string} modelName - Specific model name (required for analysis models)
 * @returns {ChatOpenAI|ChatGoogleGenerativeAI} Analysis-optimized model instance
 * @throws {Error} When provider or model is not supported
 */
const createAnalysisModel = (provider, modelName) => {
  const providerConfig = MODEL_CONFIGS[provider];
  if (!providerConfig) {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
  
  const selectedModel = modelName || providerConfig.defaultModel;
  const modelConfig = providerConfig.models[selectedModel];
  if (!modelConfig) {
    throw new Error(`Unsupported model ${selectedModel} for provider ${provider}`);
  }
  
  // Get API key using secure manager (with fallback to environment variables)
  const apiKey = getApiKey(provider, { fallbackToEnv: true, checkExpiration: true });
  
  if (!apiKey) {
    const providerName = provider === MODEL_PROVIDERS.OPENAI ? 'OpenAI' : 
                       provider === MODEL_PROVIDERS.GOOGLE ? 'Google' : provider;
    throw new Error(`No valid API key found for ${providerName}. Please set the appropriate environment variable or use secure key storage.`);
  }
  
  // Validate API key format for security
  if (provider === MODEL_PROVIDERS.OPENAI && !apiKey.startsWith('sk-')) {
    throw new Error('Invalid OpenAI API key format. Expected key starting with "sk-"');
  }
  
  // Provider-specific analysis model configuration
  switch (provider) {
    case MODEL_PROVIDERS.OPENAI:
      const openaiConfig = createOpenAIAnalysisConfig(selectedModel, modelConfig, apiKey);
      return new ChatOpenAI(openaiConfig);
      
    case MODEL_PROVIDERS.GOOGLE:
      // Check if Google Generative AI is available
      if (!ChatGoogleGenerativeAI) {
        throw new Error(`Google Generative AI not available. Please install @langchain/google-genai package or use OpenAI provider`);
      }
      
      const googleConfig = createGoogleAnalysisConfig(selectedModel, modelConfig, apiKey);
      return new ChatGoogleGenerativeAI(googleConfig);
      
    default:
      throw new Error(`Analysis model creation not implemented for provider: ${provider}`);
  }
};

/**
 * Module exports - AI model factory utilities
 * 
 * This module provides the core AI model creation functionality for the
 * error analysis system. The exports are organized to provide clear
 * separation between general model creation and analysis-specific models.
 * 
 * Export Functions:
 * - createLangChainModel: General purpose model creation with standard settings
 * - createAnalysisModel: Analysis-optimized model with enhanced creativity settings
 * - HumanMessage: LangChain message class for creating user messages
 * 
 * Usage Patterns:
 * - Use createLangChainModel for general AI interactions
 * - Use createAnalysisModel for error analysis and debugging assistance
 * - Use HumanMessage for formatting user input to AI models
 */
module.exports = {
  createLangChainModel,
  createAnalysisModel,
  HumanMessage
};