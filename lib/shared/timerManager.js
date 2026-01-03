/**
 * Timer Manager Utility
 *
 * Purpose: Provides centralized timer cleanup and management to eliminate
 * duplicated timer handling patterns across multiple files.
 *
 * Design Rationale:
 * - Single point of change for timer operations
 * - Prevents memory leaks from uncleared timers
 * - Provides consistent timer lifecycle management
 * - Supports both interval and timeout timers
 * - Handles edge cases and error conditions
 * - Module-scoped timer registry to prevent conflicts
 */

const EventEmitter = require('events');
const timers = new Set();
const timerEmitter = new EventEmitter();

/**
 * Create a managed interval that tracks the timer for automatic cleanup
 *
 * @param {Function} callback - Function to call on each interval
 * @param {number} delay - Delay between executions in milliseconds
 * @param {...any} args - Arguments to pass to callback
 * @returns {NodeJS.Timeout} Timer reference
 */
function createManagedInterval (callback, delay, ...args) {
  const timer = setInterval(callback, delay, ...args);
  timer.unref(); // FIXED: Prevent timer from keeping process alive
  timers.add(timer);
  return timer;
}

/**
 * Create a managed timeout that tracks the timer for automatic cleanup
 *
 * @param {Function} callback - Function to call after timeout
 * @param {number} delay - Delay before execution in milliseconds
 * @param {...any} args - Arguments to pass to callback
 * @returns {NodeJS.Timeout} Timer reference
 */
function createManagedTimeout (callback, delay, ...args) {
  const timer = setTimeout(callback, delay, ...args);
  timer.unref(); // FIXED: Prevent timer from keeping process alive
  timers.add(timer);
  return timer;
}

/**
 * Safely clear an interval timer with null check
 *
 * @param {NodeJS.Timeout|null|undefined} timer - Timer reference to clear
 * @returns {boolean} True if timer was cleared, false if timer was null/undefined
 */
function clearIntervalSafe (timer) {
  if (timer) {
    clearInterval(timer);
    timers.delete(timer);
    return true;
  }
  return false;
}

/**
 * Safely clear a timeout timer with null check
 *
 * @param {NodeJS.Timeout|null|undefined} timer - Timer reference to clear
 * @returns {boolean} True if timer was cleared, false if timer was null/undefined
 */
function clearTimeoutSafe (timer) {
  if (timer) {
    clearTimeout(timer);
    timers.delete(timer);
    return true;
  }
  return false;
}

/**
 * Safely clear an interval timer and set it to null (for object properties)
 *
 * @param {Object} container - Object containing the timer property
 * @param {string} propertyName - Name of the property containing the timer
 * @returns {boolean} True if timer was cleared, false if timer was null/undefined
 */
function clearIntervalAndNull (container, propertyName) {
  // FIXED: Input validation to prevent runtime crashes
  if (!container || typeof propertyName !== 'string') {
    console.warn('Invalid parameters for clearIntervalAndNull:', { container, propertyName });
    return false;
  }

  const timer = container[propertyName];
  if (timer) {
    try {
      clearInterval(timer);
      timers.delete(timer);
    } catch (error) {
      // Continue even if clearInterval fails
      console.warn('Failed to clear interval timer:', error.message);
    } finally {
      container[propertyName] = null;
    }
    return true;
  }
  return false;
}

/**
 * Safely clear a timeout timer and set it to null (for object properties)
 *
 * @param {Object} container - Object containing the timer property
 * @param {string} propertyName - Name of the property containing the timer
 * @returns {boolean} True if timer was cleared, false if timer was null/undefined
 */
function clearTimeoutAndNull (container, propertyName) {
  // FIXED: Input validation to prevent runtime crashes
  if (!container || typeof propertyName !== 'string') {
    console.warn('Invalid parameters for clearTimeoutAndNull:', { container, propertyName });
    return false;
  }

  const timer = container[propertyName];
  if (timer) {
    try {
      clearTimeout(timer);
      timers.delete(timer);
    } catch (error) {
      // Continue even if clearTimeout fails
      console.warn('Failed to clear timeout timer:', error.message);
    } finally {
      container[propertyName] = null;
    }
    return true;
  }
  return false;
}

/**
 * Clear a timer from the registry without calling clearInterval/clearTimeout
 * Useful for timers that are already cleared manually
 *
 * @param {NodeJS.Timeout} timer - Timer reference to remove from registry
 * @returns {boolean} True if timer was found and removed
 */
function removeTimer (timer) {
  return timers.delete(timer);
}

/**
 * Clear all managed timers (cleanup function for application shutdown)
 *
 * @returns {number} Number of timers that were cleared
 */
function clearAllTimers () {
  let count = 0;
  for (const timer of timers) {
    try {
      // Try both clearing methods since we don't track timer types
      // One will work, one will be ignored - that's fine
      clearInterval(timer);
      clearTimeout(timer);
      count++;
    } catch (error) {
      // Continue even if clearing fails - one of the methods likely worked
      console.warn('Failed to clear timer:', error.message);
    }
  }
  timers.clear();
  return count;
}

/**
 * Get count of active managed timers
 *
 * @returns {number} Number of currently tracked timers
 */
function getActiveTimerCount () {
  return timers.size;
}

/**
 * Check if a specific timer is currently managed
 *
 * @param {NodeJS.Timeout} timer - Timer reference to check
 * @returns {boolean} True if timer is being tracked
 */
function isTimerManaged (timer) {
  return timers.has(timer);
}

/**
 * Legacy compatibility function for the common pattern: timer && (clearInterval(timer), timer = null)
 *
 * @param {NodeJS.Timeout|null|undefined} timer - Timer reference
 * @returns {null} Always returns null for assignment
 */
function clearIntervalLegacy (timer) {
  if (timer) {
    clearInterval(timer);
  }
  return null;
}

/**
 * Legacy compatibility function for the common pattern: timer && (clearTimeout(timer), timer = null)
 *
 * @param {NodeJS.Timeout|null|undefined} timer - Timer reference
 * @returns {null} Always returns null for assignment
 */
function clearTimeoutLegacy (timer) {
  if (timer) {
    clearTimeout(timer);
  }
  return null;
}

module.exports = {
  // Timer creation
  createManagedInterval,
  createManagedTimeout,

  // Safe cleanup
  clearIntervalSafe,
  clearTimeoutSafe,
  clearIntervalAndNull,
  clearTimeoutAndNull,

  // Registry management
  removeTimer,
  clearAllTimers,
  getActiveTimerCount,
  isTimerManaged,

  // Legacy compatibility
  clearIntervalLegacy,
  clearTimeoutLegacy
};
