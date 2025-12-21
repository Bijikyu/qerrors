// Placeholder for AI model manager
// NOTE: This module provides stubs for AI model management. In a full implementation,
// these functions would interface with LangChain or other AI provider SDKs to obtain
// model instances, reset cached managers, and create model wrappers. The current
// placeholders return empty objects to keep the library functional without external
// dependencies, which is useful for environments where AI services are optional.

// Returns a singleton-like manager object that would expose methods to interact with
// the configured AI model. Here it returns an empty object as a minimal stub.
export const getAIModelManager = () => ({});

// Resets any internal state of the AI model manager. In a real implementation this
// might clear caches or reinitialize connections. The stub does nothing.
export const resetAIModelManager = () => {};

// Enumerates supported AI providers. Keeping this constant allows other parts of the
// codebase to reference provider names without hard‑coding strings.
export const MODEL_PROVIDERS = { GOOGLE: 'google', OPENAI: 'openai' };

// Factory function to create a LangChain model instance for the given provider.
// The underscore prefix on the parameter signals that the argument is currently unused
// in the stub implementation. A full version would instantiate and configure the
// appropriate LangChain model based on the provider and optional model name.
export const createLangChainModel = (_provider: string) => ({});