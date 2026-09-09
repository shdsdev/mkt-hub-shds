import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows actions under the limit", () => {
    const limiter = createRateLimiter({ maxActions: 3, windowMs: 60_000 });
    expect(limiter.check("user-1")).toBe(true);
    expect(limiter.check("user-1")).toBe(true);
    expect(limiter.check("user-1")).toBe(true);
  });

  it("rejects once the limit is exceeded within the window", () => {
    const limiter = createRateLimiter({ maxActions: 2, windowMs: 60_000 });
    expect(limiter.check("user-1")).toBe(true);
    expect(limiter.check("user-1")).toBe(true);
    expect(limiter.check("user-1")).toBe(false);
  });

  it("tracks each user independently", () => {
    const limiter = createRateLimiter({ maxActions: 1, windowMs: 60_000 });
    expect(limiter.check("user-1")).toBe(true);
    expect(limiter.check("user-2")).toBe(true);
    expect(limiter.check("user-1")).toBe(false);
    expect(limiter.check("user-2")).toBe(false);
  });

  it("allows actions again once the window has fully elapsed", () => {
    const limiter = createRateLimiter({ maxActions: 1, windowMs: 60_000 });
    expect(limiter.check("user-1")).toBe(true);
    expect(limiter.check("user-1")).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(limiter.check("user-1")).toBe(true);
  });

  it("uses a sliding window, not a fixed one", () => {
    const limiter = createRateLimiter({ maxActions: 2, windowMs: 60_000 });
    expect(limiter.check("user-1")).toBe(true); // t=0
    vi.advanceTimersByTime(40_000);
    expect(limiter.check("user-1")).toBe(true); // t=40s
    vi.advanceTimersByTime(10_000); // t=50s — first action (t=0) still within 60s window
    expect(limiter.check("user-1")).toBe(false);
    vi.advanceTimersByTime(11_000); // t=61s — first action now outside the window
    expect(limiter.check("user-1")).toBe(true);
  });
});
