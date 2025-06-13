const path = require('path'); // use Node path to build absolute stub directory
const Module = require('module'); // access internal module loader to refresh paths
const stubsPath = path.join(__dirname, 'stubs'); // resolve location of dependency stubs
process.env.NODE_PATH = process.env.NODE_PATH // prepend stubs directory to module lookup
  ? `${stubsPath}${path.delimiter}${process.env.NODE_PATH}` // keep existing NODE_PATH while prioritizing stubs
  : stubsPath; // when NODE_PATH is empty ensure stubs are still used
Module._initPaths(); // reinitialize resolution cache so Node picks up updated NODE_PATH
