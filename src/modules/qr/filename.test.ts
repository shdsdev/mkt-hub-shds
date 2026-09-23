import { describe, expect, it } from "vitest";
import { qrDownloadFilename } from "./filename";

describe("qrDownloadFilename", () => {
  it("slugs the QR name into a safe file base name", () => {
    expect(qrDownloadFilename("FT Bodallas QR", "abc")).toBe("ft-bodallas-qr");
  });

  it("collapses separators and trims leading/trailing dashes", () => {
    expect(qrDownloadFilename("  Mi   QR  ", "abc")).toBe("mi-qr");
    expect(qrDownloadFilename("-marca-", "abc")).toBe("marca");
  });

  it("removes unsafe characters", () => {
    expect(qrDownloadFilename('foo:bar"baz?*<>|', "abc")).toBe("foo-bar-baz");
    expect(qrDownloadFilename("qr/2026?.png", "abc")).toBe("qr-2026-png");
  });

  it("caps the length and avoids a trailing dash", () => {
    const long = "a".repeat(80);
    expect(qrDownloadFilename(long, "abc")).toBe("a".repeat(60));
    expect(qrDownloadFilename(` ${long} `, "abc")).toHaveLength(60);
  });

  it("falls back to qr-<id> when nothing usable remains", () => {
    expect(qrDownloadFilename("¡¿?!", "abc")).toBe("qr-abc");
    expect(qrDownloadFilename("", "abc")).toBe("qr-abc");
  });
});