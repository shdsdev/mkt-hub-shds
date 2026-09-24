import { describe, expect, it } from "vitest";
import { normalizeUtmValue } from "./utm";

describe("normalizeUtmValue", () => {
  it("provides the shared browser-safe normalization contract (lowercase snake_case)", () => {
    expect(normalizeUtmValue("Facebook Ads")).toBe("facebook_ads");
  });

  it("collapses whitespace and invalid characters into single underscores", () => {
    expect(normalizeUtmValue("Facebook   Ads")).toBe("facebook_ads");
    expect(normalizeUtmValue("Q4 Launch!")).toBe("q4_launch");
  });

  it("normalizes an existing kebab-case value to snake_case", () => {
    expect(normalizeUtmValue("spring-2026")).toBe("spring_2026");
    expect(normalizeUtmValue("a -- b")).toBe("a_b");
  });
});
