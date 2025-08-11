#!/usr/bin/env node

/**
 * Direct demo showing AI advice in console output
 */

// Enable verbose mode so advice appears in console
process.env.QERRORS_VERBOSE = 'true';

const qerrors = require('./lib/qerrors');

async function showAdviceInConsole() {
  console.log('=== AI Advice Console Demo ===');
  console.log('QERRORS_VERBOSE is enabled, so you will see:');
  console.log('1. Error processing details');
  console.log('2. AI analysis output');  
  console.log('3. Returned advice JSON\n');
  
  const testError = new Error('Cannot connect to PostgreSQL database');
  testError.code = 'ECONNREFUSED';
  testError.port = 5432;
  
  const mockRes = {
    headersSent: false,
    status(code) { console.log(`Status: ${code}`); return this; },
    json(data) { console.log(`Response: ${JSON.stringify(data.error.uniqueErrorName)}`); return this; }
  };
  
  const mockReq = { headers: { 'accept': 'application/json' } };
  
  console.log('--- Starting Error Analysis ---');
  await qerrors(testError, 'userAuthentication', mockReq, mockRes);
  
  // Wait for async AI analysis to complete and log
  console.log('\nWaiting for AI analysis to complete...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('\n=== Look above for AI advice in the verbose logs ===');
  console.log('The advice appears as JSON after the error processing logs.');
}

if (require.main === module) {
  showAdviceInConsole().then(() => {
    console.log('\nDemo complete. AI advice should be visible in the output above.');
    process.exit(0);
  }).catch(console.error);
}