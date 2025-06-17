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

test('ErrorFactory.validation creates properly formatted validation error', () => {
  const error = errorTypes.ErrorFactory.validation('Email is required', 'email', { userId: 123 });
  
  assert.equal(error.code, 'VALIDATION_ERROR'); //should use validation error code
  assert.equal(error.message, 'Email is required'); //should use provided message
  assert.equal(error.type, errorTypes.ErrorTypes.VALIDATION); //should be validation type
  assert.equal(error.context.field, 'email'); //should include field context
  assert.equal(error.context.userId, 123); //should preserve additional context
  assert.equal(typeof error.timestamp, 'string'); //should include timestamp
  assert.equal(typeof error.requestId, 'string'); //should include request ID
});

test('ErrorFactory.authentication creates auth error with default message', () => {
  const error = errorTypes.ErrorFactory.authentication();
  
  assert.equal(error.code, 'AUTHENTICATION_ERROR'); //should use auth error code
  assert.equal(error.message, 'Authentication required'); //should use default message
  assert.equal(error.type, errorTypes.ErrorTypes.AUTHENTICATION); //should be auth type
});

test('ErrorFactory.authentication accepts custom message and context', () => {
  const error = errorTypes.ErrorFactory.authentication('Invalid token', { token: 'abc123' });
  
  assert.equal(error.message, 'Invalid token'); //should use custom message
  assert.equal(error.context.token, 'abc123'); //should include context
});

test('ErrorFactory.authorization creates authz error with default message', () => {
  const error = errorTypes.ErrorFactory.authorization();
  
  assert.equal(error.code, 'AUTHORIZATION_ERROR'); //should use authz error code
  assert.equal(error.message, 'Insufficient permissions'); //should use default message
  assert.equal(error.type, errorTypes.ErrorTypes.AUTHORIZATION); //should be authz type
});

test('ErrorFactory.notFound creates resource-specific error', () => {
  const error = errorTypes.ErrorFactory.notFound('User', { id: 456 });
  
  assert.equal(error.code, 'NOT_FOUND'); //should use not found error code
  assert.equal(error.message, 'User not found'); //should include resource in message
  assert.equal(error.type, errorTypes.ErrorTypes.NOT_FOUND); //should be not found type
  assert.equal(error.context.id, 456); //should include context
});

test('ErrorFactory.rateLimit creates rate limit error with default message', () => {
  const error = errorTypes.ErrorFactory.rateLimit();
  
  assert.equal(error.code, 'RATE_LIMIT_EXCEEDED'); //should use rate limit error code
  assert.equal(error.message, 'Rate limit exceeded'); //should use default message
  assert.equal(error.type, errorTypes.ErrorTypes.RATE_LIMIT); //should be rate limit type
});

test('ErrorFactory.network creates network error with service context', () => {
  const error = errorTypes.ErrorFactory.network('Connection timeout', 'external-api', { timeout: 5000 });
  
  assert.equal(error.code, 'NETWORK_ERROR'); //should use network error code
  assert.equal(error.message, 'Connection timeout'); //should use provided message
  assert.equal(error.type, errorTypes.ErrorTypes.NETWORK); //should be network type
  assert.equal(error.context.service, 'external-api'); //should include service context
  assert.equal(error.context.timeout, 5000); //should preserve additional context
});

test('ErrorFactory.database creates database error with operation context', () => {
  const error = errorTypes.ErrorFactory.database('Query failed', 'SELECT', { table: 'users' });
  
  assert.equal(error.code, 'DATABASE_ERROR'); //should use database error code
  assert.equal(error.message, 'Query failed'); //should use provided message
  assert.equal(error.type, errorTypes.ErrorTypes.DATABASE); //should be database type
  assert.equal(error.context.operation, 'SELECT'); //should include operation context
  assert.equal(error.context.table, 'users'); //should preserve additional context
});

test('ErrorFactory.system creates system error with component context', () => {
  const error = errorTypes.ErrorFactory.system('Memory allocation failed', 'cache', { size: '1GB' });
  
  assert.equal(error.code, 'SYSTEM_ERROR'); //should use system error code
  assert.equal(error.message, 'Memory allocation failed'); //should use provided message
  assert.equal(error.type, errorTypes.ErrorTypes.SYSTEM); //should be system type
  assert.equal(error.context.component, 'cache'); //should include component context
  assert.equal(error.context.size, '1GB'); //should preserve additional context
});

test('errorMiddleware handles errors with proper response format', () => {
  let capturedStatus; //capture status code
  let capturedData; //capture response data
  
  const mockReq = { //mock Express request
    url: '/api/test',
    method: 'GET',
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' }
  };
  
  const mockRes = { //mock Express response
    headersSent: false,
    status(code) { 
      capturedStatus = code; 
      return this; 
    },
    json(data) { 
      capturedData = data; 
      return this; 
    }
  };
  
  const testError = errorTypes.createTypedError(
    'Test error',
    errorTypes.ErrorTypes.VALIDATION,
    'TEST_ERROR'
  ); //create typed error for middleware
  
  errorTypes.errorMiddleware(testError, mockReq, mockRes, () => {});
  
  assert.equal(capturedStatus, 400); //validation error should return 400
  assert.ok(capturedData.error); //response should contain error object
  assert.equal(capturedData.error.code, 'TEST_ERROR'); //error code should match
  assert.equal(capturedData.error.message, 'Test error'); //error message should match
  assert.equal(capturedData.error.type, errorTypes.ErrorTypes.VALIDATION); //type should match
});

test('errorMiddleware defaults untyped errors to system type', () => {
  let capturedStatus; //capture status code
  let capturedData; //capture response data
  
  const mockReq = { //mock Express request
    url: '/api/test',
    method: 'GET',
    ip: '127.0.0.1',
    headers: {}
  };
  
  const mockRes = { //mock Express response
    headersSent: false,
    status(code) { 
      capturedStatus = code; 
      return this; 
    },
    json(data) { 
      capturedData = data; 
      return this; 
    }
  };
  
  const plainError = new Error('Plain error'); //untyped error
  
  errorTypes.errorMiddleware(plainError, mockReq, mockRes, () => {});
  
  assert.equal(capturedStatus, 500); //should default to 500 for system error
  assert.equal(capturedData.error.type, errorTypes.ErrorTypes.SYSTEM); //should default to system type
  assert.equal(capturedData.error.code, 'INTERNAL_ERROR'); //should use default error code
});