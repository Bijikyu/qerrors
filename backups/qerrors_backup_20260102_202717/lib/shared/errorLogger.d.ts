/**
 * Log error with qerrors or fallback to console
 *
 * @param {Error} error - Error to log
 * @param {string} location - Location identifier for the error
 * @param {Object} context - Additional context information
 * @param {Object} [options={}] - Additional options
 * @returns {boolean} True if logged successfully
 */
export function logError(error: Error, location: string, context?: Object, options?: Object): boolean;
/**
 * Log error as warning with qerrors or fallback to console
 *
 * @param {Error} error - Error to log as warning
 * @param {string} location - Location identifier for the warning
 * @param {Object} context - Additional context information
 * @returns {boolean} True if logged successfully
 */
export function logWarning(error: Error, location: string, context?: Object): boolean;
/**
 * Log error as info with qerrors or fallback to console
 *
 * @param {Error} error - Error to log as info
 * @param {string} location - Location identifier for the info
 * @param {Object} context - Additional context information
 * @returns {boolean} True if logged successfully
 */
export function logInfo(error: Error, location: string, context?: Object): boolean;
/**
 * Create a safe logger function that uses qerrors with console fallback
 *
 * @param {string} defaultLocation - Default location for error messages
 * @param {string} [severity='error'] - Default severity level
 * @returns {Function} Safe logger function
 */
export function createSafeLogger(defaultLocation: string, severity?: string): Function;
/**
 * Log multiple errors efficiently (batch processing)
 *
 * @param {Array} errors - Array of {error, location, context} objects
 * @param {Object} [options={}] - Batch options
 * @returns {number} Number of errors successfully logged
 */
export function logErrors(errors: any[], options?: Object): number;
/**
 * Check if qerrors is available
 *
 * @returns {boolean} True if qerrors is available
 */
export function isQerrorsAvailable(): boolean;
/**
 * Get qerrors module status
 *
 * @returns {Object} Status information about qerrors availability
 */
export function getLoggerStatus(): Object;
/**
 * Reset qerrors cache (useful for testing)
 */
export function resetCache(): void;
/**
 * Attempt to load qerrors module safely
 *
 * @returns {Object|null} qerrors module or null if unavailable
 */
export function loadQerrors(): Object | null;
//# sourceMappingURL=errorLogger.d.ts.map