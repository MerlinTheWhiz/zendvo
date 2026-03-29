import Stripe from "stripe";

/**
 * Stripe client configuration for gift creation payments.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export const createPaymentIntent = async (
  amount: number,
  currency: string = "usd"
) => {
  return await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency,
  });
};

export interface CheckoutSessionParams {
  giftId: string;
  amount: number;
  currency: string;
  giftDescription?: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create a Stripe Checkout Session for one-time gift payment.
 */
export const createCheckoutSession = async (
  params: CheckoutSessionParams
): Promise<Stripe.Checkout.Session> => {
  const { giftId, amount, currency, giftDescription, successUrl, cancelUrl } = params;

  return await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: giftDescription || "Gift Payment",
            description: `Gift ID: ${giftId}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: { giftId },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
};

/**
 * Verify a Stripe payment intent
 * @param paymentIntentId - The Stripe payment intent ID
 * @returns Verification result with status and transaction details
 */
export const verifyPayment = async (paymentIntentId: string) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key is not configured");
  }

  if (!paymentIntentId) {
    throw new Error("Payment intent ID is required");
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      success: true,
      status: paymentIntent.status,
      reference: paymentIntent.id,
      amount: paymentIntent.amount / 100, // Convert from cents to dollars
      currency: paymentIntent.currency.toUpperCase(),
      paidAt: paymentIntent.status === "succeeded"
        ? new Date(paymentIntent.created * 1000).toISOString()
        : null,
      metadata: paymentIntent.metadata,
    };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      throw new Error(`Payment verification failed: ${error.message}`);
    }
    throw new Error("Payment verification failed: Unknown error");
  }
};

/**
 * Check if a payment was successful based on Stripe status
 * @param status - The payment status from Stripe
 * @returns boolean indicating if payment was successful
 */
export const isPaymentSuccessful = (status: string): boolean => {
  return status === "succeeded";
};
