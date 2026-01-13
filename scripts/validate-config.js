#!/usr/bin/env node

/**
 * Configuration validation script for qerrors
 * Validates all aspects of the project configuration
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating qerrors configuration...\n');

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
  console.log(`  ${colors.green}✓ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`  ${colors.red}✗ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`  ${colors.yellow}⚠ ${message}${colors.reset}`);
}

let validationErrors = 0;
let validationWarnings = 0;

function validatePackageJson() {
  logStep('Validating package.json');
  
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Required fields
    const requiredFields = ['name', 'version', 'description', 'main', 'keywords', 'author', 'license', 'engines'];
    for (const field of requiredFields) {
      if (!packageJson[field]) {
        logError(`Missing required field: ${field}`);
        validationErrors++;
      } else {
        logSuccess(`Field present: ${field}`);
      }
    }
    
    // Check main entry point
    if (packageJson.main !== 'dist/index.js') {
      logError(`Main entry point should be 'dist/index.js', found: ${packageJson.main}`);
      validationErrors++;
    } else {
      logSuccess('Main entry point is correct');
    }
    
    // Check Node.js version requirement
    if (!packageJson.engines.node || !packageJson.engines.node.includes('18')) {
      logWarning('Should specify Node.js 18+ in engines.node');
      validationWarnings++;
    } else {
      logSuccess('Node.js version requirement is appropriate');
    }
    
    // Check for production dependencies
    const criticalDeps = ['axios', 'winston', 'lodash', 'escape-html'];
    for (const dep of criticalDeps) {
      if (!packageJson.dependencies || !packageJson.dependencies[dep]) {
        logError(`Missing critical dependency: ${dep}`);
        validationErrors++;
      } else {
        logSuccess(`Critical dependency present: ${dep}`);
      }
    }
    
    // Check scripts
    const requiredScripts = ['build', 'test', 'start', 'clean'];
    for (const script of requiredScripts) {
      if (!packageJson.scripts || !packageJson.scripts[script]) {
        logError(`Missing script: ${script}`);
        validationErrors++;
      } else {
        logSuccess(`Script present: ${script}`);
      }
    }
    
  } catch (error) {
    logError(`Failed to parse package.json: ${error.message}`);
    validationErrors++;
  }
}

function validateTsConfig() {
  logStep('Validating tsconfig.json');
  
  try {
    const tsConfigPath = path.join(process.cwd(), 'tsconfig.json');
    const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
    
    // Check compiler options
    const requiredOptions = ['target', 'module', 'moduleResolution', 'outDir', 'rootDir', 'strict'];
    for (const option of requiredOptions) {
      if (!tsConfig.compilerOptions[option]) {
        logError(`Missing compiler option: ${option}`);
        validationErrors++;
      } else {
        logSuccess(`Compiler option present: ${option}`);
      }
    }
    
    // Check output directory
    if (tsConfig.compilerOptions.outDir !== './dist') {
      logWarning(`Output directory should be './dist', found: ${tsConfig.compilerOptions.outDir}`);
      validationWarnings++;
    } else {
      logSuccess('Output directory is correct');
    }
    
    // Check include/exclude patterns
    if (!tsConfig.include || !Array.isArray(tsConfig.include)) {
      logError('Missing or invalid include patterns');
      validationErrors++;
    } else {
      logSuccess('Include patterns are present');
    }
    
  } catch (error) {
    logError(`Failed to parse tsconfig.json: ${error.message}`);
    validationErrors++;
  }
}

function validateProjectStructure() {
  logStep('Validating project structure');
  
  const requiredDirectories = ['lib', 'test', 'scripts'];
  const requiredFiles = ['README.md', 'LICENSE', '.gitignore'];
  
  for (const dir of requiredDirectories) {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      logError(`Missing directory: ${dir}`);
      validationErrors++;
    } else {
      logSuccess(`Directory exists: ${dir}`);
    }
  }
  
  for (const file of requiredFiles) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      logWarning(`Missing recommended file: ${file}`);
      validationWarnings++;
    } else {
      logSuccess(`File exists: ${file}`);
    }
  }
  
  // Check for main entry files
  const entryFiles = ['index.js', 'index.ts'];
  for (const file of entryFiles) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      logError(`Missing entry file: ${file}`);
      validationErrors++;
    } else {
      logSuccess(`Entry file exists: ${file}`);
    }
  }
}

function validateLibFiles() {
  logStep('Validating library files');
  
  const libPath = path.join(process.cwd(), 'lib');
  const criticalFiles = [
    'qerrors.js',
    'logger.js',
    'errorTypes.js',
    'sanitization.js',
    'utils.js',
    'config.js'
  ];
  
  for (const file of criticalFiles) {
    const filePath = path.join(libPath, file);
    if (!fs.existsSync(filePath)) {
      logError(`Missing critical library file: ${file}`);
      validationErrors++;
    } else {
      // Check if file has content
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        logError(`Library file is empty: ${file}`);
        validationErrors++;
      } else {
        logSuccess(`Library file exists and has content: ${file}`);
      }
    }
  }
}

function validateTestFiles() {
  logStep('Validating test files');
  
  const testPath = path.join(process.cwd(), 'test');
  if (fs.existsSync(testPath)) {
    const testFiles = fs.readdirSync(testPath).filter(file => file.endsWith('.test.js'));
    
    if (testFiles.length === 0) {
      logWarning('No test files found');
      validationWarnings++;
    } else {
      logSuccess(`Found ${testFiles.length} test file(s)`);
      for (const testFile of testFiles) {
        logSuccess(`  Test file: ${testFile}`);
      }
    }
  } else {
    logWarning('Test directory does not exist');
    validationWarnings++;
  }
}

// Run all validations
const validations = [
  validatePackageJson,
  validateTsConfig,
  validateProjectStructure,
  validateLibFiles,
  validateTestFiles
];

for (const validation of validations) {
  validation();
  console.log();
}

// Summary
console.log(`${colors.blue}Configuration Validation Summary:${colors.reset}`);
console.log(`  ${colors.green}✓ Passed validations${colors.reset}`);
console.log(`  ${colors.yellow}⚠ Warnings: ${validationWarnings}${colors.reset}`);
console.log(`  ${colors.red}✗ Errors: ${validationErrors}${colors.reset}`);

if (validationErrors > 0) {
  console.log(`\n${colors.red}❌ Configuration validation failed with ${validationErrors} error(s)!${colors.reset}`);
  console.log('Please fix the errors before proceeding with build or deployment.');
  process.exit(1);
} else if (validationWarnings > 0) {
  console.log(`\n${colors.yellow}⚠️ Configuration validation passed with ${validationWarnings} warning(s).${colors.reset}`);
  console.log('Consider addressing the warnings for optimal setup.');
} else {
  console.log(`\n${colors.green}🎉 All configuration validations passed!${colors.reset}`);
}