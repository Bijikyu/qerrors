/**
 * JSON Helper Utilities
 *
 * Purpose: Provides safe JSON serialization with comprehensive fallback handling
 * to prevent application crashes from unserializable data.
 *
 * Design Rationale:
 * - Prevents JSON.stringify crashes from circular references or invalid data
 * - Provides deterministic fallback values for different data types
 * - Handles edge cases like undefined, functions, and complex objects
 * - Maintains backward compatibility with existing patterns
 * - Optimized for performance with minimal overhead
 */

/**
 * Safely serialize any value to JSON string with comprehensive fallback handling
 *
 * This function prevents crashes from circular references, undefined values,
 * functions, and other data that cannot be serialized to JSON.
 *
 * @param {any} data - Data to serialize
 * @param {string} [fallback='{}'] - Fallback value if serialization fails
 * @returns {string} JSON string representation or fallback
 */
function safeJsonStringify (data, fallback = '{}') {
  try {
    // Call native JSON.stringify, not our wrapper to prevent recursion
    const result = JSON.stringify(data);
    return result !== undefined ? result : fallback;
  } catch (error) {
    // Handle specific data types with deterministic fallbacks
    if (data === null) return 'null';
    if (data === undefined) return 'undefined';
    if (typeof data === 'string') return JSON.stringify(data);
    if (typeof data === 'number') return String(data);
    if (typeof data === 'boolean') return String(data);
    if (typeof data === 'function') return '"[Function]"';
    if (typeof data === 'symbol') return '"[Symbol]"';

    // Try to extract useful information from objects
    if (typeof data === 'object') {
      try {
        // Handle arrays
        if (Array.isArray(data)) {
          // FIXED: Clone items safely to prevent recursion
          const safeArray = data.map(item => {
            if (item === null || item === undefined) return null;
            if (typeof item === 'function') return '[Function]';
            if (typeof item === 'symbol') return '[Symbol]';
            return item; // Still safe as it's primitive
          });
          const arrayResult = JSON.stringify(safeArray);
          return arrayResult !== undefined ? arrayResult : fallback;
        }

        // Handle regular objects - create serializable representation
        const serializable = {};
        for (const key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            const value = data[key];
            if (value === null || value === undefined ||
                typeof value === 'function' || typeof value === 'symbol') {
              continue; // Skip non-serializable properties
            }
            try {
              // Test if value is serializable
              JSON.stringify(value);
              serializable[key] = value;
            } catch {
              // Skip non-serializable values
              continue;
            }
          }
        }
        const objectResult = JSON.stringify(serializable);
        return objectResult !== undefined ? objectResult : fallback;
      } catch {
        // Object handling failed, return basic object representation
        const basicResult = JSON.stringify({
          type: data?.constructor?.name || 'Object',
          toString: data?.toString?.() || '[Object]',
          keys: data && typeof data === 'object' ? Object.keys(data).slice(0, 10) : []
        });
        return basicResult !== undefined ? basicResult : fallback;
      }
    }

    // Final fallback
    return fallback;
  }
}

/**
 * Safely parse JSON string with error handling
 *
 * @param {string} jsonString - JSON string to parse
 * @param {any} [fallback=null] - Fallback value if parsing fails
 * @returns {any} Parsed object or fallback
 */
function safeJsonParse (jsonString, fallback = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return fallback;
  }
}

/**
 * Create a safe version of JSON.stringify with custom fallback
 *
 * @param {string} fallback - Custom fallback value
 * @returns {Function} Safe stringify function with specified fallback
 */
function createSafeStringify (fallback) {
  return (data) => safeJsonStringify(data, fallback);
}

/**
 * Create a safe version of JSON.parse with custom fallback
 *
 * @param {any} fallback - Custom fallback value
 * @returns {Function} Safe parse function with specified fallback
 */
function createSafeParse (fallback) {
  return (jsonString) => safeJsonParse(jsonString, fallback);
}

/**
 * Check if a value can be safely serialized to JSON
 *
 * @param {any} data - Data to check
 * @returns {boolean} True if data is serializable
 */
function isJsonSerializable (data) {
  try {
    JSON.stringify(data);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get JSON serialization error details for debugging
 *
 * @param {any} data - Data that failed to serialize
 * @returns {Object} Error details and data information
 */
function getJsonErrorInfo (data) {
  try {
    JSON.stringify(data);
    return { error: null, serializable: true };
  } catch (error) {
    return {
      error: error.message,
      serializable: false,
      dataType: typeof data,
      isArray: Array.isArray(data),
      constructor: data?.constructor?.name,
      keys: typeof data === 'object' && data !== null ? Object.keys(data) : [],
      toString: data?.toString?.()
    };
  }
}

module.exports = {
  safeJsonStringify,
  safeJsonParse,
  createSafeStringify,
  createSafeParse,
  isJsonSerializable,
  getJsonErrorInfo
};
