export const ALLOWED_COUNTRY_CODES = process.env.ALLOWED_COUNTRY_CODES
  ? process.env.ALLOWED_COUNTRY_CODES.split(",").map((code: string) => code.trim())
  : ["234", "1"];

export function validatePhoneCountryCode(phoneNumber: string): {
  isValid: boolean;
  message?: string;
} {
  let cleanNumber = phoneNumber.replace(/[\s\-().]/g, "");
  if (cleanNumber.startsWith("+")) {
    cleanNumber = cleanNumber.substring(1);
  }

  const isAllowed = ALLOWED_COUNTRY_CODES.some((code: string) =>
    cleanNumber.startsWith(code)
  );

  if (!isAllowed) {
    return {
      isValid: false,
      message: "Service currently only available in Nigeria and the US.",
    };
  }

  return { isValid: true };
}
