# Design: Phase 2 — Link Management Core

## Context

`docs/ROADMAP.md` Phase 2 objective: "the shared spine every other module builds on." Schema for
`links`, `short_links`, `qr_codes`, `domains`, `folders`, `tags`, `link_tags`, `campaigns` is
already locked in `docs/DATABASE.md`. This design covers implementation scope and the choices
`DATABASE.md` left open — it does not reopen the schema.

## Scope

**In**: data layer (Drizzle tables + module services) for links, short links, QR codes, domains,
folders, tags, campaigns; functional (unstyled-but-on-brand) CRUD UI under `(protected)/` using the
locked palette; slug auto-generation; QR PNG/SVG export.

**Out**: `print_runs` (Phase 6), redirect resolution (`/r/:slug`, `/q/:code` — Phase 3), UTM
Builder as its own guided flow (Phase 4 — Phase 2 accepts raw UTM params on the link form),
polished Dashboard IA (Phase 8), domain DNS verification (infrastructure, not in scope for any
phase in this roadmap).

## Module Ownership

Per `ARCHITECTURE.md`'s module list, `domains`/`folders`/`tags` don't have dedicated modules — they
are auxiliary concepts of the shortener. They live in `links`, alongside the `links`/`short_links`
tables themselves. `qr` owns `qr_codes` and QR generation. `campaigns` owns `campaigns` and
link/QR association.

## Data Flow — Short Link Creation (the central case)

1. `links.createLink({ destinationUrl, utmParams? })` → insert into `links`. This is the **only**
   place a destination is ever written (I-1).
2. `links.createShortLink({ linkId, domainId, slug? })`:
   - If `slug` is omitted, generate one via `nanoid` (7 chars, an unambiguous alphabet excluding
     `0/O/1/l/I`).
   - Validate against the `DATABASE.md` CHECK: `^[A-Za-z0-9_-]{3,64}$`.
   - Insert; `UNIQUE(domain_id, slug)` may conflict on a random collision — retry with a fresh
     random slug up to 3 times, then surface a clear error. A user-supplied slug never
     auto-retries; a collision on an explicit slug is reported directly.
3. Editing a link's `destinationUrl` later touches only the `links` row — no `short_link` or
   `qr_code` row changes. This is the acceptance criterion for I-1.

## QR Codes

`qr.createDynamicQrCode({ linkId, shortLinkId, ...customization })` — dynamic QR always carries
both FKs (`DATABASE.md`'s CHECK constraint). `qr.createStaticQrCode({ payload })` — static QR
carries `static_payload` only, both FK columns null. Export via the `qrcode` npm package,
generating PNG and SVG server-side (no canvas/native dependency, no heavy client bundle).

## Domains

Minimal: an ADMIN adds a domain (hostname string); it's marked `active` immediately —
`domain_verification_status` exists as a schema column per `DATABASE.md` but there's no real DNS
verification workflow in this or any roadmap phase (infrastructure concern, explicitly out of
scope). A short link's domain is chosen from existing `domains` rows at creation time.

## UI

All under `(protected)/`, using the locked palette (already applied via `app/globals.css` in Phase
1) — functional, not polished (Dashboard IA is Phase 8):

- `/links` — list + "New link" → form (destination, optional UTM fields, domain select, editable
  slug).
- `/links/[id]` — detail; editing the destination here is the visible proof of I-1 (short
  links/QR codes pointing at it are untouched).
- `/campaigns` — list + simple create/edit (name, status).
- Folders/tags: a lightweight select-or-create input on the link form. No dedicated folder/tag
  management screen yet — not enough volume to justify it before more links exist.

## Testing

Following the Phase 1 pattern: unit-test the one piece of real logic (slug generation — validity,
collision-retry behavior) with Vitest, TDD'd. Everything else is thin CRUD wiring around Drizzle,
verified by running the actual flows in a real browser (Chrome extension) against the local
Supabase stack, the same way Phase 1 caught a real bug that `pnpm check` couldn't see (the
`app/page.tsx` route collision).

## Open Questions

None — `DATABASE.md`'s existing open questions (retention period, permission matrix) don't affect
this phase's scope.
