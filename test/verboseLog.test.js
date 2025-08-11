const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stub utility

function runAnalyze() {
  // Re-require the module to ensure it picks up the current environment variables
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
  const restore = qtests.stubMethod(console, 'log', () => { logged = true; });
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
  const restoreLog = qtests.stubMethod(console, 'log', () => { logged = true; });
  const restoreError = qtests.stubMethod(console, 'error', () => {}); // Also stub console.error to avoid interference
  try {
    await runAnalyze(); //run analyzeError with verbose disabled
    assert.equal(logged, false); //console.log should not run
  } finally {
    restoreLog(); //cleanup log stub
    restoreError(); //cleanup error stub
    if (orig === undefined) { delete process.env.QERRORS_VERBOSE; } else { process.env.QERRORS_VERBOSE = orig; } //reset env
  }
});

test('verboseLog skips console when QERRORS_VERBOSE unset', async () => {
  const orig = process.env.QERRORS_VERBOSE; //capture original value
  delete process.env.QERRORS_VERBOSE; //unset variable
  let logged = false; //track usage
  const restoreLog = qtests.stubMethod(console, 'log', () => { logged = true; });
  const restoreError = qtests.stubMethod(console, 'error', () => {}); // Also stub console.error to avoid interference
  try {
    await runAnalyze(); //execute analyzeError
    assert.equal(logged, false); //expect no console output
  } finally {
    restoreLog(); //restore log stub
    restoreError(); //restore error stub
    if (orig === undefined) { delete process.env.QERRORS_VERBOSE; } else { process.env.QERRORS_VERBOSE = orig; } //restore value
  }
});
