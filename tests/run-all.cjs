const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const testsDir = __dirname;

const requiresFramework = [
  'comprehensive-integration.test.js',
  'error-handling-integration.test.js',
  'express-integration.test.js',
  'qerrors.test.js'
];

const allTestFiles = fs.readdirSync(testsDir)
  .filter(f => f.endsWith('.test.cjs') || f.endsWith('.test.js'))
  .sort();

const standaloneTests = allTestFiles.filter(f => !requiresFramework.includes(f));
const frameworkTests = allTestFiles.filter(f => requiresFramework.includes(f));

console.log('='.repeat(60));
console.log('Running standalone tests...');
console.log('='.repeat(60));
console.log(`\nStandalone tests: ${standaloneTests.length}`);
standaloneTests.forEach(f => console.log(`  - ${f}`));

if (frameworkTests.length > 0) {
  console.log(`\nSkipping ${frameworkTests.length} framework-dependent tests:`);
  frameworkTests.forEach(f => console.log(`  - ${f} (requires mocha/jest)`));
}
console.log('');

let passed = 0;
let failed = 0;
const results = [];

for (const testFile of standaloneTests) {
  const filePath = path.join(testsDir, testFile);
  console.log('-'.repeat(60));
  console.log(`Running: ${testFile}`);
  console.log('-'.repeat(60));
  
  try {
    execSync(`node "${filePath}"`, { 
      stdio: 'inherit',
      cwd: path.dirname(testsDir),
      timeout: 30000
    });
    passed++;
    results.push({ file: testFile, status: 'PASSED' });
    console.log(`\n✓ ${testFile} PASSED\n`);
  } catch (err) {
    failed++;
    results.push({ file: testFile, status: 'FAILED', error: err.message });
    console.log(`\n✗ ${testFile} FAILED\n`);
  }
}

console.log('='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));
console.log(`Standalone: ${standaloneTests.length}`);
console.log(`Passed:     ${passed}`);
console.log(`Failed:     ${failed}`);
console.log(`Skipped:    ${frameworkTests.length} (need mocha/jest)`);
console.log('');

results.forEach(r => {
  const icon = r.status === 'PASSED' ? '✓' : '✗';
  console.log(`  ${icon} ${r.file}: ${r.status}`);
});

console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}

console.log('\n🎉 All standalone tests passed!\n');
