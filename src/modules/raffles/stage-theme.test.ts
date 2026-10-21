import { describe, expect, it } from "vitest";
import {
  DEFAULT_RAFFLE_STAGE_THEME,
  getReadableStageTextColor,
  normalizeRaffleStageTheme,
} from "@/lib/raffle-stage-theme";

describe("raffle stage theme", () => {
  it("normalizes valid colors and keeps the logo optional", () => {
    expect(normalizeRaffleStageTheme({
      stageBackgroundColor: "#F4F1EA",
      stageAccentColor: "#BEEF42",
      stageLogoUrl: " https://cdn.example/logo.png ",
    })).toEqual({
      backgroundColor: "#f4f1ea",
      accentColor: "#beef42",
      logoUrl: "https://cdn.example/logo.png",
      foregroundColor: "#000000",
      accentForegroundColor: "#000000",
    });
  });

  it("falls back to the default stage theme for invalid values", () => {
    expect(normalizeRaffleStageTheme({
      stageBackgroundColor: "red",
      stageAccentColor: "#123",
      stageLogoUrl: "",
    })).toEqual(DEFAULT_RAFFLE_STAGE_THEME);
  });

  it("chooses a readable foreground for dark and light surfaces", () => {
    expect(getReadableStageTextColor("#0b0d12")).toBe("#ffffff");
    expect(getReadableStageTextColor("#f4f1ea")).toBe("#000000");
  });
});
