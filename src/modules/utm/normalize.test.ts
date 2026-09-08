import { describe, it, expect } from "vitest";
import { normalizeUtmValue } from "./normalize";

describe("normalizeUtmValue", () => {
  it("lowercases the value", () => {
    expect(normalizeUtmValue("Facebook")).toBe("facebook");
    expect(normalizeUtmValue("FACEBOOK")).toBe("facebook");
  });

  it("replaces whitespace with a single dash", () => {
    expect(normalizeUtmValue("Facebook Ads")).toBe("facebook-ads");
    expect(normalizeUtmValue("Facebook   Ads")).toBe("facebook-ads");
  });

  it("replaces invalid characters with a dash", () => {
    expect(normalizeUtmValue("Q4_Launch!")).toBe("q4-launch");
    expect(normalizeUtmValue("50%_off")).toBe("50-off");
  });

  it("collapses consecutive dashes into one", () => {
    expect(normalizeUtmValue("a -- b")).toBe("a-b");
  });

  it("strips leading and trailing dashes", () => {
    expect(normalizeUtmValue("-facebook-")).toBe("facebook");
    expect(normalizeUtmValue("  facebook  ")).toBe("facebook");
  });

  it("keeps digits and existing dashes", () => {
    expect(normalizeUtmValue("spring-2026")).toBe("spring-2026");
  });

  it("throws when the result would be empty", () => {
    expect(() => normalizeUtmValue("   ")).toThrow();
    expect(() => normalizeUtmValue("!!!")).toThrow();
  });

  it("throws when the input exceeds 255 characters", () => {
    expect(() => normalizeUtmValue("a".repeat(256))).toThrow();
  });

  it("accepts exactly 255 characters", () => {
    expect(normalizeUtmValue("a".repeat(255))).toHaveLength(255);
  });
});
