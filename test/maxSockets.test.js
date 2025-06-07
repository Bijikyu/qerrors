const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //strict assertions

function reloadQerrors() { //reload qerrors with current env
  delete require.cache[require.resolve('../lib/qerrors')]; //remove cached qerrors
  delete require.cache[require.resolve('../lib/config')]; //remove cached config to apply defaults
  return require('../lib/qerrors'); //return fresh module
}

test('axiosInstance honors QERRORS_MAX_SOCKETS', () => {
  const orig = process.env.QERRORS_MAX_SOCKETS; //save original value
  process.env.QERRORS_MAX_SOCKETS = '10'; //set custom sockets
  const { axiosInstance } = reloadQerrors(); //reload with env variable
  try {
    assert.equal(axiosInstance.defaults.httpAgent.maxSockets, 10); //http agent uses env
    assert.equal(axiosInstance.defaults.httpsAgent.maxSockets, 10); //https agent uses env
  } finally {
    if (orig === undefined) { delete process.env.QERRORS_MAX_SOCKETS; } else { process.env.QERRORS_MAX_SOCKETS = orig; }
    reloadQerrors(); //restore module state
  }
});

test('axiosInstance uses default max sockets when env missing', () => {
  const orig = process.env.QERRORS_MAX_SOCKETS; //capture original env
  delete process.env.QERRORS_MAX_SOCKETS; //unset for default test
  const { axiosInstance } = reloadQerrors(); //reload with defaults
  try {
    assert.equal(axiosInstance.defaults.httpAgent.maxSockets, 50); //default http agent value
    assert.equal(axiosInstance.defaults.httpsAgent.maxSockets, 50); //default https agent value
  } finally {
    if (orig === undefined) { delete process.env.QERRORS_MAX_SOCKETS; } else { process.env.QERRORS_MAX_SOCKETS = orig; }
    reloadQerrors(); //reset module state
  }
});

test('axiosInstance uses default max sockets with invalid env', () => { //invalid value falls back
  const orig = process.env.QERRORS_MAX_SOCKETS; //preserve original
  process.env.QERRORS_MAX_SOCKETS = 'abc'; //set non-numeric
  const { axiosInstance } = reloadQerrors(); //reload module with invalid env
  try {
    assert.equal(axiosInstance.defaults.httpAgent.maxSockets, 50); //default http agent value
    assert.equal(axiosInstance.defaults.httpsAgent.maxSockets, 50); //default https agent value
  } finally {
    if (orig === undefined) { delete process.env.QERRORS_MAX_SOCKETS; } else { process.env.QERRORS_MAX_SOCKETS = orig; }
    reloadQerrors(); //clean module state
  }
});
