import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gifts, wallets } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { notifyGiftCompleted } from "@/server/services/notificationService";
import crypto from "crypto";

export async function POST(
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

    // Fetch the gift with sender info
    const gift = await db.query.gifts.findFirst({
      where: eq(gifts.id, giftId),
      with: {
        sender: { columns: { id: true, email: true, name: true } },
        recipient: { columns: { id: true, email: true, name: true } },
      },
    });

    if (!gift) {
      return NextResponse.json(
        { success: false, error: "Gift not found" },
        { status: 404 },
      );
    }

    // Ensure the requester is the sender (also rejects public gifts with null senderId)
    if (!gift.senderId || gift.senderId !== userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    // Idempotency: already completed
    if (gift.status === "completed") {
      return NextResponse.json(
        {
          success: false,
          error: "Gift has already been confirmed",
          transactionId: gift.transactionId,
        },
        { status: 409 },
      );
    }

    // Must be otp_verified to proceed
    if (gift.status !== "otp_verified") {
      return NextResponse.json(
        {
          success: false,
          error: `Gift must be OTP-verified before confirmation. Current status: ${gift.status}`,
        },
        { status: 400 },
      );
    }

    // Check sender wallet balance
    const senderWallet = await db.query.wallets.findFirst({
      where: and(
        eq(wallets.userId, gift.senderId),
        eq(wallets.currency, gift.currency),
      ),
    });

    if (!senderWallet || senderWallet.balance < gift.amount) {
      return NextResponse.json(
        { success: false, error: "Insufficient funds" },
        { status: 402 },
      );
    }

    // Generate a unique transaction ID
    const transactionId = `txn_${crypto.randomUUID()}`;

    // Atomic transaction: debit sender, credit recipient, update gift status
    await db.transaction(async (tx) => {
      // Debit sender wallet
      await tx
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} - ${gift.amount}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(wallets.userId, gift.senderId!),
            eq(wallets.currency, gift.currency),
          ),
        );

      // Credit recipient wallet (upsert in case wallet doesn't exist yet)
      await tx
        .insert(wallets)
        .values({
          userId: gift.recipientId,
          currency: gift.currency,
          balance: gift.amount,
        })
        .onConflictDoUpdate({
          target: [wallets.userId, wallets.currency],
          set: {
            balance: sql`${wallets.balance} + ${gift.amount}`,
            updatedAt: new Date(),
          },
        });

      // Update gift status to completed
      await tx
        .update(gifts)
        .set({ status: "completed", transactionId })
        .where(eq(gifts.id, giftId));
    });

    // Send notifications to both parties (non-blocking)
    notifyGiftCompleted(
      gift.senderId,
      gift.recipientId,
      gift.amount,
      gift.currency,
      transactionId,
    ).catch((err) => {
      console.error("Failed to send gift completion notifications:", err);
    });

    const shareLink = `/g/${gift.slug}`;

    return NextResponse.json(
      {
        success: true,
        status: "completed",
        transactionId,
        shareLink,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error confirming gift:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
