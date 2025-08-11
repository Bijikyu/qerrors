const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stub utility

// Create a quiet version of stubMethod that doesn't log
function quietStubMethod(obj, methodName, stubFn) {
  // Don't use qtests.stubMethod at all to avoid its logging
  // Implement our own simple stubbing that doesn't log
  if (typeof obj !== 'object' || obj === null) {
    throw new Error(`stubMethod expected object but received ${obj}`);
  }
  if (!(methodName in obj)) {
    throw new Error(`stubMethod could not find ${methodName} on provided object`);
  }
  if (typeof stubFn !== 'function') {
    throw new Error('stubMethod stubFn must be a function');
  }
  
  const originalMethod = obj[methodName];
  const hadOwn = Object.prototype.hasOwnProperty.call(obj, methodName);
  
  obj[methodName] = stubFn;
  
  return function restore() {
    if (hadOwn) {
      obj[methodName] = originalMethod;
    } else {
      delete obj[methodName];
    }
  };
}

function runAnalyze() {
  // Re-require both config and qerrors modules to ensure they pick up current environment variables
  delete require.cache[require.resolve('../lib/config')];
  delete require.cache[require.resolve('../lib/qerrors')];
  const { analyzeError } = require('../lib/qerrors');
  const err = new Error('v');
  err.name = 'AxiosError'; //trigger early return path
  return analyzeError(err, 'ctx');
}

test('verboseLog uses console when QERRORS_VERBOSE=true', async () => {
  const orig = process.env.QERRORS_VERBOSE; //save original env
  process.env.QERRORS_VERBOSE = 'true'; //enable verbose output
  let logged = false; //track console.log usage
  const restore = quietStubMethod(console, 'log', () => { logged = true; });
  try {
    await runAnalyze(); //invoke analyzeError which calls verboseLog
    assert.equal(logged, true); //expect console.log called
  } finally {
    restore(); //restore stubbed log
    if (orig === undefined) { delete process.env.QERRORS_VERBOSE; } else { process.env.QERRORS_VERBOSE = orig; } //restore env
  }
});

test('verboseLog skips console when QERRORS_VERBOSE=false', async () => {
  const orig = process.env.QERRORS_VERBOSE; //store env
  process.env.QERRORS_VERBOSE = 'false'; //disable verbose output
  
  let logged = false; //track calls
  let loggedMessage = ''; //capture the message
  
  const restoreLog = quietStubMethod(console, 'log', (msg) => { 
    logged = true; 
    loggedMessage = msg;
  });
  const restoreError = quietStubMethod(console, 'error', () => {}); // Also stub console.error to avoid interference
  
  try {
    await runAnalyze(); //run analyzeError with verbose disabled
    assert.equal(logged, false, `console.log should not run but was called with: "${loggedMessage}"`); //console.log should not run
  } finally {
    restoreLog(); //cleanup log stub
    restoreError(); //cleanup error stub
    if (orig === undefined) { delete process.env.QERRORS_VERBOSE; } else { process.env.QERRORS_VERBOSE = orig; } //reset env
  }
});

test('verboseLog uses console when QERRORS_VERBOSE unset (defaults to true)', async () => {
  const orig = process.env.QERRORS_VERBOSE; //capture original value
  delete process.env.QERRORS_VERBOSE; //unset variable to test default behavior
  let logged = false; //track usage
  const restoreLog = quietStubMethod(console, 'log', () => { logged = true; });
  const restoreError = quietStubMethod(console, 'error', () => {}); // Also stub console.error to avoid interference
  try {
    await runAnalyze(); //execute analyzeError
    assert.equal(logged, true); //expect console output by default
  } finally {
    restoreLog(); //restore log stub
    restoreError(); //restore error stub
    if (orig === undefined) { delete process.env.QERRORS_VERBOSE; } else { process.env.QERRORS_VERBOSE = orig; } //restore value
  }
});
