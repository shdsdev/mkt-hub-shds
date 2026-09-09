# Design: Phase 8 — Dashboard

## Context

`docs/ROADMAP.md` Phase 8: Overview screen, per-asset detail screens, accordion sidebar
information architecture. Everything from Phases 2-7 already exists as functional pages
(`/links`, `/links/[id]`, `/qr`, `/campaigns`, `/analytics/[linkId]`) behind a flat top-nav with no
home page. `docs/SPEC.md` §29 calls for a sidebar with accordion grouping — validated via a visual
mockup (two navigation options compared side by side); the user chose the sidebar over keeping the
top-nav.

## Scope

**In**: replace the `(protected)` layout's top-nav with an accordion sidebar; a new `/` Overview
page with org-wide totals and a recent-links list. No existing page's internal content changes —
only the shell wrapping them.

**Out**: Folders/Tags management UI and Settings/user-management UI — both named in `SPEC.md` §30
but without a clear ROADMAP phase assignment; left as known pending items, not blocking this
phase's completion. Per-asset "detail screens" beyond what already exists (`/links/[id]`, QR list
in `/qr`) — those were already built in Phases 2 and 5.

## Sidebar (replaces the current top-nav in `app/(protected)/layout.tsx`)

Accordion groups:

- **Overview** — single link, no children, goes to `/`.
- **Assets** — expandable, contains Links (`/links`) and QR Codes (`/qr`).
- **Campaigns** — single link to `/campaigns`.
- **Analytics** — single link; since analytics is per-link today (`/analytics/[linkId]`, no
  standalone landing page), this nav item goes to `/links` with a note, OR is omitted from the
  sidebar entirely until a real analytics landing page exists. **Decision**: omit it — a nav item
  that lands on the links list with a detour isn't a real destination, and adding a fake one
  contradicts "no half-finished implementations." Users reach analytics via the existing "View
  analytics" link on `/links/[id]`.
- **Settings** — visible but disabled/greyed, no route — signals the IA slot exists without
  pretending a feature is there.

## Overview Page (`/`, replaces the current `(protected)/page.tsx` "Welcome" placeholder)

Four stat tiles (reusing the same visual pattern as `/analytics/[linkId]`'s totals):

- Active links (`links.status = 'active'` count for the org)
- Active QR codes (`qr_codes.status = 'active'` count)
- Active campaigns (`campaigns.status = 'active'` count)
- Clicks + scans, human only, last 30 days (new org-wide aggregate query against
  `tracking_events` — the only genuinely new query this phase adds)

Below that: the 5 most recently created links, each linking to its `/links/[id]` detail page.

## Testing

No new pure logic worth TDD'ing — this phase is aggregate read queries and layout restructuring,
not branching business rules. Verified against the live local Supabase stack, and — since the
Chrome extension has been disconnected for the last three phases — a real browser click-through of
the sidebar, Overview, and (if the extension is connected when implementing) a pass back through
Phases 5-7's UI that's never actually been seen rendered.

## Open Questions

None.
