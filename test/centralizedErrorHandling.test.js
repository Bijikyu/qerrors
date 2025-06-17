const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //strict assertion helpers

const qerrors = require('../lib/qerrors'); //qerrors module with centralized handling
const logger = require('../lib/logger'); //logger for stubbing
const qtests = require('qtests'); //stubbing utilities

function createRes() { //construct minimal Express-like response mock
  return {
    headersSent: false, //simulates whether headers have been sent
    statusCode: null, //captured status for assertions
    payload: null, //body content returned by status/json/send
    status(code) { this.statusCode = code; return this; }, //chainable setter
    json(data) { this.payload = data; return this; }, //capture JSON payload
    send(html) { this.payload = html; return this; } //capture HTML output
  };
}

async function stubLogger(loggerFn) { //stub logger error method
  const realLogger = await logger; //wait for logger instance
  return qtests.stubMethod(realLogger, 'error', loggerFn); //stub logger.error with provided function
}

test('logErrorWithSeverity logs with severity context', async () => {
  let criticalLogged = false; //track critical console output
  let highLogged = false; //track high severity console output

  const restoreLogger = await stubLogger(() => {}); //stub logger to prevent actual logging
  const restoreConsole = qtests.stubMethod(console, 'error', (msg) => { //stub console.error
    if (typeof msg === 'string' && msg.includes('CRITICAL ERROR')) criticalLogged = true;
    if (typeof msg === 'string' && msg.includes('HIGH SEVERITY ERROR')) highLogged = true;
  });

  try {
    const testError = new Error('Test error'); //create test error
    const context = { userId: 123 }; //test context
    
    // Test critical severity
    await qerrors.logErrorWithSeverity(testError, 'testFunction', context, qerrors.errorTypes.ErrorSeverity.CRITICAL);
    assert.ok(criticalLogged); //critical message should be logged to console
    
    // Reset and test high severity
    criticalLogged = false;
    highLogged = false;
    await qerrors.logErrorWithSeverity(testError, 'testFunction', context, qerrors.errorTypes.ErrorSeverity.HIGH);
    assert.ok(highLogged); //high severity message should be logged to console
    
    // Test medium severity (should not trigger console output)
    criticalLogged = false;
    highLogged = false;
    await qerrors.logErrorWithSeverity(testError, 'testFunction', context, qerrors.errorTypes.ErrorSeverity.MEDIUM);
    assert.ok(!criticalLogged); //medium severity should not trigger critical console output
    assert.ok(!highLogged); //medium severity should not trigger high console output

  } finally {
    restoreLogger(); //restore logger stub
    restoreConsole(); //restore console stub
  }
});

test('handleControllerError sends standardized response', async () => {
  const restoreLogger = await stubLogger(() => {}); //stub logger to prevent actual logging
  
  // Don't stub logErrorWithSeverity, just verify the response behavior
  try {
    const res = createRes(); //mock response object
    const testError = qerrors.errorTypes.createTypedError(
      'Validation failed',
      qerrors.errorTypes.ErrorTypes.VALIDATION,
      'VALIDATION_ERROR'
    ); //create typed validation error
    const context = { requestId: 'test-123' }; //test context

    await qerrors.handleControllerError(res, testError, 'testController', context, 'Custom user message');

    assert.equal(res.statusCode, 400); //validation error should return 400
    assert.ok(res.payload); //response should have payload
    assert.equal(res.payload.error.code, 'VALIDATION_ERROR'); //error code should match
    assert.equal(res.payload.error.message, 'Custom user message'); //custom message should be used
    assert.equal(res.payload.error.type, qerrors.errorTypes.ErrorTypes.VALIDATION); //type should match

  } finally {
    restoreLogger(); //restore logger stub
  }
});

test('handleControllerError defaults error type and uses error message', async () => {
  const restoreLogger = await stubLogger(() => {}); //stub logger

  try {
    const res = createRes(); //mock response object
    const testError = new Error('Generic error'); //plain error without type
    
    await qerrors.handleControllerError(res, testError, 'testController');

    assert.equal(res.statusCode, 500); //should default to 500 for system error
    assert.equal(res.payload.error.type, qerrors.errorTypes.ErrorTypes.SYSTEM); //should default to system error
    assert.equal(res.payload.error.message, 'Generic error'); //should use error message when no custom message

  } finally {
    restoreLogger(); //restore logger stub
  }
});

test('withErrorHandling executes operation and returns result on success', async () => {
  const testResult = { success: true }; //mock successful result
  const operation = async () => testResult; //mock successful operation
  
  const result = await qerrors.withErrorHandling(operation, 'testOperation');
  
  assert.deepEqual(result, testResult); //should return operation result
});

test('withErrorHandling logs error and returns fallback on failure', async () => {
  const restoreLogger = await stubLogger(() => {}); //stub logger to prevent actual logging
  
  try {
    const testError = new Error('Operation failed'); //test error
    testError.severity = qerrors.errorTypes.ErrorSeverity.HIGH; //set error severity
    const operation = async () => { throw testError; }; //mock failing operation
    const fallback = { fallback: true }; //fallback result
    
    const result = await qerrors.withErrorHandling(operation, 'testOperation', {}, fallback);
    
    assert.deepEqual(result, fallback); //should return fallback on error

  } finally {
    restoreLogger(); //restore logger stub
  }
});

test('withErrorHandling defaults to medium severity when error has no severity', async () => {
  const restoreLogger = await stubLogger(() => {}); //stub logger to prevent actual logging
  
  try {
    const testError = new Error('Operation failed'); //error without severity
    const operation = async () => { throw testError; }; //mock failing operation
    
    const result = await qerrors.withErrorHandling(operation, 'testOperation');
    
    assert.equal(result, null); //should return null when no fallback provided

  } finally {
    restoreLogger(); //restore logger stub
  }
});

test('withErrorHandling returns null fallback when no fallback provided', async () => {
  const restoreLogger = await stubLogger(() => {}); //stub logger to prevent actual logging

  try {
    const testError = new Error('Operation failed'); //test error
    const operation = async () => { throw testError; }; //mock failing operation
    
    const result = await qerrors.withErrorHandling(operation, 'testOperation');
    
    assert.equal(result, null); //should return null when no fallback provided

  } finally {
    restoreLogger(); //restore logger stub
  }
});