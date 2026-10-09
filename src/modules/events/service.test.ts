import { describe, it, expect } from "vitest";
import {
  CROCKFORD_BASE32_ALPHABET,
  generateBackupCode,
  generateOpaqueToken,
  normalizeEmail,
} from "./service";

// Service-layer primitives needed before any CRUD/registration logic lands (tasks.md 1.8):
// backup-code alphabet/length, opaque pass/cancel tokens, and email normalization used by the
// partial unique index on event_attendees.
describe("events service — backup codes", () => {
  it("uses the 32-char Crockford base32 alphabet, excluding I/L/O/U", () => {
    expect(CROCKFORD_BASE32_ALPHABET).toHaveLength(32);
    for (const excluded of ["I", "L", "O", "U"]) {
      expect(CROCKFORD_BASE32_ALPHABET).not.toContain(excluded);
    }
  });

  it("generates an 8-character code drawn only from the Crockford alphabet", () => {
    const code = generateBackupCode();
    expect(code).toHaveLength(8);
    for (const char of code) {
      expect(CROCKFORD_BASE32_ALPHABET).toContain(char);
    }
  });

  it("generates different codes across calls (collision-regeneration precondition)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateBackupCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("events service — opaque tokens", () => {
  it("generates a URL-safe base64 token with no padding or reserved characters", () => {
    const token = generateOpaqueToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
  });

  it("generates different tokens across calls", () => {
    expect(generateOpaqueToken()).not.toBe(generateOpaqueToken());
  });
});

describe("events service — email normalization", () => {
  it("lowercases and trims the email", () => {
    expect(normalizeEmail("  Someone@Example.COM  ")).toBe("someone@example.com");
  });

  it("is stable under repeated normalization", () => {
    const once = normalizeEmail("Person@Domain.com");
    expect(normalizeEmail(once)).toBe(once);
  });
});
