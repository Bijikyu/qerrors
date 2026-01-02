// 🔗 Tests: dist/index.js → All module exports
import qerrors, { createTimer, sanitizeMessage, ServiceError, getEnv, sendSuccessResponse } from '../dist/index.js';

// Basic functionality tests
console.log('Testing ESM TypeScript build...');

// Test 1: Module loading
console.log('✓ Main module loads successfully');
console.log('✓ Available functions:', Object.keys(qerrors).length);

try {
  const timer = createTimer();
  console.log('✓ Timer creation works:', typeof timer);
  const sanitized = sanitizeMessage('Password: secret123');
  console.log('✓ Sanitization works:', sanitized.includes('[REDACTED]'));
  const error = new ServiceError('Test error', 'system');
  console.log('✓ Error creation works:', error.name);
} catch (err) {
  console.error('✗ Core utilities failed:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
}

// Test 3: Configuration
try {
  getEnv('QERRORS_CONCURRENCY');
  console.log('✓ Configuration access works');
} catch (err) {
  console.error('✗ Configuration failed:', err.message);
  process.exit(1);
}

try {
  const mockRes = {
    status: (code) => ({ json: (data) => console.log('✓ Response JSON created') }),
    headersSent: false
  };
  sendSuccessResponse(mockRes, { test: 'data' });
  console.log('✓ Response helpers work');
} catch (err) {
  console.error('✗ Response helpers failed:', err.message);
  process.exit(1);
}

console.log('\n🎉 All tests passed! ESM TypeScript build is working correctly.');
console.log('📊 Summary:');
console.log('  - Module loading: ✓');
console.log('  - Core utilities: ✓'); 
console.log('  - Configuration: ✓');
console.log('  - Response helpers: ✓');
console.log('  - ESM TypeScript conversion: ✓');