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
const qerrors = require('./qerrors');
const { MODEL_PROVIDERS, MODEL_CONFIGS, QERRORS_AI_PROVIDER, QERRORS_AI_MODEL } = localVars;
const { createLangChainModel, createAnalysisModel, HumanMessage } = require('./aiModelFactory');
const LRUCache = require('lru-cache');

class AIModelManager {
  constructor() {
    this.currentProvider = QERRORS_AI_PROVIDER || MODEL_PROVIDERS.GOOGLE;
    this.currentModel = QERRORS_AI_MODEL || null;
    this.modelInstance = null;
    
    // Use optimized LRU cache for analysis model instances
    this.analysisModelCache = new LRUCache({
      max: 10, // Maximum number of cached model instances
      ttl: 1000 * 60 * 30, // 30 minutes TTL
      updateAgeOnGet: true, // Update TTL when accessed
      allowStale: false, // Don't allow stale entries
      dispose: (value, key) => {
        verboseLog(`AI analysis model evicted from cache: ${key}`);
      }
    });
    
    this.initializeCacheTracking();
    this.initializeModel();
  }
  
  initializeModel() {
    try {
      this.modelInstance = createLangChainModel(this.currentProvider, this.currentModel);
      verboseLog(`AI Model Manager initialized with provider: ${this.currentProvider}, model: ${this.currentModel || 'default'}`);
    } catch (error) {
      qerrors(error, 'aiModelManager.initializeModel', {
        operation: 'ai_model_initialization',
        provider: this.currentProvider,
        model: this.currentModel
      });
      verboseLog(`Failed to initialize AI model: ${error.message}`);
      this.modelInstance = null;
    }
  }
  
  switchModel(provider, modelName = null) {
    try {
      this.currentProvider = provider;
      this.currentModel = modelName;
      this.modelInstance = createLangChainModel(provider, modelName);
      
      // Clear analysis model cache when switching providers
      this.analysisModelCache.clear();
      
      verboseLog(`Switched to AI provider: ${provider}, model: ${modelName || 'default'}`);
      return true;
    } catch (error) {
      qerrors(error, 'aiModelManager.switchModel', {
        operation: 'ai_model_switch',
        fromProvider: this.currentProvider,
        toProvider: provider,
        toModel: modelName
      });
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
    try {
      // Early validation - ensure we have a model available for analysis
      if (!this.modelInstance) {
        verboseLog('No AI model available for error analysis');
        return null;
      }
      
      try {
        verboseLog(`Analyzing error with ${this.currentProvider} model`);
        
        // Create analysis-optimized model instance with enhanced creativity settings
        const analysisModel = this.createAnalysisModel();
        
        try {
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
              qerrors(parseError, 'aiModelManager.analyzeError.parse', {
                operation: 'ai_response_parsing',
                provider: this.currentProvider,
                model: this.currentModel,
                responseLength: advice?.length || 0
              });
              verboseLog(`Failed to parse AI response as JSON: ${parseError.message}`);
              advice = null;
            }
          }
          
          verboseLog(`AI analysis completed successfully`);
          return advice;
        } catch (invokeError) {
          qerrors(invokeError, 'aiModelManager.analyzeError.invoke', {
            operation: 'ai_model_invocation',
            provider: this.currentProvider,
            model: this.currentModel,
            promptLength: errorPrompt?.length || 0
          });
          throw invokeError;
        }
      } catch (analysisError) {
        qerrors(analysisError, 'aiModelManager.analyzeError.analysis', {
          operation: 'ai_error_analysis',
          provider: this.currentProvider,
          model: this.currentModel
        });
        throw analysisError;
      }
    } catch (error) {
      // Handle any errors during the AI analysis process
      // This includes API errors, network issues, or model failures
      qerrors(error, 'aiModelManager.analyzeError', {
        operation: 'ai_error_analysis_failed',
        provider: this.currentProvider,
        model: this.currentModel,
        hasPrompt: !!errorPrompt
      });
      verboseLog(`AI analysis failed: ${error.message}`);
      return null;
    }
  }
  
  createAnalysisModel() {
    const cacheKey = `${this.currentProvider}:${this.currentModel || 'default'}`;
    
    // Check optimized cache first
    if (this.analysisModelCache.has(cacheKey)) {
      // Track cache hit
      this.cacheHits++;
      
      // Get and update access (LRU cache handles this automatically)
      const analysisModel = this.analysisModelCache.get(cacheKey);
      return analysisModel;
    }
    
    // Track cache miss
    this.cacheMisses++;
    
    // Create new analysis model
    const analysisModel = createAnalysisModel(this.currentProvider, this.currentModel);
    
    // Add to cache (LRU cache handles eviction automatically)
    this.analysisModelCache.set(cacheKey, analysisModel);
    
    return analysisModel;
  }
  
  /**
   * Get analysis model cache statistics
   */
  getCacheStats() {
    return {
      size: this.analysisModelCache.size,
      maxSize: this.analysisModelCache.max,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
      cachedKeys: Array.from(this.analysisModelCache.keys())
    };
  }
  
  /**
   * Clear analysis model cache
   */
  clearCache() {
    this.analysisModelCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
  
  /**
   * Initialize cache tracking
   */
  initializeCacheTracking() {
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
  
  async healthCheck() {
    try {
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
      } catch (invokeError) {
        qerrors(invokeError, 'aiModelManager.healthCheck.invoke', {
          operation: 'ai_health_check_invocation',
          provider: this.currentProvider,
          model: this.currentModel
        });
        return {
          healthy: false,
          error: invokeError.message,
          provider: this.currentProvider
        };
      }
    } catch (error) {
      qerrors(error, 'aiModelManager.healthCheck', {
        operation: 'ai_model_health_check',
        provider: this.currentProvider,
        model: this.currentModel,
        hasModelInstance: !!this.modelInstance
      });
      return {
        healthy: false,
        error: error.message,
        provider: this.currentProvider
      };
    }
  }
}

// Singleton instance management with proper cleanup
let aiModelManager = null;
let cleanupInterval = null;
let shutdownListenersAdded = false;

const getAIModelManager = () => {
  if (!aiModelManager) {
    aiModelManager = new AIModelManager();
    
    // Add shutdown listeners only once to prevent memory leaks
    if (!shutdownListenersAdded) {
      const gracefulShutdown = () => {
        if (aiModelManager) {
          try {
            // Cleanup model instance if it has cleanup method
// Close model instance if available and has cleanup method
    if (aiModelManager.modelInstance && typeof aiModelManager.modelInstance.close === 'function') {
      try {
        aiModelManager.modelInstance.close();
      } catch (error) {
        console.warn('Error closing model instance:', error.message);
      }
    }
          } catch (error) {
            console.error('Error during AI model manager shutdown:', error.message);
          } finally {
            aiModelManager = null;
          }
        }
        // Clear cleanup interval
        if (cleanupInterval) {
          clearInterval(cleanupInterval);
          cleanupInterval = null;
        }
      };
      
      process.once('SIGTERM', gracefulShutdown);
      process.once('SIGINT', gracefulShutdown);
      process.once('beforeExit', gracefulShutdown);
      process.once('exit', gracefulShutdown);
      
      shutdownListenersAdded = true;
      
      // Add periodic health check to prevent stale connections
      cleanupInterval = setInterval(async () => {
        if (aiModelManager) {
          try {
            const health = await aiModelManager.healthCheck();
            if (!health.healthy) {
              console.warn('AI model manager health check failed, reinitializing...');
              aiModelManager.initializeModel();
            }
          } catch (error) {
            console.error('Error during AI model manager health check:', error.message);
          }
        }
      }, 60000); // Every minute
    }
  }
  return aiModelManager;
};

const resetAIModelManager = () => {
  if (aiModelManager) {
    try {
      // Cleanup model instance if it has cleanup method
      if (aiModelManager.modelInstance && typeof aiModelManager.modelInstance.close === 'function') {
        aiModelManager.modelInstance.close();
      }
    } catch (error) {
      console.error('Error during AI model manager reset:', error.message);
    } finally {
      aiModelManager = null;
    }
  }
  
  // Clear cleanup interval
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  
  // Remove shutdown listeners to prevent memory leaks
  if (shutdownListenersAdded) {
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('beforeExit');
    process.removeAllListeners('exit');
    shutdownListenersAdded = false;
  }
};

module.exports = {
  AIModelManager,
  getAIModelManager,
  resetAIModelManager,
  MODEL_PROVIDERS,
  MODEL_CONFIGS,
  createLangChainModel
};