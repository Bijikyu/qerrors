const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stubbing utility

const qerrorsModule = require('../lib/qerrors'); //module under test
const qerrors = qerrorsModule; //default export used for call
const { axiosInstance } = qerrorsModule; //axios instance for capture
const logger = require('../lib/logger'); //promise resolving logger for capture

function withOpenAIToken(token) { //temporarily set OPENAI_TOKEN
  const orig = process.env.OPENAI_TOKEN; //save original value
  if (token === undefined) { delete process.env.OPENAI_TOKEN; } else { process.env.OPENAI_TOKEN = token; } //apply new token
  return () => { //return restore function
    if (orig === undefined) { delete process.env.OPENAI_TOKEN; } else { process.env.OPENAI_TOKEN = orig; } //restore saved token
  };
}

function stubAxiosPost(content, capture) { //stub axiosInstance.post to capture body
  return qtests.stubMethod(axiosInstance, 'post', async (url, body) => { capture.body = body; return { data: { choices: [{ message: { content } }] } }; });
}

function createRes() { //minimal express like response object
  return { headersSent: false, statusCode: null, payload: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; },
    send(html) { this.payload = html; return this; } };
}

async function stubLogger(fn) { //stub logger.error for capture
  const real = await logger; //await resolved logger
  return qtests.stubMethod(real, 'error', fn); //replace error method
}

test('qerrors stringifies object context for openai request', async () => {
  const restoreToken = withOpenAIToken('ctx-token'); //ensure token for analysis
  const capture = {}; //capture axios body
  const restoreAxios = stubAxiosPost({ ok: true }, capture); //stub axios
  const res = createRes(); //response mock
  const ctxObj = { foo: 'bar' }; //object context
  const err = new Error('boom'); //sample error
  try {
    await qerrors(err, ctxObj, {}, res); //invoke qerrors with object context
    await new Promise(r => setTimeout(r, 0)); //wait for analysis queue
  } finally {
    restoreAxios(); //restore stubbed axios
    restoreToken(); //restore env token
  }
  assert.ok(capture.body.messages[0].content.includes(JSON.stringify(ctxObj))); //ensure context stringified
});

test('qerrors handles circular context without throwing', async () => {
  const restoreToken = withOpenAIToken(undefined); //ensure analysis skipped
  let logged; //capture logger output
  const restoreLogger = await stubLogger(errObj => { logged = errObj; }); //stub logger
  const res = createRes(); //response mock
  const ctxObj = {}; ctxObj.self = ctxObj; //self reference
  const err = new Error('boom'); //sample error
  try {
    await qerrors(err, ctxObj, {}, res); //invoke with circular context
    await new Promise(r => setTimeout(r, 0)); //wait for queue
  } finally {
    restoreLogger(); //restore logger stub
    restoreToken(); //restore env token
  }
  assert.equal(res.statusCode, 500); //response still sent
  assert.ok(typeof logged.context === 'string'); //context logged as string
  assert.ok(logged.context.includes('[Circular')); //circular marker present
});
