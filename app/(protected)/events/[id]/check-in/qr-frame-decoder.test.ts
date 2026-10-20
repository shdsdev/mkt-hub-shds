import { describe, expect, it, vi } from "vitest";
import { decodeQrFrame } from "./qr-frame-decoder";

vi.mock("jsqr", () => ({
  default: vi.fn(() => ({ data: "ABCD1234" })),
}));

describe("decodeQrFrame", () => {
  it("returns the decoded QR payload from an RGBA frame", () => {
    const result = decodeQrFrame(new Uint8ClampedArray(16), 2, 2);

    expect(result).toBe("ABCD1234");
  });
});
