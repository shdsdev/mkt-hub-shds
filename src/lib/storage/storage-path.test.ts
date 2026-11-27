import { describe, expect, it } from "vitest";
import { sanitizeStorageFileName } from "./storage-path";

describe("sanitizeStorageFileName", () => {
  it("creates a Storage-safe file name from accented names with spaces", () => {
    expect(sanitizeStorageFileName("Invitación Posada Shades 2026.png")).toBe(
      "Invitacion-Posada-Shades-2026.png",
    );
  });
});
