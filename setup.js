const path = require('path'); //core Node module for handling filesystem paths
const Module = require('module'); //exposes internal module loader utilities
const stubsPath = path.join(__dirname, 'stubs'); //resolve absolute path to stub dependencies
process.env.NODE_PATH = process.env.NODE_PATH //prepend stub path while preserving existing NODE_PATH
  ? `${stubsPath}${path.delimiter}${process.env.NODE_PATH}` //ensures stubs override real modules during tests
  : stubsPath; //use stubs exclusively when no NODE_PATH is set
Module._initPaths(); //reinitialize search paths so Node honors updated NODE_PATH
