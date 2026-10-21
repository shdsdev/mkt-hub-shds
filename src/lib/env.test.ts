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

describe("env — Marketing Hub server token", () => {
  const original = process.env.MARKETING_HUB_SERVER_TOKEN;
  afterEach(() => {
    if (original === undefined) delete process.env.MARKETING_HUB_SERVER_TOKEN;
    else process.env.MARKETING_HUB_SERVER_TOKEN = original;
  });

  it("exposes the configured server token and fails when unset", () => {
    process.env.MARKETING_HUB_SERVER_TOKEN = "hcs-secret";
    expect(env.MARKETING_HUB_SERVER_TOKEN).toBe("hcs-secret");
    delete process.env.MARKETING_HUB_SERVER_TOKEN;
    expect(() => env.MARKETING_HUB_SERVER_TOKEN).toThrow(/MARKETING_HUB_SERVER_TOKEN/);
  });
});

describe("env — monitoring secrets", () => {
  const originalDsn = process.env.SENTRY_DSN;
  const originalSecret = process.env.SENTRY_ALERTS_CLIENT_SECRET;

  afterEach(() => {
    if (originalDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = originalDsn;
    if (originalSecret === undefined) delete process.env.SENTRY_ALERTS_CLIENT_SECRET;
    else process.env.SENTRY_ALERTS_CLIENT_SECRET = originalSecret;
  });

  it("reads optional monitoring values without making the app fail when disabled", () => {
    process.env.SENTRY_DSN = "https://example@sentry.invalid/1";
    process.env.SENTRY_ALERTS_CLIENT_SECRET = "hook-secret";
    expect(env.SENTRY_DSN).toContain("sentry.invalid");
    expect(env.SENTRY_ALERTS_CLIENT_SECRET).toBe("hook-secret");
  });
});
