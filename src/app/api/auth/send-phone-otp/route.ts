import { NextRequest, NextResponse } from "next/server";
import { sendOTP } from "@/server/services/otpService";
import { isRateLimited } from "@/lib/rate-limiter";
import { validateE164PhoneNumber } from "@/lib/validation";

const OTP_RATE_LIMIT = 3; // 3 requests per hour per phone number
const OTP_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: NextRequest) {
  try {
    // CSRF Protection: Basic Origin Check
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && !origin.includes(host)) {
      return NextResponse.json(
        { success: false, error: "CSRF protection: Invalid origin" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Validate phone number format
    if (!validateE164PhoneNumber(phoneNumber)) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Invalid phone number format. Please use E.164 format (e.g., +2348123456789)" 
        },
        { status: 400 }
      );
    }

    // Rate limiting: 3 OTP requests per hour per phone number
    if (isRateLimited(`otp:${phoneNumber}`, OTP_RATE_LIMIT, OTP_RATE_WINDOW_MS)) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many OTP requests. Please try again later.",
        },
        { status: 429 }
      );
    }

    // Send OTP via SMS
    const result = await sendOTP(phoneNumber);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, message: result.message },
      { status: 200 }
    );
  } catch (error) {
    console.error("[SEND_PHONE_OTP_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
