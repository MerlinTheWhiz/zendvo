import {
  checkOTPRequestRateLimit,
  checkOTPRequestRateLimitByUserId,
  MAX_OTP_REQUESTS_PER_PHONE,
  OTP_RATE_LIMIT_WINDOW_MS,
} from "../../src/server/services/otpService";
import { db } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: jest.fn(),
      },
      emailVerifications: {
        findFirst: jest.fn(),
      },
    },
    select: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
  },
}));

describe("OTP Rate Limiting", () => {
  const mockUserId = "user-123";
  const mockPhoneNumber = "+1234567890";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("checkOTPRequestRateLimitByUserId", () => {
    it("should allow request when under the limit", async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ count: 2 }]),
        }),
      });

      (db.query.emailVerifications.findFirst as jest.Mock).mockResolvedValue({
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      });

      const result = await checkOTPRequestRateLimitByUserId(mockUserId);

      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(MAX_OTP_REQUESTS_PER_PHONE - 2 - 1);
      expect(result.retryAfterMs).toBe(0);
    });

    it("should block request when at the limit (4 OTPs in 10 minutes)", async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ count: 4 }]),
        }),
      });

      const oldestCreatedAt = new Date(Date.now() - 8 * 60 * 1000);
      (db.query.emailVerifications.findFirst as jest.Mock).mockResolvedValue({
        createdAt: oldestCreatedAt,
      });

      const result = await checkOTPRequestRateLimitByUserId(mockUserId);

      expect(result.allowed).toBe(false);
      expect(result.remainingRequests).toBe(0);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.message).toContain("Too many OTP requests");
    });

    it("should block request when over the limit (5 OTPs in 10 minutes)", async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ count: 5 }]),
        }),
      });

      const oldestCreatedAt = new Date(Date.now() - 7 * 60 * 1000);
      (db.query.emailVerifications.findFirst as jest.Mock).mockResolvedValue({
        createdAt: oldestCreatedAt,
      });

      const result = await checkOTPRequestRateLimitByUserId(mockUserId);

      expect(result.allowed).toBe(false);
      expect(result.remainingRequests).toBe(0);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it("should allow request when window has expired", async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ count: 2 }]),
        }),
      });

      const result = await checkOTPRequestRateLimitByUserId(mockUserId);

      expect(result.allowed).toBe(true);
    });

    it("should calculate correct retry time based on oldest OTP", async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ count: 4 }]),
        }),
      });

      const oldestCreatedAt = new Date(Date.now() - 2 * 60 * 1000);
      (db.query.emailVerifications.findFirst as jest.Mock).mockResolvedValue({
        createdAt: oldestCreatedAt,
      });

      const result = await checkOTPRequestRateLimitByUserId(mockUserId);

      const expectedRetryMs = 8 * 60 * 1000;
      expect(result.retryAfterMs).toBeGreaterThan(expectedRetryMs - 10000);
      expect(result.retryAfterMs).toBeLessThanOrEqual(expectedRetryMs + 10000);
    });
  });

  describe("checkOTPRequestRateLimit", () => {
    it("should allow request when phone number has no associated user", async () => {
      (db.query.users.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await checkOTPRequestRateLimit(mockPhoneNumber);

      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(MAX_OTP_REQUESTS_PER_PHONE);
    });

    it("should check OTP count for user with matching phone number", async () => {
      (db.query.users.findFirst as jest.Mock).mockResolvedValue({
        id: mockUserId,
      });

      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ count: 3 }]),
        }),
      });

      const result = await checkOTPRequestRateLimit(mockPhoneNumber);

      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(0);
    });

    it("should block request when phone number user is at limit", async () => {
      (db.query.users.findFirst as jest.Mock).mockResolvedValue({
        id: mockUserId,
      });

      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ count: 4 }]),
        }),
      });

      (db.query.emailVerifications.findFirst as jest.Mock).mockResolvedValue({
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      });

      const result = await checkOTPRequestRateLimit(mockPhoneNumber);

      expect(result.allowed).toBe(false);
      expect(result.message).toContain("Too many OTP requests");
    });
  });

  describe("Rate limit constants", () => {
    it("should have max 4 OTP requests per phone", () => {
      expect(MAX_OTP_REQUESTS_PER_PHONE).toBe(4);
    });

    it("should have 10 minute window", () => {
      expect(OTP_RATE_LIMIT_WINDOW_MS).toBe(10 * 60 * 1000);
    });
  });
});
