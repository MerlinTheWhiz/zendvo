type RateLimitStore = {
  [key: string]: {
    count: number;
    startTime: number;
  };
};

export type RateLimitStatus = {
  key: string;
  count: number;
  limit: number;
  windowMs: number;
  remaining: number;
  resetMs: number;
  limited: boolean;
};

const store: RateLimitStore = {};

function getRateLimitStatus(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitStatus {
  const now = Date.now();
  const entry = store[key];

  if (!entry || now - entry.startTime > windowMs) {
    return {
      key,
      count: 0,
      limit,
      windowMs,
      remaining: limit,
      resetMs: windowMs,
      limited: false,
    };
  }

  const elapsed = now - entry.startTime;
  const resetMs = windowMs - elapsed;
  const remaining = Math.max(0, limit - entry.count);

  return {
    key,
    count: entry.count,
    limit,
    windowMs,
    remaining,
    resetMs,
    limited: entry.count >= limit,
  };
}

function consumeRateLimitInternal(
  key: string,
  limit: number = 5,
  windowMs: number = 3600000,
): RateLimitStatus {
  const now = Date.now();
  const entry = store[key];

  if (!entry || now - (entry?.startTime ?? 0) > windowMs) {
    store[key] = { count: 1, startTime: now };
    return {
      key,
      count: 1,
      limit,
      windowMs,
      remaining: Math.max(0, limit - 1),
      resetMs: windowMs,
      limited: 1 > limit,
    };
  }

  entry.count += 1;
  const elapsed = now - entry.startTime;
  const resetMs = windowMs - elapsed;
  const remaining = Math.max(0, limit - entry.count);

  return {
    key,
    count: entry.count,
    limit,
    windowMs,
    remaining,
    resetMs,
    limited: entry.count > limit,
  };
}

export const consumeRateLimit = (
  key: string,
  limit: number = 5,
  windowMs: number = 3600000,
): RateLimitStatus => {
  return consumeRateLimitInternal(key, limit, windowMs);
};

export const isRateLimited = (
  key: string,
  limit: number = 5,
  windowMs: number = 3600000,
): boolean => {
  const status = consumeRateLimitInternal(key, limit, windowMs);
  return status.limited;
};

export const getRateLimitRemaining = (
  key: string,
  limit: number = 5,
  windowMs: number = 3600000,
): number => {
  return getRateLimitStatus(key, limit, windowMs).remaining;
};

export const getRateLimitStatusForKey = (
  key: string,
  limit: number = 5,
  windowMs: number = 3600000,
): RateLimitStatus => {
  return getRateLimitStatus(key, limit, windowMs);
};
