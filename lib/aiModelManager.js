/**
 * AI Model Manager - LangChain Integration for qerrors
 * 
 * This module provides a unified interface for different AI models using LangChain,
 * allowing easy switching between OpenAI, Anthropic, and other providers while
 * maintaining consistent error analysis functionality.
 * 
 * Design rationale:
 * - Uses LangChain for standardized model interaction across providers
 * - Maintains backward compatibility with existing OpenAI integration
 * - Provides factory pattern for easy model switching via environment variables
 * - Includes graceful fallback when models are unavailable
 * - Supports both streaming and non-streaming responses
 */

const { verboseLog } = require('./utils');
const localVars = require('../config/localVars');
const { MODEL_PROVIDERS, MODEL_CONFIGS, QERRORS_AI_PROVIDER, QERRORS_AI_MODEL } = localVars;
const { createLangChainModel, createAnalysisModel, HumanMessage } = require('./aiModelFactory');

class AIModelManager {
  constructor() {
    this.currentProvider = QERRORS_AI_PROVIDER || MODEL_PROVIDERS.GOOGLE;
    this.currentModel = QERRORS_AI_MODEL || null;
    this.modelInstance = null;
    this.initializeModel();
  }
  
  initializeModel() {
    try {
      this.modelInstance = createLangChainModel(this.currentProvider, this.currentModel);
      verboseLog(`AI Model Manager initialized with provider: ${this.currentProvider}, model: ${this.currentModel || 'default'}`);
    } catch (error) {
      verboseLog(`Failed to initialize AI model: ${error.message}`);
      this.modelInstance = null;
    }
  }
  
  switchModel(provider, modelName = null) {
    try {
      this.currentProvider = provider;
      this.currentModel = modelName;
      this.modelInstance = createLangChainModel(provider, modelName);
      verboseLog(`Switched to AI provider: ${provider}, model: ${modelName || 'default'}`);
      return true;
    } catch (error) {
      verboseLog(`Failed to switch AI model: ${error.message}`);
      return false;
    }
  }
  
  getCurrentModelInfo() {
    return {
      provider: this.currentProvider,
      model: this.currentModel || MODEL_CONFIGS[this.currentProvider]?.defaultModel,
      available: this.modelInstance !== null
    };
  }
  
  getAvailableModels(provider = this.currentProvider) {
    const providerConfig = MODEL_CONFIGS[provider];
    return providerConfig ? Object.keys(providerConfig.models) : [];
  }
  
  async analyzeError(errorPrompt) {
    if (!this.modelInstance) {
      verboseLog('No AI model available for error analysis');
      return null;
    }
    
    try {
      verboseLog(`Analyzing error with ${this.currentProvider} model`);
      const analysisModel = this.createAnalysisModel();
      const messages = [new HumanMessage(errorPrompt)];
      const response = await analysisModel.invoke(messages);
      let advice = response.content;
      
      if (typeof advice === 'string') {
        try {
          let cleanedAdvice = advice.trim();
          
          // Remove code block markers
          if (cleanedAdvice.startsWith('```json') && cleanedAdvice.endsWith('```')) {
            cleanedAdvice = cleanedAdvice.slice(7, -3).trim();
          } else if (cleanedAdvice.startsWith('```') && cleanedAdvice.endsWith('```')) {
            cleanedAdvice = cleanedAdvice.slice(3, -3).trim();
          }
          
          // Try to parse as JSON
          const parsedAdvice = JSON.parse(cleanedAdvice);
          
          // Validate that it has the expected structure
          if (parsedAdvice && typeof parsedAdvice === 'object') {
            advice = parsedAdvice;
          } else {
            advice = null;
          }
        } catch (parseError) {
          verboseLog(`Failed to parse AI response as JSON: ${parseError.message}`);
          advice = null;
        }
      }
      
      verboseLog(`AI analysis completed successfully`);
      return advice;
    } catch (error) {
      verboseLog(`AI analysis failed: ${error.message}`);
      return null;
    }
  }
  
  createAnalysisModel() {
    return createAnalysisModel(this.currentProvider, this.currentModel);
  }
  
  async healthCheck() {
    if (!this.modelInstance) {
      return {
        healthy: false,
        error: 'No model instance available'
      };
    }
    
    try {
      const testMessage = new HumanMessage('Test connection - respond with "OK"');
      const response = await this.modelInstance.invoke([testMessage]);
      return {
        healthy: true,
        provider: this.currentProvider,
        model: this.currentModel,
        response: response.content
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        provider: this.currentProvider
      };
    }
  }
}

// Singleton instance management
let aiModelManager = null;

const getAIModelManager = () => {
  if (!aiModelManager) {
    aiModelManager = new AIModelManager();
  }
  return aiModelManager;
};

const resetAIModelManager = () => {
  aiModelManager = null;
};

module.exports = {
  AIModelManager,
  getAIModelManager,
  resetAIModelManager,
  MODEL_PROVIDERS,
  MODEL_CONFIGS,
  createLangChainModel
};