'use strict';

const qerrors = require('./qerrors');

// Import unified data structures to replace the duplicate CircularBuffer
const { UnifiedCircularBuffer, BufferFactory } = require('./shared/dataStructures');

// Import existing shared data structures
const BoundedLRUCache = require('./shared/BoundedLRUCache');
const BoundedQueue = require('./shared/BoundedQueue');
const BoundedSet = require('./shared/BoundedSet');

// Re-export the unified circular buffer as CircularBuffer for backward compatibility
const CircularBuffer = UnifiedCircularBuffer;

// Export all memory management utilities
module.exports = {
  // Use the unified implementation instead of duplicate code
  CircularBuffer,
  
  // Existing shared implementations
  BoundedLRUCache,
  BoundedQueue,
  BoundedSet,
  
  // Also export the unified buffer factory for new usage
  BufferFactory,
  UnifiedCircularBuffer
};