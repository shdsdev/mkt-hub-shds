import { describe, it, expect } from "vitest";
import { percentChange } from "./percent-change";

describe("percentChange", () => {
  it("computes a positive change", () => {
    expect(percentChange(120, 100)).toBe(20);
  });

  it("computes a negative change", () => {
    expect(percentChange(80, 100)).toBe(-20);
  });

  it("returns null when there is nothing to compare against", () => {
    expect(percentChange(50, 0)).toBeNull();
  });

  it("returns 0 when current equals previous", () => {
    expect(percentChange(100, 100)).toBe(0);
  });
});
