'use strict';

/**
 * AI Model Configuration Module - Centralized AI provider and model management
 * 
 * This module serves as a specialized interface for AI model configuration,
 * re-exporting the essential AI-related constants from the main configuration.
 * It provides a clean separation between core configuration and AI-specific
 * settings, making it easier to manage AI provider integrations.
 * 
 * Design rationale:
 * - Centralize AI model configuration in dedicated module
 * - Provide clean interface for AI-related settings
 * - Separate AI concerns from general configuration
 * - Enable easy extension for new AI providers
 * - Maintain single source of truth for model settings
 */

// Import AI provider enumeration and model configurations from centralized config
const { MODEL_PROVIDERS } = require('../config/localVars');  // Supported AI providers
const { MODEL_CONFIGS } = require('../config/localVars');     // Provider-specific model settings

/**
 * Module exports - AI configuration interface
 * 
 * This export provides access to AI provider definitions and
 * their corresponding model configurations. It serves as the
 * primary interface for any module that needs to interact
 * with AI models within the qerrors system.
 */
module.exports = {
  MODEL_PROVIDERS,  // Enumeration of supported AI providers (openai, google)
  MODEL_CONFIGS     // Detailed configuration for each provider's models
};