import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { comparePassword } from "@/lib/auth";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  COOKIE_OPTIONS,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
} from "@/lib/cookies";
import { db } from "@/lib/db";
import { refreshTokens, users } from "@/lib/db/schema";
import { generateAccessToken, generateRefreshToken, UserRole } from "@/lib/tokens";
import { sanitizeInput, validateEmail } from "@/lib/validation";

const FAILED_ATTEMPT_LIMIT = 5;
const FAILED_ATTEMPT_WINDOW_MS = 60 * 1000;

type FailedAttemptState = {
  count: number;
  windowStartMs: number;
};

const failedAttemptsByIp = new Map<string, FailedAttemptState>();

const getClientIp = (request: NextRequest): string => {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1"
  );
};

const isIpRateLimited = (ip: string): boolean => {
  const now = Date.now();
  const attemptState = failedAttemptsByIp.get(ip);

  if (!attemptState) {
    return false;
  }

  if (now - attemptState.windowStartMs >= FAILED_ATTEMPT_WINDOW_MS) {
    failedAttemptsByIp.delete(ip);
    return false;
  }

  return attemptState.count >= FAILED_ATTEMPT_LIMIT;
};

const registerFailedAttempt = (ip: string): void => {
  const now = Date.now();
  const attemptState = failedAttemptsByIp.get(ip);

  if (
    !attemptState ||
    now - attemptState.windowStartMs >= FAILED_ATTEMPT_WINDOW_MS
  ) {
    failedAttemptsByIp.set(ip, { count: 1, windowStartMs: now });
    return;
  }

  failedAttemptsByIp.set(ip, {
    count: attemptState.count + 1,
    windowStartMs: attemptState.windowStartMs,
  });
};

const clearFailedAttempts = (ip: string): void => {
  failedAttemptsByIp.delete(ip);
};

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    if (isIpRateLimited(ip)) {
      return NextResponse.json(
        {
          error:
            "Too many failed login attempts. Please try again in 1 minute.",
        },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    const sanitizedEmail = sanitizeInput(String(email)).toLowerCase();
    if (!validateEmail(sanitizedEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 },
      );
    }

    const userRows = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        role: users.role,
      })
      .from(users)
      .where(eq(users.email, sanitizedEmail))
      .limit(1);

    const user = userRows[0];

    if (!user) {
      registerFailedAttempt(ip);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const isPasswordValid = await comparePassword(
      String(password),
      user.passwordHash,
    );

    if (!isPasswordValid) {
      registerFailedAttempt(ip);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    clearFailedAttempts(ip);

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
    };
    const accessToken = await generateAccessToken(payload);
    const refreshToken = await generateRefreshToken(payload);

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          lastLogin: new Date(),
          loginAttempts: 0,
          lockUntil: null,
        })
        .where(eq(users.id, user.id));

      await tx.insert(refreshTokens).values({
        id: crypto.randomUUID(),
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deviceInfo: request.headers.get("user-agent"),
      });
    });

    const response = NextResponse.json(
      {
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      { status: 200 },
    );

    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });

    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error("[LOGIN_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
