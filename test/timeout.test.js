const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //strict assertion helpers

function reloadQerrors() { //helper to reload module with current env
  delete require.cache[require.resolve('../lib/qerrors')]; //remove cached module
  return require('../lib/qerrors'); //reload qerrors fresh
}

test('axiosInstance honors QERRORS_TIMEOUT', () => {
  const orig = process.env.QERRORS_TIMEOUT; //save existing value
  process.env.QERRORS_TIMEOUT = '1234'; //set custom timeout for test
  const { axiosInstance } = reloadQerrors(); //reload module with env
  try {
    assert.equal(axiosInstance.defaults.timeout, 1234); //timeout matches env
  } finally {
    if (orig === undefined) { delete process.env.QERRORS_TIMEOUT; } else { process.env.QERRORS_TIMEOUT = orig; }
    reloadQerrors(); //restore module state
  }
});

test('axiosInstance uses default timeout when env missing', () => {
  const orig = process.env.QERRORS_TIMEOUT; //capture original env
  delete process.env.QERRORS_TIMEOUT; //remove to test default
  const { axiosInstance } = reloadQerrors(); //reload module with defaults
  try {
    assert.equal(axiosInstance.defaults.timeout, 10000); //default set
  } finally {
    if (orig === undefined) { delete process.env.QERRORS_TIMEOUT; } else { process.env.QERRORS_TIMEOUT = orig; }
    reloadQerrors(); //reset module state
  }
});
