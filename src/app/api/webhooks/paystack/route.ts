import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { markGiftPaymentSuccessfulByReference } from "@/server/services/giftStatusService";

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

    // Read the raw request body as text for verification
    const rawBody = await req.text();

    if (!secret || !signature) {
      console.warn("[PAYSTACK_WEBHOOK] Invalid signature context");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Compute HMAC SHA512 hash of the raw body using the secret key
    const hash = crypto
      .createHmac("sha512", secret)
      .update(rawBody)
      .digest("hex");

    if (hash.length !== signature.length) {
      console.warn("[PAYSTACK_WEBHOOK] Invalid signature length");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Verify that the computed hash matches the signature from Paystack
    const computed = Buffer.from(hash, "hex");
    const received = Buffer.from(signature, "hex");

    if (
      computed.length !== received.length ||
      !crypto.timingSafeEqual(computed, received)
    ) {
      console.warn("[PAYSTACK_WEBHOOK] Invalid signature detected");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse the validated payload
    const event = JSON.parse(rawBody);

    console.log(`[PAYSTACK_WEBHOOK] Received event: ${event.event}`);

    if (event?.event !== "charge.success") {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const reference = event?.data?.reference;

    if (!reference || typeof reference !== "string") {
      console.warn("[PAYSTACK_WEBHOOK] charge.success missing reference");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const result = await markGiftPaymentSuccessfulByReference(
      reference,
      "paystack",
    );

    if (!result.success) {
      console.warn(
        `[PAYSTACK_WEBHOOK] Unable to process reference ${reference}: ${result.message}`,
      );
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[PAYSTACK_WEBHOOK_ERROR]", error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
