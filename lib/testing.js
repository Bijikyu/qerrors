/**
 * Jest-compatible testing mocks for qerrors
 * 
 * Design rationale: Provides CommonJS-friendly mocks that avoid ESM parse issues
 * in Jest test runners. Use these mocks when testing applications that depend on
 * qerrors to isolate test behavior from the full error handling implementation.
 * 
 * Usage in Jest:
 *   jest.mock('qerrors', () => require('qerrors/lib/testing'));
 * 
 * @module qerrors/testing
 */

/**
 * Mock qerrors function that returns undefined
 * 
 * @returns {undefined} Always returns undefined for predictable test behavior
 */
function qerrors() { //no-op mock for tests
    return undefined;
}

/**
 * Mock controller error handler for Express route testing
 * 
 * @param {Object} res - Express response object
 * @param {Error} error - The error to handle
 * @param {string} [context='test'] - Context identifier for the error
 * @param {Object} [meta={}] - Additional metadata
 * @returns {Object|undefined} JSON response or undefined if res is invalid
 */
function handleControllerError(res, error, context = 'test', meta = {}) { //simplified mock for controller error testing
    const status = (error && (error.status || error.statusCode)) || 400; //extract status from error
    const message = (error && (error.message || String(error))) || 'Error'; //extract message from error
    if (res && typeof res.status === 'function' && typeof res.json === 'function') {
        return res.status(status).json({ error: message, context, meta }); //send mock response
    }
    return undefined;
}

/**
 * Mock ErrorFactory for creating test errors
 * 
 * Provides simplified factory methods for common error types used in tests.
 */
const MockErrorFactory = {
    /**
     * Creates validation error for testing
     * 
     * @param {string} [message='Validation error'] - Error message
     * @param {string} [field='field'] - Field that failed validation
     * @returns {Error} Validation error with status 400
     */
    validation(message = 'Validation error', field = 'field') { //create mock validation error
        const err = new Error(message);
        err.name = 'ValidationError';
        err.status = 400;
        err.field = field;
        return err;
    },

    /**
     * Creates not found error for testing
     * 
     * @param {string} [entity='Resource'] - Entity that was not found
     * @returns {Error} Not found error with status 404
     */
    notFound(entity = 'Resource') { //create mock not found error
        const err = new Error(`${entity} not found`);
        err.name = 'NotFoundError';
        err.status = 404;
        return err;
    },

    /**
     * Creates authentication error for testing
     * 
     * @param {string} [message='Authentication required'] - Error message
     * @returns {Error} Authentication error with status 401
     */
    authentication(message = 'Authentication required') { //create mock auth error
        const err = new Error(message);
        err.name = 'AuthenticationError';
        err.status = 401;
        return err;
    },

    /**
     * Creates authorization error for testing
     * 
     * @param {string} [message='Access denied'] - Error message
     * @returns {Error} Authorization error with status 403
     */
    authorization(message = 'Access denied') { //create mock authorization error
        const err = new Error(message);
        err.name = 'AuthorizationError';
        err.status = 403;
        return err;
    },

    /**
     * Converts unknown value to Error for testing
     * 
     * @param {unknown} error - Any error value
     * @param {Object} [_meta={}] - Metadata (ignored in mock)
     * @returns {Error} Normalized error
     */
    from(error, _meta = {}) { //normalize unknown to Error
        if (error instanceof Error) return error;
        const err = new Error(String(error));
        err.status = 500;
        return err;
    }
};

/**
 * Mock Express error middleware for testing error handling flows
 * 
 * @param {Error} err - Error from Express middleware chain
 * @param {Object} _req - Express request (unused)
 * @param {Object} res - Express response object
 * @param {Function} _next - Express next function (unused)
 * @returns {Object} JSON error response
 */
function mockErrorMiddleware(err, _req, res, _next) { //simplified error middleware for testing
    const status = (err && (err.status || err.statusCode)) || 500;
    const message = (err && (err.message || String(err))) || 'Error';
    return res.status(status).json({ error: message });
}

/**
 * Creates a mock response object for testing
 * 
 * @returns {Object} Mock Express response with status, json, and send methods
 */
function createMockResponse() { //factory for mock Express response
    const res = {
        statusCode: 200,
        body: null,
        status(code) { //chainable status setter
            res.statusCode = code;
            return res;
        },
        json(data) { //json response handler
            res.body = data;
            return res;
        },
        send(data) { //send response handler
            res.body = data;
            return res;
        }
    };
    return res;
}

/**
 * Creates a mock request object for testing
 * 
 * @param {Object} [overrides={}] - Properties to override
 * @returns {Object} Mock Express request
 */
function createMockRequest(overrides = {}) { //factory for mock Express request
    return {
        method: 'GET',
        url: '/test',
        headers: {},
        body: {},
        params: {},
        query: {},
        ip: '127.0.0.1',
        ...overrides
    };
}

module.exports = {
    __esModule: true, //ESM compatibility flag
    default: qerrors,
    qerrors,
    handleControllerError,
    ErrorFactory: MockErrorFactory, //export as ErrorFactory for drop-in replacement
    MockErrorFactory, //also export with explicit Mock prefix
    errorMiddleware: mockErrorMiddleware,
    mockErrorMiddleware,
    createMockResponse, //test utility
    createMockRequest //test utility
};
