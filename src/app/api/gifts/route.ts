import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, gifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  validateAmount,
  validateCurrency,
  sanitizeInput,
  validateMessage,
  validateUnlockAt,
  CreateGiftSchema,
} from "@/lib/validation";
import { generateOTP, storeGiftOTP } from "@/server/services/otpService";
import { sendGiftConfirmationOTP } from "@/server/services/emailService";

export async function GET() {
  return NextResponse.json({ gifts: [] });
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    const userEmail = request.headers.get("x-user-email");

    if (!userId || !userEmail) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    
    // Validate request body using Zod schema
    const validationResult = CreateGiftSchema.safeParse(body);
    
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: firstError.message,
        },
        { status: 400 },
      );
    }

    const { recipient, amount, currency, message, template, coverImageId, unlock_at } = validationResult.data;

    // Check if recipient exists
    const recipientUser = await db.query.users.findFirst({
      where: eq(users.id, recipient),
    });

    if (!recipientUser) {
      return NextResponse.json(
        { success: false, error: "Recipient not found" },
        { status: 404 },
      );
    }

    // Prevent sending gift to self
    if (recipient === userId) {
      return NextResponse.json(
        { success: false, error: "Cannot send gift to yourself" },
        { status: 422 },
      );
    }

    // Sanitize optional fields
    const sanitizedMessage = message ? sanitizeInput(message) : null;
    const sanitizedTemplate = template ? sanitizeInput(template) : null;
    const sanitizedCoverImageId = coverImageId ? sanitizeInput(String(coverImageId)) : null;

    // Create gift record
    const [newGift] = await db
      .insert(gifts)
      .values({
        senderId: userId,
        recipientId: recipient,
        amount,
        currency: currency.toUpperCase(),
        message: sanitizedMessage,
        template: sanitizedTemplate,
        coverImageId: sanitizedCoverImageId,
        unlockDatetime: unlock_at ? new Date(unlock_at) : null,
        status: "pending_otp",
      })
      .returning();

    // Generate and store OTP
    const otp = generateOTP();
    await storeGiftOTP(newGift.id, otp);

    // Send OTP to sender
    const emailResult = await sendGiftConfirmationOTP(
      userEmail,
      otp,
      recipientUser.name || undefined,
    );

    if (!emailResult.success) {
      console.error(
        "Failed to send gift confirmation OTP:",
        emailResult.message,
      );
    }

    return NextResponse.json(
      {
        success: true,
        giftId: newGift.id,
        status: "pending_otp",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating gift:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
