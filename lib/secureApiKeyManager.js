/**
 * Secure API Key Management
 * 
 * Purpose: Provides secure storage, encryption, and rotation support for API keys
 * used by qerrors AI model integrations. This module ensures that sensitive
 * API keys are never stored in plaintext and support automatic rotation.
 * 
 * Design Rationale:
 * - Security: Encrypt API keys at rest with strong encryption
 * - Rotation: Support automatic and manual key rotation
 * - Compatibility: Work with existing environment variable system
 * - Audit: Track key usage and rotation history
 * - Graceful: Fallback to plaintext if encryption not available
 * 
 * Security Features:
 * - AES-256-GCM encryption for key storage
 * - Key rotation with version tracking
 * - Secure key derivation from environment variables
 * - Audit logging for key operations
 * - Memory protection for key handling
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { verboseLog } = require('./utils');

// Constants for encryption
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

// Key storage file location
const KEY_STORE_PATH = path.join(process.cwd(), '.qkeys');

/**
 * Derive encryption key from environment-specific salt
 * @param {string} salt - Salt for key derivation
 * @returns {Buffer} Derived encryption key
 */
let generatedKey = null;

/**
 * Generate or load secure encryption key
 * @returns {string} Secure encryption passphrase
 */
function getSecurePassphrase() {
  // SECURITY: Check for dangerous default keys
  if (process.env.QERRORS_ENCRYPTION_KEY) {
    const key = process.env.QERRORS_ENCRYPTION_KEY;
    
    // Block known insecure default keys
    const insecureDefaults = [
      'qerrors-default-key',
      'qerrors-secure-key-2024',
      'default-key',
      'password',
      'secret',
      'admin',
      '12345678',
      'qwerty123'
    ];
    
    if (insecureDefaults.includes(key.toLowerCase())) {
      throw new Error(`SECURITY ERROR: Detected insecure default encryption key "${key}". Please set a unique, secure QERRORS_ENCRYPTION_KEY environment variable.`);
    }
    
    if (key.length < 16) {
      throw new Error('QERRORS_ENCRYPTION_KEY must be at least 16 characters long for secure key encryption');
    }
    
    return key;
  }
  
  // Generate a secure random key if not provided and not already generated
  if (!generatedKey) {
    // Generate a cryptographically secure random key
    generatedKey = crypto.randomBytes(32).toString('hex');
    
    console.warn('SECURITY WARNING: Using auto-generated encryption key. This key will be lost on restart.');
    console.warn('Set QERRORS_ENCRYPTION_KEY environment variable for persistence.');
    console.warn('Generated key fingerprint (for verification):', crypto.createHash('sha256').update(generatedKey).digest('hex').substring(0, 16));
  }
  
  return generatedKey;
}

/**
 * Derive encryption key from passphrase using PBKDF2
 * @param {Buffer} salt - Salt for key derivation
 * @returns {Buffer} Derived encryption key
 */
function deriveEncryptionKey(salt) {
  const passphrase = getSecurePassphrase();
  
  // Use higher iteration count for better security
  return crypto.pbkdf2Sync(passphrase, salt, 200000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt API key
 * @param {string} apiKey - Plain text API key
 * @param {string} keyId - Unique identifier for the key
 * @returns {Object} Encrypted key data
 */
function encryptApiKey(apiKey, keyId = null) {
  try {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key for encryption');
    }
    
    // Generate unique salt and IV for each encryption
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Derive encryption key
    const key = deriveEncryptionKey(salt);
    
    // Create cipher with proper IV and authentication
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(keyId || 'default'));
    
    // Encrypt the key
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const tag = cipher.getAuthTag();
    
    const encryptedData = {
      keyId: keyId || 'default',
      version: Date.now().toString(),
      encrypted: encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: ALGORITHM,
      created: new Date().toISOString()
    };
    
    verboseLog(`API key encrypted successfully for keyId: ${keyId || 'default'}`);
    return encryptedData;
    
  } catch (error) {
    verboseLog(`API key encryption failed: ${error.message}`);
    throw new Error(`Failed to encrypt API key: ${error.message}`);
  }
}

/**
 * Decrypt API key
 * @param {Object} encryptedData - Encrypted key data
 * @returns {string} Plain text API key
 */
function decryptApiKey(encryptedData) {
  try {
    if (!encryptedData || typeof encryptedData !== 'object') {
      throw new Error('Invalid encrypted data format');
    }
    
    // Convert hex strings back to buffers
    const salt = Buffer.from(encryptedData.salt, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    
    // Derive encryption key
    const key = deriveEncryptionKey(salt);
    
    // Create decipher with proper IV and authentication
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(encryptedData.keyId || 'default'));
    decipher.setAuthTag(tag);
    
    // Decrypt the key
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    verboseLog(`API key decrypted successfully for keyId: ${encryptedData.keyId || 'default'}`);
    return decrypted;
    
  } catch (error) {
    verboseLog(`API key decryption failed: ${error.message}`);
    throw new Error(`Failed to decrypt API key: ${error.message}`);
  }
}

/**
 * Load encrypted key store from disk
 * @returns {Object} Key store data
 */
function loadKeyStore() {
  try {
    if (fs.existsSync(KEY_STORE_PATH)) {
      const data = fs.readFileSync(KEY_STORE_PATH, 'utf8');
      return JSON.parse(data);
    }
    return { keys: {}, metadata: { version: '1.0', created: new Date().toISOString() } };
  } catch (error) {
    verboseLog(`Failed to load key store: ${error.message}`);
    return { keys: {}, metadata: { version: '1.0', created: new Date().toISOString() } };
  }
}

/**
 * Save encrypted key store to disk
 * @param {Object} keyStore - Key store data to save
 */
function saveKeyStore(keyStore) {
  try {
    // Ensure directory exists
    const dir = path.dirname(KEY_STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { mode: 0o700 }); // Restrictive permissions
    }
    
    // Write with restrictive permissions
    fs.writeFileSync(KEY_STORE_PATH, JSON.stringify(keyStore, null, 2), { mode: 0o600 });
    verboseLog('Key store saved successfully');
  } catch (error) {
    verboseLog(`Failed to save key store: ${error.message}`);
    throw new Error(`Failed to save key store: ${error.message}`);
  }
}

/**
 * Store encrypted API key
 * @param {string} provider - AI provider name (openai, google, etc.)
 * @param {string} apiKey - Plain text API key
 * @param {Object} options - Additional options
 */
function storeApiKey(provider, apiKey, options = {}) {
  try {
    const { rotate = false, expireInDays = 90 } = options;
    const keyId = `${provider}_key`;
    
    // Encrypt the key
    const encryptedData = encryptApiKey(apiKey, keyId);
    
    // Set expiration
    if (expireInDays > 0) {
      const expiration = new Date();
      expiration.setDate(expiration.getDate() + expireInDays);
      encryptedData.expires = expiration.toISOString();
    }
    
    // Load existing key store
    const keyStore = loadKeyStore();
    
    // Handle rotation
    if (rotate && keyStore.keys[keyId]) {
      // Keep old key as backup during rotation
      const backupKeyId = `${keyId}_backup_${Date.now()}`;
      keyStore.keys[backupKeyId] = {
        ...keyStore.keys[keyId],
        rotated: true,
        rotatedAt: new Date().toISOString()
      };
      
      verboseLog(`Previous API key rotated to backup: ${backupKeyId}`);
    }
    
    // Store new key
    keyStore.keys[keyId] = encryptedData;
    keyStore.metadata.lastUpdated = new Date().toISOString();
    
    // Save updated key store
    saveKeyStore(keyStore);
    
    verboseLog(`API key stored successfully for provider: ${provider}`);
    return { success: true, keyId, expires: encryptedData.expires };
    
  } catch (error) {
    verboseLog(`Failed to store API key for ${provider}: ${error.message}`);
    throw error;
  }
}

/**
 * Retrieve and decrypt API key
 * @param {string} provider - AI provider name
 * @param {Object} options - Retrieval options
 * @returns {string|null} Plain text API key or null if not found
 */
function getApiKey(provider, options = {}) {
  try {
    const { checkExpiration = true, fallbackToEnv = true } = options;
    const keyId = `${provider}_key`;
    
    // Load key store
    const keyStore = loadKeyStore();
    const encryptedData = keyStore.keys[keyId];
    
    if (!encryptedData) {
      // Fallback to environment variable if enabled
      if (fallbackToEnv) {
        const envKey = getApiKeyFromEnv(provider);
        if (envKey) {
          verboseLog(`Using environment variable for ${provider} API key`);
          return envKey;
        }
      }
      
      verboseLog(`No API key found for provider: ${provider}`);
      return null;
    }
    
    // Check expiration if enabled
    if (checkExpiration && encryptedData.expires) {
      const expirationTime = new Date(encryptedData.expires).getTime();
      const currentTime = new Date().getTime();
      
      if (currentTime > expirationTime) {
        verboseLog(`API key expired for provider: ${provider}`);
        return null;
      }
    }
    
    // Decrypt and return the key
    return decryptApiKey(encryptedData);
    
  } catch (error) {
    verboseLog(`Failed to retrieve API key for ${provider}: ${error.message}`);
    
    // Fallback to environment variable if enabled
    if (options.fallbackToEnv) {
      const envKey = getApiKeyFromEnv(provider);
      if (envKey) {
        verboseLog(`Fallback to environment variable for ${provider} API key`);
        return envKey;
      }
    }
    
    return null;
  }
}

/**
 * Get API key from environment variables
 * @param {string} provider - AI provider name
 * @returns {string|null} API key from environment
 */
function getApiKeyFromEnv(provider) {
  const envVars = {
    openai: 'OPENAI_API_KEY',
    google: 'GEMINI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    azure: 'AZURE_OPENAI_API_KEY'
  };
  
  const envVar = envVars[provider.toLowerCase()];
  return envVar ? process.env[envVar] : null;
}

/**
 * Rotate API key
 * @param {string} provider - AI provider name
 * @param {string} newApiKey - New API key to rotate to
 * @returns {Object} Rotation result
 */
function rotateApiKey(provider, newApiKey) {
  try {
    if (!newApiKey || typeof newApiKey !== 'string') {
      throw new Error('New API key is required for rotation');
    }
    
    const result = storeApiKey(provider, newApiKey, { rotate: true });
    
    // Clean up old backup keys (keep only last 3)
    cleanupOldBackupKeys(provider, 3);
    
    verboseLog(`API key rotation completed for provider: ${provider}`);
    return { ...result, rotated: true, provider };
    
  } catch (error) {
    verboseLog(`API key rotation failed for ${provider}: ${error.message}`);
    throw error;
  }
}

/**
 * Clean up old backup keys
 * @param {string} provider - AI provider name
 * @param {number} keepCount - Number of backup keys to keep
 */
function cleanupOldBackupKeys(provider, keepCount = 3) {
  try {
    const keyStore = loadKeyStore();
    const keyId = `${provider}_key`;
    const backupKeys = [];
    
    // Find backup keys for this provider
    for (const [storedKeyId, keyData] of Object.entries(keyStore.keys)) {
      if (storedKeyId.startsWith(keyId + '_backup_')) {
        backupKeys.push({ keyId: storedKeyId, timestamp: keyData.rotatedAt || keyData.created });
      }
    }
    
    // Sort by timestamp (oldest first)
    backupKeys.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Remove oldest keys beyond keep count
    if (backupKeys.length > keepCount) {
      const toRemove = backupKeys.slice(0, backupKeys.length - keepCount);
      
      for (const { keyId } of toRemove) {
        delete keyStore.keys[keyId];
        verboseLog(`Removed old backup key: ${keyId}`);
      }
      
      saveKeyStore(keyStore);
    }
    
  } catch (error) {
    verboseLog(`Failed to cleanup old backup keys: ${error.message}`);
  }
}

/**
 * Get key metadata
 * @param {string} provider - AI provider name
 * @returns {Object|null} Key metadata
 */
function getKeyMetadata(provider) {
  try {
    const keyStore = loadKeyStore();
    const keyId = `${provider}_key`;
    const keyData = keyStore.keys[keyId];
    
    if (!keyData) {
      return null;
    }
    
    return {
      keyId,
      provider,
      version: keyData.version,
      created: keyData.created,
      expires: keyData.expires,
      hasExpiration: !!keyData.expires,
      daysUntilExpiration: keyData.expires ? 
        Math.ceil((new Date(keyData.expires).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 
        null
    };
    
  } catch (error) {
    verboseLog(`Failed to get key metadata for ${provider}: ${error.message}`);
    return null;
  }
}

/**
 * Check if encryption is available
 * @returns {boolean} Whether encryption is properly configured
 */
function isEncryptionAvailable() {
  try {
    return !!(process.env.QERRORS_ENCRYPTION_KEY && process.env.QERRORS_ENCRYPTION_KEY.length >= 16);
  } catch {
    return false;
  }
}

module.exports = {
  encryptApiKey,
  decryptApiKey,
  storeApiKey,
  getApiKey,
  rotateApiKey,
  getKeyMetadata,
  isEncryptionAvailable,
  getApiKeyFromEnv,
  loadKeyStore,
  saveKeyStore
};