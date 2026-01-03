/**
 * Core Execution Utilities Module - Safe Operation Handling with Performance Tracking
 *
 * Purpose: Provides fundamental execution utilities for safe operation handling,
 * performance monitoring, and error resilience throughout the qerrors system.
 * This module serves as the foundation for reliable execution patterns and
 * provides essential utilities for timing, cloning, and error-safe operations.
 *
 * Design Principles:
 * - Error Safety: All operations include comprehensive error handling
 * - Performance Awareness: Built-in timing and performance tracking capabilities
 * - Type Safety: TypeScript interfaces for reliable operation patterns
 * - Functional Style: Pure functions and immutable operations where possible
 * - Backward Compatibility: Maintains existing API while adding enhanced functionality
 *
 * Key Features:
 * - Safe execution wrappers with fallback mechanisms
 * - Performance timing utilities with memory tracking
 * - Deep cloning utilities for object immutability
 * - Async operation result handling with structured responses
 * - Error context preservation for debugging
 */
export { createUnifiedTimer, createPerformanceTimer } from './timers.js';
/**
 * Safe execution wrapper with comprehensive error handling and fallback
 *
 * Purpose: Executes a function with complete error safety, providing a fallback
 * value when the operation fails. This utility is essential for operations that
 * must never break the application flow, even when encountering unexpected errors.
 *
 * Error Handling Strategy:
 * - Catches all exceptions and prevents propagation
 * - Logs detailed error information with operation context
 * - Returns a safe fallback value to maintain application stability
 * - Preserves error context for debugging and monitoring
 *
 * Use Cases:
 * - Configuration parsing that must not break application startup
 * - Optional feature initialization with graceful degradation
 * - Data processing operations where partial success is acceptable
 * - External service integration with fallback behavior
 *
 * @template T - Return type of the function and fallback
 * @param {string} name - Descriptive operation name for error logging and debugging
 * @param {() => T} fn - Function to execute safely - any errors will be caught
 * @param {T} fallback - Safe fallback value returned when the function fails
 * @param {Record<string, any>} [info] - Additional context information for error logging
 * @returns {T} Function result if successful, or fallback value if error occurs
 */
export declare const safeRun: <T>(name: string, fn: () => T, fallback: T, info?: Record<string, any>) => T;
/**
 * Deep clone utility using lodash for complete object immutability
 *
 * Purpose: Creates a deep clone of any object using lodash's proven
 * cloneDeep implementation. This utility is essential for creating
 * immutable copies of objects, preventing unintended mutations and
 * ensuring data integrity throughout the application.
 *
 * Performance Considerations:
 * - Uses lodash's optimized cloneDeep algorithm for maximum performance
 * - Handles all JavaScript types including dates, regex, and circular references
 * - Memory efficient with proper garbage collection patterns
 * - Suitable for both small and large object cloning operations
 *
 * Use Cases:
 * - Creating immutable state copies for functional programming patterns
 * - Preventing mutation of shared configuration objects
 * - Deep copying error contexts for logging without side effects
 * - Cloning complex data structures for testing and debugging
 *
 * @template T - Type of object being cloned
 * @param {T} obj - Object to create deep clone of
 * @returns {T} Complete deep clone with no shared references to original
 */
export declare const deepClone: <T>(obj: T) => T;
/**
 * Async operation attempt with structured result handling
 *
 * Purpose: Executes an async function and returns a structured result object
 * that clearly indicates success or failure. This pattern enables clean
 * error handling without try/catch blocks and provides a consistent interface
 * for async operations that may fail.
 *
 * Result Pattern Benefits:
 * - Explicit success/failure indication through boolean ok field
 * - Type-safe value access only when operation succeeds
 * - Structured error information for debugging and logging
 * - Enables functional error handling patterns without exceptions
 * - Consistent interface across all async operations
 *
 * Error Handling Philosophy:
 * - Catches all exceptions and prevents unhandled promise rejections
 * - Preserves original error information for debugging
 * - Returns structured result that can be safely destructured
 * - Enables pattern matching for different error scenarios
 *
 * @template T - Return type of the async function
 * @param {() => T | Promise<T>} fn - Async function to attempt execution
 * @returns {Promise<{ok: true, value: T} | {ok: false, error: any}>} Structured result with success status
 */
export declare const attempt: <T>(fn: () => T | Promise<T>) => Promise<{
    ok: true;
    value: T;
} | {
    ok: false;
    error: unknown;
}>;
/**
 * Execute operation with integrated error handling and logging
 */
export declare const executeWithErrorHandling: <T>(options: {
    opName: string;
    operation: () => T | Promise<T>;
    context?: Record<string, any>;
    failureMessage?: string;
    errorCode?: string;
    errorType?: string;
    logMessage?: string;
    rethrow?: boolean;
    fallbackValue?: T;
}) => Promise<T>;
/**
 * Execute operation with qerrors integration
 */
export declare const executeWithQerrors: <T>(options: {
    opName: string;
    operation: () => T | Promise<T>;
    context?: Record<string, any>;
    failureMessage: string;
    errorCode?: string;
    errorType?: string;
    logMessage?: string;
    rethrow?: boolean;
    fallbackValue?: T;
}) => Promise<T>;
/**
 * Format error message safely
 * @param error - Error to format
 * @param context - Additional context
 * @returns Formatted error message
 */
export declare const formatErrorMessage: (error: unknown, context: string) => string;
//# sourceMappingURL=executionCore.d.ts.map