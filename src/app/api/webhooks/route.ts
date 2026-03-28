import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { gifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing stripe signature or webhook secret" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook signature verification failed";
    console.error("Webhook error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const giftId = session.metadata?.giftId;

    if (!giftId) {
      console.error("Webhook: checkout.session.completed missing giftId metadata");
      return NextResponse.json({ received: true });
    }

    const gift = await db.query.gifts.findFirst({
      where: eq(gifts.id, giftId),
    });

    if (!gift) {
      console.error(`Webhook: gift ${giftId} not found`);
      return NextResponse.json({ received: true });
    }

    // Mark payment as verified and advance status to pending_review if not already further along
    const advanceable = ["otp_verified", "pending_review"];
    if (advanceable.includes(gift.status)) {
      await db
        .update(gifts)
        .set({
          paymentVerifiedAt: new Date(),
          status: "pending_review",
          updatedAt: new Date(),
        })
        .where(eq(gifts.id, giftId));
    }
  }

  return NextResponse.json({ received: true });
}
