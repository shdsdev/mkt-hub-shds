// Fixed, developer-curated list — themes are not user-created content, so this is plain data,
// not a DB table (2026-09-09 Settings + Themes design).
export type Theme = {
  id: string;
  label: string;
  swatch: [primary: string, accent: string, background: string];
};

export const THEMES: Theme[] = [
  { id: "midnight", label: "Midnight", swatch: ["#e074c9", "#8845f4", "#0b0b0a"] },
  { id: "signature", label: "Signature", swatch: ["#ff0055", "#00e2ee", "#1c1213"] },
  { id: "nightfall", label: "Nightfall", swatch: ["#5da9e0", "#7fd9c4", "#100e0b"] },
];

export const DEFAULT_THEME_ID = "midnight";

export function isValidThemeId(id: string): boolean {
  return THEMES.some((theme) => theme.id === id);
}
