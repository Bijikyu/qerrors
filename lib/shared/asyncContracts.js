/**
 * Concurrency Control using p-limit npm module
 *
 * Purpose: Replace custom createLimiter function with battle-tested
 * p-limit library for ultra-lightweight Promise-based concurrency control.
 *
 * Features:
 * - Promise-based concurrency limiting
 * - Ultra-lightweight (11.7kB)
 * - Maintained by Sindre Sorhus (renowned maintainer)
 * - Zero known CVEs
 * - Better memory efficiency than custom queue implementations
 */

const pLimitModule = require('p-limit');

/**
 * Create Concurrency Limiter using p-limit
 *
 * Simplified factory function that replaces custom queue-based
 * concurrency control with battle-tested p-limit library.
 *
 * @param {number} concurrency - Maximum concurrent operations
 * @returns {Function} Limiter function that returns Promise
 */
function createConcurrencyLimiter (concurrency = 5) {
  if (typeof concurrency !== 'number' || concurrency <= 0) {
    throw new Error('Concurrency must be a positive number');
  }

  const limiter = pLimitModule(concurrency);
  return limiter;
}

module.exports = {
  createConcurrencyLimiter
};
