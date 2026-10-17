import { describe, expect, it } from "vitest";
import { canTransitionQuestionStatus } from "./state";

describe("canTransitionQuestionStatus", () => {
  it.each([
    ["pending", "approved"],
    ["pending", "rejected"],
    ["approved", "answered"],
    ["approved", "archived"],
    ["answered", "approved"],
    ["answered", "archived"],
    ["archived", "approved"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(canTransitionQuestionStatus(from, to)).toBe(true);
  });

  it.each([
    ["pending", "answered"],
    ["rejected", "approved"],
    ["archived", "answered"],
  ] as const)("rejects %s -> %s", (from, to) => {
    expect(canTransitionQuestionStatus(from, to)).toBe(false);
  });
});
