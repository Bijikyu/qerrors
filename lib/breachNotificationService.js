/**
 * Data Breach Notification Service
 * Implements GDPR Article 33/34 breach notification procedures
 * and CCPA breach notification requirements
 */

const crypto = require('crypto');
const privacyManager = require('./privacyManager');

class BreachNotificationService {
  constructor() {
    this.breachLog = new Map(); // In production, use persistent storage
    this.notificationThresholds = {
      gdpr: 72, // 72 hours in hours
      ccpa: 'reasonable time without unreasonable delay'
    };
    
    // Configuration
    this.notificationChannels = {
      email: process.env.BREACH_EMAIL_ENABLED !== 'false',
      sms: process.env.BREACH_SMS_ENABLED === 'true',
      inApp: process.env.BREACH_INAPP_ENABLED !== 'false'
    };
    
    this.defaultRecipients = {
      dpo: process.env.DPO_EMAIL || 'dpo@qerrors.dev',
      security: process.env.SECURITY_EMAIL || 'security@qerrors.dev',
      legal: process.env.LEGAL_EMAIL || 'legal@qerrors.dev',
      management: process.env.MANAGEMENT_EMAIL || 'management@qerrors.dev'
    };
  }

  /**
   * Detect and assess potential data breach
   */
  async detectBreach(incidentData) {
    const breachId = this.generateBreachId();
    const timestamp = new Date().toISOString();
    
    const breachAssessment = {
      breachId,
      timestamp,
      status: 'assessment',
      incidentData: this.sanitizeIncidentData(incidentData),
      riskAssessment: await this.assessRisk(incidentData),
      notificationDeadline: this.calculateNotificationDeadline(),
      nextReview: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() // 4 hours
    };

    this.breachLog.set(breachId, breachAssessment);
    
    // Log breach detection
    console.log('BREACH_DETECTED:', JSON.stringify({
      breachId,
      severity: breachAssessment.riskAssessment.severity,
      deadline: breachAssessment.notificationDeadline
    }, null, 2));

    return breachAssessment;
  }

  /**
   * Assess breach risk and impact
   */
  async assessRisk(incidentData) {
    const riskFactors = {
      dataTypes: this.assessDataTypes(incidentData.dataTypes || []),
      volume: this.assessVolume(incidentData.recordsAffected || 0),
      accessibility: this.assessAccessibility(incidentData.accessibility || 'unknown'),
      encryption: this.assessEncryption(incidentData.encryption || false),
      duration: this.assessDuration(incidentData.breachDuration || 0),
      attackerMotivation: this.assessMotivation(incidentData.motivation || 'unknown'),
      affectedPopulation: this.assessAffectedPopulation(incidentData.affectedPopulation || 0)
    };

    const riskScore = this.calculateRiskScore(riskFactors);
    const severity = this.determineSeverity(riskScore);
    
    return {
      score: riskScore,
      severity,
      factors: riskFactors,
      requiresNotification: this.requiresNotification(severity, riskFactors),
      gdprArticle33: riskScore >= 60, // High risk requiring supervisory authority notification
      gdprArticle34: this.requiresIndividualNotification(riskFactors)
    };
  }

  /**
   * Assess data type sensitivity
   */
  assessDataTypes(dataTypes) {
    const sensitivityMap = {
      'personal_data': 30,
      'special_category_data': 50,
      'financial_data': 45,
      'health_data': 50,
      'biometric_data': 50,
      'criminal_data': 60,
      'email': 20,
      'ip_address': 10,
      'usage_data': 5
    };

    let maxSensitivity = 0;
    let totalSensitivity = 0;

    dataTypes.forEach(type => {
      const sensitivity = sensitivityMap[type] || 10;
      maxSensitivity = Math.max(maxSensitivity, sensitivity);
      totalSensitivity += sensitivity;
    });

    return {
      types: dataTypes,
      maxSensitivity,
      totalSensitivity,
      averageSensitivity: dataTypes.length > 0 ? totalSensitivity / dataTypes.length : 0
    };
  }

  /**
   * Assess breach volume impact
   */
  assessVolume(recordsAffected) {
    if (recordsAffected < 100) return { level: 'low', score: 5 };
    if (recordsAffected < 1000) return { level: 'medium', score: 15 };
    if (recordsAffected < 10000) return { level: 'high', score: 25 };
    return { level: 'critical', score: 40 };
  }

  /**
   * Assess data accessibility
   */
  assessAccessibility(accessibility) {
    const accessMap = {
      'encrypted_no_keys': { score: 5, description: 'Encrypted data, keys not compromised' },
      'encrypted_keys_compromised': { score: 25, description: 'Encrypted data, keys compromised' },
      'public_accessible': { score: 40, description: 'Publicly accessible' },
      'limited_access': { score: 20, description: 'Limited unauthorized access' },
      'internal_access': { score: 15, description: 'Internal unauthorized access' }
    };

    return accessMap[accessibility] || { score: 20, description: 'Unknown accessibility' };
  }

  /**
   * Assess encryption status
   */
  assessEncryption(isEncrypted) {
    return {
      encrypted: isEncrypted,
      score: isEncrypted ? 5 : 15,
      description: isEncrypted ? 'Data was encrypted' : 'Data was not encrypted'
    };
  }

  /**
   * Assess breach duration
   */
  assessDuration(hours) {
    if (hours < 1) return { level: 'very_short', score: 5 };
    if (hours < 24) return { level: 'short', score: 10 };
    if (hours < 168) return { level: 'medium', score: 20 };
    return { level: 'long', score: 30 };
  }

  /**
   * Assess attacker motivation
   */
  assessMotivation(motivation) {
    const motivationMap = {
      'accidental': { score: 10, description: 'Accidental exposure' },
      'financial_gain': { score: 35, description: 'Financial motivation' },
      'espionage': { score: 40, description: 'Industrial espionage' },
      'activism': { score: 25, description: 'Hacktivism' },
      'unknown': { score: 20, description: 'Unknown motivation' }
    };

    return motivationMap[motivation] || motivationMap['unknown'];
  }

  /**
   * Assess affected population
   */
  assessAffectedPopulation(count) {
    if (count < 50) return { level: 'small', score: 5 };
    if (count < 500) return { level: 'medium', score: 15 };
    if (count < 5000) return { level: 'large', score: 25 };
    return { level: 'massive', score: 35 };
  }

  /**
   * Calculate overall risk score
   */
  calculateRiskScore(riskFactors) {
    const weights = {
      dataTypes: 0.25,
      volume: 0.20,
      accessibility: 0.20,
      encryption: 0.10,
      duration: 0.10,
      motivation: 0.10,
      affectedPopulation: 0.05
    };

    let score = 0;
    
    score += riskFactors.dataTypes.maxSensitivity * weights.dataTypes;
    score += riskFactors.volume.score * weights.volume;
    score += riskFactors.accessibility.score * weights.accessibility;
    score += riskFactors.encryption.score * weights.encryption;
    score += riskFactors.duration.score * weights.duration;
    score += riskFactors.motivation.score * weights.motivation;
    score += riskFactors.affectedPopulation.score * weights.affectedPopulation;

    return Math.min(100, Math.round(score));
  }

  /**
   * Determine breach severity
   */
  determineSeverity(riskScore) {
    if (riskScore >= 75) return 'critical';
    if (riskScore >= 50) return 'high';
    if (riskScore >= 25) return 'medium';
    return 'low';
  }

  /**
   * Check if notification is required
   */
  requiresNotification(severity, riskFactors) {
    // GDPR: any breach likely to result in risk to rights/freedoms
    // CCPA: any unauthorized acquisition of personal information
    
    return severity !== 'low' || 
           riskFactors.dataTypes.maxSensitivity >= 30 ||
           riskFactors.volume.level !== 'low';
  }

  /**
   * Check if individual notification is required
   */
  requiresIndividualNotification(riskFactors) {
    // High risk to rights and freedoms requires individual notification
    return riskFactors.dataTypes.maxSensitivity >= 40 || 
           riskFactors.accessibility.score >= 30 ||
           riskFactors.volume.level === 'critical';
  }

  /**
   * Initialize breach response
   */
  async initiateResponse(breachId, responsePlan) {
    const breach = this.breachLog.get(breachId);
    if (!breach) {
      throw new Error(`Breach ${breachId} not found`);
    }

    const response = {
      breachId,
      initiatedAt: new Date().toISOString(),
      responseTeam: responsePlan.responseTeam || this.getDefaultResponseTeam(),
      containmentActions: responsePlan.containmentActions || [],
      investigation: {
        lead: responsePlan.investigationLead || 'default',
        timeline: responsePlan.investigationTimeline || 'standard',
        forensics: responsePlan.forensicsRequired || false
      },
      communicationPlan: {
        internal: responsePlan.internalCommunication || true,
        external: responsePlan.externalCommunication || false,
        legal: responsePlan.legalNotification || true
      }
    };

    breach.status = 'response_initiated';
    breach.response = response;
    
    // Send immediate internal notifications
    await this.sendInternalNotifications(breach, response);

    return response;
  }

  /**
   * Send notifications to regulatory authorities (GDPR Article 33)
   */
  async notifyAuthorities(breachId, notificationData) {
    const breach = this.breachLog.get(breachId);
    if (!breach) {
      throw new Error(`Breach ${breachId} not found`);
    }

    const authorityNotification = {
      breachId,
      notificationDate: new Date().toISOString(),
      notifyingOrganization: 'QErrors Service',
      contactDetails: this.getContactDetails(),
      description: {
        natureOfBreach: notificationData.description || breach.incidentData.description,
        categoriesOfData: breach.riskAssessment.factors.dataTypes.types,
        likelyConsequences: this.assessConsequences(breach.riskAssessment),
        measuresTaken: notificationData.measuresTaken || [],
        measuresProposed: notificationData.measuresProposed || []
      },
      timeline: {
        breachDiscovery: breach.timestamp,
        breachContained: notificationData.containedDate || null,
        notificationDelay: this.calculateDelay(breach.timestamp)
      }
    };

    // Store notification record
    breach.authorityNotification = authorityNotification;
    breach.status = 'authorities_notified';

    // In production, this would integrate with actual notification systems
    console.log('AUTHORITY_NOTIFICATION:', JSON.stringify(authorityNotification, null, 2));

    return authorityNotification;
  }

  /**
   * Send notifications to affected individuals (GDPR Article 34)
   */
  async notifyIndividuals(breachId, communicationPlan) {
    const breach = this.breachLog.get(breachId);
    if (!breach) {
      throw new Error(`Breach ${breachId} not found`);
    }

    const individualNotification = {
      breachId,
      communicationDate: new Date().toISOString(),
      urgency: this.determineCommunicationUrgency(breach.riskAssessment),
      channels: communicationPlan.channels || ['email'],
      content: {
        subject: 'Important Security Notice Regarding Your Personal Data',
        summary: this.generateIndividualSummary(breach),
        risks: this.explainRisks(breach.riskAssessment),
        protectiveMeasures: this.recommendProtectiveMeasures(breach.riskAssessment),
        contactInformation: this.getContactDetails(),
        nextSteps: this.provideNextSteps()
      },
      language: communicationPlan.language || 'en',
      accessibilityOptions: communicationPlan.accessibility || ['plain_text', 'large_print']
    };

    breach.individualNotification = individualNotification;
    breach.status = 'individuals_notified';

    console.log('INDIVIDUAL_NOTIFICATION:', JSON.stringify(individualNotification, null, 2));

    return individualNotification;
  }

  /**
   * Generate breach report for compliance and audit
   */
  generateBreachReport(breachId) {
    const breach = this.breachLog.get(breachId);
    if (!breach) {
      throw new Error(`Breach ${breachId} not found`);
    }

    return {
      breachId,
      reportDate: new Date().toISOString(),
      incidentSummary: {
        timestamp: breach.timestamp,
        description: breach.incidentData.description,
        severity: breach.riskAssessment.severity,
        riskScore: breach.riskAssessment.score
      },
      timeline: this.generateTimeline(breach),
      impactAssessment: {
        dataTypes: breach.riskAssessment.factors.dataTypes,
        recordsAffected: breach.incidentData.recordsAffected,
        individualsAffected: breach.incidentData.affectedPopulation,
        regulatoryImplications: this.assessRegulatoryImplications(breach.riskAssessment)
      },
      responseActions: {
        containment: breach.response?.containmentActions || [],
        investigation: breach.response?.investigation || {},
        notifications: {
          authorities: breach.authorityNotification ? 'completed' : 'not required',
          individuals: breach.individualNotification ? 'completed' : 'not required'
        }
      },
      lessonsLearned: breach.lessonsLearned || [],
      recommendations: breach.recommendations || [],
      complianceStatus: this.assessComplianceStatus(breach)
    };
  }

  /**
   * Generate unique breach ID
   */
  generateBreachId() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `BRCH-${timestamp}-${random}`;
  }

  /**
   * Calculate GDPR 72-hour notification deadline
   */
  calculateNotificationDeadline() {
    const deadline = new Date(Date.now() + 72 * 60 * 60 * 1000);
    return deadline.toISOString();
  }

  /**
   * Sanitize incident data for logging
   */
  sanitizeIncidentData(incidentData) {
    const sanitized = { ...incidentData };
    
    // Remove or redact sensitive information
    if (sanitized.rawData) delete sanitized.rawData;
    if (sanitized.passwords) delete sanitized.passwords;
    if (sanitized.apiKeys) delete sanitized.apiKeys;
    
    return sanitized;
  }

  /**
   * Calculate delay from discovery to notification
   */
  calculateDelay(discoveryDate) {
    const discovery = new Date(discoveryDate);
    const now = new Date();
    const hours = Math.floor((now - discovery) / (1000 * 60 * 60));
    return `${hours} hours`;
  }

  /**
   * Get default response team
   */
  getDefaultResponseTeam() {
    return {
      incidentCommander: 'security@qerrors.dev',
      technicalLead: 'tech@qerrors.dev',
      communications: 'comms@qerrors.dev',
      legal: 'legal@qerrors.dev',
      privacy: privacyManager
    };
  }

  /**
   * Get contact details for notifications
   */
  getContactDetails() {
    return {
      organization: 'QErrors Service',
      email: 'privacy@qerrors.dev',
      phone: '+1-555-PRIVACY',
      dpo: 'dpo@qerrors.dev',
      address: '123 Tech Street, Digital City, 12345'
    };
  }

  /**
   * Send internal notifications
   */
  async sendInternalNotifications(breach, response) {
    const recipients = [
      this.defaultRecipients.dpo,
      this.defaultRecipients.security,
      this.defaultRecipients.legal
    ];

    // In production, this would use actual email/SMS services
    console.log(`INTERNAL_NOTIFICATION: Breach ${breach.breachId} - Severity: ${breach.riskAssessment.severity}`);
    console.log(`Recipients: ${recipients.join(', ')}`);
  }

  // Additional helper methods would be implemented here
  assessConsequences(riskAssessment) { /* implementation */ }
  recommendProtectiveMeasures(riskAssessment) { /* implementation */ }
  generateIndividualSummary(breach) { /* implementation */ }
  explainRisks(riskAssessment) { /* implementation */ }
  provideNextSteps() { /* implementation */ }
  determineCommunicationUrgency(riskAssessment) { /* implementation */ }
  generateTimeline(breach) { /* implementation */ }
  assessRegulatoryImplications(riskAssessment) { /* implementation */ }
  assessComplianceStatus(breach) { /* implementation */ }
}

// Export singleton instance
const breachNotificationService = new BreachNotificationService();
module.exports = breachNotificationService;