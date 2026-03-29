import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { calculateProcessingFee } from "@/lib/fees";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ giftId: string }> },
) {
  try {
    const { giftId } = await params;

    const gift = await db.query.gifts.findFirst({
      where: eq(gifts.id, giftId),
      columns: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        amount: true,
        currency: true,
        message: true,
        senderName: true,
        hideAmount: true,
        hideSender: true,
        unlockDatetime: true,
        linkExpiresAt: true,
        isAnonymous: true,
      },
      with: {
        recipient: { columns: { id: true, name: true, email: true } },
        sender: { columns: { name: true } },
      },
    });

    if (!gift) {
      return NextResponse.json(
        { success: false, error: "Gift not found" },
        { status: 404 },
      );
    }

    if (gift.linkExpiresAt && new Date(gift.linkExpiresAt) < new Date()) {
      return NextResponse.json(
        { success: false, error: "This gift link has expired" },
        { status: 410 },
      );
    }

    if (gift.status !== "pending_review") {
      return NextResponse.json(
        { success: false, error: "Gift is not in pending_review status" },
        { status: 400 },
      );
    }

    const processingFee = calculateProcessingFee(gift.amount);
    const totalAmount = gift.amount + processingFee;

    return NextResponse.json(
      {
        success: true,
        data: {
          recipient: {
            id: gift.recipient?.id,
            name: gift.recipient?.name,
            email: gift.recipient?.email,
          },
          amount: gift.amount,
          currency: gift.currency,
          processingFee,
          totalAmount,
          privacySettings: {
            hideAmount: gift.hideAmount,
            hideSender: gift.hideSender,
          },
          unlockDatetime: gift.unlockDatetime ? gift.unlockDatetime.toISOString() : null,
          message: gift.message,
          senderName: gift.sender?.name ?? gift.senderName ?? null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching gift summary:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
