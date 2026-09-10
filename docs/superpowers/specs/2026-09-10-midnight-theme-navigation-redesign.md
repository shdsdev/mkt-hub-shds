# Design: "Midnight" Theme + Sidebar/Header Redesign

## Context

User wants the app's navigation shell (sidebar + header) restyled to match the "Agndex Dashboard"
reference on Watermelon UI (https://ui.watermelon.sh/dashboard/agndex-dashboard), as closely as
possible ("identical"). The template itself is not installable — its registry endpoint 404s both
via direct fetch and the real `shadcn add` CLI (confirmed, not assumed). Colors/spacing below were
extracted by inspecting the live reference page's computed styles directly (canvas-based rgb
readback, not eyeballed from a screenshot), so this is a faithful recreation, not an approximation.

## Scope

**In**: a new selectable theme ("Midnight") registered alongside the existing "Signature" theme
(per the 2026-09-09 Settings + Themes design — one CSS block + one registry entry), set as the new
default; a restructured sidebar (icons per item, grouped sections with muted labels, active-item
pill background) and header (simple breadcrumb, matching the reference's typography/spacing)
applied globally (structural, not theme-specific — applies under either color theme).

**Out**: a fake multi-project switcher (the reference's "Default Project" dropdown — we have no
multi-project concept, not inventing one), a literal "Developer Portal" badge (not our product),
copying the reference's exact copy/labels where they don't map to this app's actual features.

## Extracted Tokens ("Midnight")

| Token | Value |
|---|---|
| background | `#0b0b0a` |
| foreground | `#fbfbfa` |
| card/surface | `#202121` (readable as `--card`), nav active-item bg `#353435` |
| primary (buttons, links) | `#e074c9`, text `#171717` on it |
| secondary accent (status badges) | `#8845f4` at low-opacity bg, `#8d4aff` text |
| destructive | `#e20a00`-family (unchanged from current — not respecified by the reference beyond one red button) |
| muted text | `#6c6c6d` (section labels) |
| radius | 8–10px (vs. current 12px — tightened to match) |
| font | Inter (already in use) |

## Sidebar

- Width ~276px (vs. current 224px)
- Each nav item: icon (lucide-react, already a dependency) + label, `gap-2.5`, `rounded-lg`,
  active state gets the `#353435`-equivalent background (translated to a `--sidebar-active` token
  so it responds to whichever color theme is active, not hardcoded)
- Icon choices (matching what each page actually does, not arbitrary): Overview → `LayoutDashboard`,
  QR Short Links → `QrCode`, Campaigns → `Megaphone`, Audit Log → `ScrollText`, Settings → `Settings`
- Section grouping label style: small (`text-xs`), muted-gray, sentence case (the reference is NOT
  uppercase/letter-spaced despite how these usually look — verified via computed style, not guessed)

## Header

Replace the current plain "Marketing Hub" + email/sign-out bar with a breadcrumb-style header:
"Marketing Hub / <current page name>" on the left (derived from the active route, no fake project
segment), user email + role + sign out on the right — same content as today, restyled to match the
reference's spacing/typography (16px, foreground color, 24px line height equivalent).

## Testing

Visual-only, no pure logic. Verified via `pnpm check` and a real browser pass across several pages
confirming the new sidebar/header render correctly and theme switching (Signature ↔ Midnight)
still works from Settings.

## Open Questions

None.
