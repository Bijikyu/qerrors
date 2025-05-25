const path = require('path');
process.env.NODE_PATH = path.join(__dirname, 'stubs'); //add stub modules path
require('module').Module._initPaths();
