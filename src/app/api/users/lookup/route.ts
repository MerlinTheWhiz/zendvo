import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isRateLimited } from "@/lib/rate-limiter";
import { normalizePhoneNumber, validatePhoneNumber, sanitizePhoneNumber, validateE164PhoneNumber } from "@/lib/validation";

const LOOKUP_RATE_LIMIT = 20;
const LOOKUP_RATE_WINDOW_MS = 60_000;
const MAX_PHONE_LENGTH = 30;

export async function GET(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    if (
      isRateLimited(`lookup:${ip}`, LOOKUP_RATE_LIMIT, LOOKUP_RATE_WINDOW_MS)
    ) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const phoneParam = request.nextUrl.searchParams.get("phone");

    if (!phoneParam) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 },
      );
    }

    if (!validateE164PhoneNumber(phoneParam)) {
      return NextResponse.json(
        { success: false, error: "Invalid phone number format. Please use E.164 format (e.g., +2348123456789)" },
        { status: 400 },
      );
    }

    const sanitizedPhone = sanitizePhoneNumber(phoneParam);

    const user = await db.query.users.findFirst({
      where: eq(users.phoneNumber, sanitizedPhone),
      columns: {
        name: true,
        username: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          displayName: user.name ?? null,
          username: user.username ?? null,
          avatarUrl: user.avatarUrl ?? null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[USER_LOOKUP_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
