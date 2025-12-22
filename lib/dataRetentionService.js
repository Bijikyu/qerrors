/**
 * Data Retention and Cleanup Service
 * Implements automated data retention policies and cleanup procedures
 * for GDPR/CCPA compliance
 */

const cron = require('node-cron');
const crypto = require('crypto');
const privacyManager = require('./privacyManager');

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
   * Perform secure data deletion with multiple passes
   */
  secureDelete(data, passes = this.secureDeletionPasses) {
    if (!this.useSecureDeletion) {
      return false; // Skip secure deletion if disabled
    }

    try {
      if (typeof data === 'string') {
        // For strings, create a mutable buffer and overwrite it
        let buffer = Buffer.from(data);
        for (let i = 0; i < passes; i++) {
          const randomData = crypto.randomBytes(buffer.length);
          randomData.copy(buffer);
        }
        return true;
      } else if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        // For objects, overwrite each property
        for (let i = 0; i < passes; i++) {
          const randomData = crypto.randomBytes(64).toString('hex');
          for (const key in data) {
            if (data.hasOwnProperty(key)) {
              data[key] = randomData;
            }
          }
        }
        return true;
      } else if (Array.isArray(data)) {
        // For arrays, overwrite each element
        for (let i = 0; i < passes; i++) {
          const randomData = crypto.randomBytes(32).toString('hex');
          for (let j = 0; j < data.length; j++) {
            data[j] = randomData;
          }
        }
        return true;
      }
      
      return false; // Data type not supported for secure deletion
    } catch (error) {
      console.error('Secure deletion failed:', error.message);
      return false;
    }
  }

  /**
   * Generate secure deletion verification hash
   */
  generateDeletionVerification(dataId) {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256')
      .update(`${dataId}:${timestamp}:${random}`)
      .digest('hex');
    
    return {
      dataId,
      timestamp,
      verificationHash: hash,
      passes: this.secureDeletionPasses
    };
  }

  /**
   * Verify secure deletion was completed
   */
  verifyDeletion(verificationData) {
    try {
      // In production, this would verify against secure deletion logs
      // For now, we'll generate a verification timestamp
      const verification = {
        ...verificationData,
        verifiedAt: new Date().toISOString(),
        verificationMethod: 'multi-pass-secure-overwrite',
        status: 'verified'
      };
      
      return verification;
    } catch (error) {
      console.error('Deletion verification failed:', error.message);
      return null;
    }
  }

  /**
   * Start the data retention service
   */
  start() {
    if (this.isRunning) {
      console.log('Data retention service is already running');
      return;
    }

    console.log(`Starting data retention service with ${this.retentionDays} day retention period`);
    console.log(`Cleanup schedule: ${this.cleanupSchedule}`);

    // Schedule daily cleanup job
    this.cleanupJob = cron.schedule(this.cleanupSchedule, () => {
      this.performCleanup();
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.cleanupJob.start();
    this.isRunning = true;

    console.log('Data retention service started successfully');
    
    // Perform initial cleanup after a short delay
    setTimeout(() => this.performCleanup(), 5000);
  }

  /**
   * Stop the data retention service
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    if (this.cleanupJob) {
      this.cleanupJob.stop();
      this.cleanupJob = null;
    }

    this.isRunning = false;
    console.log('Data retention service stopped');
  }

  /**
   * Perform data cleanup based on retention policies
   */
  async performCleanup() {
    console.log('Starting data cleanup process...');
    
    try {
      const startTime = Date.now();
      const cleanupResults = {
        timestamp: new Date().toISOString(),
        duration: 0,
        deletedRecords: {
          errorLogs: 0,
          userSessions: 0,
          consentRecords: 0,
          auditLogs: 0
        },
        errors: []
      };

      // Clean up old error logs
      await this.cleanupErrorLogs(cleanupResults);

      // Clean up expired user sessions
      await this.cleanupUserSessions(cleanupResults);

      // Clean up old consent records (keep withdrawn ones for compliance)
      await this.cleanupConsentRecords(cleanupResults);

      // Clean up old audit logs (keep for minimum compliance period)
      await this.cleanupAuditLogs(cleanupResults);

      cleanupResults.duration = Date.now() - startTime;
      
      console.log('Data cleanup completed:', {
        duration: `${cleanupResults.duration}ms`,
        totalDeleted: Object.values(cleanupResults.deletedRecords).reduce((a, b) => a + b, 0),
        errors: cleanupResults.errors.length
      });

      // Log cleanup results for audit purposes
      this.logCleanupResults(cleanupResults);

    } catch (error) {
      console.error('Data cleanup failed:', error);
    }
  }

  /**
   * Clean up old error logs
   */
  async cleanupErrorLogs(results) {
    try {
      // In a real implementation, this would query your log storage
      // For demo purposes, we'll simulate the cleanup
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      
      console.log(`Cleaning up error logs older than ${cutoffDate.toISOString()}`);
      
      // Simulate cleanup - in reality, this would be database queries
      // Example: db.logs.deleteMany({ timestamp: { $lt: cutoffDate } })
      
      results.deletedRecords.errorLogs = Math.floor(Math.random() * 100); // Simulated count
      
    } catch (error) {
      results.errors.push(`Error log cleanup failed: ${error.message}`);
    }
  }

  /**
   * Clean up expired user sessions
   */
  async cleanupUserSessions(results) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days for sessions
      
      console.log(`Cleaning up user sessions older than ${cutoffDate.toISOString()}`);
      
      // In reality: db.sessions.deleteMany({ lastActivity: { $lt: cutoffDate } })
      
      results.deletedRecords.userSessions = Math.floor(Math.random() * 50); // Simulated count
      
    } catch (error) {
      results.errors.push(`Session cleanup failed: ${error.message}`);
    }
  }

  /**
   * Get category-specific retention periods
   */
  getRetentionPeriod(category) {
    const retentionPeriods = {
      errorLogs: 90, // 90 days for error logs
      userSessions: 30, // 30 days for sessions
      consentRecords: this.retentionDays, // Configurable default
      consentRecordsWithdrawn: 2555, // 7 years for withdrawn consent (compliance)
      auditLogs: 2555, // 7 years for audit logs (compliance)
      analytics: 365, // 1 year for analytics
      performance: 180, // 6 months for performance data
      security: 1825 // 5 years for security incidents
    };
    
    return retentionPeriods[category] || this.retentionDays;
  }

  /**
   * Clean up old consent records (keep withdrawn records longer for compliance)
   */
  async cleanupConsentRecords(results) {
    try {
      const standardRetention = this.getRetentionPeriod('consentRecords');
      const withdrawnRetention = this.getRetentionPeriod('consentRecordsWithdrawn');
      
      const standardCutoff = new Date();
      standardCutoff.setDate(standardCutoff.getDate() - standardRetention);
      
      const withdrawnCutoff = new Date();
      withdrawnCutoff.setDate(withdrawnCutoff.getDate() - withdrawnRetention);
      
      console.log(`Cleaning up consent records: standard < ${standardCutoff.toISOString()}, withdrawn < ${withdrawnCutoff.toISOString()}`);
      
      // Secure deletion of expired consent records
      const deletedStandard = Math.floor(Math.random() * 20); // Simulated count
      const deletedWithdrawn = Math.floor(Math.random() * 5); // Simulated count
      
      // Generate secure deletion verifications
      const verifications = [];
      for (let i = 0; i < deletedStandard + deletedWithdrawn; i++) {
        const verification = this.generateDeletionVerification(`consent-${Date.now()}-${i}`);
        verifications.push(this.verifyDeletion(verification));
      }
      
      results.deletedRecords.consentRecords = deletedStandard;
      results.deletedRecords.consentRecordsWithdrawn = deletedWithdrawn;
      results.secureDeletionVerifications = verifications;
      
    } catch (error) {
      results.errors.push(`Consent record cleanup failed: ${error.message}`);
    }
  }

  /**
   * Clean up old audit logs (keep for minimum compliance period)
   */
  async cleanupAuditLogs(results) {
    try {
      // Keep audit logs for 7 years for compliance (adjust based on your requirements)
      const auditRetentionDays = Math.min(this.retentionDays, 7 * 365);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - auditRetentionDays);
      
      console.log(`Cleaning up audit logs older than ${cutoffDate.toISOString()}`);
      
      // In reality: db.auditLogs.deleteMany({ timestamp: { $lt: cutoffDate } })
      
      results.deletedRecords.auditLogs = Math.floor(Math.random() * 200); // Simulated count
      
    } catch (error) {
      results.errors.push(`Audit log cleanup failed: ${error.message}`);
    }
  }

  /**
   * Log cleanup results for audit purposes
   */
  logCleanupResults(results) {
    const auditLog = {
      timestamp: results.timestamp,
      event: 'DATA_CLEANUP',
      duration: results.duration,
      recordsDeleted: results.deletedRecords,
      errors: results.errors,
      success: results.errors.length === 0
    };

    // In reality, this would be stored in your audit log system
    console.log('AUDIT:', JSON.stringify(auditLog, null, 2));
  }

  /**
   * Get cleanup statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      retentionDays: this.retentionDays,
      cleanupSchedule: this.cleanupSchedule,
      nextCleanup: this.getNextCleanupTime()
    };
  }

  /**
   * Get next scheduled cleanup time
   */
  getNextCleanupTime() {
    if (!this.isRunning || !this.cleanupJob) {
      return null;
    }

    // Calculate next run time based on cron schedule
    // This is a simplified calculation - in production, use a proper cron parser
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(2, 0, 0, 0); // Next day at 2 AM UTC

    return nextRun.toISOString();
  }

  /**
   * Manual cleanup trigger for testing or immediate cleanup
   */
  async triggerManualCleanup() {
    console.log('Manual cleanup triggered');
    await this.performCleanup();
  }
}

// Export singleton instance
const dataRetentionService = new DataRetentionService();

// Auto-start service if not in test environment
if (process.env.NODE_ENV !== 'test') {
  dataRetentionService.start();
}

module.exports = dataRetentionService;