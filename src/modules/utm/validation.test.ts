import { describe, it, expect } from "vitest";
import {
  validateSourceValue,
  validateMediumValue,
  validatePairing,
  validateCustomParameters,
} from "./validation";

describe("validateCustomParameters", () => {
  it("accepts unique valid non-UTM pairs", () => {
    const result = validateCustomParameters([
      { key: "promo", value: "spring" },
      { key: "region", value: "latam" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a blank key", () => {
    const result = validateCustomParameters([{ key: "   ", value: "x" }]);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/vac[ií]/i);
  });

  it("rejects a reserved utm_ key case-insensitively", () => {
    const result = validateCustomParameters([{ key: "UTM_Source", value: "google" }]);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/reservada/i);
  });

  it("rejects a malformed key", () => {
    expect(validateCustomParameters([{ key: "My Key", value: "x" }]).valid).toBe(false);
    expect(validateCustomParameters([{ key: "1promo", value: "x" }]).valid).toBe(false);
  });

  it("rejects duplicate keys case-insensitively", () => {
    const result = validateCustomParameters([
      { key: "promo", value: "a" },
      { key: "promo", value: "b" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/duplicada/i);
  });

  it("rejects a blank value", () => {
    expect(validateCustomParameters([{ key: "promo", value: "   " }]).valid).toBe(false);
  });
});

describe("validateSourceValue", () => {
  it("accepts an active taxonomy source in controlled mode", () => {
    expect(validateSourceValue("facebook", "controlled").valid).toBe(true);
  });

  it("rejects an unapproved source in controlled mode", () => {
    const result = validateSourceValue("tiktok_unknown", "controlled");
    expect(result.valid).toBe(false);
  });

  it("accepts a custom partner source only in partner/external mode", () => {
    expect(validateSourceValue("my partner agency", "partner").valid).toBe(true);
    expect(validateSourceValue("external platform", "external").valid).toBe(true);
    expect(validateSourceValue("my partner agency", "controlled").valid).toBe(false);
  });

  it("rejects an empty source", () => {
    expect(validateSourceValue("   ", "controlled").valid).toBe(false);
  });
});

describe("validateMediumValue", () => {
  it("accepts an active taxonomy medium", () => {
    expect(validateMediumValue("social").valid).toBe(true);
  });

  it("rejects a deprecated or unknown medium", () => {
    expect(validateMediumValue("social-post").valid).toBe(false);
    expect(validateMediumValue("made-up-medium").valid).toBe(false);
  });
});

describe("validatePairing", () => {
  it("is warning-only for a non-recommended pair", () => {
    const result = validatePairing("google", "email");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("has no warnings for a recommended pair", () => {
    expect(validatePairing("google", "cpc").warnings).toHaveLength(0);
  });
});
