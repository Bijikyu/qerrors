/**
 * Test script for OpenAI functionality in qerrors
 * 
 * This script creates various types of errors to test the AI-powered
 * error analysis feature and verify it provides helpful debugging suggestions.
 */

const { qerrors, logError } = require('./index.js');

async function testOpenAIFunctionality() {
    console.log('=== Testing qerrors OpenAI Functionality ===\n');
    
    // Test 1: Database connection error simulation
    console.log('1. Testing database connection error...');
    try {
        throw new Error('ECONNREFUSED: Connection refused to database server at localhost:5432');
    } catch (error) {
        error.stack = `Error: ECONNREFUSED: Connection refused to database server at localhost:5432
    at Database.connect (/app/database.js:45:12)
    at UserService.findUser (/app/services/user.js:23:8)
    at AuthController.login (/app/controllers/auth.js:15:5)`;
        
        console.log('Calling qerrors with database error...');
        await qerrors(error, 'Database connection test', { 
            operation: 'database_connect',
            host: 'localhost',
            port: 5432,
            database: 'myapp_db'
        });
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for async processing
    
    // Test 2: Type error simulation
    console.log('\n2. Testing JavaScript type error...');
    try {
        const user = null;
        user.name.toUpperCase(); // This will throw TypeError
    } catch (error) {
        console.log('Calling qerrors with type error...');
        await qerrors(error, 'User profile processing', {
            operation: 'process_user_profile',
            userId: '12345',
            expectedType: 'object',
            actualValue: null
        });
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for async processing
    
    // Test 3: API validation error
    console.log('\n3. Testing API validation error...');
    try {
        const validationError = new Error('Validation failed: email is required, password must be at least 8 characters');
        validationError.name = 'ValidationError';
        validationError.details = {
            email: 'Email field is required',
            password: 'Password must be at least 8 characters long'
        };
        throw validationError;
    } catch (error) {
        console.log('Calling qerrors with validation error...');
        await qerrors(error, 'User registration API', {
            operation: 'user_registration',
            endpoint: '/api/users/register',
            method: 'POST',
            requestData: { email: '', password: '123' }
        });
    }
    
    console.log('\n=== Test Complete ===');
    console.log('Check the logs directory for detailed AI analysis results.');
    console.log('The AI should provide debugging suggestions for each error type.');
}

// Run the test
if (require.main === module) {
    testOpenAIFunctionality().catch(console.error);
}

module.exports = { testOpenAIFunctionality };