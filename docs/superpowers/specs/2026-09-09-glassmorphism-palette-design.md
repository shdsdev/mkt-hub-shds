# Design: Glassmorphism Palette Refresh

## Context

User supplied a design system config generated from a design tool (Balsa UI Studio) as a target
look: a darker near-black background, a hot-pink/red primary, a cyan accent, and a glassmorphism
treatment on panels. The generator tool itself (`balsa-ui` npm package) turned out to be a Vue 3
component library — confirmed against the npm registry (`description: "Agent-native, open-code
Vue 3 components..."`, no React in its keywords) — incompatible with this Next.js/React project.
User confirmed (after seeing the evidence) to skip the tool and replicate the same palette/effect
natively in the project's existing Tailwind v4 token system (`app/globals.css`), which is how
theming already works here (SPEC.md §29's "locked palette"). This design supersedes that locked
palette with the new one below.

Fonts (Poppins for headings, Inter for body) are unchanged — the target config already matched
what's in use.

## Scope

**In**: updated CSS custom properties in `app/globals.css` (colors, shadows), a glass treatment
(translucency + backdrop-blur) applied to `.bg-card` so every existing card/panel gets it for
free with no markup changes, and updating SPEC.md §29 to record the new locked palette.

**Out**: introducing any new npm dependency (the Vue tool is not used), a light-mode variant
(still dark-by-default only, matching the existing DD6 decision), changing radius/spacing tokens
(not specified in the supplied config).

## Token Mapping

| Token | Before | After |
|---|---|---|
| `--background` | `#1c130f` | `#1c1213` |
| `--foreground` | `#f7eeeb` | `#f7edee` |
| `--card` / `--popover` | `#201915` | `#291d1e`, rendered translucent (`color-mix` with the background at ~70% opacity) so `backdrop-filter: blur()` reads as glass |
| `--primary` | `#ff6f2c` | `#ff0055` |
| `--primary-foreground` | `#1c130f` | `#f7edee` — flipped to light text; the new primary is too saturated for dark text to read well on it |
| `--secondary` | `#ff8b68` | `#9c5a5f` |
| `--secondary-foreground` | `#1c130f` | `#f7edee` |
| `--muted` | `#3d2f29` | `#3d2e2e` |
| `--muted-foreground` | `#c9b8b1` | `#cbb2b4` (recomputed for the new hue, same lightness relationship) |
| `--accent` | `#30ffe3` | `#00e2ee` |
| `--accent-foreground` | `#1c130f` | `#1c1213` (stays dark — the new accent is still light) |
| `--destructive` / `--destructive-foreground` | `#ef4444` / `#f7eeeb` | unchanged (not specified in the supplied config) |
| `--border` / `--input` | `#3d2f29` | `#3d2e2e` (= new `--muted`, same derivation as before) |
| `--ring` | `#ff6f2c` | `#ff0055` (= new `--primary`, same derivation as before) |

Shadow tokens (`--shadow-sm/md/lg/detail`) are added as CSS variables holding `box-shadow` values
built from the supplied offsets, all using `rgba(247, 237, 238, 0.08)` (the new foreground at 8%
opacity) as specified.

## Glass Treatment

`@layer base` gets a rule targeting `.bg-card` (the Tailwind utility class Tailwind v4 generates
from `--color-card`, already used by every card/panel across the app) adding
`backdrop-filter: blur(12px)` and the new `--shadow-md`. Because `--card` becomes translucent, this
is enough to make every existing panel read as glass — no component file needs to change.

## Testing

Visual-only change, no pure logic to unit test. Verified by running `pnpm check` (nothing here
touches TypeScript/tests) and a real browser look at a few representative screens (overview,
links, audit log) after the change.

## Open Questions

None.
