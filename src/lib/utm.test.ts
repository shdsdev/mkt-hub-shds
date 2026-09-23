import { describe, expect, it } from "vitest";
import { normalizeUtmValue } from "./utm";

describe("normalizeUtmValue", () => {
  it("provides the shared browser-safe normalization contract", () => {
    expect(normalizeUtmValue("Facebook Ads")).toBe("facebook-ads");
  });
});
