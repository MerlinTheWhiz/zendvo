import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, emailVerifications } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthPayload } from "@/lib/auth-session";
import {
  generateOTP,
  storeOTP,
  checkOTPRequestRateLimitByUserId,
} from "@/server/services/otpService";
import { sendVerificationEmail } from "@/server/services/emailService";

const RESEND_COOLDOWN_MS = 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    if (user.status === "active") {
      console.log(
        `[AUTH_AUDIT] OTP resend requested for verified user: ${user.id} from IP: ${
          request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1"
        }`,
      );
      return NextResponse.json(
        { success: true, message: "Email already verified" },
        { status: 200 },
      );
    }

    const latestVerification = await db.query.emailVerifications.findFirst({
      where: eq(emailVerifications.userId, user.id),
      orderBy: [desc(emailVerifications.createdAt)],
      columns: { createdAt: true },
    });

    const now = Date.now();
    if (
      latestVerification &&
      now - new Date(latestVerification.createdAt).getTime() <
        RESEND_COOLDOWN_MS
    ) {
      const retryAfterSeconds = Math.ceil(
        (RESEND_COOLDOWN_MS -
          (now - new Date(latestVerification.createdAt).getTime())) /
          1000,
      );

      console.log(
        `[AUTH_AUDIT] OTP resend rate limited for user: ${user.id} from IP: ${
          request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1"
        }`,
      );

      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
          message: "Please wait before requesting a new verification code.",
          retryAfter: retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    // Rate limiting: max 4 OTPs per 10 minutes per user
    const rateLimitResult = await checkOTPRequestRateLimitByUserId(user.id);
    if (!rateLimitResult.allowed) {
      console.log(
        `[AUTH_AUDIT] OTP rate limited for user: ${user.id} from IP: ${
          request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1"
        }`,
      );
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
          message: rateLimitResult.message,
          retryAfter: Math.ceil(rateLimitResult.retryAfterMs / 1000),
        },
        { status: 429 },
      );
    }

    const otp = generateOTP();
    await storeOTP(user.id, otp);

    const emailResult = await sendVerificationEmail(
      user.email,
      otp,
      user.name || undefined,
    );

    if (!emailResult.success) {
      console.error(
        `[AUTH_AUDIT] OTP resend email failed for user: ${user.id}`,
        emailResult.error,
      );
    }

    console.log(
      `[AUTH_AUDIT] OTP resent for user: ${user.id} from IP: ${
        request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1"
      }`,
    );

    return NextResponse.json({
      success: true,
      message: "New verification code sent successfully",
      expiresIn: "10 minutes",
    });
  } catch (error) {
    console.error("Error in resend-otp:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
