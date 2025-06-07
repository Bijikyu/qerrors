

const test = require('node:test'); //node test runner //(import node test)

const assert = require('assert');
const qtests = require('qtests');
const { getMissingEnvVars, throwIfMissingEnvVars, warnIfMissingEnvVars } = require('../lib/envUtils');

function withEnvVars(vars) {
       const original = {}; //(store original values)
       Object.entries(vars).forEach(([key, value]) => {
               original[key] = process.env[key]; //(save original)
               if (value === undefined) {
                       delete process.env[key]; //(remove var)
               } else {
                       process.env[key] = value; //(set var)
               }
       });
       return () => { //(restore function)
               Object.entries(original).forEach(([key, value]) => {
                       if (value === undefined) {
                               delete process.env[key]; //(remove restored var)
                       } else {
                               process.env[key] = value; //(restore var)
                       }
               });
       };
}

// Scenario: detect missing environment variables
test('getMissingEnvVars identifies missing variables', () => {
       const restore = withEnvVars({ TEST_VAR1: 'present', TEST_VAR2: undefined });
       try {
               const missing = getMissingEnvVars(['TEST_VAR1', 'TEST_VAR2', 'TEST_VAR3']);
               assert.deepEqual(missing, ['TEST_VAR2', 'TEST_VAR3']);
       } finally {
               restore();
       }
});

// Scenario: return empty array when all variables present
test('getMissingEnvVars returns empty array when all present', () => {
       const restore = withEnvVars({ TEST_VAR1: 'present', TEST_VAR2: 'also_present' });
       try {
               const missing = getMissingEnvVars(['TEST_VAR1', 'TEST_VAR2']);
               assert.deepEqual(missing, []);
       } finally {
               restore();
       }
});

// Scenario: throw error when required variables missing
test('throwIfMissingEnvVars throws when variables missing', () => {
       const restore = withEnvVars({ REQUIRED_VAR: undefined });
       try {
               assert.throws(() => {
                       throwIfMissingEnvVars(['REQUIRED_VAR']);
               }, /Missing required environment variables: REQUIRED_VAR/);
       } finally {
               restore();
       }
});

// Scenario: return empty array when all required variables present
test('throwIfMissingEnvVars returns empty array when all present', () => {
       const restore = withEnvVars({ REQUIRED_VAR: 'present' });
       try {
               const result = throwIfMissingEnvVars(['REQUIRED_VAR']);
               assert.deepEqual(result, []);
       } finally {
               restore();
       }
});

// Scenario: warn about missing optional variables
test('warnIfMissingEnvVars returns false when variables missing', () => {
       const restore = withEnvVars({ OPTIONAL_VAR: undefined });
       let warnings = [];
       const restoreWarn = qtests.stubMethod(console, 'warn', (msg) => warnings.push(msg));
       try {
               const result = warnIfMissingEnvVars(['OPTIONAL_VAR']);
               assert.equal(result, false);
               assert.equal(warnings.length, 1);
               assert.ok(warnings[0].includes('OPTIONAL_VAR'));
       } finally {
               restore();
               restoreWarn();
       }
});

// Scenario: return true when all optional variables present
test('warnIfMissingEnvVars returns true when all present', () => {
       const restore = withEnvVars({ OPTIONAL_VAR: 'present' });
       try {
               const result = warnIfMissingEnvVars(['OPTIONAL_VAR']);
               assert.equal(result, true);
       } finally {
               restore();
       }
});

// Scenario: use custom warning message
test('warnIfMissingEnvVars uses custom message', () => {
       const restore = withEnvVars({ CUSTOM_VAR: undefined });
       let warnings = [];
       const restoreWarn = qtests.stubMethod(console, 'warn', (msg) => warnings.push(msg));
       try {
               warnIfMissingEnvVars(['CUSTOM_VAR'], 'Custom warning message');
               assert.equal(warnings[0], 'Custom warning message');
       } finally {
               restore();
               restoreWarn();
       }
});
