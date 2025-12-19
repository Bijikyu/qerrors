'use strict';

const { ChatOpenAI } = require('@langchain/openai');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage } = require('@langchain/core/messages');
const { verboseLog } = require('./utils');
const localVars = require('../config/localVars');
const { MODEL_PROVIDERS, MODEL_CONFIGS, QERRORS_MAX_TOKENS, QERRORS_VERBOSE } = localVars;

const createLangChainModel = (provider = MODEL_PROVIDERS.GOOGLE, modelName = null) => {
  const providerConfig = MODEL_CONFIGS[provider];
  if (!providerConfig) {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
  
  const missingVars = providerConfig.requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables for ${provider}: ${missingVars.join(', ')}`);
  }
  
  // Validate API key format
  if (provider === MODEL_PROVIDERS.OPENAI && process.env.OPENAI_API_KEY) {
    if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format. Expected key starting with "sk-"');
    }
  }
  
  const selectedModel = modelName || providerConfig.defaultModel;
  const modelConfig = providerConfig.models[selectedModel];
  if (!modelConfig) {
    throw new Error(`Unsupported model ${selectedModel} for provider ${provider}`);
  }
  
  switch (provider) {
    case MODEL_PROVIDERS.OPENAI:
      return new ChatOpenAI({
        modelName: selectedModel,
        temperature: modelConfig.temperature,
        maxCompletionTokens: parseInt(QERRORS_MAX_TOKENS || '0') || modelConfig.maxTokens,
        topP: modelConfig.topP,
        openAIApiKey: process.env.OPENAI_API_KEY,
        verbose: (QERRORS_VERBOSE || 'true') !== 'false',
        apiVersion: "2024-08-06"
      });
      
    case MODEL_PROVIDERS.GOOGLE:
      return new ChatGoogleGenerativeAI({
        modelName: selectedModel,
        temperature: modelConfig.temperature,
        maxOutputTokens: parseInt(QERRORS_MAX_TOKENS) || modelConfig.maxTokens,
        topP: modelConfig.topP,
        apiKey: process.env.GEMINI_API_KEY,
        verbose: (QERRORS_VERBOSE || 'true') !== 'false',
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

const createAnalysisModel = (provider, modelName) => {
  const providerConfig = MODEL_CONFIGS[provider];
  const selectedModel = modelName || providerConfig.defaultModel;
  const modelConfig = providerConfig.models[selectedModel];
  
  switch (provider) {
    case MODEL_PROVIDERS.OPENAI:
      return new ChatOpenAI({
        modelName: selectedModel,
        temperature: 1,
        maxCompletionTokens: parseInt(QERRORS_MAX_TOKENS || '0') || modelConfig.maxTokens,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        openAIApiKey: process.env.OPENAI_API_KEY,
        verbose: (QERRORS_VERBOSE || 'true') !== 'false',
        responseFormat: {
          type: 'json_object'
        },
        apiVersion: "2024-08-06"
      });
      
    case MODEL_PROVIDERS.GOOGLE:
      return new ChatGoogleGenerativeAI({
        modelName: selectedModel,
        temperature: 1,
        maxOutputTokens: parseInt(QERRORS_MAX_TOKENS) || modelConfig.maxTokens,
        topP: 1,
        apiKey: process.env.GEMINI_API_KEY,
        verbose: (QERRORS_VERBOSE || 'true') !== 'false',
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
      throw new Error(`Analysis model creation not implemented for provider: ${provider}`);
  }
};

module.exports = {
  createLangChainModel,
  createAnalysisModel,
  HumanMessage
};