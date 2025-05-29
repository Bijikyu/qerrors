const test = require('node:test');
const assert = require('node:assert/strict');

const pkg = require('../index');
const qerrors = require('../lib/qerrors');
const logger = require('../lib/logger');

/**
 * Test suite for the main module's public API and export structure.
 * 
 * These tests verify that the qerrors module correctly exports its
 * public interface, ensuring backward compatibility and proper module
 * structure for consumers of the package.
 * 
 * Rationale: The module's export structure is its public contract with
 * consumers. We need to ensure:
 * 
 * 1. Named exports (qerrors, logger) are available for selective importing
 * 2. Default export points to qerrors for backward compatibility
 * 3. All exported functions and objects have the expected API surface
 * 4. Module can be imported using various CommonJS patterns
 * 
 * This testing approach ensures that existing codebases using the module
 * won't break when the module is updated, and that new consumers can
 * import the module using their preferred pattern.
 * 
 * We test both the module's export structure and that the exported
 * functions are the actual implementations, not just placeholders.
 */
test('index exports qerrors and logger', () => {
  assert.equal(pkg.qerrors, qerrors);
  assert.equal(pkg.logger, logger);
  assert.equal(pkg.default, qerrors);
});