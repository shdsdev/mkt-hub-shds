type RateLimitOptions = { maxActions: number; windowMs: number };

type Bucket = { count: number; windowStartedAt: number };

export function createQuestionRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return {
    check(key: string, now = Date.now()): boolean {
      const bucket = buckets.get(key);
      if (!bucket || now - bucket.windowStartedAt >= options.windowMs) {
        buckets.set(key, { count: 1, windowStartedAt: now });
        return true;
      }
      if (bucket.count >= options.maxActions) return false;
      bucket.count += 1;
      return true;
    },
  };
}

const publicQuestionLimiter = createQuestionRateLimiter({ maxActions: 5, windowMs: 60_000 });
const publicRegistrationLimiter = createQuestionRateLimiter({ maxActions: 10, windowMs: 60_000 });

export function checkPublicQuestionRateLimit(key: string): boolean {
  return publicQuestionLimiter.check(key);
}

export function checkPublicQuestionRegistrationRateLimit(code: string): boolean {
  return publicRegistrationLimiter.check(`registration:${code}`);
}
