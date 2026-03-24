import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { refreshTokens } from "@/lib/db/schema";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  COOKIE_OPTIONS,
} from "@/lib/cookies";

const ADMIN_ROLES = new Set(["admin", "superadmin"]);

export async function POST(request: NextRequest) {
  try {
    const requesterId = request.headers.get("x-user-id");
    const requesterRole = request.headers.get("x-user-role") ?? "";

    if (!requesterId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawTargetUserId = (body as { userId?: string }).userId;
    const targetUserId =
      typeof rawTargetUserId === "string" && rawTargetUserId.trim().length > 0
        ? rawTargetUserId.trim()
        : requesterId;

    const isSelfTarget = targetUserId === requesterId;
    const isAdmin = ADMIN_ROLES.has(requesterRole.toLowerCase());

    if (!isSelfTarget && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: insufficient permissions to revoke this user",
        },
        { status: 403 },
      );
    }

    const revokedAt = new Date();

    await db
      .update(refreshTokens)
      .set({ revokedAt })
      .where(eq(refreshTokens.userId, targetUserId));

    const response = NextResponse.json(
      {
        success: true,
        message: "Refresh tokens revoked successfully",
        data: { userId: targetUserId, revokedAt: revokedAt.toISOString() },
      },
      { status: 200 },
    );

    if (isSelfTarget) {
      response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
        ...COOKIE_OPTIONS,
        maxAge: 0,
      });
      response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
        ...COOKIE_OPTIONS,
        maxAge: 0,
      });
    }

    return response;
  } catch (error) {
    console.error("[REVOKE_REFRESH_TOKENS_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
