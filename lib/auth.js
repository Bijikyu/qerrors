const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const qerrors = require('./qerrors');

/**
 * Secure Authentication Module
 * Implements password hashing, JWT token management, and account security
 */

class SecureAuth {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || this.generateSecureSecret();
    this.tokenExpiry = process.env.JWT_EXPIRY || '24h';
    this.saltRounds = 12;
  }

  /**
   * Generate a secure random secret if not provided
   */
  generateSecureSecret() {
    console.warn('WARNING: Using auto-generated JWT secret. Set JWT_SECRET environment variable for production.');
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Hash a password securely with timeout protection
   */
  async hashPassword(password) {
    try {
      // Add timeout protection to prevent blocking
      const hashPromise = bcrypt.hash(password, this.saltRounds);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Password hashing timeout')), 5000);
      });
      
      return await Promise.race([hashPromise, timeoutPromise]);
    } catch (error) {
      qerrors(error, 'auth.hashPassword', { 
        operation: 'password_hashing',
        saltRounds: this.saltRounds,
        hasTimeout: error.message === 'Password hashing timeout'
      });
      
      if (error.message === 'Password hashing timeout') {
        try {
          // Fallback to faster hashing with lower rounds under load
          return await bcrypt.hash(password, Math.max(4, this.saltRounds - 4));
        } catch (fallbackError) {
          qerrors(fallbackError, 'auth.hashPassword.fallback', {
            operation: 'password_hashing_fallback',
            fallbackRounds: Math.max(4, this.saltRounds - 4)
          });
          throw new Error('Failed to hash password even with fallback');
        }
      }
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      qerrors(error, 'auth.verifyPassword', { 
        operation: 'password_verification',
        hasHash: !!hash
      });
      throw new Error('Failed to verify password');
    }
  }

  /**
   * Generate JWT token
   */
  generateToken(payload) {
    try {
      return jwt.sign(payload, this.jwtSecret, { expiresIn: this.tokenExpiry });
    } catch (error) {
      qerrors(error, 'auth.generateToken', { 
        operation: 'jwt_token_generation',
        tokenExpiry: this.tokenExpiry,
        hasPayload: !!payload
      });
      throw new Error('Failed to generate token');
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      qerrors(error, 'auth.verifyToken', { 
        operation: 'jwt_token_verification',
        hasToken: !!token,
        errorType: error.name
      });
      throw new Error('Invalid token');
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const issues = [];
    if (password.length < minLength) issues.push(`Minimum ${minLength} characters`);
    if (!hasUpperCase) issues.push('At least one uppercase letter');
    if (!hasLowerCase) issues.push('At least one lowercase letter');
    if (!hasNumbers) issues.push('At least one number');
    if (!hasSpecialChar) issues.push('At least one special character');

    return {
      isValid: issues.length === 0,
      issues,
      score: 5 - issues.length
    };
  }

  /**
   * Validate environment configuration
   */
  validateEnvironment() {
    try {
      const required = ['ADMIN_USERNAME', 'ADMIN_PASSWORD'];
      const missing = required.filter(key => !process.env[key]);
      
      if (missing.length > 0) {
        const error = new Error(`Missing required environment variables: ${missing.join(', ')}`);
        qerrors(error, 'auth.validateEnvironment.missing', { 
          operation: 'environment_validation',
          missingVars: missing
        });
        throw error;
      }

      // Check for default/weak credentials
      const username = process.env.ADMIN_USERNAME;
      const password = process.env.ADMIN_PASSWORD;

      const strength = this.validatePasswordStrength(password);
      if (!strength.isValid) {
        const error = new Error(`Admin password is too weak: ${strength.issues.join(', ')}`);
        qerrors(error, 'auth.validateEnvironment.weakPassword', { 
          operation: 'password_strength_validation',
          passwordScore: strength.score,
          issues: strength.issues
        });
        throw error;
      }

      if (username === 'admin' && password.includes('password')) {
        const error = new Error('Default or insecure credentials detected. Please change ADMIN_USERNAME and ADMIN_PASSWORD');
        qerrors(error, 'auth.validateEnvironment.insecure', { 
          operation: 'credential_security_check',
          hasDefaultUsername: username === 'admin',
          hasWeakPassword: password.includes('password')
        });
        throw error;
      }

      return true;
    } catch (error) {
      // Only log if it's not one of our already-logged errors
      if (!error.message.includes('Missing required environment variables') && 
          !error.message.includes('Admin password is too weak') && 
          !error.message.includes('Default or insecure credentials')) {
        qerrors(error, 'auth.validateEnvironment', { 
          operation: 'environment_validation'
        });
      }
      throw error;
    }
  }
}

module.exports = new SecureAuth();