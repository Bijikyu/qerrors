/**
 * Privacy and Data Protection Module
 * Implements GDPR/CCPA compliance features including consent management,
 * data retention policies, and user rights management
 */

const crypto = require('crypto');

class PrivacyManager {
  constructor() {
    this.consentRecords = new Map(); // In production, use a persistent store
    this.dataRetentionDays = parseInt(process.env.DATA_RETENTION_DAYS) || 365;
    this.consentVersion = '1.0';
    
    // Initialize encryption keys
    this.encryptionKey = this.getOrCreateEncryptionKey();
    this.algorithm = 'aes-256-gcm';
  }

  /**
   * Get or create encryption key for personal data
   */
  getOrCreateEncryptionKey() {
    const envKey = process.env.PRIVACY_ENCRYPTION_KEY;
    if (envKey && envKey.length >= 64) { // 256 bits in hex = 64 chars
      return Buffer.from(envKey, 'hex');
    }
    
    // Generate a new key if none exists
    // In production, this should be stored securely and loaded from environment
    const key = crypto.randomBytes(32);
    console.warn('WARNING: Using auto-generated encryption key. Set PRIVACY_ENCRYPTION_KEY in production!');
    return key;
  }

  /**
   * Encrypt sensitive data
   */
  encryptData(data) {
    if (!data || typeof data !== 'string') {
      return data;
    }

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      cipher.setAAD(Buffer.from('qerrors-pii', 'utf8'));
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted: true,
        data: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.algorithm
      };
    } catch (error) {
      console.error('Encryption failed:', error.message);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  decryptData(encryptedData) {
    if (!encryptedData || !encryptedData.encrypted) {
      return encryptedData;
    }

    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAAD(Buffer.from('qerrors-pii', 'utf8'));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error.message);
      throw new Error('Failed to decrypt sensitive data');
    }
  }

  /**
   * Sanitize data for encryption - identify PII fields
   */
  identifyPII(data) {
    const piiFields = [
      'ipAddress', 'userAgent', 'email', 'phone', 'address', 
      'fullName', 'realName', 'name', 'location', 'identifier'
    ];
    
    const piiData = {};
    const sanitizedData = {};
    
    for (const [key, value] of Object.entries(data)) {
      const isPII = piiFields.some(field => key.toLowerCase().includes(field.toLowerCase()));
      
      if (isPII && value) {
        piiData[key] = value;
        sanitizedData[key] = '[ENCRYPTED]';
      } else {
        sanitizedData[key] = value;
      }
    }
    
    return { piiData, sanitizedData };
  }

  /**
   * Apply data minimization - collect only necessary data
   */
  minimizeDataCollection(consentData) {
    const minimized = {};
    
    // Only collect IP if necessary for security
    if (consentData.ipAddress && this.isIPCollectionRequired(consentData)) {
      // Hash IP for privacy while preserving security value
      minimized.ipAddress = this.hashPII(consentData.ipAddress, 'ip');
    }
    
    // Only collect user agent if analytics consent is given
    if (consentData.userAgent && consentData.analytics) {
      // Extract only browser version, not full user agent
      minimized.userAgent = this.extractBrowserInfo(consentData.userAgent);
    }
    
    // Copy non-PII fields
    ['purposes', 'marketing', 'analytics', 'essential'].forEach(field => {
      if (consentData[field] !== undefined) {
        minimized[field] = consentData[field];
      }
    });
    
    return minimized;
  }

  /**
   * Check if IP collection is required for security
   */
  isIPCollectionRequired(consentData) {
    // Only collect IP for rate limiting or security monitoring
    return consentData.securityRequired || process.env.REQUIRE_IP_FOR_SECURITY === 'true';
  }

  /**
   * Hash PII for privacy-preserving identification
   */
  hashPII(data, type) {
    const salt = process.env.PI_HASH_SALT || 'default-salt-change-in-production';
    const hash = crypto.createHash('sha256')
      .update(`${type}:${data}:${salt}`)
      .digest('hex');
    return {
      hashed: true,
      value: hash.substring(0, 16), // Truncate for additional privacy
      type: type
    };
  }

  /**
   * Extract minimal browser information from user agent
   */
  extractBrowserInfo(userAgent) {
    // Extract only essential browser/version info, remove unique identifiers
    const browserMatch = userAgent.match(/(chrome|firefox|safari|edge)\/(\d+)/i);
    if (browserMatch) {
      return `${browserMatch[1].toLowerCase()}-${browserMatch[2]}`;
    }
    return 'unknown';
  }

  /**
   * Record user consent for data processing with minimization
   */
  recordConsent(userId, consentData) {
    // Apply data minimization first
    const minimizedData = this.minimizeDataCollection(consentData);
    
    // Identify and encrypt any remaining PII
    const piiFields = {
      ipAddress: minimizedData.ipAddress,
      userAgent: minimizedData.userAgent
    };
    
    const encryptedPII = {};
    for (const [key, value] of Object.entries(piiFields)) {
      if (value) {
        if (value && value.hashed) {
          // Already hashed, store as-is
          encryptedPII[key] = value;
        } else {
          // Encrypt the data
          encryptedPII[key] = this.encryptData(value);
        }
      }
    }

    const consent = {
      userId: this.hashPII(userId, 'user'), // Hash user ID for privacy
      timestamp: new Date().toISOString(),
      version: this.consentVersion,
      purposes: minimizedData.purposes || [],
      marketing: minimizedData.marketing || false,
      analytics: minimizedData.analytics || false,
      essential: minimizedData.essential || true,
      dataMinimized: true,
      ...encryptedPII // Store encrypted/hashed PII
    };

    // Store with hashed key for additional privacy
    const hashedUserId = consent.userId.value;
    this.consentRecords.set(hashedUserId, consent);
    return consent;
  }

  /**
   * Helper method to get consent by trying both original and hashed user ID
   */
  getConsentByUserId(userId) {
    // Try original user ID first (for backward compatibility)
    let consent = this.consentRecords.get(userId);
    
    // If not found, try hashed ID
    if (!consent) {
      const hashedUserId = this.hashPII(userId, 'user');
      if (hashedUserId && hashedUserId.value) {
        consent = this.consentRecords.get(hashedUserId.value);
      }
    }
    
    return consent;
  }

  /**
   * Check if user has given consent for specific purpose
   */
  hasConsent(userId, purpose) {
    const consent = this.getConsentByUserId(userId);
    if (!consent || consent.withdrawnAt) return false;
    
    switch (purpose) {
      case 'essential':
        return consent.essential;
      case 'marketing':
        return consent.marketing;
      case 'analytics':
        return consent.analytics;
      default:
        return consent.purposes && consent.purposes.includes(purpose);
    }
  }

  /**
   * Update user consent preferences
   */
  updateConsent(userId, updates) {
    const existingConsent = this.getConsentByUserId(userId);
    if (!existingConsent) {
      throw new Error('No existing consent record found');
    }

    const updatedConsent = {
      ...existingConsent,
      timestamp: new Date().toISOString(),
      ...updates
    };

    // Get the hashed user ID for storage
    const hashedUserId = existingConsent.userId && existingConsent.userId.value ? 
      existingConsent.userId.value : userId;
    
    this.consentRecords.set(hashedUserId, updatedConsent);
    return updatedConsent;
  }

  /**
   * Withdraw all consent (Right to be Forgotten)
   */
  withdrawConsent(userId) {
    const consent = this.getConsentByUserId(userId);
    if (!consent) {
      throw new Error('No consent record found');
    }

    // Mark as withdrawn but keep record for compliance
    const withdrawnConsent = {
      ...consent,
      withdrawnAt: new Date().toISOString(),
      purposes: [],
      marketing: false,
      analytics: false,
      essential: false
    };

    // Get the hashed user ID for storage
    const hashedUserId = consent.userId && consent.userId.value ? 
      consent.userId.value : userId;
    
    this.consentRecords.set(hashedUserId, withdrawnConsent);
    return withdrawnConsent;
  }

  /**
   * Get user's consent data (Data Portability - GDPR Art. 20)
   */
  getUserData(userId) {
    // Try both original and hashed user ID
    let consent = this.consentRecords.get(userId);
    if (!consent) {
      // Try with hashed ID (how we actually store it)
      const hashedUserId = this.hashPII(userId, 'user');
      if (hashedUserId && hashedUserId.value) {
        consent = this.consentRecords.get(hashedUserId.value);
      }
    }
    
    if (!consent) {
      throw new Error('No user data found');
    }

    // Decrypt PII for data export
    const decryptedConsent = { ...consent };
    
    if (decryptedConsent.ipAddress && decryptedConsent.ipAddress.encrypted) {
      try {
        decryptedConsent.ipAddress = this.decryptData(decryptedConsent.ipAddress);
      } catch (error) {
        console.warn('Failed to decrypt IP address:', error.message);
        decryptedConsent.ipAddress = '[DECRYPTION_FAILED]';
      }
    }
    
    if (decryptedConsent.userAgent && decryptedConsent.userAgent.encrypted) {
      try {
        decryptedConsent.userAgent = this.decryptData(decryptedConsent.userAgent);
      } catch (error) {
        console.warn('Failed to decrypt user agent:', error.message);
        decryptedConsent.userAgent = '[DECRYPTION_FAILED]';
      }
    }

    return {
      consent: decryptedConsent,
      exportDate: new Date().toISOString(),
      dataFormat: 'JSON',
      allUserData: this.getAllUserData(userId) // Include all user data
    };
  }

  /**
   * Right to Access (GDPR Art. 15)
   */
  accessUserData(userId) {
    const userData = this.getUserData(userId);
    
    return {
      userId,
      accessDate: new Date().toISOString(),
      dataSummary: {
        consentRecords: 1,
        dataCategories: ['consent', 'usage analytics'],
        storageLocations: ['encrypted in-memory storage'],
        retentionPeriods: [`${this.dataRetentionDays} days`]
      },
      rawData: userData,
      purposes: userData.consent.purposes,
      recipients: ['internal systems only'],
      internationalTransfers: false
    };
  }

  /**
   * Right to Rectification (GDPR Art. 16)
   */
  rectifyUserData(userId, corrections) {
    const existingConsent = this.consentRecords.get(userId);
    if (!existingConsent) {
      throw new Error('No user data found to rectify');
    }

    // Apply corrections to allowed fields
    const allowedFields = ['purposes', 'marketing', 'analytics'];
    const rectifiedData = { ...existingConsent };
    
    for (const [field, value] of Object.entries(corrections)) {
      if (allowedFields.includes(field)) {
        rectifiedData[field] = value;
        rectifiedData.lastRectified = new Date().toISOString();
      }
    }

    this.consentRecords.set(userId, rectifiedData);
    return {
      success: true,
      rectifiedFields: Object.keys(corrections).filter(f => allowedFields.includes(f)),
      rectificationDate: new Date().toISOString()
    };
  }

  /**
   * Enhanced Right to Erasure (GDPR Art. 17) - Complete deletion
   */
  eraseUserData(userId, verificationCode = null) {
    const consent = this.getConsentByUserId(userId);
    if (!consent) {
      throw new Error('No user data found');
    }

    // In production, verify deletion request via email/code
    if (verificationCode) {
      // Verify deletion request (implement proper verification system)
      console.log(`Verifying deletion request for user ${userId} with code ${verificationCode}`);
    }

    // Get the actual storage key (hashed ID) for deletion
    const storageKey = consent.userId && consent.userId.value ? 
      consent.userId.value : userId;

    // Complete deletion from all storage
    this.consentRecords.delete(storageKey);
    
    // Log deletion for compliance (non-identifiable)
    const logId = userId.substring(0, 8) + '...';
    console.log(`User data deleted: ${logId} at ${new Date().toISOString()}`);

    return {
      success: true,
      deletionDate: new Date().toISOString(),
      dataCategoriesDeleted: ['consent records', 'PII data', 'usage data'],
      confirmationId: this.generateDeletionConfirmation(userId)
    };
  }

  /**
   * Right to Restriction of Processing (GDPR Art. 18)
   */
  restrictProcessing(userId, restrictionReason) {
    const consent = this.getConsentByUserId(userId);
    if (!consent) {
      throw new Error('No user data found');
    }

    const restrictedConsent = {
      ...consent,
      processingRestricted: true,
      restrictionReason,
      restrictionDate: new Date().toISOString(),
      marketing: false, // Always restrict marketing
      analytics: restrictionReason === 'objection' ? false : consent.analytics
    };

    // Get the actual storage key for updating
    const storageKey = consent.userId && consent.userId.value ? 
      consent.userId.value : userId;

    this.consentRecords.set(storageKey, restrictedConsent);
    return restrictedConsent;
  }

  /**
   * Right to Object to Processing (GDPR Art. 21)
   */
  objectToProcessing(userId, processingTypes = ['marketing', 'analytics']) {
    const consent = this.getConsentByUserId(userId);
    if (!consent) {
      throw new Error('No user data found');
    }

    const updatedConsent = { ...consent };
    
    processingTypes.forEach(type => {
      if (type in updatedConsent) {
        updatedConsent[type] = false;
      }
    });

    updatedConsent.objectionDate = new Date().toISOString();
    updatedConsent.objectedProcessingTypes = processingTypes;

    // Get actual storage key for updating
    const storageKey = consent.userId && consent.userId.value ? 
      consent.userId.value : userId;

    this.consentRecords.set(storageKey, updatedConsent);
    return updatedConsent;
  }

  /**
   * Get comprehensive user data from all systems
   */
  getAllUserData(userId) {
    // In production, this would aggregate data from all systems
    const consent = this.consentRecords.get(userId);
    
    return {
      consentRecords: consent ? 1 : 0,
      lastActivity: consent?.timestamp || null,
      dataCategories: consent ? ['consent', 'analytics'] : [],
      processingActivities: consent?.purposes || [],
      retentionSchedules: consent ? [`${this.dataRetentionDays} days`] : []
    };
  }

  /**
   * Generate deletion confirmation ID
   */
  generateDeletionConfirmation(userId) {
    const timestamp = Date.now().toString(36);
    const userHash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8);
    return `DEL-${userHash}-${timestamp}`;
  }

  /**
   * Check if data should be deleted based on retention policy
   */
  shouldDeleteData(timestamp) {
    const dataAge = Date.now() - new Date(timestamp).getTime();
    const maxAge = this.dataRetentionDays * 24 * 60 * 60 * 1000;
    return dataAge > maxAge;
  }

  /**
   * Get comprehensive privacy policy with specific disclosures
   */
  getPrivacyPolicy() {
    return {
      version: this.consentVersion,
      lastUpdated: new Date().toISOString(),
      effectiveDate: '2025-01-01',
      title: 'Comprehensive Privacy Policy',
      sections: [
        {
          title: '1. Data Controller Information',
          content: {
            companyName: 'QErrors Service',
            contactEmail: 'privacy@qerrors.dev',
            dataProtectionOfficer: 'dpo@qerrors.dev',
            jurisdiction: 'Global',
            regulatoryFramework: ['GDPR', 'CCPA', 'PIPEDA']
          }
        },
        {
          title: '2. Data Collection Practices',
          content: {
            dataTypes: [
              {
                category: 'Identity and Contact Data',
                examples: ['Hashed User ID', 'Email (with consent)'],
                collectionMethod: 'Direct input',
                purpose: 'Service provision, authentication',
                legalBasis: 'Contractual necessity, Consent'
              },
              {
                category: 'Technical Usage Data',
                examples: ['Hashed IP addresses', 'Browser type/version', 'Service usage patterns'],
                collectionMethod: 'Automatic collection',
                purpose: 'Service security, performance optimization',
                legalBasis: 'Legitimate interest'
              },
              {
                category: 'Consent and Preference Data',
                examples: ['Consent records', 'Marketing preferences', 'Analytics preferences'],
                collectionMethod: 'Direct input',
                purpose: 'Compliance, personalization',
                legalBasis: 'Consent'
              }
            ],
            dataMinimization: 'We implement data minimization principles by collecting only data that is strictly necessary for the specified purposes. Personal identifiers are hashed and encrypted.',
            voluntaryInformation: 'Providing personal data is voluntary, but refusal may affect service functionality.'
          }
        },
        {
          title: '3. Data Processing Purposes and Legal Basis',
          content: {
            purposes: [
              {
                purpose: 'Service Provision',
                description: 'Provide core error handling and monitoring services',
                legalBasis: 'Contractual necessity',
                dataCategories: ['Hashed User ID', 'Technical usage data'],
                retentionPeriod: 'Service duration + 90 days'
              },
              {
                purpose: 'Security and Fraud Prevention',
                description: 'Protect against unauthorized access and misuse',
                legalBasis: 'Legitimate interest',
                dataCategories: ['Hashed IP addresses', 'Security events'],
                retentionPeriod: '5 years'
              },
              {
                purpose: 'Service Improvement and Analytics',
                description: 'Analyze usage patterns to improve service quality',
                legalBasis: 'Legitimate interest',
                dataCategories: ['Aggregated usage data', 'Performance metrics'],
                retentionPeriod: '365 days'
              },
              {
                purpose: 'Marketing Communications',
                description: 'Send updates about features and services',
                legalBasis: 'Consent',
                dataCategories: ['Email address', 'Marketing preferences'],
                retentionPeriod: 'Until consent withdrawal'
              }
            ]
          }
        },
        {
          title: '4. Data Sharing and Third Parties',
          content: {
            generalPolicy: 'We do not sell your personal data to third parties. We only share data when necessary for service provision or when legally required.',
            thirdPartyCategories: [
              {
                category: 'Service Providers',
                examples: ['Cloud hosting providers', 'Security monitoring services'],
                purpose: 'Service infrastructure and security',
                dataShared: 'Encrypted technical data only',
                safeguards: 'Data processing agreements, encryption'
              },
              {
                category: 'Legal Authorities',
                examples: ['Law enforcement', 'Regulatory bodies'],
                purpose: 'Legal compliance requirements',
                dataShared: 'Only when legally required',
                safeguards: 'Legal review, data minimization'
              }
            ],
            internationalTransfers: {
              policy: 'Data may be processed in multiple jurisdictions with adequate data protection laws',
              mechanisms: ['Standard Contractual Clauses', 'Adequacy determinations'],
              safeguards: 'Encryption, access controls'
            }
          }
        },
        {
          title: '5. Data Security Measures',
          content: {
            technicalMeasures: [
              'AES-256 encryption for data at rest',
              'TLS 1.3 encryption for data in transit',
              'Regular security audits and penetration testing',
              'Intrusion detection and prevention systems',
              'Secure coding practices and vulnerability scanning'
            ],
            organizationalMeasures: [
              'Employee security training and awareness programs',
              'Need-to-know access controls',
              'Regular security policy reviews',
              'Incident response procedures',
              'Data protection impact assessments'
            ],
            dataBreachProcedures: 'We notify affected users and authorities within 72 hours of discovering a breach, in accordance with GDPR requirements.'
          }
        },
        {
          title: '6. Your Data Subject Rights',
          content: {
            rights: [
              {
                right: 'Right to Access',
                description: 'Obtain confirmation and copy of your personal data',
                exerciseMethod: 'Email privacy@qerrors.dev with subject "Data Access Request"',
                responseTime: '30 days'
              },
              {
                right: 'Right to Rectification',
                description: 'Correct inaccurate or incomplete personal data',
                exerciseMethod: 'Email privacy@qerrors.dev with subject "Data Correction Request"',
                responseTime: '30 days'
              },
              {
                right: 'Right to Erasure (Right to be Forgotten)',
                description: 'Request deletion of your personal data',
                exerciseMethod: 'Email privacy@qerrors.dev with subject "Data Deletion Request"',
                responseTime: '30 days',
                exceptions: 'Legal requirements, legitimate interests'
              },
              {
                right: 'Right to Restrict Processing',
                description: 'Limit processing of your personal data',
                exerciseMethod: 'Email privacy@qerrors.dev with subject "Processing Restriction Request"',
                responseTime: '30 days'
              },
              {
                right: 'Right to Data Portability',
                description: 'Receive your data in a machine-readable format',
                exerciseMethod: 'Email privacy@qerrors.dev with subject "Data Portability Request"',
                responseTime: '30 days',
                format: 'JSON, CSV'
              },
              {
                right: 'Right to Object',
                description: 'Object to processing based on legitimate interest',
                exerciseMethod: 'Email privacy@qerrors.dev with subject "Processing Objection"',
                responseTime: '30 days'
              }
            ],
            ccpaRights: {
              rightToKnow: 'Access to categories of personal information collected',
              rightToDelete: 'Request deletion of personal information',
              rightToOptOut: 'Opt-out of sale or sharing of personal information',
              rightToNonDiscrimination: 'Not receive discriminatory treatment for exercising privacy rights'
            }
          }
        },
        {
          title: '7. Data Retention Policies',
          content: {
            generalPolicy: 'We retain personal data only as long as necessary for the purposes for which it was collected, subject to legal requirements.',
            retentionPeriods: [
              { category: 'Error logs and service data', retention: '90 days', purpose: 'Service improvement' },
              { category: 'User session data', retention: '30 days', purpose: 'Service functionality' },
              { category: 'Analytics data', retention: '365 days', purpose: 'Service optimization' },
              { category: 'Consent records', retention: `${this.dataRetentionDays} days`, purpose: 'Compliance' },
              { category: 'Withdrawn consent', retention: '7 years', purpose: 'Legal compliance' },
              { category: 'Security incident logs', retention: '5 years', purpose: 'Security monitoring' },
              { category: 'Audit logs', retention: '7 years', purpose: 'Compliance' }
            ],
            deletionProcess: 'Data is securely deleted using multi-pass overwriting and deletion verification procedures.',
            automatedCleanup: 'Automated cleanup processes run daily to remove expired data according to retention policies.'
          }
        },
        {
          title: '8. Cookies and Tracking Technologies',
          content: {
            cookieTypes: [
              {
                type: 'Essential Cookies',
                purpose: 'Service functionality and security',
                duration: 'Session to 24 hours',
                required: true
              },
              {
                type: 'Analytics Cookies',
                purpose: 'Service usage analysis',
                duration: '365 days',
                required: false,
                consentRequired: true
              },
              {
                type: 'Marketing Cookies',
                purpose: 'Personalization and communication',
                duration: '180 days',
                required: false,
                consentRequired: true
              }
            ],
            cookieManagement: 'You can manage cookie preferences through our consent management interface or browser settings.',
            thirdPartyCookies: 'We do not use third-party advertising or tracking cookies.'
          }
        },
        {
          title: '9. Children and Minors',
          content: {
            policy: 'Our services are not intended for children under 13. We do not knowingly collect personal information from children.',
            parentalConsent: 'If we discover we have collected information from a child under 13, we will promptly delete it.',
            ageVerification: 'Age verification may be required for certain features to comply with applicable laws.'
          }
        },
        {
          title: '10. Changes to This Policy',
          content: {
            updateProcess: 'We may update this privacy policy to reflect changes in our practices or legal requirements.',
            notificationMethod: 'Significant changes will be communicated via email, website notices, or other appropriate means.',
            effectiveDate: 'Changes become effective when posted, with 30-day notice for material changes requiring user action.'
          }
        },
        {
          title: '11. Contact Information',
          content: {
            generalInquiries: 'privacy@qerrors.dev',
            dataProtectionOfficer: 'dpo@qerrors.dev',
            complaints: 'compliance@qerrors.dev',
            mailingAddress: 'QErrors Privacy Department, 123 Tech Street, Digital City, 12345',
            phone: '+1-555-PRIVACY',
            responseTime: 'We acknowledge receipt within 5 business days and respond within 30 days'
          }
        },
        {
          title: '12. Legal and Regulatory Information',
          content: {
            governingLaw: 'This policy is governed by the laws of [Jurisdiction]',
            disputeResolution: 'Privacy disputes will be resolved through [Arbitration/Mediation] as specified in our Terms of Service',
            regulatoryOversight: 'We cooperate with data protection authorities and regulatory bodies',
            compliance: 'This policy is designed to comply with GDPR, CCPA, and other applicable privacy laws'
          }
        }
      ],
      attachments: {
        consentManagementGuide: 'Available at /consent-guide',
        dataRequestForms: 'Available at /data-requests',
        securityDocumentation: 'Available at /security-docs',
        complianceDocumentation: 'Available at /compliance'
      }
    };
  }

  /**
   * Generate consent request form data
   */
  getConsentRequest(requestInfo) {
    return {
      version: this.consentVersion,
      requestDate: new Date().toISOString(),
      ipAddress: requestInfo.ipAddress,
      userAgent: requestInfo.userAgent,
      purposes: [
        {
          id: 'essential',
          name: 'Essential Services',
          description: 'Required for basic functionality and security',
          required: true
        },
        {
          id: 'analytics',
          name: 'Analytics',
          description: 'Help us improve our services by understanding usage patterns',
          required: false
        },
        {
          id: 'marketing',
          name: 'Marketing Communications',
          description: 'Receive updates about new features and services',
          required: false
        }
      ]
    };
  }

  /**
   * Sanitize user data for privacy compliance
   */
  sanitizeUserData(data) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sensitiveFields = [
      'email', 'phone', 'address', 'fullName', 'realName',
      'creditCard', 'ssn', 'socialSecurity', 'bankAccount'
    ];

    const sanitized = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED_FOR_PRIVACY]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeUserData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

module.exports = new PrivacyManager();