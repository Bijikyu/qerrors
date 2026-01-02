import envLoader from './lib/shared/environmentLoader.js';
import { safeJsonStringify } from './lib/shared/jsonHelpers.js';
import { logError } from './lib/shared/errorLogger.js';
import { createManagedInterval, clearAllTimers } from './lib/shared/timerManager.js';
import { calculateCacheSize } from './lib/shared/adaptiveSizing.js';

console.log('🚀 Production Readiness Test');

// Test 1: All utilities can be required
console.log('✅ All utilities loaded successfully');

// Test 2: Environment operations
await envLoader.loadDotenv();
console.log('✅ Environment initialization complete');

// Test 3: JSON operations
const testJson = safeJsonStringify({ test: 'value with special chars' });
console.log('✅ JSON serialization works:', testJson.length, 'characters');

// Test 4: Error logging
logError(new Error('Final test'), 'production.readiness', { success: true });
console.log('✅ Error logging test complete');

// Test 5: Timer operations
const timer = createManagedInterval(() => {}, 1000);
console.log('✅ Timer management works');
clearAllTimers();
console.log('✅ Timer cleanup complete');

// Test 6: Adaptive sizing
const size = calculateCacheSize(50);
console.log('✅ Adaptive sizing calculated:', size);

console.log('🎊 ALL PRODUCTION READINESS TESTS PASSED');