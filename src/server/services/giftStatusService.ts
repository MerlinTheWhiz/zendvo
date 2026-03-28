import { db } from "@/lib/db";
import { gifts } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export const GIFT_STATUS_TRANSITIONS = {
  pending_otp: ["otp_verified", "failed"],
  otp_verified: ["pending_review", "confirmed", "failed"],
  pending_review: ["confirmed", "failed"],
  confirmed: ["completed", "sent", "failed"],
  completed: ["sent"],
  sent: [],
  failed: [],
} as const;

export type GiftStatus = keyof typeof GIFT_STATUS_TRANSITIONS;

export interface StatusTransitionResult {
  success: boolean;
  message: string;
  currentStatus?: string;
  allowedTransitions?: readonly string[];
}

export async function validateGiftStatusTransition(
  giftId: string,
  targetStatus: GiftStatus,
  currentUserId?: string
): Promise<StatusTransitionResult> {
  const gift = await db.query.gifts.findFirst({
    where: eq(gifts.id, giftId),
  });

  if (!gift) {
    return {
      success: false,
      message: "Gift not found",
    };
  }

  const currentStatus = gift.status as GiftStatus;
  
  // Check if transition is allowed
  const allowedTransitions: readonly GiftStatus[] =
    GIFT_STATUS_TRANSITIONS[currentStatus] || [];
  
  if (!allowedTransitions.includes(targetStatus)) {
    return {
      success: false,
      message: `Invalid status transition from ${currentStatus} to ${targetStatus}. Allowed transitions: ${allowedTransitions.join(", ")}`,
      currentStatus,
      allowedTransitions,
    };
  }

  // Additional business logic validations
  const validationResult = await validateBusinessRules(gift, targetStatus, currentUserId);
  if (!validationResult.success) {
    return validationResult;
  }

  return {
    success: true,
    message: `Status transition from ${currentStatus} to ${targetStatus} is allowed`,
    currentStatus,
    allowedTransitions,
  };
}

async function validateBusinessRules(
  gift: any,
  targetStatus: GiftStatus,
  currentUserId?: string
): Promise<StatusTransitionResult> {
  const now = new Date();

  switch (targetStatus) {
    case "otp_verified":
      // Can only fund if OTP is verified (for sender-initiated gifts)
      if (gift.otpHash && gift.otpExpiresAt && now > new Date(gift.otpExpiresAt)) {
        return {
          success: false,
          message: "OTP has expired. Please request a new verification code.",
        };
      }
      break;

    case "confirmed":
      // Can only lock if there's a future unlock datetime
      if (!gift.unlockDatetime) {
        return {
          success: false,
          message: "Cannot lock gift: no unlock datetime specified",
        };
      }
      
      if (new Date(gift.unlockDatetime) <= now) {
        return {
          success: false,
          message: "Cannot lock gift: unlock datetime must be in the future",
        };
      }
      break;

    case "completed":
      // Can only unlock if unlock datetime has passed
      if (gift.unlockDatetime && new Date(gift.unlockDatetime) > now) {
        return {
          success: false,
          message: "Gift cannot be unlocked yet. Please wait until the unlock datetime.",
        };
      }
      break;

    case "sent":
      // Can only claim if sender has sufficient funds (for funded gifts)
      if (gift.senderId) {
        // This check should be done in the actual claiming logic with proper wallet balance checks
        // Here we just ensure the gift is in a claimable state
        if (gift.status !== "completed" && gift.status !== "confirmed") {
          return {
            success: false,
            message: `Gift must be completed or confirmed to be sent. Current status: ${gift.status}`,
          };
        }
      }
      break;

    default:
      break;
  }

  return { success: true, message: "Business rules validation passed" };
}

export async function transitionGiftStatus(
  giftId: string,
  targetStatus: GiftStatus,
  metadata?: Record<string, any>
): Promise<StatusTransitionResult> {
  const validation = await validateGiftStatusTransition(giftId, targetStatus);
  
  if (!validation.success) {
    return validation;
  }

  try {
    const updateData: any = { status: targetStatus };
    
    // Add metadata for specific transitions
    if ((targetStatus === "completed" || targetStatus === "sent") && metadata?.transactionId) {
      updateData.transactionId = metadata.transactionId;
    }

    await db
      .update(gifts)
      .set(updateData)
      .where(eq(gifts.id, giftId));

    return {
      success: true,
      message: `Gift status successfully updated to ${targetStatus}`,
    };
  } catch (error) {
    console.error(`Error transitioning gift ${giftId} to ${targetStatus}:`, error);
    return {
      success: false,
      message: "Database error while updating gift status",
    };
  }
}

export function getGiftStatusFlow(): GiftStatus[] {
  return [
    "pending_otp",
    "otp_verified",
    "pending_review",
    "confirmed",
    "completed",
    "sent",
    "failed",
  ];
}

export function isTerminalStatus(status: GiftStatus): boolean {
  return status === "sent" || status === "failed";
}

export function canTransitionFrom(currentStatus: GiftStatus, targetStatus: GiftStatus): boolean {
  const transitions: readonly GiftStatus[] =
    GIFT_STATUS_TRANSITIONS[currentStatus] || [];
  return transitions.includes(targetStatus);
}
