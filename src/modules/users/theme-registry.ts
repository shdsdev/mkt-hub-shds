// Fixed, developer-curated list — themes are not user-created content, so this is plain data,
// not a DB table (2026-09-09 Settings + Themes design). The 3 swatch colors can be retuned via an
// ADMIN-only DB override layer (2026-10-15 Arctic Frost design) without becoming user-generated
// content themselves — see src/modules/users/theme-overrides.ts.
export type Theme = {
  id: string;
  label: string;
  swatch: [primary: string, accent: string, background: string];
  mode: "light" | "dark";
};

export const THEMES: Theme[] = [
  { id: "light", label: "Light", swatch: ["#242424", "#f3fe64", "#f4f3ef"], mode: "light" },
  { id: "dark", label: "Dark", swatch: ["#f5f3f0", "#ff6a2b", "#050505"], mode: "dark" },
  { id: "carbon", label: "Carbon", swatch: ["#242424", "#f3fe64", "#f4f3ef"], mode: "light" },
  { id: "lark-orange", label: "Lark Orange", swatch: ["#ffffff", "#ff6a2b", "#050505"], mode: "dark" },
  { id: "midnight", label: "Midnight", swatch: ["#e074c9", "#8845f4", "#0b0b0a"], mode: "dark" },
  { id: "signature", label: "Signature", swatch: ["#ff0055", "#00e2ee", "#1c1213"], mode: "dark" },
  { id: "nightfall", label: "Nightfall", swatch: ["#5da9e0", "#7fd9c4", "#100e0b"], mode: "dark" },
  { id: "greydlu", label: "Greydlu", swatch: ["#d4d4d8", "#d0f23c", "#100e0b"], mode: "dark" },
  { id: "aston", label: "Aston", swatch: ["#2dd4bf", "#d0f23c", "#100e0b"], mode: "dark" },
  { id: "arctic-frost", label: "Arctic Frost", swatch: ["#3772FF", "#FF7F11", "#faf8f2"], mode: "light" },
];

export const DEFAULT_THEME_ID = "carbon";

const THEME_TOGGLE_PAIRS = {
  carbon: "lark-orange",
  "lark-orange": "carbon",
} as const;

export function getThemeToggleTarget(themeId: string): string {
  const pairedTheme = THEME_TOGGLE_PAIRS[themeId as keyof typeof THEME_TOGGLE_PAIRS];
  if (pairedTheme) return pairedTheme;

  const currentTheme = THEMES.find((theme) => theme.id === themeId);
  return currentTheme?.mode === "dark" ? "carbon" : "lark-orange";
}

// 2026-10-15: hidden from the settings picker, but still fully defined in CSS/aura-background and
// still a valid stored preference — a user who already has one of these set sees no change.
export const HIDDEN_THEME_IDS = ["signature", "aston"] as const;

export const VISIBLE_THEMES: Theme[] = THEMES.filter(
  (theme) => !(HIDDEN_THEME_IDS as readonly string[]).includes(theme.id),
);

export function isValidThemeId(id: string): boolean {
  return THEMES.some((theme) => theme.id === id);
}
