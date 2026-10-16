import { describe, expect, it } from "vitest";
import { createQuestionRateLimiter } from "./rate-limit";

describe("question rate limiter", () => {
  it("allows only the configured number of actions in a window", () => {
    const limiter = createQuestionRateLimiter({ maxActions: 2, windowMs: 60_000 });

    expect(limiter.check("participant-1", 1_000)).toBe(true);
    expect(limiter.check("participant-1", 2_000)).toBe(true);
    expect(limiter.check("participant-1", 3_000)).toBe(false);
    expect(limiter.check("participant-2", 3_000)).toBe(true);
  });

  it("resets the counter after the window", () => {
    const limiter = createQuestionRateLimiter({ maxActions: 1, windowMs: 1_000 });

    expect(limiter.check("participant-1", 1_000)).toBe(true);
    expect(limiter.check("participant-1", 1_999)).toBe(false);
    expect(limiter.check("participant-1", 2_000)).toBe(true);
  });
});
