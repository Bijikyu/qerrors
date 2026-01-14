/**
 * Structured Audit Logger
 * Provides comprehensive audit logging for security-sensitive operations
 */

import { randomBytes } from 'crypto';

export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AuditCategory =
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'DATA_ACCESS'
  | 'DATA_MODIFICATION'
  | 'SECURITY_EVENT'
  | 'PAYMENT_OPERATION'
  | 'PERFORMANCE';

export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'ATTEMPT';

export interface AuditEvent {
  timestamp: string;
  severity: AuditSeverity;
  category: AuditCategory;
  action: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  outcome: AuditOutcome;
  details: Record<string, unknown>;
  auditId: string;
}

const SENSITIVE_KEYS = [
  'key', 'token', 'password', 'secret', 'clientSecret',
  'authorization', 'bearer', 'creditCard', 'cardNumber',
  'ssn', 'bankAccount', 'apiKey', 'accessToken', 'refreshToken'
];

const redactSensitiveData = (obj: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactSensitiveData(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
};

const generateAuditId = (): string => {
  const bytes = randomBytes(4);
  return `audit_${Date.now().toString(36)}_${bytes.toString('hex').substring(0, 8)}`;
};

class AuditLogger {
  log(event: Omit<AuditEvent, 'timestamp' | 'auditId'>): void {
    const auditEvent: AuditEvent = {
      timestamp: new Date().toISOString(),
      auditId: generateAuditId(),
      ...event,
      details: redactSensitiveData(event.details),
    };
    console.info('[AUDIT]', JSON.stringify({ type: 'AUDIT_EVENT', auditEvent }));
  }

  logAuth(
    action: string,
    outcome: AuditOutcome,
    userId?: string,
    details: Record<string, unknown> = {}
  ): void {
    this.log({
      severity: outcome === 'FAILURE' ? 'HIGH' : 'MEDIUM',
      category: 'AUTHENTICATION',
      action,
      userId,
      outcome,
      details,
    });
  }

  logDataAccess(
    resource: string,
    action: string,
    userId?: string,
    details: Record<string, unknown> = {}
  ): void {
    this.log({
      severity: 'LOW',
      category: 'DATA_ACCESS',
      action,
      userId,
      resource,
      outcome: 'SUCCESS',
      details,
    });
  }

  logDataModification(
    resource: string,
    action: string,
    outcome: AuditOutcome,
    userId?: string,
    details: Record<string, unknown> = {}
  ): void {
    this.log({
      severity: outcome === 'SUCCESS' ? 'MEDIUM' : 'HIGH',
      category: 'DATA_MODIFICATION',
      action,
      userId,
      resource,
      outcome,
      details,
    });
  }

  logSecurityEvent(
    action: string,
    severity: AuditSeverity,
    details: Record<string, unknown> = {},
    userId?: string
  ): void {
    this.log({
      severity,
      category: 'SECURITY_EVENT',
      action,
      userId,
      outcome: 'ATTEMPT',
      details,
    });
  }

  logPaymentOperation(
    action: string,
    outcome: AuditOutcome,
    userId?: string,
    details: Record<string, unknown> = {}
  ): void {
    this.log({
      severity: outcome === 'FAILURE' ? 'CRITICAL' : 'HIGH',
      category: 'PAYMENT_OPERATION',
      action,
      userId,
      outcome,
      details,
    });
  }

  logPerformance(
    action: string,
    durationMs: number,
    details: Record<string, unknown> = {}
  ): void {
    this.log({
      severity: durationMs > 5000 ? 'HIGH' : durationMs > 1000 ? 'MEDIUM' : 'LOW',
      category: 'PERFORMANCE',
      action,
      outcome: 'SUCCESS',
      details: { ...details, durationMs },
    });
  }

  logAuthorization(
    action: string,
    outcome: AuditOutcome,
    userId?: string,
    resource?: string,
    details: Record<string, unknown> = {}
  ): void {
    this.log({
      severity: outcome === 'FAILURE' ? 'HIGH' : 'MEDIUM',
      category: 'AUTHORIZATION',
      action,
      userId,
      resource,
      outcome,
      details,
    });
  }
}

export const auditLogger = new AuditLogger();

export const logAuth = auditLogger.logAuth.bind(auditLogger);
export const logDataAccess = auditLogger.logDataAccess.bind(auditLogger);
export const logDataModification = auditLogger.logDataModification.bind(auditLogger);
export const logSecurityEvent = auditLogger.logSecurityEvent.bind(auditLogger);
export const logPaymentOperation = auditLogger.logPaymentOperation.bind(auditLogger);
export const logPerformance = auditLogger.logPerformance.bind(auditLogger);
export const logAuthorization = auditLogger.logAuthorization.bind(auditLogger);
