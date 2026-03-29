import {
  clearCurrencyConverterCache,
  convertNgnToUsdc,
  getNgnToUsdcRate,
} from "@/lib/currencyConverter";

describe("currencyConverter utility", () => {
  const samplePrice = 1500;
  const sampleRate = 1 / samplePrice;
  const fakeResponse = {
    "usd-coin": {
      ngn: samplePrice,
    },
  };
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearCurrencyConverterCache();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeResponse,
    }) as unknown as typeof fetch;
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 1));
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it("fetches and returns the NGN to USDC multiplier", async () => {
    const rate = await getNgnToUsdcRate();

    expect(rate).toBeCloseTo(sampleRate, 12);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("caches the rate and avoids repeated API calls within the TTL", async () => {
    const firstRate = await getNgnToUsdcRate();
    const secondRate = await getNgnToUsdcRate();

    expect(firstRate).toBeCloseTo(sampleRate, 12);
    expect(secondRate).toBeCloseTo(sampleRate, 12);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes the cached rate after the TTL expires", async () => {
    await getNgnToUsdcRate();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(10 * 60 * 1000 + 1);

    await getNgnToUsdcRate();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("converts NGN amounts to USDC using the cached rate", async () => {
    const converted = await convertNgnToUsdc(3000);

    expect(converted).toBeCloseTo(3000 * sampleRate, 12);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("throws when the amount is not a number", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(convertNgnToUsdc("1000" as any)).rejects.toThrow(
      "amountNgn must be a valid number",
    );
  });
});
