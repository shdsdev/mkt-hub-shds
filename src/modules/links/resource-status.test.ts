import { describe, it, expect } from "vitest";
import { isResolvable } from "./resource-status";

describe("isResolvable", () => {
  it("resolves an active resource", () => {
    expect(isResolvable("active")).toBe(true);
  });

  it("keeps resolving an archived resource — a printed QR must survive archiving", () => {
    expect(isResolvable("archived")).toBe(true);
  });

  it("does not resolve a disabled resource — deliberate takedown", () => {
    expect(isResolvable("disabled")).toBe(false);
  });
});
