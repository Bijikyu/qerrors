#!/usr/bin/env node

/**
 * Production deployment script for qerrors
 * Handles environment validation, service checks, and deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🚀 Starting qerrors production deployment...\n');

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

function validateEnvironment() {
  logStep('Validating production environment');
  
  const requiredEnvVars = ['NODE_ENV'];
  const optionalEnvVars = ['OPENAI_API_KEY', 'LOG_LEVEL', 'PORT'];
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    logError(`Missing required environment variables: ${missing.join(', ')}`);
    return false;
  }
  
  if (process.env.NODE_ENV !== 'production') {
    logWarning('NODE_ENV is not set to production');
  }
  
  const missingOptional = optionalEnvVars.filter(envVar => !process.env[envVar]);
  if (missingOptional.length > 0) {
    logWarning(`Optional environment variables not set: ${missingOptional.join(', ')}`);
  }
  
  logSuccess('Environment validation completed');
  return true;
}

function checkDependencies() {
  logStep('Checking production dependencies');
  
  try {
    // Check if node_modules exists and has the required packages
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredPackages = ['axios', 'winston', 'lodash', 'express'];
    
    for (const pkg of requiredPackages) {
      try {
        require.resolve(pkg);
      } catch (error) {
        logError(`Required dependency not found: ${pkg}`);
        return false;
      }
    }
    
    logSuccess('All production dependencies are available');
    return true;
  } catch (error) {
    logError(`Dependency check failed: ${error.message}`);
    return false;
  }
}

function performHealthCheck() {
  logStep('Performing application health check');
  
  try {
    // Try to require the main module
    const qerrors = require('./dist/index.js');
    
    // Check if main functions exist
    const requiredFunctions = ['middleware', 'generateErrorId', 'cleanup'];
    for (const func of requiredFunctions) {
      if (!qerrors[func] || typeof qerrors[func] !== 'function') {
        logError(`Required function not found: ${func}`);
        return false;
      }
    }
    
    logSuccess('Application health check passed');
    return true;
  } catch (error) {
    logError(`Health check failed: ${error.message}`);
    return false;
  }
}

function setupMonitoring() {
  logStep('Setting up monitoring and logging');
  
  try {
    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Create deployment log
    const deploymentLog = {
      deploymentTime: new Date().toISOString(),
      version: JSON.parse(fs.readFileSync('package.json', 'utf8')).version,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      deploymentId: crypto.randomUUID()
    };
    
    fs.writeFileSync(
      path.join(logsDir, 'deployment.json'),
      JSON.stringify(deploymentLog, null, 2)
    );
    
    logSuccess('Monitoring setup completed');
    return true;
  } catch (error) {
    logError(`Monitoring setup failed: ${error.message}`);
    return false;
  }
}

function createProductionConfig() {
  logStep('Creating production configuration');
  
  try {
    const config = {
      production: true,
      logLevel: process.env.LOG_LEVEL || 'info',
      maxErrorHistory: 100,
      queue: {
        maxQueueSize: 500,
        maxConcurrency: 5
      },
      cache: {
        maxSize: 200,
        ttl: 600000 // 10 minutes
      },
      monitoring: {
        metricsInterval: 60000,
        healthCheckInterval: 300000
      }
    };
    
    const configDir = path.join(process.cwd(), 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(configDir, 'production.json'),
      JSON.stringify(config, null, 2)
    );
    
    logSuccess('Production configuration created');
    return true;
  } catch (error) {
    logError(`Configuration creation failed: ${error.message}`);
    return false;
  }
}

// Deployment steps
const deploymentSteps = [
  validateEnvironment,
  checkDependencies,
  performHealthCheck,
  setupMonitoring,
  createProductionConfig
];

console.log(`${colors.blue}Running deployment validation steps...${colors.reset}\n`);

let allStepsPassed = true;
for (const step of deploymentSteps) {
  if (!step()) {
    allStepsPassed = false;
  }
  console.log();
}

if (allStepsPassed) {
  console.log(`${colors.green}🎉 Deployment validation completed successfully!${colors.reset}`);
  console.log(`${colors.green}qerrors is ready for production.${colors.reset}`);
  
  // Provide next steps
  console.log('\nNext steps:');
  console.log(`${colors.blue}• Start the application: npm start${colors.reset}`);
  console.log(`${colors.blue}• Monitor logs: tail -f logs/app.log${colors.reset}`);
  console.log(`${colors.blue}• Check health: GET /health${colors.reset}`);
} else {
  console.log(`${colors.red}❌ Deployment validation failed!${colors.reset}`);
  console.log(`${colors.red}Please fix the issues above before deploying.${colors.reset}`);
  process.exit(1);
}