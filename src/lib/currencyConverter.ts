const DEFAULT_CONVERTER_API_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=ngn";

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let cachedRate: number | null = null;
let cacheUpdatedAt = 0;

interface CoingeckoResponse {
  "usd-coin"?: {
    ngn?: number;
  };
}

function getConverterApiUrl(): string {
  return (
    process.env.CURRENCY_CONVERTER_API_URL || DEFAULT_CONVERTER_API_URL
  );
}

function isCacheValid(): boolean {
  return (
    cachedRate !== null &&
    cacheUpdatedAt > 0 &&
    Date.now() - cacheUpdatedAt < CACHE_TTL_MS
  );
}

function setCache(rate: number) {
  cachedRate = rate;
  cacheUpdatedAt = Date.now();
}

async function fetchUsdcPriceInNgn(): Promise<number> {
  const apiUrl = getConverterApiUrl();
  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(
      `Currency converter API returned ${response.status}: ${response.statusText}`,
    );
  }

  const body = (await response.json()) as CoingeckoResponse;
  const price = body["usd-coin"]?.ngn;

  if (typeof price !== "number" || Number.isNaN(price) || price <= 0) {
    throw new Error("Currency converter API returned an invalid NGN price.");
  }

  return price;
}

export async function getNgnToUsdcRate(
  forceRefresh = false,
): Promise<number> {
  if (!forceRefresh && isCacheValid() && cachedRate !== null) {
    return cachedRate;
  }

  const usdcPriceInNgn = await fetchUsdcPriceInNgn();
  const ngnToUsdcRate = 1 / usdcPriceInNgn;

  if (!Number.isFinite(ngnToUsdcRate) || ngnToUsdcRate <= 0) {
    throw new Error("Calculated NGN to USDC rate is invalid.");
  }

  setCache(ngnToUsdcRate);
  return ngnToUsdcRate;
}

export async function convertNgnToUsdc(
  amountNgn: number,
  forceRefresh = false,
): Promise<number> {
  if (typeof amountNgn !== "number" || Number.isNaN(amountNgn)) {
    throw new TypeError("amountNgn must be a valid number.");
  }

  const rate = await getNgnToUsdcRate(forceRefresh);
  return amountNgn * rate;
}

export function clearCurrencyConverterCache() {
  cachedRate = null;
  cacheUpdatedAt = 0;
}
