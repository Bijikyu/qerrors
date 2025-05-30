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
    error: () => {}, // No-op error logging
    warn: () => {},  // No-op warning logging
    info: () => {}   // No-op info logging
  }),
  
  // Format object with all formatting functions as no-ops
  // Prevents errors when logger configuration attempts to use these formatters
  format: {
    combine: () => {},    // No-op format combiner
    timestamp: () => {},  // No-op timestamp formatter
    errors: () => {},     // No-op error formatter
    splat: () => {},      // No-op string interpolation formatter
    json: () => {},       // No-op JSON formatter
    printf: () => {}      // No-op printf-style formatter
  },
  
  // Transport constructors as no-op functions
  // Prevents file system operations and console output during testing
  transports: {
    File: function(){},     // No-op file transport constructor
    Console: function(){}   // No-op console transport constructor
  }
};
