import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, gifts } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import {
  validateAmount,
  validateCurrency,
  validateEmail,
  validateFutureDatetime,
  sanitizeInput,
} from "@/lib/validation";
import { isRateLimited } from "@/lib/rate-limiter";
import { validateHoneypot } from "@/lib/honeypot";
import { generateUniqueSlug } from "@/lib/slug";

const MAX_MESSAGE_LENGTH = 500;

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";
    if (isRateLimited(ip, 10, 60_000)) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const body = await request.json();

    if (!validateHoneypot(body)) {
      console.warn("[PUBLIC_GIFT] Honeypot triggered, rejecting bot request");
      return NextResponse.json(
        {
          success: true,
          data: { giftId: crypto.randomUUID(), status: "pending_review" },
        },
        { status: 201 },
      );
    }

    const {
      recipientId,
      amount,
      currency = "USDC",
      unlockDatetime,
      hideAmount,
      message,
      senderName,
      senderEmail,
      senderAvatar,
    } = body;

    if (!recipientId || !amount || !senderName || !senderEmail) {
      return NextResponse.json(
        {
          success: false,
          error:
            "recipientId, amount, senderName, and senderEmail are required",
        },
        { status: 400 },
      );
    }

    if (typeof amount !== "number" || !validateAmount(amount)) {
      return NextResponse.json(
        {
          success: false,
          error: "Amount must be a positive number not exceeding 10,000",
        },
        { status: 422 },
      );
    }

    if (typeof currency !== "string" || !validateCurrency(currency)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported currency. Accepted: USD, EUR, GBP, NGN, USDC",
        },
        { status: 422 },
      );
    }

    if (typeof senderEmail !== "string" || !validateEmail(senderEmail)) {
      return NextResponse.json(
        { success: false, error: "Invalid sender email address" },
        { status: 422 },
      );
    }

    if (unlockDatetime !== undefined && unlockDatetime !== null) {
      const parsedDate = new Date(unlockDatetime);
      if (!validateFutureDatetime(parsedDate)) {
        return NextResponse.json(
          {
            success: false,
            error: "Delivery datetime must be a valid date in the future",
          },
          { status: 422 },
        );
      }
    }

    if (
      message &&
      typeof message === "string" &&
      message.length > MAX_MESSAGE_LENGTH
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Message must not exceed ${MAX_MESSAGE_LENGTH} characters`,
        },
        { status: 422 },
      );
    }

    const recipientUser = await db.query.users.findFirst({
      where: eq(users.id, recipientId),
    });

    if (!recipientUser) {
      return NextResponse.json(
        { success: false, error: "Recipient not found" },
        { status: 404 },
      );
    }

    const sanitizedSenderEmail = sanitizeInput(senderEmail).toLowerCase();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const duplicate = await db.query.gifts.findFirst({
      where: and(
        eq(gifts.senderEmail, sanitizedSenderEmail),
        eq(gifts.recipientId, recipientId),
        eq(gifts.amount, amount),
        gte(gifts.createdAt, fiveMinutesAgo),
      ),
    });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A similar gift was recently submitted. Please wait before trying again.",
        },
        { status: 409 },
      );
    }

    const sanitizedMessage = message ? sanitizeInput(message) : null;
    const sanitizedSenderName = sanitizeInput(senderName);
    const sanitizedSenderAvatar = senderAvatar
      ? sanitizeInput(senderAvatar)
      : null;

    const slug = await generateUniqueSlug();

    const [newGift] = await db
      .insert(gifts)
      .values({
        recipientId,
        amount,
        currency: currency.toUpperCase(),
        message: sanitizedMessage,
        status: "pending_review",
        hideAmount: hideAmount ?? false,
        unlockDatetime: unlockDatetime ? new Date(unlockDatetime) : null,
        senderName: sanitizedSenderName,
        senderEmail: sanitizedSenderEmail,
        senderAvatar: sanitizedSenderAvatar,
        slug,
      })
      .returning();

    return NextResponse.json(
      { success: true, data: { giftId: newGift.id, status: "pending_review", slug: newGift.slug } },
      { status: 201 },
    );
  } catch (error) {
    console.error("[PUBLIC_GIFT_CREATE_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
