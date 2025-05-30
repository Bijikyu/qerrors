/**
 * Axios stub for testing environments
 * 
 * This module provides a minimal stub implementation of axios to prevent
 * real HTTP requests during testing. It replaces the actual axios module
 * when the stubs directory is included in the module search path.
 * 
 * Design rationale:
 * - Prevents network calls during unit tests for faster, more reliable testing
 * - Eliminates dependencies on external services (OpenAI API) during testing
 * - Provides predictable behavior for testing error handling scenarios
 * - Returns empty object to satisfy basic response structure expectations
 * 
 * The stub only implements the 'post' method as that's what qerrors uses
 * for OpenAI API calls. Additional methods can be added if needed.
 */

// Minimal axios stub that prevents real HTTP requests
// Returns empty object wrapped in Promise to match axios API contract
module.exports = { 
  post: async () => ({}) // Async function returning empty response object
};
