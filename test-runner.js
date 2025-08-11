#!/usr/bin/env node

/**
 * Test Runner for qerrors Project
 * 
 * Executes the complete test suite with proper setup and configuration.
 * This file provides a single entry point for running all tests in the project.
 * 
 * Usage:
 *   node test-runner.js
 *   npm test (if configured in package.json)
 * 
 * Features:
 * - Loads setup.js for test environment configuration
 * - Runs all test files in the test/ directory
 * - Provides clear test results summary
 * - Exit codes: 0 for success, 1 for failures
 */

const { spawn } = require('child_process');
const path = require('path');

// Configuration
const SETUP_FILE = './setup.js';
const TEST_DIR = 'test/';

/**
 * Execute the Node.js test runner with proper setup
 */
function runTests() {
  console.log('🧪 Running qerrors test suite...\n');
  
  // Spawn Node.js test runner with setup file and test directory
  const testProcess = spawn('node', [
    '-r', SETUP_FILE,  // Require setup.js before running tests
    '--test',          // Use Node.js built-in test runner
    TEST_DIR          // Run all tests in test directory
  ], {
    stdio: 'inherit',  // Pass through stdout/stderr for real-time output
    cwd: process.cwd() // Run from current working directory
  });
  
  // Handle test completion
  testProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ All tests passed successfully!');
    } else {
      console.log('\n❌ Some tests failed. Check output above for details.');
    }
    process.exit(code);
  });
  
  // Handle process errors
  testProcess.on('error', (error) => {
    console.error('❌ Failed to start test runner:', error.message);
    process.exit(1);
  });
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };