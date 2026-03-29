import { validateUnlockAt, convertToUTCDate, formatAsUTCISO } from "@/lib/validation";

describe("Timezone-aware integration", () => {
  it("should handle PST sender input and convert to UTC correctly", () => {
    // Simulate a sender in PST (UTC-8) setting unlock for 9 AM PST
    // 9 AM PST = 5 PM UTC (9 AM + 8 hours)
    const pstUnlockTime = "2026-03-30T09:00:00.000-08:00";
    
    // Validate the input
    const validation = validateUnlockAt(pstUnlockTime);
    expect(validation.valid).toBe(true);
    
    // Convert to UTC for database storage
    const utcDate = convertToUTCDate(pstUnlockTime);
    expect(utcDate).toBeInstanceOf(Date);
    
    // Verify it's stored as 5 PM UTC
    const utcString = formatAsUTCISO(utcDate);
    expect(utcString).toBe("2026-03-30T17:00:00.000Z");
  });

  it("should handle EST sender input and convert to UTC correctly", () => {
    // Simulate a sender in EST (UTC-5) setting unlock for 9 AM EST
    // 9 AM EST = 2 PM UTC (9 AM + 5 hours)
    const estUnlockTime = "2026-03-30T09:00:00.000-05:00";
    
    // Validate the input
    const validation = validateUnlockAt(estUnlockTime);
    expect(validation.valid).toBe(true);
    
    // Convert to UTC for database storage
    const utcDate = convertToUTCDate(estUnlockTime);
    expect(utcDate).toBeInstanceOf(Date);
    
    // Verify it's stored as 2 PM UTC
    const utcString = formatAsUTCISO(utcDate);
    expect(utcString).toBe("2026-03-30T14:00:00.000Z");
  });

  it("should handle UTC sender input correctly", () => {
    // Simulate a sender using UTC directly
    const utcUnlockTime = "2026-03-30T17:00:00.000Z";
    
    // Validate the input
    const validation = validateUnlockAt(utcUnlockTime);
    expect(validation.valid).toBe(true);
    
    // Convert to UTC for database storage (should remain the same)
    const utcDate = convertToUTCDate(utcUnlockTime);
    expect(utcDate).toBeInstanceOf(Date);
    
    // Verify it's stored as the same UTC time
    const utcString = formatAsUTCISO(utcDate);
    expect(utcString).toBe("2026-03-30T17:00:00.000Z");
  });

  it("should reject invalid timezone formats", () => {
    const invalidFormats = [
      "2026-03-30 09:00:00", // No timezone
      "2026-03-30T09:00:00", // No milliseconds or timezone
      "2026-03-30T09:00:00.000", // No timezone
      "2026-03-30T09:00:00Z", // No milliseconds
      "2026-03-30T09:00:00+01:00", // No milliseconds
    ];

    invalidFormats.forEach(format => {
      const validation = validateUnlockAt(format);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain("timezone and milliseconds");
    });
  });

  it("should maintain timezone accuracy for edge cases", () => {
    // Test with different timezone offsets
    const testCases = [
      { input: "2026-03-30T12:00:00.000+00:00", expected: "2026-03-30T12:00:00.000Z" },
      { input: "2026-03-30T12:00:00.000+05:30", expected: "2026-03-30T06:30:00.000Z" }, // IST to UTC
      { input: "2026-03-30T12:00:00.000-10:00", expected: "2026-03-30T22:00:00.000Z" }, // HST to UTC
    ];

    testCases.forEach(({ input, expected }) => {
      const validation = validateUnlockAt(input);
      expect(validation.valid).toBe(true);
      
      const utcDate = convertToUTCDate(input);
      const utcString = formatAsUTCISO(utcDate);
      expect(utcString).toBe(expected);
    });
  });
});