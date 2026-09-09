import { describe, it, expect } from "vitest";
import { computeLogoDimensions, resolveErrorCorrectionLevel, LOGO_SAFE_ZONE_RATIO } from "./logo";

describe("computeLogoDimensions", () => {
  it("caps the logo at the safe-zone ratio of the QR size", () => {
    const { width, height } = computeLogoDimensions(400);
    expect(width).toBe(Math.round(400 * LOGO_SAFE_ZONE_RATIO));
    expect(height).toBe(Math.round(400 * LOGO_SAFE_ZONE_RATIO));
  });

  it("scales proportionally with QR size", () => {
    const small = computeLogoDimensions(200);
    const large = computeLogoDimensions(400);
    expect(large.width).toBe(small.width * 2);
  });
});

describe("resolveErrorCorrectionLevel", () => {
  it("forces H when a logo is present, regardless of the requested level", () => {
    expect(resolveErrorCorrectionLevel("L", true)).toBe("H");
    expect(resolveErrorCorrectionLevel("M", true)).toBe("H");
    expect(resolveErrorCorrectionLevel("H", true)).toBe("H");
  });

  it("respects the requested level when there is no logo", () => {
    expect(resolveErrorCorrectionLevel("L", false)).toBe("L");
    expect(resolveErrorCorrectionLevel("Q", false)).toBe("Q");
  });
});
