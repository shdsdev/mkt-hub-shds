import { describe, it, expect, afterEach } from "vitest";
import { env } from "./env";

describe("env — events reminder job secret", () => {
  const original = process.env.EVENTS_REMINDER_JOB_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.EVENTS_REMINDER_JOB_SECRET;
    else process.env.EVENTS_REMINDER_JOB_SECRET = original;
  });

  it("throws a named error when unset, never reading raw process.env", () => {
    delete process.env.EVENTS_REMINDER_JOB_SECRET;
    expect(() => env.EVENTS_REMINDER_JOB_SECRET).toThrow(/EVENTS_REMINDER_JOB_SECRET/);
  });

  it("exposes the configured secret", () => {
    process.env.EVENTS_REMINDER_JOB_SECRET = "a-shared-secret";
    expect(env.EVENTS_REMINDER_JOB_SECRET).toBe("a-shared-secret");
  });
});
