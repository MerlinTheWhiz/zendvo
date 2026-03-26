import { db } from "@/lib/db";
import { gifts } from "@/lib/db/schema";
import { verifyGiftOTP } from "@/server/services/otpService";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { giftId, otp } = body;

    if (!giftId || !otp) {
      return NextResponse.json(
        { success: false, error: "giftId and otp are required" },
        { status: 400 },
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: "Invalid OTP format. Must be 6 digits." },
        { status: 400 },
      );
    }

    const gift = await db.query.gifts.findFirst({
      where: eq(gifts.id, giftId),
    });

    if (!gift) {
      return NextResponse.json(
        { success: false, error: "Gift not found" },
        { status: 404 },
      );
    }

    if (gift.senderId !== userId) {
      return NextResponse.json(
        { success: false, error: "You are not authorized to verify this gift" },
        { status: 403 },
      );
    }

    if (gift.status !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          error: "This gift has already been verified or is no longer pending",
        },
        { status: 400 },
      );
    }

    const result = await verifyGiftOTP(gift, otp);

    if (!result.success) {
      const statusCode = result.locked ? 423 : 400;

      return NextResponse.json(
        {
          success: false,
          error: result.message,
          remainingAttempts: result.remainingAttempts,
        },
        { status: statusCode },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        data: {
          giftId: gift.id,
          status: "FUNDED",
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GIFT_VERIFY_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
