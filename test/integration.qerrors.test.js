const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //strict assertions
const qtests = require('qtests'); //stubbing utilities

const qerrors = require('../lib/qerrors'); //module under test
const { axiosInstance } = qerrors; //axios instance used by qerrors
const logger = require('../lib/logger'); //logger instance

function createRes() { //minimal express like response mock
  return {
    headersSent: false, //flag for header state
    statusCode: null, //status tracking
    payload: null, //captured payload
    status(code) { this.statusCode = code; return this; }, //status setter
    json(data) { this.payload = data; return this; }, //json payload
    send(html) { this.payload = html; return this; } //html payload
  };
}

test('qerrors integration logs error and analyzes context', async () => {
  const restoreAxios = qtests.stubMethod(axiosInstance, 'post', async () => ({ data: { choices: [{ message: { content: '{"ok":true}' } }] } })); //stub axiosInstance.post
  let logArg; //capture logger.error argument
  const origLog = logger.error; //store original function
  logger.error = (...args) => { logArg = args[0]; return origLog.apply(logger, args); }; //wrap logger.error to capture call //(wrap to spy while preserving)
  const origToken = process.env.OPENAI_TOKEN; //store token to restore after test
  process.env.OPENAI_TOKEN = 'tkn'; //set token for analyzeError to run
  const res = createRes(); //create mock res
  const err = new Error('boom'); //sample error
  try {
    await qerrors(err, 'spyCtx', {}, res); //invoke qerrors real functions
  } finally {
    restoreAxios(); //restore axios.post
    logger.error = origLog; //restore logger.error
    if (origToken === undefined) { delete process.env.OPENAI_TOKEN; } else { process.env.OPENAI_TOKEN = origToken; } //restore token after test
  }
  assert.ok(logArg.uniqueErrorName); //ensure log contains id
  assert.equal(logArg.uniqueErrorName, err.uniqueErrorName); //id matches error
  assert.equal(logArg.context, 'spyCtx'); //verify context was logged correctly
});