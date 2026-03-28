import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import Stripe from "stripe";

/**
 * Stripe Webhook Handler
 * 
 * This endpoint receives events from Stripe.
 * It cryptographically verifies the stripe-signature header
 * using Stripe's constructEvent method to ensure authenticity.
 */
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("[STRIPE_WEBHOOK] STRIPE_WEBHOOK_SECRET is not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    if (!signature) {
      console.warn("[STRIPE_WEBHOOK] Missing stripe-signature header");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    // Read the raw request body as text for Stripe verification
    const rawBody = await req.text();

    let event: Stripe.Event;

    try {
      // Use Stripe's official constructEvent method to verify the signature
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.warn("[STRIPE_WEBHOOK] Signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    console.log(`[STRIPE_WEBHOOK] Received event: ${event.type}`);

    /**
     * Handle Stripe events here.
     * Common events:
     * - payment_intent.succeeded: Payment was successful
     * - payment_intent.payment_failed: Payment failed
     * - checkout.session.completed: Checkout was successful
     */
    
    // TODO: Implement specific event handling logic
    // Example:
    // if (event.type === 'payment_intent.succeeded') {
    //   const paymentIntent = event.data.object as Stripe.PaymentIntent;
    //   // Update gift status in database
    // }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[STRIPE_WEBHOOK_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
