'use strict';

const { ChatOpenAI } = require('@langchain/openai');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage } = require('@langchain/core/messages');
const { verboseLog } = require('./utils');
const { MODEL_PROVIDERS, MODEL_CONFIGS } = require('./aiModelConfig');

const createLangChainModel = (provider = MODEL_PROVIDERS.GOOGLE, modelName = null) => {
  const providerConfig = MODEL_CONFIGS[provider];
  if (!providerConfig) {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
  
  const missingVars = providerConfig.requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables for ${provider}: ${missingVars.join(', ')}`);
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
        maxTokens: parseInt(process.env.QERRORS_MAX_TOKENS) || modelConfig.maxTokens,
        topP: modelConfig.topP,
        openAIApiKey: process.env.OPENAI_API_KEY,
        verbose: process.env.QERRORS_VERBOSE !== 'false'
      });
      
    case MODEL_PROVIDERS.GOOGLE:
      return new ChatGoogleGenerativeAI({
        modelName: selectedModel,
        temperature: modelConfig.temperature,
        maxOutputTokens: parseInt(process.env.QERRORS_MAX_TOKENS) || modelConfig.maxTokens,
        topP: modelConfig.topP,
        apiKey: process.env.GEMINI_API_KEY,
        verbose: process.env.QERRORS_VERBOSE !== 'false'
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
        maxTokens: parseInt(process.env.QERRORS_MAX_TOKENS) || modelConfig.maxTokens,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        openAIApiKey: process.env.OPENAI_API_KEY,
        verbose: process.env.QERRORS_VERBOSE !== 'false',
        modelKwargs: {
          response_format: {
            type: 'json_object'
          }
        }
      });
      
    case MODEL_PROVIDERS.GOOGLE:
      return new ChatGoogleGenerativeAI({
        modelName: selectedModel,
        temperature: 1,
        maxOutputTokens: parseInt(process.env.QERRORS_MAX_TOKENS) || modelConfig.maxTokens,
        topP: 1,
        apiKey: process.env.GEMINI_API_KEY,
        verbose: process.env.QERRORS_VERBOSE !== 'false'
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