const test = require('node:test'); //node test runner
const assert = require('node:assert/strict'); //strict assertion helpers

const errorTypes = require('../lib/errorTypes'); //error types module under test
const qtests = require('qtests'); //stubbing utilities

test('ErrorTypes constants are properly defined', () => {
  assert.equal(typeof errorTypes.ErrorTypes, 'object'); //ensure ErrorTypes exported
  assert.equal(errorTypes.ErrorTypes.VALIDATION, 'validation'); //verify validation type
  assert.equal(errorTypes.ErrorTypes.AUTHENTICATION, 'authentication'); //verify auth type
  assert.equal(errorTypes.ErrorTypes.AUTHORIZATION, 'authorization'); //verify authz type
  assert.equal(errorTypes.ErrorTypes.NOT_FOUND, 'not_found'); //verify not found type
  assert.equal(errorTypes.ErrorTypes.RATE_LIMIT, 'rate_limit'); //verify rate limit type
  assert.equal(errorTypes.ErrorTypes.NETWORK, 'network'); //verify network type
  assert.equal(errorTypes.ErrorTypes.DATABASE, 'database'); //verify database type
  assert.equal(errorTypes.ErrorTypes.SYSTEM, 'system'); //verify system type
  assert.equal(errorTypes.ErrorTypes.CONFIGURATION, 'configuration'); //verify config type
});

test('ErrorSeverity constants are properly defined', () => {
  assert.equal(typeof errorTypes.ErrorSeverity, 'object'); //ensure ErrorSeverity exported
  assert.equal(errorTypes.ErrorSeverity.LOW, 'low'); //verify low severity
  assert.equal(errorTypes.ErrorSeverity.MEDIUM, 'medium'); //verify medium severity
  assert.equal(errorTypes.ErrorSeverity.HIGH, 'high'); //verify high severity
  assert.equal(errorTypes.ErrorSeverity.CRITICAL, 'critical'); //verify critical severity
});

test('ERROR_STATUS_MAP maps types to correct HTTP status codes', () => {
  assert.equal(errorTypes.ERROR_STATUS_MAP[errorTypes.ErrorTypes.VALIDATION], 400); //validation maps to 400
  assert.equal(errorTypes.ERROR_STATUS_MAP[errorTypes.ErrorTypes.AUTHENTICATION], 401); //auth maps to 401
  assert.equal(errorTypes.ERROR_STATUS_MAP[errorTypes.ErrorTypes.AUTHORIZATION], 403); //authz maps to 403
  assert.equal(errorTypes.ERROR_STATUS_MAP[errorTypes.ErrorTypes.NOT_FOUND], 404); //not found maps to 404
  assert.equal(errorTypes.ERROR_STATUS_MAP[errorTypes.ErrorTypes.RATE_LIMIT], 429); //rate limit maps to 429
  assert.equal(errorTypes.ERROR_STATUS_MAP[errorTypes.ErrorTypes.NETWORK], 502); //network maps to 502
  assert.equal(errorTypes.ERROR_STATUS_MAP[errorTypes.ErrorTypes.DATABASE], 500); //database maps to 500
  assert.equal(errorTypes.ERROR_STATUS_MAP[errorTypes.ErrorTypes.SYSTEM], 500); //system maps to 500
  assert.equal(errorTypes.ERROR_STATUS_MAP[errorTypes.ErrorTypes.CONFIGURATION], 500); //config maps to 500
});

test('ERROR_SEVERITY_MAP maps types to correct severity levels', () => {
  assert.equal(errorTypes.ERROR_SEVERITY_MAP[errorTypes.ErrorTypes.VALIDATION], errorTypes.ErrorSeverity.LOW); //validation is low severity
  assert.equal(errorTypes.ERROR_SEVERITY_MAP[errorTypes.ErrorTypes.AUTHENTICATION], errorTypes.ErrorSeverity.LOW); //auth is low severity
  assert.equal(errorTypes.ERROR_SEVERITY_MAP[errorTypes.ErrorTypes.AUTHORIZATION], errorTypes.ErrorSeverity.MEDIUM); //authz is medium severity
  assert.equal(errorTypes.ERROR_SEVERITY_MAP[errorTypes.ErrorTypes.NOT_FOUND], errorTypes.ErrorSeverity.LOW); //not found is low severity
  assert.equal(errorTypes.ERROR_SEVERITY_MAP[errorTypes.ErrorTypes.RATE_LIMIT], errorTypes.ErrorSeverity.MEDIUM); //rate limit is medium severity
  assert.equal(errorTypes.ERROR_SEVERITY_MAP[errorTypes.ErrorTypes.NETWORK], errorTypes.ErrorSeverity.MEDIUM); //network is medium severity
  assert.equal(errorTypes.ERROR_SEVERITY_MAP[errorTypes.ErrorTypes.DATABASE], errorTypes.ErrorSeverity.HIGH); //database is high severity
  assert.equal(errorTypes.ERROR_SEVERITY_MAP[errorTypes.ErrorTypes.SYSTEM], errorTypes.ErrorSeverity.HIGH); //system is high severity
  assert.equal(errorTypes.ERROR_SEVERITY_MAP[errorTypes.ErrorTypes.CONFIGURATION], errorTypes.ErrorSeverity.CRITICAL); //config is critical severity
});

test('getRequestId extracts ID from request headers', () => {
  const req1 = { headers: { 'x-request-id': 'test-123' } }; //mock request with x-request-id
  assert.equal(errorTypes.getRequestId(req1), 'test-123'); //should extract x-request-id

  const req2 = { headers: { 'x-correlation-id': 'corr-456' } }; //mock request with x-correlation-id
  assert.equal(errorTypes.getRequestId(req2), 'corr-456'); //should extract x-correlation-id

  const req3 = { headers: { 'request-id': 'req-789' } }; //mock request with request-id
  assert.equal(errorTypes.getRequestId(req3), 'req-789'); //should extract request-id
});

test('getRequestId generates UUID when no headers available', () => {
  const req1 = { headers: {} }; //empty headers
  const id1 = errorTypes.getRequestId(req1); //get generated ID
  assert.equal(typeof id1, 'string'); //should be string
  assert.ok(id1.length > 0); //should have content

  const req2 = null; //no request object
  const id2 = errorTypes.getRequestId(req2); //get generated ID
  assert.equal(typeof id2, 'string'); //should be string
  assert.ok(id2.length > 0); //should have content

  assert.notEqual(id1, id2); //different calls should generate different IDs
});

test('createStandardError builds properly formatted error object', () => {
  const context = { userId: 123, action: 'test' }; //sample context
  const error = errorTypes.createStandardError(
    'TEST_ERROR',
    'Test error message',
    errorTypes.ErrorTypes.VALIDATION,
    context
  );

  assert.equal(error.code, 'TEST_ERROR'); //code should match
  assert.equal(error.message, 'Test error message'); //message should match
  assert.equal(error.type, errorTypes.ErrorTypes.VALIDATION); //type should match
  assert.equal(typeof error.timestamp, 'string'); //timestamp should be string
  assert.equal(typeof error.requestId, 'string'); //requestId should be string
  assert.equal(error.context.userId, 123); //context should be preserved
  assert.equal(error.context.action, 'test'); //context should be preserved
  assert.equal(error.context.req, undefined); //req should be removed
  assert.equal(error.context.res, undefined); //res should be removed
});

test('createStandardError removes req and res from context', () => {
  const mockReq = { headers: { 'x-request-id': 'test' } }; //mock request
  const mockRes = { status: () => {} }; //mock response
  const context = { req: mockReq, res: mockRes, data: 'keep' }; //context with req/res

  const error = errorTypes.createStandardError('TEST', 'message', 'validation', context);

  assert.equal(error.context.req, undefined); //req should be removed
  assert.equal(error.context.res, undefined); //res should be removed
  assert.equal(error.context.data, 'keep'); //other data should remain
});

test('sendErrorResponse sends JSON with correct status', () => {
  let capturedStatus; //capture status code
  let capturedData; //capture response data
  let statusCalled = false; //track if status was called
  let jsonCalled = false; //track if json was called

  const mockRes = { //mock response object
    headersSent: false,
    status(code) { 
      capturedStatus = code; 
      statusCalled = true;
      return this; 
    },
    json(data) { 
      capturedData = data; 
      jsonCalled = true;
      return this; 
    }
  };

  const errorObj = { code: 'TEST', message: 'test' }; //sample error object
  errorTypes.sendErrorResponse(mockRes, 400, errorObj);

  assert.ok(statusCalled); //status should be called
  assert.ok(jsonCalled); //json should be called
  assert.equal(capturedStatus, 400); //status should be 400
  assert.deepEqual(capturedData, { error: errorObj }); //response should wrap error
});

test('sendErrorResponse does not send when headers already sent', () => {
  let statusCalled = false; //track if status was called
  let jsonCalled = false; //track if json was called

  const mockRes = { //mock response with headers sent
    headersSent: true,
    status() { statusCalled = true; return this; },
    json() { jsonCalled = true; return this; }
  };

  const errorObj = { code: 'TEST', message: 'test' }; //sample error object
  errorTypes.sendErrorResponse(mockRes, 400, errorObj);

  assert.ok(!statusCalled); //status should not be called
  assert.ok(!jsonCalled); //json should not be called
});

test('createTypedError creates error with proper classification', () => {
  const error = errorTypes.createTypedError(
    'Database connection failed',
    errorTypes.ErrorTypes.DATABASE,
    'DB_CONN_ERROR',
    { host: 'localhost' }
  );

  assert.ok(error instanceof Error); //should be Error instance
  assert.equal(error.message, 'Database connection failed'); //message should match
  assert.equal(error.type, errorTypes.ErrorTypes.DATABASE); //type should match
  assert.equal(error.code, 'DB_CONN_ERROR'); //code should match
  assert.equal(error.statusCode, 500); //status should be mapped from type
  assert.equal(error.severity, errorTypes.ErrorSeverity.HIGH); //severity should be mapped from type
  assert.deepEqual(error.context, { host: 'localhost' }); //context should be preserved
});

test('createTypedError uses defaults when optional parameters omitted', () => {
  const error = errorTypes.createTypedError(
    'Simple error',
    errorTypes.ErrorTypes.VALIDATION
  );

  assert.equal(error.code, 'GENERIC_ERROR'); //should use default code
  assert.deepEqual(error.context, {}); //should use empty context
  assert.equal(error.statusCode, 400); //should map status from validation type
  assert.equal(error.severity, errorTypes.ErrorSeverity.LOW); //should map severity from validation type
});