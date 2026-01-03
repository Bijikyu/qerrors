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

const { commonImports } = require('./shared/imports');
const { verboseLog } = commonImports.logging();
const localVars = require('../config/localVars');
const qerrors = require('./qerrors');
const { MODEL_PROVIDERS, MODEL_CONFIGS, QERRORS_AI_PROVIDER, QERRORS_AI_MODEL } = localVars;
const { createLangChainModel, createAnalysisModel, HumanMessage } = require('./aiModelFactory');
const BoundedLRUCache = require('./shared/BoundedLRUCache');
const LRUCache = require('lru-cache');

class AIModelManager {
  constructor() {
    try {
      this.currentProvider = QERRORS_AI_PROVIDER || MODEL_PROVIDERS.GOOGLE;
      this.currentModel = QERRORS_AI_MODEL || null;
      this.modelInstance = null;
      this.analysisModelCache = new BoundedLRUCache({
        max: 10,
        ttl: 1000 * 60 * 30, // 30 minutes
        updateAgeOnGet: true,
        allowStale: false,
        dispose: (value, key) => {
          verboseLog(`AI analysis model evicted from cache: ${key}`);
        }
      });
      
      this.initializeCacheTracking();
    } catch (error) {
      console.error('Error initializing AI Model Manager:', error.message);
      this.analysisModelCache = new Map(); // Fallback to Map
    }
    this.initializeModel();
  }

  /**
   * Initialize the AI model with current provider settings
   */
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

  /**
   * Switch to a different AI provider/model
   */
  switchModel(provider, modelName = null) {
    try {
      this.currentProvider = provider;
      this.currentModel = modelName;
      this.modelInstance = createLangChainModel(provider, modelName);
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

  /**
   * Get current model information
   */
  getCurrentModelInfo() {
    return {
      provider: this.currentProvider,
      model: this.currentModel || MODEL_CONFIGS[this.currentProvider]?.defaultModel,
      available: this.modelInstance !== null
    };
  }

  /**
   * Get available models for a provider
   */
  getAvailableModels(provider = this.currentProvider) {
    const providerConfig = MODEL_CONFIGS[provider];
    return providerConfig ? Object.keys(providerConfig.models) : [];
  }

  /**
   * Analyze error using AI model with comprehensive response processing
   * 
   * This method orchestrates the AI-powered error analysis process, including:
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
      
      // Validate input prompt size to prevent API abuse and memory issues
      const MAX_PROMPT_SIZE = 8 * 1024; // 8KB limit for error prompts
      if (!errorPrompt || typeof errorPrompt !== 'string') {
        verboseLog('Invalid error prompt: must be a non-empty string');
        return null;
      }
      
      if (errorPrompt.length > MAX_PROMPT_SIZE) {
        verboseLog(`Error prompt too large (${errorPrompt.length} bytes), rejecting request`);
        return null;
      }
      
      // Additional content validation for security
      const dangerousPatterns = [
        /javascript:/gi,
        /data:/gi,
        /vbscript:/gi,
        /on\w+\s*=/gi,
        /expression\s*\(/gi,
        /<script[^>]*>/gi,
        /<\/script>/gi
      ];
      
      if (dangerousPatterns.some(pattern => pattern.test(errorPrompt))) {
        verboseLog('Error prompt contains potentially dangerous content, blocking request');
        return null;
      }
      
      try {
        verboseLog(`Analyzing error with ${this.currentProvider} model`);
        
        // Create analysis-optimized model instance with enhanced creativity settings
        const analysisModel = this.createAnalysisModel();
        
        // Format the error prompt for LangChain message structure
        const messages = [new HumanMessage(errorPrompt)];
        
        // Invoke AI model - this is the actual API call to the AI provider
        const response = await analysisModel.invoke(messages);
        let advice = response.content;
        
        // Process string responses to extract structured JSON data
        if (typeof advice === 'string') {
          try {
            // Limit response size to prevent memory issues
            const MAX_RESPONSE_SIZE = 50 * 1024; // 50KB limit
            if (advice.length > MAX_RESPONSE_SIZE) {
              verboseLog(`AI response too large (${advice.length} bytes), truncating`);
              advice = advice.substring(0, MAX_RESPONSE_SIZE);
            }
            
            // Remove leading/trailing whitespace for consistent parsing
            let cleanedAdvice = advice.trim();
            
            // Code block detection with single pass
            const codeBlockStart = cleanedAdvice.indexOf('```');
            const codeBlockEnd = cleanedAdvice.lastIndexOf('```');
            
            if (codeBlockStart !== -1 && codeBlockEnd > codeBlockStart + 3) {
              // Extract content between code blocks
              const blockContent = cleanedAdvice.substring(codeBlockStart + 3, codeBlockEnd).trim();
              
              // Check if it's a JSON block
              if (blockContent.startsWith('json')) {
                cleanedAdvice = blockContent.slice(4).trim();
              } else {
                cleanedAdvice = blockContent;
              }
            }
            
            // Early validation for common JSON patterns
            if (!cleanedAdvice.startsWith('{') || !cleanedAdvice.endsWith('}')) {
              advice = null;
            } else {
              // Attempt to parse cleaned response as JSON
              const parsedAdvice = JSON.parse(cleanedAdvice);
              
              // Validate parsed structure meets our expectations
              if (parsedAdvice && typeof parsedAdvice === 'object' && !Array.isArray(parsedAdvice)) {
                advice = parsedAdvice;
              } else {
                advice = null;
              }
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
  }

  /**
   * Create analysis model instance with optimized settings
   */
  createAnalysisModel() {
    try {
      // Create model with analysis-specific settings
      const analysisModel = createAnalysisModel(this.currentProvider, this.currentModel);
      
      // Configure for analysis (lower temperature for consistent responses)
      if (analysisModel && typeof analysisModel.temperature === 'undefined') {
        analysisModel.temperature = 0.1; // Low temperature for more deterministic responses
      }
      
      return analysisModel;
    } catch (error) {
      qerrors(error, 'aiModelManager.createAnalysisModel', {
        operation: 'analysis_model_creation',
        provider: this.currentProvider,
        model: this.currentModel
      });
      return null;
    }
  }

  /**
   * Initialize cache tracking for monitoring
   */
  initializeCacheTracking() {
    // Setup cache monitoring
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
    
    // Override cache methods for tracking
    const originalGet = this.analysisModelCache.get;
    this.analysisModelCache.get = (key) => {
      const value = originalGet.call(this.analysisModelCache, key);
      if (value !== undefined) {
        this.cacheStats.hits++;
      } else {
        this.cacheStats.misses++;
      }
      return value;
    };
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return {
      ...this.cacheStats,
      size: this.analysisModelCache.size,
      totalRequests: this.cacheStats.hits + this.cacheStats.misses,
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
    };
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup() {
    try {
      // Close model instance if available and has cleanup method
      if (this.modelInstance && typeof this.modelInstance.close === 'function') {
        try {
          await this.modelInstance.close();
        } catch (error) {
          console.warn('Error closing model instance:', error.message);
        }
      }
      
      // Clear cache
      if (this.analysisModelCache) {
        this.analysisModelCache.clear();
      }
      
      verboseLog('AI Model Manager cleanup completed');
    } catch (error) {
      console.error('Error during AI model manager cleanup:', error.message);
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
      const gracefulShutdown = async () => {
        if (aiModelManager) {
          try {
            await aiModelManager.cleanup();
          } catch (error) {
            console.error('Error during AI model manager shutdown:', error.message);
          } finally {
            aiModelManager = null;
          }
        }
      };
      
      process.on('SIGTERM', gracefulShutdown);
      process.on('SIGINT', gracefulShutdown);
      shutdownListenersAdded = true;
    }
  }
  return aiModelManager;
};

const resetAIModelManager = () => {
  if (aiModelManager) {
    return aiModelManager.cleanup().then(() => {
      aiModelManager = null;
    });
  }
};

module.exports = {
  getAIModelManager,
  resetAIModelManager,
  AIModelManager,
  MODEL_PROVIDERS,
  MODEL_CONFIGS
};