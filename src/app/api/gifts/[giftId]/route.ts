import { db } from "@/lib/db";
import { gifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

const REVIEWABLE_GIFT_STATUSES = new Set(["PENDING", "FUNDED"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ giftId: string }> },
) {
  try {
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { giftId } = await params;

    const gift = await db.query.gifts.findFirst({
      where: eq(gifts.id, giftId),
      with: {
        recipient: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!gift) {
      return NextResponse.json(
        { success: false, error: "Gift not found" },
        { status: 404 },
      );
    }

    if (gift.senderId !== userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    if (!REVIEWABLE_GIFT_STATUSES.has(gift.status)) {
      return NextResponse.json(
        { success: false, error: "Gift not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: gift.id,
          recipient: gift.recipient,
          amount: gift.amount,
          currency: gift.currency,
          message: gift.message,
          template: gift.template,
          status: gift.status,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching gift details:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
