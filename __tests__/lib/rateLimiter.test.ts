import { consumeRateLimit, getRateLimitStatusForKey, isRateLimited } from "@/lib/rate-limiter";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

describe("rate-limiter utility", () => {
  it("should consume and track remaining quota", () => {
    const key = "rl-test:1";

    const first = consumeRateLimit(key, 3, 100_000);
    expect(first.remaining).toBe(2);
    expect(first.limited).toBe(false);

    const second = consumeRateLimit(key, 3, 100_000);
    expect(second.remaining).toBe(1);
    expect(second.limited).toBe(false);

    const third = consumeRateLimit(key, 3, 100_000);
    expect(third.remaining).toBe(0);
    expect(third.limited).toBe(false);

    const fourth = consumeRateLimit(key, 3, 100_000);
    expect(fourth.remaining).toBe(0);
    expect(fourth.limited).toBe(true);
  });

  it("should report status without consuming quota", () => {
    const key = "rl-status:1";
    const status = getRateLimitStatusForKey(key, 5, 100_000);

    expect(status.remaining).toBe(5);
    expect(status.limited).toBe(false);
  });

  it("should keep isRateLimited boolean behavior", () => {
    const key = "rl-bool:1";
    expect(isRateLimited(key, 1, 100_000)).toBe(false);
    expect(isRateLimited(key, 1, 100_000)).toBe(true);
  });
});

describe("middleware /api/auth header injection", () => {
  it("sets X-RateLimit-Remaining and related headers for /api/auth paths", async () => {
    const request = new NextRequest("http://localhost/api/auth/login");
    const response = await middleware(request);

    expect(response.headers.get("x-ratelimit-remaining")).toBe("99");
    expect(response.headers.get("x-ratelimit-limit")).toBe("100");
    expect(response.headers.get("x-ratelimit-reset")).toBeDefined();
  });
});
