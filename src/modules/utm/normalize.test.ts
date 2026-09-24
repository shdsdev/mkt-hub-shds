import { describe, it, expect } from "vitest";
import { normalizeUtmValue } from "@/lib/utm";

describe("normalizeUtmValue", () => {
  it("lowercases the value", () => {
    expect(normalizeUtmValue("Facebook")).toBe("facebook");
    expect(normalizeUtmValue("FACEBOOK")).toBe("facebook");
  });

  it("replaces whitespace with a single underscore", () => {
    expect(normalizeUtmValue("Facebook Ads")).toBe("facebook_ads");
    expect(normalizeUtmValue("Facebook   Ads")).toBe("facebook_ads");
  });

  it("replaces invalid characters with an underscore", () => {
    expect(normalizeUtmValue("Q4_Launch!")).toBe("q4_launch");
    expect(normalizeUtmValue("50%_off")).toBe("50_off");
  });

  it("collapses consecutive separators into one underscore", () => {
    expect(normalizeUtmValue("a -- b")).toBe("a_b");
  });

  it("strips leading and trailing underscores", () => {
    expect(normalizeUtmValue("-facebook-")).toBe("facebook");
    expect(normalizeUtmValue("  facebook  ")).toBe("facebook");
  });

  it("normalizes dashes to underscores", () => {
    expect(normalizeUtmValue("spring-2026")).toBe("spring_2026");
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
