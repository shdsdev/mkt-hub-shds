import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { themeColorOverrides } from "./db";
import { isAdmin, type UserRole } from "./service";

export type ThemeColorOverrideToken = "primary" | "accent" | "background";

// theme_id -> only the tokens that have an override row; a theme/token with no row keeps its
// fixed globals.css value (2026-10-15 Arctic Frost design — overrides are a narrow per-token
// delta, not a replacement for the theme-registry/CSS source of truth).
export type ThemeColorOverrides = Record<string, Partial<Record<ThemeColorOverrideToken, string>>>;

export async function getThemeColorOverrides(): Promise<ThemeColorOverrides> {
  const rows = await db
    .select({ themeId: themeColorOverrides.themeId, token: themeColorOverrides.token, hex: themeColorOverrides.hex })
    .from(themeColorOverrides);

  const result: ThemeColorOverrides = {};
  for (const row of rows) {
    const token = row.token as ThemeColorOverrideToken;
    result[row.themeId] = { ...result[row.themeId], [token]: row.hex };
  }
  return result;
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export type SetThemeColorOverrideInput = {
  actorRole: UserRole;
  actorUserId: string;
  themeId: string;
  token: ThemeColorOverrideToken;
  hex: string;
};

export type SetThemeColorOverrideResult = { ok: true } | { ok: false; reason: "forbidden" | "invalid_hex" };

// ADMIN-only (2026-10-15 design: "solo lo puede hacer el admin"). Strict `#rrggbb` only — no
// 3-digit shorthand, no named colors — so every stored override round-trips unambiguously into a
// CSS custom property value.
export async function setThemeColorOverride(input: SetThemeColorOverrideInput): Promise<SetThemeColorOverrideResult> {
  if (!isAdmin({ role: input.actorRole })) return { ok: false, reason: "forbidden" };
  if (!HEX_PATTERN.test(input.hex)) return { ok: false, reason: "invalid_hex" };

  await db
    .insert(themeColorOverrides)
    .values({ themeId: input.themeId, token: input.token, hex: input.hex, updatedBy: input.actorUserId })
    .onConflictDoUpdate({
      target: [themeColorOverrides.themeId, themeColorOverrides.token],
      set: { hex: input.hex, updatedBy: input.actorUserId, updatedAt: new Date() },
    });

  return { ok: true };
}

export type ClearThemeColorOverrideInput = {
  actorRole: UserRole;
  themeId: string;
  token: ThemeColorOverrideToken;
};

export type ClearThemeColorOverrideResult = { ok: true } | { ok: false; reason: "forbidden" };

// Reverts a theme/token back to its fixed globals.css value by deleting the override row.
export async function clearThemeColorOverride(
  input: ClearThemeColorOverrideInput,
): Promise<ClearThemeColorOverrideResult> {
  if (!isAdmin({ role: input.actorRole })) return { ok: false, reason: "forbidden" };

  await db
    .delete(themeColorOverrides)
    .where(and(eq(themeColorOverrides.themeId, input.themeId), eq(themeColorOverrides.token, input.token)));

  return { ok: true };
}

const TOKEN_ORDER: ThemeColorOverrideToken[] = ["primary", "accent", "background"];

function channel(value: string) {
  const normalized = Number.parseInt(value, 16) / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getReadableForeground(hex: string) {
  const luminance = 0.2126 * channel(hex.slice(1, 3)) + 0.7152 * channel(hex.slice(3, 5)) + 0.0722 * channel(hex.slice(5, 7));
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= blackContrast ? "#ffffff" : "#242424";
}

// Renders a theme's override rows as inline CSS custom property declarations
// (`--primary:#hex;...`) for app/layout.tsx to splice onto <html style="...">. Source order wins
// over the static [data-app-theme="..."] stylesheet block by plain CSS specificity rules already
// relied on elsewhere in globals.css — no `!important` needed. Empty string (not `undefined`) for
// "nothing to override" so the caller can always interpolate it directly into a style attribute.
export function buildThemeOverrideStyle(
  overrides: Partial<Record<ThemeColorOverrideToken, string>> | undefined,
): string {
  if (!overrides) return "";
  let style = "";
  for (const token of TOKEN_ORDER) {
    const hex = overrides[token];
    if (hex) {
      style += `--${token}:${hex};`;
      if (token !== "background") style += `--${token}-foreground:${getReadableForeground(hex)};`;
    }
  }
  return style;
}
