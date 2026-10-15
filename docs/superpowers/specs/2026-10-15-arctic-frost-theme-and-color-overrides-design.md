# Arctic Frost Theme, Hide Signature/Aston, Admin Color Overrides

## Context

The app's theme system (`src/modules/users/theme-registry.ts`) is a fixed, developer-curated list
of 5 dark themes (2026-09-09 "Settings + Themes" design: "themes are not user-created content, so
this is plain data, not a DB table"). Each theme is a `[data-app-theme="id"]` block of ~20 CSS
custom properties in `app/globals.css`, plus an optional atmospheric "aura" gradient background
rendered by `src/components/aura-background.tsx` for themes that want one (all 5 currently do).
Theme selection is a per-user preference (`user.profile.theme`), picked from a grid of swatch cards
in `app/(protected)/settings/general/page.tsx`.

This change adds a 6th theme ("Arctic Frost" — the first *light* theme), hides two existing themes
from the picker without deleting them, and introduces a narrow, DB-backed color override mechanism
so an ADMIN can retune the 3 swatch colors of any theme without a code deploy.

## Decisions (confirmed with user)

1. **Color overrides are per-token deltas in a new DB table**, layered on top of the existing
   fixed CSS values — not a full migration of the theme system into the database. This preserves
   the 2026-09-09 "plain data" architecture for everything except the 3 swatch colors.
2. **Only the 3 swatch colors are editable**: `primary`, `accent`, `background`. The other ~17
   tokens per theme (card, border, sidebar, shadows, etc.) stay fixed in `globals.css` — editing
   them has much higher risk of breaking contrast/legibility across the app for a feature whose
   whole point is a quick color retune, not a theme builder.
3. **Signature and Aston are hidden, not deleted.** They're removed from the array the settings
   picker renders, but stay fully defined in `theme-registry.ts`/`globals.css`/`aura-background.tsx`
   and remain valid values for `isValidThemeId`. A user who already has one of these two set as
   their preference sees no change — their UI doesn't move. Reversible later with a one-line change.
4. **Overrides are global, not per-organization.** The request ("solo lo puede hacer el admin") is
   about *who* can change it, not a per-tenant customization — there is exactly one override per
   `(theme_id, token)` pair, platform-wide.

## New theme: Arctic Frost

### `theme-registry.ts`

```ts
{ id: "arctic-frost", label: "Arctic Frost", swatch: ["#3772FF", "#FF7F11", "#faf8f2"] }
```

(primary = Crayola Blue, accent = Vivid Tangerine, background = the cream base from the user's
Aura Gradient spec.)

### Full token mapping (`app/globals.css`, `[data-app-theme="arctic-frost"]` block)

Derived from the user's 5-hex reference palette (Jet Black `#172A32`, Alabaster Grey `#D6DCD7`,
Azure Mist `#CFDEDC`, Vivid Tangerine `#FF7F11`, Crayola Blue `#3772FF`) plus the `#faf8f2` base
from the Aura spec, following the exact structural pattern every other aura theme already uses
(translucent `background`/`card`/`popover`/`sidebar` via `color-mix()` so the aura shows through,
same as Nightfall/Greydlu/Aston):

- `--background`: `color-mix(in srgb, #faf8f2 32%, transparent)`
- `--foreground`: `#172A32` (Jet Black — the one theme where foreground is dark-on-light instead of light-on-dark)
- `--card` / `--popover`: `color-mix(in srgb, #ffffff 70%/92%, transparent)` (white translucent surfaces, mirroring the dark themes' near-opaque popover / more-translucent card split)
- `--card-foreground` / `--popover-foreground`: `#172A32`
- `--primary`: `#3772FF`, `--primary-foreground`: `#faf8f2`
- `--secondary`: `#CFDEDC`, `--secondary-foreground`: `#172A32`
- `--muted`: `color-mix(in srgb, #D6DCD7 60%, transparent)`, `--muted-foreground`: `#52636a` (a mid grey-blue derived from the palette, for AA-readable muted text on a light surface)
- `--accent`: `#FF7F11`, `--accent-foreground`: `#172A32`
- `--destructive`: `#ef4444` (kept consistent with every other theme's destructive token), `--destructive-foreground`: `#faf8f2`
- `--border` / `--input`: `rgba(23, 42, 50, 0.12)` (Jet-Black-tinted, low alpha — light themes need a darker, not lighter, hairline)
- `--ring`: `#3772FF`
- `--shadow-*`: `rgba(23, 42, 50, 0.08–0.12)` scale — deliberately lighter than the dark themes' `0.3–0.35` shadows, since a strong black shadow reads wrong on a light backdrop
- `--sidebar`: `color-mix(in srgb, #ffffff 12%, transparent)`, `--sidebar-foreground`: `#172A32`, remaining sidebar tokens follow the same light-surface pattern as card/popover above

### Aura background (4 layers + grain, per the user's "Arctic Frost" spec)

- Extend `AuraThemeId` in `aura-background.tsx` to include `"arctic-frost"`, `AURA_LAYER_COUNT.arctic-frost = 4`, `AURA_HAS_GRAIN.arctic-frost = true` (the spec explicitly wants the grain overlay).
- Add `.aura-arctic-frost-layer-1..4` to `globals.css`, reproducing the 4 layers from the user's CSS block (normal/multiply blend modes, the given blur values, mobile vs. desktop blur via the existing media-query pattern already used for Nightfall/Midnight).
- **Required fix to shared CSS**: `.aura-base` currently hardcodes `background-color: #100e0b` for every aura theme. Add `[data-app-theme="arctic-frost"] .aura-base { background-color: #faf8f2; }` so Arctic Frost's base matches its spec instead of inheriting the dark default.

### `dark:` Tailwind variant risk (implementation-time check, not a new requirement)

`app/layout.tsx` applies the `dark` class to `<html>` unconditionally, and 7 components
(`button.tsx`, `input.tsx`, `avatar.tsx`, `calendar.tsx`, `input-otp.tsx`, `map.tsx`,
`onboarding-screen.tsx` — 35 occurrences of literal `dark:` Tailwind utility classes total) have
dark-mode-specific Tailwind styling that will still apply even when Arctic Frost is active, since
they don't go through the app's own CSS-variable theme tokens. During implementation, each of these
7 files gets checked against Arctic Frost specifically and only patched where it visibly breaks
(wrong contrast, invisible borders, etc.) — not rewritten wholesale.

## Hiding Signature and Aston

`app/(protected)/settings/general/page.tsx` currently does `THEMES.map(...)`. Change to map over a
new `VISIBLE_THEMES` (or equivalent filtered list) exported from `theme-registry.ts`, e.g.:

```ts
export const HIDDEN_THEME_IDS = ["signature", "aston"] as const;
export const VISIBLE_THEMES = THEMES.filter((t) => !HIDDEN_THEME_IDS.includes(t.id));
```

`isValidThemeId` keeps checking the full `THEMES` array (not `VISIBLE_THEMES`) so existing
Signature/Aston users' stored preference keeps validating and rendering exactly as today.

## Admin color overrides

### Data model (`src/modules/users/db.ts`, new table)

```ts
export const themeColorOverrideToken = pgEnum("theme_color_override_token", [
  "primary", "accent", "background",
]);

export const themeColorOverrides = pgTable(
  "theme_color_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    themeId: text("theme_id").notNull(),
    token: themeColorOverrideToken("token").notNull(),
    hex: text("hex").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid("updated_by").notNull().references(() => users.id),
  },
  (table) => [unique("theme_color_overrides_theme_token_unique").on(table.themeId, table.token)],
);
```

Global table, no `organizationId` — see Decision 4. `drizzle-kit generate` produces the migration
as usual (no manual SQL file, matching the rest of the codebase's convention).

### Service (`src/modules/users/service.ts` or a new `theme-overrides.ts` leaf file in the module)

- `getThemeColorOverrides(): Promise<Record<string, Partial<Record<"primary"|"accent"|"background", string>>>>` — one query, grouped by `themeId`, used to render the effective swatches/CSS variables.
- `setThemeColorOverride(input: { actorRole: UserRole; themeId: string; token: "primary"|"accent"|"background"; hex: string })` — ADMIN-gated (`isAdmin`, same pattern as `createEvent`/`setEventStatus` in the events module), validates `hex` against a strict `#rrggbb` pattern, upserts via `onConflictDoNothing`-style `ON CONFLICT (theme_id, token) DO UPDATE`.
- `clearThemeColorOverride(input: { actorRole: UserRole; themeId: string; token: ... })` — ADMIN-gated, deletes the row, reverting to the fixed `globals.css` value. (A "reset to default" affordance in the modal needs this.)

### Applying overrides at render time

`app/layout.tsx` already sets `data-app-theme={themeId}` on `<html>`. Extend it to also read
`getThemeColorOverrides()` and, when the active theme has any override rows, emit a small inline
`<style>` tag (or `style` attribute additions on `<html>`) setting `--primary`/`--accent`/
`--background` directly — inline styles win over the `[data-app-theme="..."]` block in the
stylesheet by CSS specificity/source-order rules already in play elsewhere in this file (see the
existing comment about aura override blocks winning "because it comes later in the source"), so no
`!important` is needed. This keeps the override invisible to every component — they still just read
`var(--primary)` etc.

### Admin UI

Lives in `app/(protected)/settings/general/page.tsx`, gated by `isAdmin(user.profile)` (same gate
as `settings/users`). A "Editar colores" action per theme card (admin-only, hidden for non-admins)
opens a modal: a theme selector (defaults to the card that was clicked) plus 3 color inputs
(`<input type="color">` + hex text field for precise entry) for primary/accent/background, a live
preview of the 3 swatches, and a "Restablecer a los valores originales" action per color that calls
`clearThemeColorOverride`. Submits via a server action (`setThemeColorOverrideAction`) following the
existing `updateUserThemeAction` form-action pattern.

## Isolation

Touches: `src/modules/users/theme-registry.ts`, `src/modules/users/db.ts`, `src/modules/users/service.ts` (or a new file), `src/modules/users/index.ts`, `app/globals.css`, `src/components/aura-background.tsx`, `app/layout.tsx`, `app/(protected)/settings/general/page.tsx`, `app/(protected)/settings/actions.ts`, plus new tests for each. No overlap with the events module work (confirmation/reminder emails, just shipped) or the other agent's check-in UI work.

## Testing strategy

- `theme-registry.test.ts` (new or extended): `VISIBLE_THEMES` excludes Signature/Aston; `isValidThemeId` still accepts them.
- `aura-background.test.ts` (if one exists, else inline render test): Arctic Frost renders 4 layers + grain.
- `service.test.ts` (users module): ADMIN can set/clear an override; non-ADMIN is rejected; invalid hex is rejected; override round-trips through `getThemeColorOverrides`.
- `layout` test or a focused unit test for the inline-style-generation helper: given override rows for the active theme, the right CSS variables are emitted; given none, nothing extra is emitted.
- `settings/general/page.test.tsx` (if present) / actions test: the edit-colors action is admin-gated end to end, same shape as existing `settings/users` admin tests.

## Non-goals

- No per-organization theme customization.
- No editing of the other ~17 tokens per theme (card, border, sidebar, shadows, etc.).
- No wholesale rewrite of the 7 files using literal `dark:` Tailwind classes — only visible breakage under Arctic Frost gets patched.
