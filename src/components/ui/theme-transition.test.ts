import { describe, expect, it } from "vitest";
import { buildThemeRevealPath } from "./theme-transition";

describe("theme reveal transition", () => {
  it("builds a collapsed organic path at the trigger and an expanded path at the viewport edges", () => {
    const collapsed = buildThemeRevealPath(0, { x: 100, y: 80 }, 400, 300);
    const expanded = buildThemeRevealPath(1, { x: 100, y: 80 }, 400, 300);

    expect(collapsed).toContain("M100 80");
    expect(expanded).toContain("Z");
    expect(expanded).not.toBe(collapsed);
    expect(expanded.length).toBeGreaterThan(collapsed.length);
  });
});
