/**
 * Enhanced Logging Tests for qerrors module
 * 
 * This test suite validates the enhanced logging functionality including
 * security-aware sanitization, performance monitoring, request correlation,
 * and structured logging capabilities.
 */

const { test } = require('node:test'); //node test framework
const assert = require('assert'); //node assert for test validation
const qtests = require('qtests'); //qerrors test utilities for mocking and stubbing
const logger = require('../lib/logger'); //enhanced logger module

// Test constants for validation
const SENSITIVE_DATA = {
    creditCard: '4532-1234-5678-9000',
    ssn: '123-45-6789',
    cvv: 'cvv: 123',
    password: 'password: secretpass123',
    apiKey: 'api_key: sk_test_123456789',
    token: 'token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    email: 'user@example.com',
    phone: '+1-555-123-4567'
};

const EXPECTED_SANITIZED = {
    creditCard: '[CARD-REDACTED]',
    ssn: '[SSN-REDACTED]',
    cvv: 'cvv: [REDACTED]',
    password: 'password: [REDACTED]',
    apiKey: 'api_key: [REDACTED]',
    token: 'token: [REDACTED]',
    email: '[EMAIL-REDACTED]',
    phone: '[PHONE-REDACTED]'
};

// Test sanitizeMessage function with various sensitive data patterns
test('sanitizeMessage masks credit card numbers', () => {
    const result = logger.sanitizeMessage(`Payment processed for card ${SENSITIVE_DATA.creditCard}`);
    assert.ok(result.includes(EXPECTED_SANITIZED.creditCard)); //credit card should be masked
    assert.ok(!result.includes(SENSITIVE_DATA.creditCard)); //original card number should not appear
});

test('sanitizeMessage masks SSN patterns', () => {
    const result = logger.sanitizeMessage(`User SSN: ${SENSITIVE_DATA.ssn}`);
    assert.ok(result.includes(EXPECTED_SANITIZED.ssn)); //SSN should be masked
    assert.ok(!result.includes(SENSITIVE_DATA.ssn)); //original SSN should not appear
});

test('sanitizeMessage masks CVV codes', () => {
    const result = logger.sanitizeMessage(SENSITIVE_DATA.cvv);
    assert.equal(result, EXPECTED_SANITIZED.cvv); //CVV should be properly masked with prefix preserved
});

test('sanitizeMessage masks passwords', () => {
    const result = logger.sanitizeMessage(SENSITIVE_DATA.password);
    assert.equal(result, EXPECTED_SANITIZED.password); //password should be masked with prefix preserved
});

test('sanitizeMessage masks API keys', () => {
    const result = logger.sanitizeMessage(SENSITIVE_DATA.apiKey);
    assert.equal(result, EXPECTED_SANITIZED.apiKey); //API key should be masked with prefix preserved
});

test('sanitizeMessage masks authentication tokens', () => {
    const result = logger.sanitizeMessage(SENSITIVE_DATA.token);
    assert.equal(result, EXPECTED_SANITIZED.token); //token should be masked with prefix preserved
});

test('sanitizeMessage masks email addresses', () => {
    const result = logger.sanitizeMessage(`Contact: ${SENSITIVE_DATA.email}`);
    assert.ok(result.includes(EXPECTED_SANITIZED.email)); //email should be masked
    assert.ok(!result.includes(SENSITIVE_DATA.email)); //original email should not appear
});

test('sanitizeMessage masks phone numbers', () => {
    const result = logger.sanitizeMessage(`Phone: ${SENSITIVE_DATA.phone}`);
    assert.ok(result.includes(EXPECTED_SANITIZED.phone)); //phone should be masked
    assert.ok(!result.includes(SENSITIVE_DATA.phone)); //original phone should not appear
});

test('sanitizeMessage handles non-string input', () => {
    const objectInput = { message: 'test', card: SENSITIVE_DATA.creditCard };
    const result = logger.sanitizeMessage(objectInput);
    assert.ok(typeof result === 'string'); //should convert to string
    assert.ok(result.includes(EXPECTED_SANITIZED.creditCard)); //should sanitize after conversion
});

// Test sanitizeContext function with nested objects and arrays
test('sanitizeContext handles simple objects', () => {
    const context = {
        user: 'john',
        cardNumber: SENSITIVE_DATA.creditCard,
        amount: 100
    };
    const result = logger.sanitizeContext(context);
    assert.equal(result.user, 'john'); //non-sensitive data preserved
    assert.equal(result.amount, 100); //numeric data preserved
    assert.equal(result.cardNumber, '[REDACTED]'); //sensitive key completely masked for security
});

test('sanitizeContext masks sensitive keys', () => {
    const context = {
        password: 'secretvalue',
        apiKey: 'keyvalue',
        token: 'tokenvalue',
        normalField: 'normalvalue'
    };
    const result = logger.sanitizeContext(context);
    assert.equal(result.password, '[REDACTED]'); //sensitive key masked
    assert.equal(result.apiKey, '[REDACTED]'); //sensitive key masked
    assert.equal(result.token, '[REDACTED]'); //sensitive key masked
    assert.equal(result.normalField, 'normalvalue'); //normal field preserved
});

test('sanitizeContext handles nested objects recursively', () => {
    const context = {
        user: {
            name: 'john',
            credentials: {
                password: 'secret123',
                apiKey: 'key123'
            }
        },
        payment: {
            cardInfo: SENSITIVE_DATA.creditCard,
            amount: 100
        }
    };
    const result = logger.sanitizeContext(context);
    assert.equal(result.user.name, 'john'); //normal nested field preserved
    assert.equal(result.user.credentials.password, '[REDACTED]'); //nested sensitive key masked
    assert.equal(result.user.credentials.apiKey, '[REDACTED]'); //nested sensitive key masked
    assert.equal(result.payment.amount, 100); //normal nested field preserved
    assert.ok(result.payment.cardInfo.includes('[CARD-REDACTED]')); //nested sensitive data sanitized in string
});

test('sanitizeContext handles arrays', () => {
    const context = {
        users: [
            { name: 'john', password: 'secret1' },
            { name: 'jane', password: 'secret2' }
        ],
        paymentInfo: [SENSITIVE_DATA.creditCard, '5555-4444-3333-2222']
    };
    const result = logger.sanitizeContext(context);
    assert.equal(result.users[0].name, 'john'); //array item field preserved
    assert.equal(result.users[0].password, '[REDACTED]'); //array item sensitive key masked
    assert.equal(result.users[1].name, 'jane'); //array item field preserved
    assert.equal(result.users[1].password, '[REDACTED]'); //array item sensitive key masked
    assert.ok(result.paymentInfo[0].includes('[CARD-REDACTED]')); //array sensitive data masked
    assert.ok(result.paymentInfo[1].includes('[CARD-REDACTED]')); //array sensitive data masked
});

test('sanitizeContext handles null and undefined values', () => {
    const context = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zero: 0
    };
    const result = logger.sanitizeContext(context);
    assert.equal(result.nullValue, null); //null preserved
    assert.equal(result.undefinedValue, undefined); //undefined preserved
    assert.equal(result.emptyString, ''); //empty string preserved
    assert.equal(result.zero, 0); //zero preserved
});

// Test createEnhancedLogEntry function
test('createEnhancedLogEntry generates complete log structure', () => {
    const entry = logger.createEnhancedLogEntry('INFO', 'Test message', { user: 'john' }, 'req-123');
    
    assert.equal(entry.level, 'INFO'); //correct log level
    assert.equal(entry.message, 'Test message'); //message preserved
    assert.equal(entry.requestId, 'req-123'); //request ID included
    assert.equal(entry.context.user, 'john'); //context included
    assert.ok(entry.timestamp); //timestamp generated
    assert.ok(entry.service); //service name included
    assert.ok(entry.environment); //environment included
    assert.equal(typeof entry.pid, 'number'); //process ID included
    assert.ok(entry.hostname); //hostname included
});

test('createEnhancedLogEntry includes memory usage for high severity levels', () => {
    const warnEntry = logger.createEnhancedLogEntry('WARN', 'Warning message');
    const errorEntry = logger.createEnhancedLogEntry('ERROR', 'Error message');
    const infoEntry = logger.createEnhancedLogEntry('INFO', 'Info message');
    
    assert.ok(warnEntry.memory); //memory included for WARN level
    assert.ok(errorEntry.memory); //memory included for ERROR level
    assert.ok(!infoEntry.memory); //memory not included for INFO level
    
    assert.equal(typeof warnEntry.memory.heapUsed, 'number'); //heap usage is numeric
    assert.equal(typeof warnEntry.memory.heapTotal, 'number'); //heap total is numeric
    assert.equal(typeof warnEntry.memory.external, 'number'); //external memory is numeric
    assert.equal(typeof warnEntry.memory.rss, 'number'); //RSS is numeric
});

test('createEnhancedLogEntry sanitizes message and context', () => {
    const entry = logger.createEnhancedLogEntry('INFO', 
        `Payment for card ${SENSITIVE_DATA.creditCard}`, 
        { password: 'secret123', user: 'john' }
    );
    
    assert.ok(entry.message.includes('[CARD-REDACTED]')); //message sanitized
    assert.ok(!entry.message.includes(SENSITIVE_DATA.creditCard)); //original card not in message
    assert.equal(entry.context.password, '[REDACTED]'); //context sanitized
    assert.equal(entry.context.user, 'john'); //non-sensitive context preserved
});

// Test enhanced logging functions - simplified tests that work with existing logger structure
test('logInfo function exists and can be called', async () => {
    // Test that the function exists and doesn't throw when called
    assert.ok(typeof logger.logInfo === 'function'); //logInfo function exists
    
    // Test that calling it doesn't throw an error
    try {
        await logger.logInfo('Test message', { user: 'john' }, 'req-123');
        assert.ok(true); //function call completed without throwing
    } catch (error) {
        assert.fail(`logInfo should not throw: ${error.message}`);
    }
});

test('logError function exists and can be called', async () => {
    // Test that the function exists and doesn't throw when called
    assert.ok(typeof logger.logError === 'function'); //logError function exists
    
    try {
        await logger.logError('Error message', { operation: 'test' });
        assert.ok(true); //function call completed without throwing
    } catch (error) {
        assert.fail(`logError should not throw: ${error.message}`);
    }
});

// Test performance timer functionality with simplified validation
test('createPerformanceTimer returns a function', () => {
    const timer = logger.createPerformanceTimer('testOperation', 'req-123');
    assert.ok(typeof timer === 'function'); //timer should be a function
});

test('createPerformanceTimer function can be executed', async () => {
    const timer = logger.createPerformanceTimer('testOperation');
    
    try {
        const result = await timer(true, { custom: 'data' });
        assert.ok(result); //timer should return a result
        assert.ok(typeof result.duration_ms === 'number'); //duration should be numeric
        assert.equal(result.success, true); //success status should be preserved
        assert.equal(result.custom, 'data'); //additional context should be preserved
    } catch (error) {
        assert.fail(`Performance timer should not throw: ${error.message}`);
    }
});

test('createPerformanceTimer handles failure scenarios', async () => {
    const timer = logger.createPerformanceTimer('failedOperation');
    
    try {
        const result = await timer(false, { error: 'operation failed' });
        assert.ok(result); //timer should return a result even on failure
        assert.equal(result.success, false); //failure status should be preserved
        assert.equal(result.error, 'operation failed'); //error context should be preserved
    } catch (error) {
        assert.fail(`Performance timer should handle failures gracefully: ${error.message}`);
    }
});

// Test LOG_LEVELS constants
test('LOG_LEVELS contains all expected levels with priorities', () => {
    const levels = logger.LOG_LEVELS;
    
    assert.ok(levels.DEBUG); //DEBUG level exists
    assert.ok(levels.INFO); //INFO level exists
    assert.ok(levels.WARN); //WARN level exists
    assert.ok(levels.ERROR); //ERROR level exists
    assert.ok(levels.FATAL); //FATAL level exists
    assert.ok(levels.AUDIT); //AUDIT level exists
    
    assert.ok(levels.DEBUG.priority < levels.INFO.priority); //DEBUG < INFO priority
    assert.ok(levels.INFO.priority < levels.WARN.priority); //INFO < WARN priority
    assert.ok(levels.WARN.priority < levels.ERROR.priority); //WARN < ERROR priority
    assert.ok(levels.ERROR.priority < levels.FATAL.priority); //ERROR < FATAL priority
    assert.ok(levels.FATAL.priority < levels.AUDIT.priority); //FATAL < AUDIT priority
    
    assert.ok(levels.DEBUG.color); //DEBUG has color
    assert.ok(levels.DEBUG.name); //DEBUG has name
});