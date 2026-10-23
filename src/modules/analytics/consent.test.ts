import { describe, expect, it } from "vitest";
import { createConsentToken, hasAnalyticsConsent, verifyConsentToken } from "./consent";

describe("analytics consent tokens", () => {
  const issuedAt = new Date("2026-10-23T12:00:00.000Z");

  it("creates and verifies a granted consent token", () => {
    const token = createConsentToken("granted", issuedAt, "test-secret");

    expect(verifyConsentToken(token, "test-secret", issuedAt)).toBe(true);
    expect(verifyConsentToken(token, "wrong-secret", issuedAt)).toBe(false);
  });

  it("rejects expired, malformed, and tampered tokens", () => {
    const token = createConsentToken("granted", issuedAt, "test-secret");

    expect(verifyConsentToken(token, "test-secret", new Date("2027-05-01T00:00:00.000Z"))).toBe(false);
    expect(verifyConsentToken(`${token}tampered`, "test-secret", issuedAt)).toBe(false);
    expect(verifyConsentToken("not-a-token", "test-secret", issuedAt)).toBe(false);
  });

  it("only accepts granted consent from the signed cookie", () => {
    const token = createConsentToken("granted", issuedAt, "test-secret");
    const request = { cookies: { get: (name: string) => name === "mh_analytics_consent" ? { value: token } : undefined } };

    expect(hasAnalyticsConsent(request as never, "test-secret", issuedAt)).toBe(true);
    expect(hasAnalyticsConsent({ cookies: { get: () => undefined } } as never, "test-secret", issuedAt)).toBe(false);
  });
});
