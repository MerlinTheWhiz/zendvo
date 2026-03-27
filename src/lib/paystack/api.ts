/**
 * Paystack API wrapper logic.
 * Handles payouts to Nigerian bank accounts and payment verification.
 */
export const paystackConfig = {
  baseUrl: "https://api.paystack.co",
  secretKey: process.env.PAYSTACK_SECRET_KEY,
};

export const verifyBankAccount = async (
  accountNumber: string,
  bankCode: string
) => {
  // Logic to call https://api.paystack.co/bank/resolve
  return { status: "mock_verified", name: "Zendvo Recipient" };
};

/**
 * Verify a Paystack payment transaction
 * @param reference - The payment reference from Paystack
 * @returns Verification result with status and transaction details
 */
export const verifyPayment = async (reference: string) => {
  if (!paystackConfig.secretKey) {
    throw new Error("Paystack secret key is not configured");
  }

  if (!reference) {
    throw new Error("Payment reference is required");
  }

  try {
    const response = await fetch(
      `${paystackConfig.baseUrl}/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackConfig.secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Paystack API error: ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.status) {
      throw new Error(data.message || "Payment verification failed");
    }

    const transaction = data.data;

    return {
      success: true,
      status: transaction.status,
      reference: transaction.reference,
      amount: transaction.amount / 100, // Convert from kobo to naira
      currency: transaction.currency,
      paidAt: transaction.paid_at,
      gatewayResponse: transaction.gateway_response,
      metadata: transaction.metadata,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Payment verification failed: ${error.message}`);
    }
    throw new Error("Payment verification failed: Unknown error");
  }
};

/**
 * Check if a payment was successful based on Paystack status
 * @param status - The payment status from Paystack
 * @returns boolean indicating if payment was successful
 */
export const isPaymentSuccessful = (status: string): boolean => {
  return status === "success";
};
