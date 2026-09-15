import { describe, it, expect } from "vitest";
import { resolveErrorCorrectionLevel } from "./logo";

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
