import { z } from "zod";

export const validateEmail = (email: string): boolean => {
  const emailRegex =
    /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): boolean => {
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

export const sanitizeInput = (input: string): string => {
  return input.trim();
};

export const validateAmount = (amount: number): boolean => {
  return amount > 0 && amount <= 10000; // Assuming max 10000 for now
};

export const validateCurrency = (currency: string): boolean => {
  const supportedCurrencies = ["USD", "EUR", "GBP", "NGN", "USDC"]; // Add more as needed
  return supportedCurrencies.includes(currency.toUpperCase());
};

export const validateFutureDatetime = (date: Date): boolean => {
  return !isNaN(date.getTime()) && date.getTime() > Date.now();
};

export const validateUnlockAt = (unlockAt: string | Date): { valid: boolean; error?: string } => {
  const unlockDate = new Date(unlockAt);
  
  if (isNaN(unlockDate.getTime())) {
    return { valid: false, error: "Invalid date format for unlock_at" };
  }
  
  const oneHourFromNow = Date.now() + 60 * 60 * 1000;
  
  if (unlockDate.getTime() < oneHourFromNow) {
    return { valid: false, error: "unlock_at must be at least 1 hour in the future" };
  }
  
  return { valid: true };
};

export const normalizePhoneNumber = (phone: string): string => {
  return phone.replace(/[\s\-().]/g, "");
};

export const validatePhoneNumber = (phone: string): boolean => {
  const normalized = normalizePhoneNumber(phone);
  return /^\+?\d{7,15}$/.test(normalized);
};

export const sanitizePhoneNumber = (phone: string): string => {
  // Trim whitespace and remove common formatting characters
  let sanitized = phone.trim();
  sanitized = normalizePhoneNumber(sanitized);
  
  // Ensure E.164 format with + prefix
  if (!sanitized.startsWith('+')) {
    // If number starts with 0 (local format), assume Nigerian format (+234)
    if (sanitized.startsWith('0')) {
      sanitized = '+234' + sanitized.substring(1);
    } else if (sanitized.startsWith('234')) {
      // Number already includes Nigerian country code but missing '+'
      sanitized = '+' + sanitized;
    } else {
      // For other numbers without country code, default to +234 (Nigeria)
      sanitized = '+234' + sanitized;
    }
  }
  
  return sanitized;
};

export const validateE164PhoneNumber = (phone: string): boolean => {
  const normalized = normalizePhoneNumber(phone.trim());

  // Reject numbers that include a country code but omit '+'
  if (!normalized.startsWith('+') && normalized.startsWith('234')) {
    return false;
  }

  const sanitized = sanitizePhoneNumber(phone);
  // E.164 format: + followed by 7-15 digits
  if (!/^\+[1-9]\d{6,14}$/.test(sanitized)) {
    return false;
  }

  // Reject Nigerian numbers where the national part is all zeros.
  if (sanitized.startsWith('+234') && /^0+$/.test(sanitized.slice(4))) {
    return false;
  }

  return true;
};

export const validateMessage = (message: string | null | undefined): boolean => {
  if (!message) return true;
  return message.length <= 500;
};

export const CreateGiftSchema = z.object({
  recipient: z.string().uuid("Invalid recipient ID"),
  amount: z.number().min(500, "Gift amount needs to be above the minimum threshold"),
  currency: z.string().default("USDC"),
  message: z.string().max(500, "Message cannot exceed 500 characters").optional().nullable(),
  template: z.string().optional().nullable(),
  coverImageId: z.union([z.string(), z.number()]).optional().nullable(),
  unlock_at: z.string().datetime().optional().nullable().or(z.date().optional().nullable())
}).refine((data) => {
  if (!data.unlock_at) return true;
  const unlockDate = new Date(data.unlock_at);
  const oneHourFromNow = Date.now() + 60 * 60 * 1000;
  return unlockDate.getTime() >= oneHourFromNow;
}, {
  message: "unlock_at must be at least 1 hour in the future",
  path: ["unlock_at"]
});
