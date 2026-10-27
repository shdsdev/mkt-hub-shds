import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_ID, getThemeToggleTarget, HIDDEN_THEME_IDS, isValidThemeId, THEMES, VISIBLE_THEMES } from "./theme-registry";

describe("theme-registry", () => {
  it("uses Light as the default and exposes the four primary themes first", () => {
    expect(DEFAULT_THEME_ID).toBe("light");
    expect(VISIBLE_THEMES.slice(0, 4).map((theme) => theme.id)).toEqual(["light", "dark", "carbon", "lark-orange"]);
  });

  it("keeps the requested primary palette swatches", () => {
    expect(THEMES.find((theme) => theme.id === "light")?.swatch).toEqual(["#242424", "#f3fe64", "#f4f3ef"]);
    expect(THEMES.find((theme) => theme.id === "dark")?.swatch).toEqual(["#f5f3f0", "#ff6a2b", "#050505"]);
  });

  it("keeps the primary theme order stable", () => {
    expect(DEFAULT_THEME_ID).toBe("light");
    expect(VISIBLE_THEMES.slice(0, 4).map((theme) => theme.id)).toEqual(["light", "dark", "carbon", "lark-orange"]);
  });

  it("keeps the requested primary palette swatches", () => {
    expect(THEMES.find((theme) => theme.id === "light")?.swatch).toEqual(["#242424", "#f3fe64", "#f4f3ef"]);
    expect(THEMES.find((theme) => theme.id === "dark")?.swatch).toEqual(["#f5f3f0", "#ff6a2b", "#050505"]);
    expect(THEMES.find((theme) => theme.id === "carbon")?.swatch).toEqual(["#242424", "#f3fe64", "#f4f3ef"]);
    expect(THEMES.find((theme) => theme.id === "lark-orange")?.swatch).toEqual(["#ffffff", "#ff6a2b", "#050505"]);
  });

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

  it("pairs the primary themes for the quick appearance toggle", () => {
    expect(getThemeToggleTarget("light")).toBe("dark");
    expect(getThemeToggleTarget("dark")).toBe("light");
    expect(getThemeToggleTarget("carbon")).toBe("lark-orange");
    expect(getThemeToggleTarget("lark-orange")).toBe("carbon");
  });
});
