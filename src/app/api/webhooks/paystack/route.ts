import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Paystack Webhook Handler
 * 
 * This endpoint receives events from Paystack.
 * It cryptographically verifies the x-paystack-signature header
 * to ensure the request is authentic.
 */
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-paystack-signature");
    const secret = process.env.PAYSTACK_SECRET_KEY;

    if (!secret) {
      console.error("[PAYSTACK_WEBHOOK] PAYSTACK_SECRET_KEY is not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    if (!signature) {
      console.warn("[PAYSTACK_WEBHOOK] Missing x-paystack-signature header");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    // Read the raw request body as text for verification
    const rawBody = await req.text();

    // Compute HMAC SHA512 hash of the raw body using the secret key
    const hash = crypto
      .createHmac("sha512", secret)
      .update(rawBody)
      .digest("hex");

    // Verify that the computed hash matches the signature from Paystack
    if (hash !== signature) {
      console.warn("[PAYSTACK_WEBHOOK] Invalid signature detected");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse the validated payload
    const event = JSON.parse(rawBody);

    console.log(`[PAYSTACK_WEBHOOK] Received event: ${event.event}`);

    /**
     * Handle Paystack events here.
     * Common events:
     * - charge.success: Payment was successful
     * - transfer.success: Payout was successful
     * - transfer.failed: Payout failed
     */
    
    // TODO: Implement specific event handling logic
    // Example:
    // if (event.event === 'charge.success') {
    //   const { reference, metadata } = event.data;
    //   // Update gift status in database
    // }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[PAYSTACK_WEBHOOK_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
