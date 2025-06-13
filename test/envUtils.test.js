

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
               assert.deepEqual(missing, ['TEST_VAR2', 'TEST_VAR3']); //missing vars returned
       } finally {
               restore();
       }
});

// Scenario: return empty array when all variables present
test('getMissingEnvVars returns empty array when all present', () => {
       const restore = withEnvVars({ TEST_VAR1: 'present', TEST_VAR2: 'also_present' });
       try {
               const missing = getMissingEnvVars(['TEST_VAR1', 'TEST_VAR2']);
               assert.deepEqual(missing, []); //no vars missing
       } finally {
               restore();
       }
});

// Scenario: throw error when required variables missing
test('throwIfMissingEnvVars throws when variables missing', () => {
       const restore = withEnvVars({ REQUIRED_VAR: undefined });
       try {
               assert.throws(() => { //throws when required var absent
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
               const result = throwIfMissingEnvVars(['REQUIRED_VAR']); //returns empty array
               assert.deepEqual(result, []); //no errors thrown
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
               const result = warnIfMissingEnvVars(['OPTIONAL_VAR']); //warn about missing
               assert.equal(result, false); //function indicates missing
               assert.equal(warnings.length, 1); //one warning logged
               assert.ok(warnings[0].includes('OPTIONAL_VAR')); //message references var
       } finally {
               restore();
               restoreWarn();
       }
});

// Scenario: return true when all optional variables present
test('warnIfMissingEnvVars returns true when all present', () => {
       const restore = withEnvVars({ OPTIONAL_VAR: 'present' });
       try {
               const result = warnIfMissingEnvVars(['OPTIONAL_VAR']); //nothing missing
               assert.equal(result, true); //no warning needed
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
               warnIfMissingEnvVars(['CUSTOM_VAR'], 'Custom warning message'); //custom warn text
               assert.equal(warnings[0], 'Custom warning message'); //exact message logged
       } finally {
               restore();
               restoreWarn();
       }
});
