'use strict';

const MODEL_PROVIDERS = {
  OPENAI: 'openai',
  GOOGLE: 'google'
};

const MODEL_CONFIGS = {
  [MODEL_PROVIDERS.OPENAI]: {
    models: {
      'gpt-4o': { maxTokens: 4096, temperature: 0.1, topP: 1 },
      'gpt-4o-mini': { maxTokens: 4096, temperature: 0.1, topP: 1 },
      'gpt-4': { maxTokens: 4096, temperature: 0.1, topP: 1 },
      'gpt-3.5-turbo': { maxTokens: 4096, temperature: 0.1, topP: 1 }
    },
    defaultModel: 'gpt-4o',
    requiredEnvVars: ['OPENAI_API_KEY']
  },
  [MODEL_PROVIDERS.GOOGLE]: {
    models: {
      'gemini-2.5-flash-lite': { maxTokens: 8192, temperature: 0.1, topP: 1 },
      'gemini-2.0-flash-exp': { maxTokens: 8192, temperature: 0.1, topP: 1 },
      'gemini-pro': { maxTokens: 8192, temperature: 0.1, topP: 1 },
      'gemini-1.5-pro': { maxTokens: 8192, temperature: 0.1, topP: 1 },
      'gemini-1.5-flash': { maxTokens: 8192, temperature: 0.1, topP: 1 }
    },
    defaultModel: 'gemini-2.5-flash-lite',
    requiredEnvVars: ['GEMINI_API_KEY']
  }
};

module.exports = {
  MODEL_PROVIDERS,
  MODEL_CONFIGS
};