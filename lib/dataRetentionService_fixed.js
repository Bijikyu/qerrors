/**
 * Data Retention and Cleanup Service
 * Implements automated data retention policies and cleanup procedures
 * for GDPR/CCPA compliance
 */

const cron = require('node-cron');
const crypto = require('crypto');
const qerrors = require('./qerrors');
const { executeQuery, executeTransaction } = require('./connectionPool');

class DataRetentionService {
  constructor() {
    this.isRunning = false;
    this.cleanupJob = null;
    this.retentionDays = parseInt(process.env.DATA_RETENTION_DAYS) || 365;
    this.cleanupSchedule = process.env.CLEANUP_SCHEDULE || '0 2 * * *'; // Daily at 2 AM
    
    // Secure deletion settings
    this.secureDeletionPasses = parseInt(process.env.SECURE_DELETION_PASSES) || 3;
    this.useSecureDeletion = process.env.ENABLE_SECURE_DELETION !== 'false';
  }

 /**
  * Perform secure data deletion with multiple passes (async version)
  */
async secureDelete(data, passes = this.secureDeletionPasses) {
  if (!this.useSecureDeletion) {
    return false; // Skip secure deletion if disabled
  }

  try {
    if (typeof data === 'string') {
      // For strings, create a mutable buffer and overwrite it
      let buffer = Buffer.from(data);
      for (let i = 0; i < passes; i++) {
        const randomData = await new Promise((resolve, reject) => {
          crypto.randomBytes(buffer.length, (err, buf) => {
            if (err) {
              reject(err);
            } else {
              resolve(buf);
            }
          });
        });
        randomData.copy(buffer);
        // Add small delay to prevent blocking
        await new Promise(resolve => setImmediate(resolve));
      }
      return true;
    } else if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      // For objects, overwrite each property
      for (let i = 0; i < passes; i++) {
        const randomData = await new Promise((resolve, reject) => {
          crypto.randomBytes(64, (err, buf) => {
            if (err) {
              reject(err);
            } else {
              resolve(buf.toString('hex'));
            }
          });
        });
        for (const key in data) {
          if (data.hasOwnProperty(key)) {
            data[key] = randomData;
          }
        }
        // Add small delay to prevent blocking
        await new Promise(resolve => setImmediate(resolve));
      }
      return true;
    } else if (Array.isArray(data)) {
      // For arrays, overwrite each element
      for (let i = 0; i < passes; i++) {
        const randomData = await new Promise((resolve, reject) => {
          crypto.randomBytes(32, (err, buf) => {
            if (err) {
              reject(err);
            } else {
              resolve(buf.toString('hex'));
            }
          });
        });
        for (let j = 0; j < data.length; j++) {
          data[j] = randomData;
        }
        // Add small delay to prevent blocking
        await new Promise(resolve => setImmediate(resolve));
      }
      return true;
    }
    
    return false; // Data type not supported for secure deletion
  } catch (error) {
    qerrors(error, 'dataRetentionService.secureDelete', {
      operation: 'secure_data_deletion',
      dataType: typeof data,
      passes: passes,
      isArray: Array.isArray(data)
    });
    console.error('Secure deletion failed:', error.message);
    return false;
  }
}

// Export singleton instance
const dataRetentionService = new DataRetentionService();

// Auto-start service if not in test environment
if (process.env.NODE_ENV !== 'test') {
  dataRetentionService.start();
}

module.exports = dataRetentionService;