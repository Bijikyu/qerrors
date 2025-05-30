/**
 * Winston logging library stub for testing environments
 * 
 * This module provides a minimal stub implementation of winston to prevent
 * actual file I/O operations during testing while maintaining API compatibility.
 * 
 * Design rationale:
 * - Prevents file system operations during testing for cleaner test environments
 * - Eliminates log file creation/modification that could interfere with tests
 * - Maintains winston API contract so logger-dependent code continues to work
 * - Uses no-op functions to satisfy function call expectations without side effects
 * - Includes all winston APIs used by qerrors to prevent runtime errors
 * 
 * The stub implements the complete winston API surface used by the logger module:
 * - createLogger factory function
 * - All format functions for log message processing
 * - Transport constructors for File and Console outputs
 */

module.exports = {
  // Factory function that returns a logger with no-op methods
  // Maintains winston logger interface while preventing actual logging
  createLogger: () => ({
    error: () => {}, // No-op error logging used only during testing //(clarified no-op usage for testing)
    warn: () => {},  // No-op warning logging used only during testing //(clarified no-op usage for testing)
    info: () => {}   // No-op info logging used only during testing //(clarified no-op usage for testing)
  }),
  
  // Format object with all formatting functions as no-ops
  // Prevents errors when logger configuration attempts to use these formatters
  format: {
    combine: () => {},    // No-op format combiner used only during testing //(clarified no-op usage for testing)
    timestamp: () => {},  // No-op timestamp formatter used only during testing //(clarified no-op usage for testing)
    errors: () => {},     // No-op error formatter used only during testing //(clarified no-op usage for testing)
    splat: () => {},      // No-op string interpolation formatter used only during testing //(clarified no-op usage for testing)
    json: () => {},       // No-op JSON formatter used only during testing //(clarified no-op usage for testing)
    printf: () => {}      // No-op printf-style formatter used only during testing //(clarified no-op usage for testing)
  },
  
  // Transport constructors as no-op functions
  // Prevents file system operations and console output during testing
  transports: {
    File: function(){},     // No-op file transport constructor used only during testing //(clarified no-op usage for testing)
    Console: function(){}   // No-op console transport constructor used only during testing //(clarified no-op usage for testing)
  }
};
