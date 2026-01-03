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
export function safeJsonStringify(data: any, fallback?: string): string;
/**
 * Safely parse JSON string with error handling
 *
 * @param {string} jsonString - JSON string to parse
 * @param {any} [fallback=null] - Fallback value if parsing fails
 * @returns {any} Parsed object or fallback
 */
export function safeJsonParse(jsonString: string, fallback?: any): any;
/**
 * Create a safe version of JSON.stringify with custom fallback
 *
 * @param {string} fallback - Custom fallback value
 * @returns {Function} Safe stringify function with specified fallback
 */
export function createSafeStringify(fallback: string): Function;
/**
 * Create a safe version of JSON.parse with custom fallback
 *
 * @param {any} fallback - Custom fallback value
 * @returns {Function} Safe parse function with specified fallback
 */
export function createSafeParse(fallback: any): Function;
/**
 * Check if a value can be safely serialized to JSON
 *
 * @param {any} data - Data to check
 * @returns {boolean} True if data is serializable
 */
export function isJsonSerializable(data: any): boolean;
/**
 * Get JSON serialization error details for debugging
 *
 * @param {any} data - Data that failed to serialize
 * @returns {Object} Error details and data information
 */
export function getJsonErrorInfo(data: any): Object;
//# sourceMappingURL=jsonHelpers.d.ts.map