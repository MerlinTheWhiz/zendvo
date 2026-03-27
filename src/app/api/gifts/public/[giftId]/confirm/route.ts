import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { processGiftTransaction } from "@/server/services/transactionService";
import { notifyGiftConfirmed } from "@/server/services/notificationService";
import {
  sendGiftCompletionToSender,
  sendGiftNotificationToRecipient,
} from "@/server/services/emailService";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ giftId: string }> },
) {
  try {
    const { giftId } = await params;

    const gift = await db.query.gifts.findFirst({
      where: eq(gifts.id, giftId),
      with: {
        sender: { columns: { id: true, name: true, email: true } },
        recipient: { columns: { id: true, name: true, email: true } },
      },
    });

    if (!gift) {
      return NextResponse.json(
        { success: false, error: "Gift not found" },
        { status: 404 },
      );
    }

    if (gift.status !== "pending_review") {
      if (gift.status === "completed") {
        return NextResponse.json(
          {
            success: false,
            error: "Gift has already been confirmed",
            status: gift.status,
          },
          { status: 409 },
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: `Gift cannot be confirmed. Current status: ${gift.status}. Expected: pending_review`,
          status: gift.status,
        },
        { status: 400 },
      );
    }

    const shareLink = `/g/${gift.slug}`;

    const transactionId = await processGiftTransaction({
      senderId: gift.senderId,
      recipientId: gift.recipientId,
      amount: gift.amount,
      currency: gift.currency,
    });

    await db
      .update(gifts)
      .set({
        status: "completed",
        transactionId,
        updatedAt: new Date(),
      })
      .where(eq(gifts.id, giftId));

    notifyGiftConfirmed(
      gift.senderId,
      gift.recipientId,
      gift.amount,
      gift.currency,
      shareLink,
      gift.unlockDatetime ?? undefined,
    ).catch((err: unknown) => {
      console.error("[GIFT_CONFIRM_NOTIFICATION_ERROR]", err);
    });

    if (gift.senderId && gift.sender) {
      sendGiftCompletionToSender(
        gift.sender.email,
        gift.sender.name || "Valued Sender",
        shareLink,
        gift.amount,
        gift.currency,
        gift.recipient?.name || "Gift Recipient",
      ).catch((err: unknown) =>
        console.error("[GIFT_CONFIRM_SENDER_EMAIL_ERROR]", err),
      );
    } else if (gift.senderEmail && gift.senderName) {
      sendGiftCompletionToSender(
        gift.senderEmail,
        gift.senderName,
        shareLink,
        gift.amount,
        gift.currency,
        gift.recipient?.name || "Gift Recipient",
      ).catch((err: unknown) =>
        console.error("[GIFT_CONFIRM_PUBLIC_SENDER_EMAIL_ERROR]", err),
      );
    }

    if (gift.recipient) {
      sendGiftNotificationToRecipient(
        gift.recipient.email,
        gift.recipient.name || "Valued Recipient",
        gift.senderName || (gift.sender?.name ?? "Someone"),
        gift.amount,
        gift.currency,
        gift.unlockDatetime ?? undefined,
      ).catch((err: unknown) =>
        console.error("[GIFT_CONFIRM_RECIPIENT_EMAIL_ERROR]", err),
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: "completed",
        shareLink,
        transactionId,
        message: "Gift confirmed successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GIFT_CONFIRM_ERROR]", error);
    if (
      error instanceof Error &&
      error.message.includes("Insufficient balance")
    ) {
      return NextResponse.json(
        { success: false, error: "Insufficient balance to send gift" },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
