import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { initiateStripeCheckout } from "@/server/services/paymentService";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ giftId: string }> }
) {
  try {
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { giftId } = await params;

    const gift = await db.query.gifts.findFirst({
      where: eq(gifts.id, giftId),
    });

    if (!gift) {
      return NextResponse.json(
        { success: false, error: "Gift not found" },
        { status: 404 }
      );
    }

    if (!gift.senderId || gift.senderId !== userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // Only allow checkout initiation for gifts awaiting payment
    const allowedStatuses = ["otp_verified", "pending_review"];
    if (!allowedStatuses.includes(gift.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot initiate checkout for gift with status: ${gift.status}`,
        },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    const { sessionId, url } = await initiateStripeCheckout({
      giftId,
      amount: gift.amount,
      currency: gift.currency,
      baseUrl,
    });

    return NextResponse.json({ success: true, sessionId, url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
