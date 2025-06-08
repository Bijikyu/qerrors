const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //strict assertions

function reloadQerrors() { //reload module to apply env vars
  delete require.cache[require.resolve('../lib/qerrors')]; //clear qerrors cache
  delete require.cache[require.resolve('../lib/config')]; //clear config cache
  return require('../lib/qerrors'); //return fresh module
}

test('axiosInstance honors QERRORS_MAX_FREE_SOCKETS', () => {
  const orig = process.env.QERRORS_MAX_FREE_SOCKETS; //save original env value
  process.env.QERRORS_MAX_FREE_SOCKETS = '100'; //set custom free sockets
  const { axiosInstance } = reloadQerrors(); //reload with env variable
  try {
    assert.equal(axiosInstance.defaults.httpAgent.maxFreeSockets, 100); //http agent uses env
    assert.equal(axiosInstance.defaults.httpsAgent.maxFreeSockets, 100); //https agent uses env
  } finally {
    if (orig === undefined) { delete process.env.QERRORS_MAX_FREE_SOCKETS; } else { process.env.QERRORS_MAX_FREE_SOCKETS = orig; }
    reloadQerrors(); //reset module state
  }
});

test('axiosInstance uses default max free sockets when env missing', () => {
  const orig = process.env.QERRORS_MAX_FREE_SOCKETS; //capture original env
  delete process.env.QERRORS_MAX_FREE_SOCKETS; //unset for default test
  const { axiosInstance } = reloadQerrors(); //reload with defaults
  try {
    assert.equal(axiosInstance.defaults.httpAgent.maxFreeSockets, 256); //default http agent value
    assert.equal(axiosInstance.defaults.httpsAgent.maxFreeSockets, 256); //default https agent value
  } finally {
    if (orig === undefined) { delete process.env.QERRORS_MAX_FREE_SOCKETS; } else { process.env.QERRORS_MAX_FREE_SOCKETS = orig; }
    reloadQerrors(); //restore module state
  }
});

test('axiosInstance uses default max free sockets with invalid env', () => { //invalid value fallback
  const orig = process.env.QERRORS_MAX_FREE_SOCKETS; //preserve original value
  process.env.QERRORS_MAX_FREE_SOCKETS = 'abc'; //set non-numeric
  const { axiosInstance } = reloadQerrors(); //reload module with invalid env
  try {
    assert.equal(axiosInstance.defaults.httpAgent.maxFreeSockets, 256); //default http agent value
    assert.equal(axiosInstance.defaults.httpsAgent.maxFreeSockets, 256); //default https agent value
  } finally {
    if (orig === undefined) { delete process.env.QERRORS_MAX_FREE_SOCKETS; } else { process.env.QERRORS_MAX_FREE_SOCKETS = orig; }
    reloadQerrors(); //clean module state
  }
});
