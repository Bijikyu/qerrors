const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //assert helpers
const qtests = require('qtests'); //stubbing utility

const qerrorsModule = require('../lib/qerrors'); //module under test
const qerrors = qerrorsModule; //default export used for call
const { axiosInstance } = qerrorsModule; //axios instance for capture
const logger = require('../lib/logger'); //promise resolving logger for capture

function withOpenAIToken(token) { //temporarily set OPENAI_API_KEY
  const orig = process.env.OPENAI_API_KEY; //save original value
  if (token === undefined) { delete process.env.OPENAI_API_KEY; } else { process.env.OPENAI_API_KEY = token; } //apply new token
  return () => { //return restore function
    if (orig === undefined) { delete process.env.OPENAI_API_KEY; } else { process.env.OPENAI_API_KEY = orig; } //restore saved token
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
  
  // Mock the AI model manager to capture the prompt
  const { getAIModelManager } = require('../lib/aiModelManager');
  const aiManager = getAIModelManager();
  const originalAnalyzeError = aiManager.analyzeError;
  let capturedPrompt = '';
  aiManager.analyzeError = async (prompt) => { 
    capturedPrompt = prompt; 
    return { ok: true }; 
  };
  
  const res = createRes(); //response mock
  const ctxObj = { foo: 'bar' }; //object context
  const err = new Error('boom'); //sample error
  try {
    await qerrors(err, ctxObj, {}, res); //invoke qerrors with object context
    await new Promise(r => setTimeout(r, 100)); //wait for analysis queue
  } finally {
    aiManager.analyzeError = originalAnalyzeError; //restore AI manager
    restoreToken(); //restore env token
  }
  assert.ok(capturedPrompt.includes(JSON.stringify(ctxObj))); //ensure context stringified
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
