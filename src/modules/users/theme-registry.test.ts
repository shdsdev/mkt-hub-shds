import { describe, expect, it } from "vitest";
import { HIDDEN_THEME_IDS, isValidThemeId, THEMES, VISIBLE_THEMES } from "./theme-registry";

describe("theme-registry", () => {
  it("includes arctic-frost in THEMES with its swatch", () => {
    const arcticFrost = THEMES.find((theme) => theme.id === "arctic-frost");
    expect(arcticFrost).toBeDefined();
    expect(arcticFrost?.swatch).toEqual(["#3772FF", "#FF7F11", "#faf8f2"]);
  });

  it("excludes hidden themes (signature, aston) from VISIBLE_THEMES", () => {
    const visibleIds = VISIBLE_THEMES.map((theme) => theme.id);
    expect(visibleIds).not.toContain("signature");
    expect(visibleIds).not.toContain("aston");
    expect(visibleIds).toContain("arctic-frost");
    expect(visibleIds).toContain("midnight");
    expect(visibleIds).toContain("nightfall");
    expect(visibleIds).toContain("greydlu");
  });

  it("HIDDEN_THEME_IDS matches signature and aston exactly", () => {
    expect(HIDDEN_THEME_IDS).toEqual(["signature", "aston"]);
  });

  it("isValidThemeId still accepts hidden themes", () => {
    expect(isValidThemeId("signature")).toBe(true);
    expect(isValidThemeId("aston")).toBe(true);
  });

  it("isValidThemeId accepts arctic-frost", () => {
    expect(isValidThemeId("arctic-frost")).toBe(true);
  });

  it("isValidThemeId rejects unknown ids", () => {
    expect(isValidThemeId("not-a-theme")).toBe(false);
  });
});
