// Generic sliding-window rate limiter, in-memory (valid because the deployment is one persistent
// container — same argument as the Phase 3 tracking buffer). Applied to every mutating server
// action, not just login (Phase 1 already covers login separately with its own lockout).
export type RateLimiter = {
  check: (key: string) => boolean;
};

export function createRateLimiter(options: { maxActions: number; windowMs: number }): RateLimiter {
  const timestamps = new Map<string, number[]>();

  function check(key: string): boolean {
    const now = Date.now();
    const windowStart = now - options.windowMs;
    const recent = (timestamps.get(key) ?? []).filter((t) => t > windowStart);

    if (recent.length >= options.maxActions) {
      timestamps.set(key, recent);
      return false;
    }

    recent.push(now);
    timestamps.set(key, recent);
    return true;
  }

  return { check };
}
