/**
 * Development and testing setup configuration
 * 
 * This module configures Node.js module resolution to include a local 'stubs' directory
 * in the module search path. This is primarily used for testing scenarios where
 * real dependencies need to be replaced with stub implementations.
 * 
 * Design rationale:
 * - Enables testing without external dependencies (network calls, file system, etc.)
 * - Allows controlled behavior simulation for edge cases and error conditions
 * - Maintains clean test isolation by preventing real API calls during testing
 * - Uses Node.js built-in module resolution rather than complex mocking frameworks
 * 
 * How it works:
 * 1. Adds 'stubs' directory to NODE_PATH environment variable
 * 2. Reinitializes Node's module search paths to include the new location
 * 3. When require() is called, Node checks stubs directory before real modules
 * 
 * This approach is simpler than runtime mocking but requires careful management
 * of when this setup is loaded to avoid affecting production code.
 */

const path = require('path');

// Add stubs directory to Node.js module search path
// This enables require() calls to find stub implementations before real modules
// Using path.join ensures cross-platform compatibility for directory paths
process.env.NODE_PATH = path.join(__dirname, 'stubs');

// Reinitialize Node's module resolution system to pick up the new NODE_PATH
// This is necessary because NODE_PATH is only read during Node.js startup
// Calling _initPaths() forces Node to rebuild its module search path array
require('module').Module._initPaths();
