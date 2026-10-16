import { describe, expect, it } from "vitest";
import { normalizeQrDescription } from "./metadata";

describe("normalizeQrDescription", () => {
  it("returns an optional trimmed description with a 160 character limit", () => {
    expect(normalizeQrDescription("  contexto del QR  ")).toBe("contexto del QR");
    expect(normalizeQrDescription("a".repeat(160))).toHaveLength(160);
    expect(normalizeQrDescription("a".repeat(161))).toBeUndefined();
    expect(normalizeQrDescription("   ")).toBeUndefined();
  });
});
