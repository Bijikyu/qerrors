
/**
 * qerrors Setup - Enhanced with qtests Integration
 * 
 * This setup file configures module resolution for both qerrors stubs and qtests stubs.
 * It ensures our custom stubs work alongside qtests functionality for comprehensive testing.
 */

const path = require('path'); // use Node path to build absolute stub directory
const Module = require('module'); // access internal module loader to refresh paths

// Configure our custom stubs directory
const stubsPath = path.join(__dirname, 'stubs'); // resolve location of dependency stubs

// Note: qtests setup is NOT automatically enabled here due to winston conflicts
// Instead, individual test files can import qtests utilities as needed
// This prevents qtests from overriding our production winston configuration
// while still allowing manual use of qtests utilities in tests

// Configure NODE_PATH to include our custom stubs
process.env.NODE_PATH = process.env.NODE_PATH // prepend stubs directory to module lookup
  ? `${stubsPath}${path.delimiter}${process.env.NODE_PATH}` // keep existing NODE_PATH while prioritizing stubs
  : stubsPath; // when NODE_PATH is empty ensure stubs are still used

Module._initPaths(); // reinitialize resolution cache so Node picks up updated NODE_PATH

