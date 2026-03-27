import Stripe from "stripe";

/**
 * Stripe client configuration for gift creation payments.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
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
