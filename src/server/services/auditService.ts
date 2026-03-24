/**
 * Security Audit Logging Service
 * Logs security-related events for monitoring and compliance
 */

export enum AuditEventType {
  OTP_GENERATED = "OTP_GENERATED",
  OTP_VERIFIED_SUCCESS = "OTP_VERIFIED_SUCCESS",
  OTP_VERIFIED_FAILED = "OTP_VERIFIED_FAILED",
  ACCOUNT_LOCKED_5_ATTEMPTS = "ACCOUNT_LOCKED_5_ATTEMPTS",
  ACCOUNT_LOCKED_10_ATTEMPTS = "ACCOUNT_LOCKED_10_ATTEMPTS",
  ACCOUNT_UNLOCKED = "ACCOUNT_UNLOCKED",
  GIFT_OTP_FAILED = "GIFT_OTP_FAILED",
  GIFT_OTP_LOCKED = "GIFT_OTP_LOCKED",
}

interface AuditLogEntry {
  timestamp: Date;
  eventType: AuditEventType;
  userId?: string;
  giftId?: string;
  metadata?: Record<string, unknown>;
  message: string;
}

/**
 * Logs a security audit event
 * In production, this should write to a dedicated audit log system
 * (e.g., CloudWatch, Datadog, Splunk, or a dedicated audit table)
 */
export function logAuditEvent(entry: AuditLogEntry): void {
  const logEntry = {
    ...entry,
    timestamp: entry.timestamp.toISOString(),
  };

  // Console logging for development
  console.log("[SECURITY_AUDIT]", JSON.stringify(logEntry));
}

/**
 * Helper function to log OTP-related security events
 */
export function logOTPEvent(
  eventType: AuditEventType,
  userId: string,
  metadata?: Record<string, unknown>,
): void {
  logAuditEvent({
    timestamp: new Date(),
    eventType,
    userId,
    metadata,
    message: `OTP event: ${eventType} for user ${userId}`,
  });
}

/**
 * Helper function to log gift OTP-related security events
 */
export function logGiftOTPEvent(
  eventType: AuditEventType,
  giftId: string,
  metadata?: Record<string, unknown>,
): void {
  logAuditEvent({
    timestamp: new Date(),
    eventType,
    giftId,
    metadata,
    message: `Gift OTP event: ${eventType} for gift ${giftId}`,
  });
}
