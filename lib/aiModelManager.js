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

const { verboseLog } = require('./shared/logging');
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
  
  /**
   * Analyze error using AI model with comprehensive response processing
   * 
   * This method orchestrates the AI-powered error analysis process, including
   * model invocation, response parsing, and error handling. It handles the complex
   * task of extracting structured advice from AI responses while maintaining
   * system stability through comprehensive error handling.
   * 
   * Response Processing Strategy:
   * 1. Invoke AI model with analysis-optimized settings
   * 2. Extract content from LangChain response object
   * 3. Clean and normalize response format
   * 4. Parse structured JSON from AI response
   * 5. Validate response structure and return parsed advice
   * 
   * Error Handling Philosophy:
   * - Never allow AI analysis failures to break the application
   * - Gracefully handle malformed AI responses
   * - Provide detailed logging for debugging AI issues
   * - Return null for any analysis failures to signal no advice available
   * 
   * @param {string} errorPrompt - Formatted error context for AI analysis
   * @returns {Promise<Object|null>} Parsed analysis advice or null if analysis fails
   */
  async analyzeError(errorPrompt) {
    // Early validation - ensure we have a model available for analysis
    if (!this.modelInstance) {
      verboseLog('No AI model available for error analysis');
      return null;
    }
    
    try {
      verboseLog(`Analyzing error with ${this.currentProvider} model`);
      
      // Create analysis-optimized model instance with enhanced creativity settings
      const analysisModel = this.createAnalysisModel();
      
      // Format the error prompt for LangChain message structure
      const messages = [new HumanMessage(errorPrompt)];
      
      // Invoke the AI model - this is the actual API call to the AI provider
      const response = await analysisModel.invoke(messages);
      let advice = response.content;
      
      // Process string responses to extract structured JSON data
      if (typeof advice === 'string') {
        try {
          // Remove leading/trailing whitespace for consistent parsing
          let cleanedAdvice = advice.trim();
          
          // Handle different code block formats that AI models might return
          // Format 1: ```json ... ``` (explicit JSON block)
          if (cleanedAdvice.startsWith('```json') && cleanedAdvice.endsWith('```')) {
            cleanedAdvice = cleanedAdvice.slice(7, -3).trim();
          } 
          // Format 2: ``` ... ``` (generic code block)
          else if (cleanedAdvice.startsWith('```') && cleanedAdvice.endsWith('```')) {
            cleanedAdvice = cleanedAdvice.slice(3, -3).trim();
          }
          
          // Attempt to parse the cleaned response as JSON
          // This validates that the AI returned properly structured advice
          const parsedAdvice = JSON.parse(cleanedAdvice);
          
          // Validate the parsed structure meets our expectations
          // We expect an object with advice properties, not primitive values
          if (parsedAdvice && typeof parsedAdvice === 'object') {
            advice = parsedAdvice;
          } else {
            // AI returned valid JSON but not the expected structure
            advice = null;
          }
        } catch (parseError) {
          // JSON parsing failed - AI returned malformed or non-JSON response
          verboseLog(`Failed to parse AI response as JSON: ${parseError.message}`);
          advice = null;
        }
      }
      
      verboseLog(`AI analysis completed successfully`);
      return advice;
    } catch (error) {
      // Handle any errors during the AI analysis process
      // This includes API errors, network issues, or model failures
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