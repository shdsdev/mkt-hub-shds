# Design: Settings + Themes

## Context

User wants a "Themes" section under Settings, letting each user pick between visual themes for
the app. Today "Settings" is only a disabled, unclickable placeholder in the sidebar — no route,
no page — so this is the first real Settings work. Scoped down to exactly what's asked: a
per-user theme preference and a Themes section. No organization/users/roles management (SPEC.md
§30 names those as future Settings content, not requested here — no stub tabs for them).

Only one real theme exists today (the hot-pink/cyan glassmorphism palette from
`2026-09-09-glassmorphism-palette-design.md`). A second theme is planned once the user supplies a
reference image for it; this design only has to make adding that theme later a small, mechanical
change (one CSS block + one registry entry), not build it now.

## Scope

**In**: `users.theme` column, a themes registry (id/label pairs), `app/globals.css` restructured so
the current palette is addressable by `[data-app-theme="signature"]` (kept as the `:root`/`.dark`
fallback too, so unauthenticated pages like `/login` still render correctly), `app/layout.tsx`
made async to read the current user's theme and set `data-app-theme` on `<html>` server-side (no
flash of the wrong theme), a `/settings` page with a Themes section, a server action to update the
preference, and enabling the sidebar's Settings link.

**Out**: the second theme itself (blocked on the reference image), organization/users/roles
settings, any theme picker beyond "pick one of the registered themes."

## Data Model

`src/modules/users/db.ts`: add `theme: text("theme")` (nullable) to `users`. `null` means "use the
default theme" — avoids a migration-time backfill decision and matches how nullable/optional
columns are already handled elsewhere in this schema (e.g. `logoUrl`).

## Theming Mechanism

`src/modules/users/theme-registry.ts` (a plain data module, not a DB table — themes are a fixed,
developer-curated list, not user-created content): exports `THEMES = [{ id: "signature", label:
"Signature" }]` and a `DEFAULT_THEME_ID = "signature"`.

`app/globals.css`: the existing `:root, .dark { ... }` block (the current palette) gets `[data-app-
theme="signature"]` added to its selector list — same values, now also addressable by the
attribute. A future second theme adds a sibling `[data-app-theme="<id>"] { ... }` block redefining
the same custom properties; no other file changes.

`app/layout.tsx` becomes an async server component: calls `getCurrentUser()` (already safe to call
on every route, including `/login`, since it just checks the Supabase session), resolves
`user?.profile.theme ?? DEFAULT_THEME_ID`, and sets `data-app-theme={themeId}` on `<html>` alongside
the existing `dark` class. Resolved entirely server-side — no client flash, no localStorage.

## `/settings` Page

New `app/(protected)/settings/page.tsx` — any logged-in user (approved scope: not admin-gated).
Single "Themes" section: a card per registered theme (label + a small color-swatch preview built
from that theme's palette values, hardcoded per theme since there are only a couple), the current
one visually marked selected, each a button that submits `updateUserThemeAction`.

`updateUserThemeAction` (new, in `app/(protected)/settings/actions.ts`): rate-limited like every
other mutation, validates the id against `THEMES`, calls a new `updateTheme(userId, themeId)` in
`src/modules/users/service.ts`, `revalidatePath("/", "layout")` so the new `data-app-theme` takes
effect immediately across the whole app (not just `/settings`). Not audited — a cosmetic per-user
preference, not an organizational action (matches the existing line between what gets audited and
what doesn't — see Phase 9 design).

## Sidebar

`app/(protected)/sidebar.tsx`: the disabled `<span>` placeholder becomes a real `<NavLink
href="/settings">Settings</NavLink>`.

## Testing

No new pure logic to unit test (theme resolution is a one-line nullish-coalescing fallback, not
worth a test file for). Verified via `pnpm check` and a real browser check: change the theme on
`/settings`, confirm it persists across a reload and across different pages.

## Open Questions

None — the second theme's design is explicitly deferred to its own follow-up once the reference
image arrives.
