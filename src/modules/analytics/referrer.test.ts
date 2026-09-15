import { describe, it, expect } from "vitest";
import { normalizeReferrer } from "./referrer";

describe("normalizeReferrer", () => {
  it("extracts the hostname from a full referer URL", () => {
    expect(normalizeReferrer("https://l.instagram.com/?u=https://example.com")).toBe(
      "l.instagram.com",
    );
    expect(normalizeReferrer("https://www.google.com/search?q=hub+mkt")).toBe("www.google.com");
  });

  it("returns undefined for a missing header", () => {
    expect(normalizeReferrer(null)).toBeUndefined();
  });

  it("returns undefined for an empty header", () => {
    expect(normalizeReferrer("")).toBeUndefined();
  });

  it("returns undefined for a malformed value instead of throwing", () => {
    expect(normalizeReferrer("not-a-url")).toBeUndefined();
  });
});
