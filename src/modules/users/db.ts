import { pgTable, pgEnum, uuid, text, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { authUsers } from "@/db/auth-schema-ref";

export const userRole = pgEnum("user_role", [
  "ADMIN",
  "RECEPTION",
  "MARKETING_MANAGER",
  "MARKETING_USER",
  "VIEWER",
  "EVENT_EDITOR",
]);

export const userStatus = pgEnum("user_status", ["active", "disabled"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Org-wide default logo pre-filled into new QR codes (Settings) — unlike `users.theme`, this is
  // a brand asset, not a per-user preference.
  defaultLogoUrl: text("default_logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Profile table, not a credentials store (DATABASE.md) — `id` is a FK to Supabase's
// `auth.users.id`, not its own primary key generator. Supabase owns email/password.
export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  role: userRole("role").notNull().default("MARKETING_USER"),
  status: userStatus("status").notNull().default("active"),
  // Account-level lockout (distinct from Supabase Auth's own per-IP rate limiting) — closes the
  // distributed-brute-force gap where many IPs each make a couple of attempts against one
  // account. See docs/SPEC.md §18.
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  // Per-user preference — null means "use the default theme" (theme-registry.ts). Never gates
  // any behavior, purely cosmetic.
  theme: text("theme"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ADMIN-only retune of a theme's 3 swatch colors (2026-10-15 Arctic Frost design) — a narrow
// per-token delta layered on top of the fixed theme-registry.ts/globals.css values, not a
// migration of the theme system itself into the DB (that stays plain/code-defined data by design).
// Global, not per-organization: at most one row per (theme_id, token) pair, platform-wide.
export const themeColorOverrideToken = pgEnum("theme_color_override_token", [
  "primary",
  "accent",
  "background",
]);

export const themeColorOverrides = pgTable(
  "theme_color_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    themeId: text("theme_id").notNull(),
    token: themeColorOverrideToken("token").notNull(),
    hex: text("hex").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [unique("theme_color_overrides_theme_token_unique").on(table.themeId, table.token)],
);

export const usersTables = {
  organizations,
  users,
  userRole,
  userStatus,
  themeColorOverrideToken,
  themeColorOverrides,
} as const;
