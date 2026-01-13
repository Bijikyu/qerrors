/**
 * Create a managed interval that tracks the timer for automatic cleanup
 *
 * @param {Function} callback - Function to call on each interval
 * @param {number} delay - Delay between executions in milliseconds
 * @param {...any} args - Arguments to pass to callback
 * @returns {NodeJS.Timeout} Timer reference
 */
export function createManagedInterval(callback: Function, delay: number, ...args: any[]): NodeJS.Timeout;
/**
 * Create a managed timeout that tracks the timer for automatic cleanup
 *
 * @param {Function} callback - Function to call after timeout
 * @param {number} delay - Delay before execution in milliseconds
 * @param {...any} args - Arguments to pass to callback
 * @returns {NodeJS.Timeout} Timer reference
 */
export function createManagedTimeout(callback: Function, delay: number, ...args: any[]): NodeJS.Timeout;
/**
 * Safely clear an interval timer with null check
 *
 * @param {NodeJS.Timeout|null|undefined} timer - Timer reference to clear
 * @returns {boolean} True if timer was cleared, false if timer was null/undefined
 */
export function clearIntervalSafe(timer: NodeJS.Timeout | null | undefined): boolean;
/**
 * Safely clear a timeout timer with null check
 *
 * @param {NodeJS.Timeout|null|undefined} timer - Timer reference to clear
 * @returns {boolean} True if timer was cleared, false if timer was null/undefined
 */
export function clearTimeoutSafe(timer: NodeJS.Timeout | null | undefined): boolean;
/**
 * Safely clear an interval timer and set it to null (for object properties)
 *
 * @param {Object} container - Object containing the timer property
 * @param {string} propertyName - Name of the property containing the timer
 * @returns {boolean} True if timer was cleared, false if timer was null/undefined
 */
export function clearIntervalAndNull(container: Object, propertyName: string): boolean;
/**
 * Safely clear a timeout timer and set it to null (for object properties)
 *
 * @param {Object} container - Object containing the timer property
 * @param {string} propertyName - Name of the property containing the timer
 * @returns {boolean} True if timer was cleared, false if timer was null/undefined
 */
export function clearTimeoutAndNull(container: Object, propertyName: string): boolean;
/**
 * Clear a timer from the registry without calling clearInterval/clearTimeout
 * Useful for timers that are already cleared manually
 *
 * @param {NodeJS.Timeout} timer - Timer reference to remove from registry
 * @returns {boolean} True if timer was found and removed
 */
export function removeTimer(timer: NodeJS.Timeout): boolean;
/**
 * Clear all managed timers (cleanup function for application shutdown)
 *
 * @returns {number} Number of timers that were cleared
 */
export function clearAllTimers(): number;
/**
 * Get count of active managed timers
 *
 * @returns {number} Number of currently tracked timers
 */
export function getActiveTimerCount(): number;
/**
 * Check if a specific timer is currently managed
 *
 * @param {NodeJS.Timeout} timer - Timer reference to check
 * @returns {boolean} True if timer is being tracked
 */
export function isTimerManaged(timer: NodeJS.Timeout): boolean;
/**
 * Legacy compatibility function for the common pattern: timer && (clearInterval(timer), timer = null)
 *
 * @param {NodeJS.Timeout|null|undefined} timer - Timer reference
 * @returns {null} Always returns null for assignment
 */
export function clearIntervalLegacy(timer: NodeJS.Timeout | null | undefined): null;
/**
 * Legacy compatibility function for the common pattern: timer && (clearTimeout(timer), timer = null)
 *
 * @param {NodeJS.Timeout|null|undefined} timer - Timer reference
 * @returns {null} Always returns null for assignment
 */
export function clearTimeoutLegacy(timer: NodeJS.Timeout | null | undefined): null;
//# sourceMappingURL=timerManager.d.ts.map