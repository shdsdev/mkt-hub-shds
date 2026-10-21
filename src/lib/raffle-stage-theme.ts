export type RaffleStageTheme = {
  backgroundColor: string;
  accentColor: string;
  logoUrl: string | null;
  foregroundColor: string;
  accentForegroundColor: string;
};

export const DEFAULT_RAFFLE_STAGE_THEME: RaffleStageTheme = {
  backgroundColor: "#0b0d12",
  accentColor: "#bef264",
  logoUrl: null,
  foregroundColor: "#ffffff",
  accentForegroundColor: "#000000",
};

function normalizeHexColor(value: string | null | undefined, fallback: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}

function channel(value: string) {
  const normalized = Number.parseInt(value, 16) / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getLuminance(hex: string) {
  return 0.2126 * channel(hex.slice(1, 3)) + 0.7152 * channel(hex.slice(3, 5)) + 0.0722 * channel(hex.slice(5, 7));
}

export function getReadableStageTextColor(hex: string) {
  const luminance = getLuminance(hex);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= blackContrast ? "#ffffff" : "#000000";
}

export function normalizeRaffleStageTheme(input: {
  stageBackgroundColor?: string | null;
  stageAccentColor?: string | null;
  stageLogoUrl?: string | null;
} = {}): RaffleStageTheme {
  const backgroundColor = normalizeHexColor(input.stageBackgroundColor, DEFAULT_RAFFLE_STAGE_THEME.backgroundColor);
  const accentColor = normalizeHexColor(input.stageAccentColor, DEFAULT_RAFFLE_STAGE_THEME.accentColor);
  const logoUrl = input.stageLogoUrl?.trim() || null;

  return {
    backgroundColor,
    accentColor,
    logoUrl,
    foregroundColor: getReadableStageTextColor(backgroundColor),
    accentForegroundColor: getReadableStageTextColor(accentColor),
  };
}
