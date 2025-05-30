/**
 * Method stubbing utility for test isolation and behavior control
 * 
 * This utility provides a clean, reusable way to temporarily replace object methods
 * during testing. It implements the "stub and restore" pattern that's essential
 * for reliable unit testing.
 * 
 * Design rationale:
 * - Enables testing of functions that depend on external services or complex behaviors
 * - Provides automatic cleanup mechanism to prevent test pollution
 * - Uses closure to safely capture original method references
 * - Includes comprehensive logging for debugging test setup issues
 * - Implements error handling to provide clear feedback when stubbing fails
 * 
 * Pattern: stub -> test -> restore ensures tests don't affect each other
 * This is critical for test reliability and preventing mysterious test failures.
 * 
 * @param {Object} obj - The object containing the method to stub
 * @param {string} method - The name of the method to replace
 * @param {Function} replacement - The stub function to use instead
 * @returns {Function} - Restore function that reverts the stub
 */
function stubMethod(obj, method, replacement) {
  // Log stubbing operation for test debugging and verification
  // This helps track which methods are being stubbed during test execution
  console.log(`stubMethod is running with ${method}`);
  
  try {
    // Capture original method implementation before replacement
    // This reference is preserved in closure for later restoration
    const orig = obj[method];
    
    // Replace method with stub implementation
    // From this point, all calls to obj[method] will use the replacement
    obj[method] = replacement;
    
    // Create restoration function using closure to preserve original method
    // This pattern ensures the original method is always available for restoration
    // regardless of what happens to the object or method after stubbing
    const restore = () => { 
      obj[method] = orig; // Restore original method implementation
    };
    
    // Log successful stub creation for test debugging
    console.log(`stubMethod is returning restore`);
    
    // Return restore function for test cleanup
    // Tests MUST call this function to prevent method pollution between tests
    return restore;
    
  } catch (error) {
    // Log stubbing failures with clear error context
    // This helps diagnose issues with test setup or object structure
    console.error(`stubMethod encountered ${error.message}`);
    
    // Re-throw error to fail fast and provide clear test failure indication
    // This prevents tests from running with incorrect stub configuration
    throw error;
  }
}

// Export stubbing utility for use across test files
// This promotes consistent stubbing patterns and code reuse in test suites
module.exports = stubMethod;
