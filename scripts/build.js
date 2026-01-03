#!/usr/bin/env node

/**
 * Production build script for qerrors
 * Performs comprehensive validation, linting, and compilation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting qerrors production build...\n');

// ANSI color codes for better output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function logStep(step, color = colors.blue) {
  console.log(`${color}► ${step}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

function runCommand(command, description, required = true) {
  logStep(description);
  try {
    execSync(command, { stdio: 'inherit' });
    logSuccess(`${description} completed`);
    return true;
  } catch (error) {
    if (required) {
      logError(`${description} failed`);
      throw error;
    } else {
      logWarning(`${description} failed (optional)`);
      return false;
    }
  }
}

// Build steps
const buildSteps = [
  {
    command: 'npm run clean',
    description: 'Cleaning dist directory',
    required: true
  },
    {
    command: 'npm run lint',
    description: 'Running ESLint',
    required: false
  },
  {
    command: 'npm run test:ts',
    description: 'Running type checking and tests',
    required: true
  },
  {
    command: 'npm run build',
    description: 'Compiling TypeScript',
    required: true
  }
];

// Optional validation steps
const validationSteps = [
  {
    command: 'madge --circular lib/',
    description: 'Checking for circular dependencies',
    required: false
  },
  {
    command: 'node -e "require(\'./dist/index.js\')"',
    description: 'Validating compiled modules',
    required: false
  }
];

// Run build steps
for (const step of buildSteps) {
  runCommand(step.command, step.description, step.required);
  console.log();
}

// Run validation steps
for (const step of validationSteps) {
  runCommand(step.command, step.description, step.required);
  console.log();
}

// Check if dist directory was created and contains files
logStep('Validating build output');
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  const distFiles = fs.readdirSync(distPath);
  if (distFiles.length > 0) {
    logSuccess(`Build output contains ${distFiles.length} files`);
  } else {
    logError('Build output is empty');
    process.exit(1);
  }
} else {
  logError('Dist directory was not created');
  process.exit(1);
}

// Check package.json main entry
logStep('Validating package.json entry points');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (packageJson.main === 'dist/index.js') {
  logSuccess('Package.json main entry point is correct');
} else {
  logError('Package.json main entry point is incorrect');
  process.exit(1);
}

// Create build info
logStep('Creating build information');
const buildInfo = {
  buildTime: new Date().toISOString(),
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
  files: fs.readdirSync(distPath)
};

fs.writeFileSync(
  path.join(distPath, 'build-info.json'),
  JSON.stringify(buildInfo, null, 2)
);
logSuccess('Build information created');

console.log('\n🎉 Build completed successfully!');
console.log(`${colors.green}The qerrors library is ready for production deployment.${colors.reset}`);