import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  validateEmail,
  validatePassword,
  sanitizeInput,
  sanitizePhoneNumber,
  validateE164PhoneNumber,
} from "@/lib/validation";
import { isRateLimited } from "@/lib/rate-limiter";
import { createUser, findUserByEmail, findUserByPhoneNumber } from "@/server/db/authRepository";
import { generateOTP, storeOTP } from "@/server/services/otpService";
import { sendVerificationEmail } from "@/server/services/emailService";

const BCRYPT_COST = 12;

export async function POST(request: NextRequest) {
  try {
    // 1. Validate Content-Type
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Content-Type. Expected application/json",
        },
        { status: 400 },
      );
    }

    // 1.5. Request Body Size Limit (10KB)
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 10240) {
      return NextResponse.json(
        { success: false, error: "Request body too large" },
        { status: 413 },
      );
    }

    // 1.6. CSRF Protection (Basic Origin Validation)
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && !origin.includes(host)) {
      return NextResponse.json(
        { success: false, error: "CSRF protection: Invalid origin" },
        { status: 403 },
      );
    }

    // 2. Rate Limiting (max 5 registration attempts per IP per hour)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many registration attempts. Please try again later.",
        },
        { status: 429 },
      );
    }

    // 3. Parse Request Body
    const body = await request.json();
    const { email, password, name, phoneNumber } = body;

    // 4. Validate Missing Fields
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 },
      );
    }

    const sanitizedEmail = sanitizeInput(email);
    let sanitizedPhoneNumber: string | null = null;

    // Validate and sanitize phone number if provided
    if (phoneNumber) {
      if (!validateE164PhoneNumber(phoneNumber)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid phone number format. Please use E.164 format (e.g., +2348123456789)",
          },
          { status: 400 },
        );
      }
      sanitizedPhoneNumber = sanitizePhoneNumber(phoneNumber);
    }

    // 5. Validate Email Format
    if (!validateEmail(sanitizedEmail)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 },
      );
    }

    // 6. Validate Password Strength
    if (!validatePassword(password)) {
      return NextResponse.json(
        {
          success: false,
          error: "Password too weak",
          details: {
            message:
              "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
          },
        },
        { status: 400 },
      );
    }

    // 7. Check for Duplicate Email
    const existingUser = await findUserByEmail(sanitizedEmail);

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Email already registered" },
        { status: 409 },
      );
    }

    // 8. Check for Duplicate Phone Number (if provided)
    if (sanitizedPhoneNumber) {
      const existingUserByPhone = await findUserByPhoneNumber(sanitizedPhoneNumber);
      if (existingUserByPhone) {
        return NextResponse.json(
          { success: false, error: "Phone number already registered" },
          { status: 409 },
        );
      }
    }

    // 9. Hash Password
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    // 10. Create User Record
    try {
      const user = await createUser({
        email: sanitizedEmail,
        passwordHash,
        name: name ? sanitizeInput(name) : null,
        phoneNumber: sanitizedPhoneNumber,
      });

      // Initiate email verification flow immediately after registration.
      const otp = generateOTP();
      await storeOTP(user.id, otp);

      const emailResult = await sendVerificationEmail(
        user.email,
        otp,
        user.name ?? undefined,
      );

      if (!emailResult.success) {
        console.error("[REGISTER_VERIFICATION_EMAIL_ERROR]", emailResult.error);
      }

      // 11. Return Success Response
      return NextResponse.json(
        {
          success: true,
          message: "User registered successfully",
          data: {
            userId: user.id,
            email: user.email,
            phoneNumber: user.phoneNumber,
            verificationInitiated: true,
          },
        },
        { status: 201 },
      );
    } catch (error: any) {
      // Handle PostgreSQL unique violation (error code 23505)
      if (error.code === '23505') {
        console.error("[UNIQUE_VIOLATION]", error);

        // Check which constraint was violated
        if (error.detail?.includes('email')) {
          return NextResponse.json(
            { success: false, error: "Email already registered" },
            { status: 409 },
          );
        } else if (error.detail?.includes('phone_number')) {
          return NextResponse.json(
            { success: false, error: "Phone number already registered" },
            { status: 409 },
          );
        } else if (error.detail?.includes('username')) {
          return NextResponse.json(
            { success: false, error: "Username already taken" },
            { status: 409 },
          );
        }

        return NextResponse.json(
          { success: false, error: "Account already exists with provided information" },
          { status: 409 },
        );
      }

      // Re-throw other errors to be caught by outer catch block
      throw error;
    }
  } catch (error) {
    console.error("[REGISTER_ERROR]", error);

    // Handle specific Prisma errors (e.g. database connection issues)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
