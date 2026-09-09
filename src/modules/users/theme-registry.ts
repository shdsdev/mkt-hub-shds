// Fixed, developer-curated list — themes are not user-created content, so this is plain data,
// not a DB table (2026-09-09 Settings + Themes design).
export type Theme = {
  id: string;
  label: string;
  swatch: [primary: string, accent: string, background: string];
};

export const THEMES: Theme[] = [
  { id: "signature", label: "Signature", swatch: ["#ff0055", "#00e2ee", "#1c1213"] },
];

export const DEFAULT_THEME_ID = "signature";

export function isValidThemeId(id: string): boolean {
  return THEMES.some((theme) => theme.id === id);
}
