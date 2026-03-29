import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@/lib/db";
import { users, emailVerifications, gifts } from "@/lib/db/schema";
import { eq, and, desc, lt, or, gt, sql } from "drizzle-orm";
import { validateE164PhoneNumber, sanitizePhoneNumber } from "@/lib/validation";
import {
  AuditEventType,
  logGiftOTPEvent,
  logOTPEvent,
} from "@/server/services/auditService";

export const MAX_OTP_REQUESTS_PER_PHONE = 4;
export const OTP_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export interface OTPRateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  retryAfterMs: number;
  message?: string;
}

export async function checkOTPRequestRateLimit(
  phoneNumber: string,
): Promise<OTPRateLimitResult> {
  const windowStart = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_MS);

  const user = await db.query.users.findFirst({
    where: eq(users.phoneNumber, phoneNumber),
    columns: { id: true },
  });

  if (!user) {
    return {
      allowed: true,
      remainingRequests: MAX_OTP_REQUESTS_PER_PHONE,
      retryAfterMs: 0,
    };
  }

  const recentOTPs = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.userId, user.id),
        gt(emailVerifications.createdAt, windowStart),
      ),
    );

  const otpCount = recentOTPs[0]?.count ?? 0;

  if (otpCount >= MAX_OTP_REQUESTS_PER_PHONE) {
    const oldestOTP = await db.query.emailVerifications.findFirst({
      where: and(
        eq(emailVerifications.userId, user.id),
        gt(emailVerifications.createdAt, windowStart),
      ),
      orderBy: [emailVerifications.createdAt],
      columns: { createdAt: true },
    });

    const retryAfterMs = oldestOTP
      ? Math.max(
          0,
          OTP_RATE_LIMIT_WINDOW_MS -
            (Date.now() - new Date(oldestOTP.createdAt).getTime()),
        )
      : OTP_RATE_LIMIT_WINDOW_MS;

    return {
      allowed: false,
      remainingRequests: 0,
      retryAfterMs,
      message: `Too many OTP requests. Please wait ${Math.ceil(retryAfterMs / 60000)} minutes before requesting a new code.`,
    };
  }

  return {
    allowed: true,
    remainingRequests: MAX_OTP_REQUESTS_PER_PHONE - otpCount - 1,
    retryAfterMs: 0,
  };
}

export async function checkOTPRequestRateLimitByUserId(
  userId: string,
): Promise<OTPRateLimitResult> {
  const windowStart = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_MS);

  const recentOTPs = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.userId, userId),
        gt(emailVerifications.createdAt, windowStart),
      ),
    );

  const otpCount = recentOTPs[0]?.count ?? 0;

  if (otpCount >= MAX_OTP_REQUESTS_PER_PHONE) {
    const oldestOTP = await db.query.emailVerifications.findFirst({
      where: and(
        eq(emailVerifications.userId, userId),
        gt(emailVerifications.createdAt, windowStart),
      ),
      orderBy: [emailVerifications.createdAt],
      columns: { createdAt: true },
    });

    const retryAfterMs = oldestOTP
      ? Math.max(
          0,
          OTP_RATE_LIMIT_WINDOW_MS -
            (Date.now() - new Date(oldestOTP.createdAt).getTime()),
        )
      : OTP_RATE_LIMIT_WINDOW_MS;

    return {
      allowed: false,
      remainingRequests: 0,
      retryAfterMs,
      message: `Too many OTP requests. Please wait ${Math.ceil(retryAfterMs / 60000)} minutes before requesting a new code.`,
    };
  }

  return {
    allowed: true,
    remainingRequests: MAX_OTP_REQUESTS_PER_PHONE - otpCount - 1,
    retryAfterMs: 0,
  };
}

export function generateOTP(): string {
  // CSPRNG compliant
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Generates a SHA-256 hash of the OTP with a unique salt.
 */
export function hashOTP(otp: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHmac("sha256", salt).update(otp).digest("hex");
  return { salt, hash };
}

/**
 * Verifies an OTP against a stored hash and salt using constant-time comparison.
 */
export function verifyOTPHash(
  otp: string,
  storedHash: string,
  salt: string,
): boolean {
  const hash = crypto.createHmac("sha256", salt).update(otp).digest("hex");

  if (hash.length !== storedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}

export async function sendOTP(phoneNumber: string): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    // Validate and sanitize phone number
    if (!validateE164PhoneNumber(phoneNumber)) {
      return {
        success: false,
        message: "Invalid phone number format. Please use E.164 format (e.g., +2348123456789)",
        error: "INVALID_PHONE_FORMAT"
      };
    }

    const sanitizedPhone = sanitizePhoneNumber(phoneNumber);

    // Find user by phone number
    const user = await db.query.users.findFirst({
      where: eq(users.phoneNumber, sanitizedPhone),
    });

    if (!user) {
      return {
        success: false,
        message: "User not found with this phone number",
        error: "USER_NOT_FOUND"
      };
    }

    if (user.status === "suspended") {
      return {
        success: false,
        message: "Account suspended",
        error: "ACCOUNT_SUSPENDED"
      };
    }

    // Generate and store OTP
    const otp = generateOTP();
    await storeOTP(user.id, otp);

    // TODO: Integrate with SMS provider (e.g., Twilio, AWS SNS)
    // For now, we'll log the OTP (in production, this should send via SMS)
    console.log(`[SMS_OTP] Phone: ${sanitizedPhone}, OTP: ${otp}`);

    // Mock SMS sending - replace with actual SMS provider integration
    const smsResult = await sendSMSViaProvider(sanitizedPhone, `Your Zendvo verification code is: ${otp}. Valid for 10 minutes.`);

    if (!smsResult.success) {
      console.error("Failed to send OTP SMS:", smsResult.error);
      return {
        success: false,
        message: "Failed to send OTP SMS",
        error: "SMS_SEND_FAILED"
      };
    }

    console.log(`[AUDIT] SMS OTP sent to ${sanitizedPhone} for user ${user.id}`);

    return {
      success: true,
      message: "OTP sent successfully via SMS"
    };

  } catch (error) {
    console.error("[SEND_PHONE_OTP_ERROR]", error);
    return {
      success: false,
      message: "Internal server error",
      error: "INTERNAL_ERROR"
    };
  }
}


async function sendSMSViaProvider(phoneNumber: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    // For now, simulate successful SMS sending
    console.log(`[MOCK_SMS] To: ${phoneNumber}, Message: ${message}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown SMS error" };
  }
}

export async function storeOTP(userId: string, otp: string) {
  const { salt, hash } = hashOTP(otp);
  const storedValue = `${salt}:${hash}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Invalidate previous unused OTPs
  await db
    .update(emailVerifications)
    .set({ isUsed: true })
    .where(
      and(
        eq(emailVerifications.userId, userId),
        eq(emailVerifications.isUsed, false),
      ),
    );

  logOTPEvent(AuditEventType.OTP_GENERATED, userId);

  const [newVerification] = await db
    .insert(emailVerifications)
    .values({
      userId,
      otpHash: storedValue,
      expiresAt,
      attempts: 0,
      isUsed: false,
    })
    .returning();

  await db
    .update(users)
    .set({ lastOtpSentAt: new Date() })
    .where(eq(users.id, userId));

  return newVerification;
}

export async function verifyOTP(userId: string, otp: string) {
  const verification = await db.query.emailVerifications.findFirst({
    where: and(
      eq(emailVerifications.userId, userId),
      eq(emailVerifications.isUsed, false),
    ),
    orderBy: [desc(emailVerifications.createdAt)],
  });

  if (!verification) {
    return {
      success: false,
      message: "No verification code found. Please request a new one.",
    };
  }

  if (new Date() > verification.expiresAt) {
    return {
      success: false,
      message: "Verification code has expired. Please request a new one.",
    };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (user && user.lockUntil && new Date() < user.lockUntil) {
    return {
      success: false,
      message: "Account is temporarily locked. Please try again later.",
      locked: true,
    };
  }

  if (verification.attempts >= 5) {
    return {
      success: false,
      message: "Maximum attempts exceeded. Account is locked.",
      locked: true,
    };
  }

  let isValid = false;
  const storedHash = verification.otpHash;

  if (storedHash.includes(":")) {
    const [salt, hash] = storedHash.split(":");
    isValid = verifyOTPHash(otp, hash, salt);
  } else {
    isValid = await bcrypt.compare(otp, storedHash);
  }

  if (!isValid) {
    const newAttempts = verification.attempts + 1;

    await db
      .update(emailVerifications)
      .set({ attempts: newAttempts })
      .where(eq(emailVerifications.id, verification.id));

    // Track cumulative failures for wide window lock
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    let cumulativeFailures = (user?.otpFailedAttempts || 0) + 1;
    let windowStart = user?.otpAttemptsWindowStart;

    // Reset window if it's been more than 1 hour
    if (!windowStart || windowStart < oneHourAgo) {
      cumulativeFailures = 1;
      windowStart = now;
    }

    // Update cumulative failure tracking
    await db
      .update(users)
      .set({
        otpFailedAttempts: cumulativeFailures,
        otpAttemptsWindowStart: windowStart,
      })
      .where(eq(users.id, userId));

    logOTPEvent(AuditEventType.OTP_VERIFIED_FAILED, userId, {
      attemptNumber: newAttempts,
      cumulativeFailures,
      remainingAttempts: 5 - newAttempts,
    });

    // Check for 10 attempts in 1 hour (wide window lock)
    if (cumulativeFailures >= 10) {
      const lockUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      await db
        .update(users)
        .set({
          lockUntil,
          otpFailedAttempts: 0,
          otpAttemptsWindowStart: null,
        })
        .where(eq(users.id, userId));

      logOTPEvent(AuditEventType.ACCOUNT_LOCKED_10_ATTEMPTS, userId, {
        lockDuration: "24 hours",
        cumulativeFailures,
        reason: "10 failed OTP attempts within 1 hour",
      });

      return {
        success: false,
        message:
          "Account locked for 24 hours due to repeated failed attempts. Please contact support if you need assistance.",
        locked: true,
        shouldSendAlert: true,
        lockDuration: "24 hours",
      };
    }

    // Check for 5 attempts on current OTP (narrow window lock)
    if (newAttempts >= 5) {
      const lockUntil = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes
      await db.update(users).set({ lockUntil }).where(eq(users.id, userId));

      logOTPEvent(AuditEventType.ACCOUNT_LOCKED_5_ATTEMPTS, userId, {
        lockDuration: "30 minutes",
        attemptNumber: newAttempts,
        reason: "5 failed attempts on current OTP",
      });

      return {
        success: false,
        message: "Maximum attempts exceeded. Account locked for 30 minutes.",
        locked: true,
        shouldSendAlert: true,
        lockDuration: "30 minutes",
      };
    }

    const remainingAttempts = 5 - newAttempts;
    return {
      success: false,
      message: `Invalid verification code. ${remainingAttempts} attempts remaining.`,
      remainingAttempts,
    };
  }

  // Success path
  await db
    .delete(emailVerifications)
    .where(eq(emailVerifications.id, verification.id));

  await db
    .update(users)
    .set({
      status: "active",
      lockUntil: null,
      loginAttempts: 0,
      otpFailedAttempts: 0,
      otpAttemptsWindowStart: null,
      isPhoneVerified: true,
    })
    .where(eq(users.id, userId));

  logOTPEvent(AuditEventType.OTP_VERIFIED_SUCCESS, userId);

  return { success: true, message: "Email verified successfully!" };
}

export async function cleanupExpiredOTPs(): Promise<number> {
  const result = await db
    .delete(emailVerifications)
    .where(lt(emailVerifications.expiresAt, new Date()))
    .returning();
  return result.length;
}

export async function storeGiftOTP(giftId: string, otp: string) {
  const saltRounds = 10;
  const otpHash = await bcrypt.hash(otp, saltRounds);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  return await db
    .update(gifts)
    .set({
      otpHash,
      otpExpiresAt: expiresAt,
      otpAttempts: 0,
    })
    .where(eq(gifts.id, giftId))
    .returning();
}

const MAX_GIFT_OTP_ATTEMPTS = 5;

export async function verifyGiftOTP(
  gift: {
    id: string;
    otpHash: string | null;
    otpExpiresAt: Date | null;
    otpAttempts: number;
  },
  otp: string,
) {
  if (!gift.otpHash || !gift.otpExpiresAt) {
    return {
      success: false,
      message: "No verification code found for this gift.",
    };
  }

  if (gift.otpAttempts >= MAX_GIFT_OTP_ATTEMPTS) {
    logGiftOTPEvent(AuditEventType.GIFT_OTP_LOCKED, gift.id, {
      attempts: gift.otpAttempts,
    });

    return {
      success: false,
      message: "Maximum attempts exceeded. This gift has been locked.",
      locked: true,
    };
  }

  if (new Date() > gift.otpExpiresAt) {
    return {
      success: false,
      message: "Verification code has expired. Please request a new one.",
    };
  }

  const isValid = await bcrypt.compare(otp, gift.otpHash);

  if (!isValid) {
    const newAttempts = gift.otpAttempts + 1;

    await db
      .update(gifts)
      .set({ otpAttempts: newAttempts })
      .where(eq(gifts.id, gift.id));

    logGiftOTPEvent(AuditEventType.GIFT_OTP_FAILED, gift.id, {
      attemptNumber: newAttempts,
      remainingAttempts: MAX_GIFT_OTP_ATTEMPTS - newAttempts,
    });

    const remainingAttempts = MAX_GIFT_OTP_ATTEMPTS - newAttempts;

    if (remainingAttempts <= 0) {
      logGiftOTPEvent(AuditEventType.GIFT_OTP_LOCKED, gift.id, {
        attempts: newAttempts,
        reason: "Maximum attempts exceeded",
      });
    }

    return {
      success: false,
      message: `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining.`,
      remainingAttempts,
      locked: remainingAttempts <= 0,
    };
  }

  await db
    .update(gifts)
    .set({
      status: "otp_verified",
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
    })
    .where(eq(gifts.id, gift.id));

  return { success: true, message: "Gift OTP verified successfully!" };
}
