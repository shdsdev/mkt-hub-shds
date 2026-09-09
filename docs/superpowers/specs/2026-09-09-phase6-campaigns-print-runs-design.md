# Design: Phase 6 — Campaigns / Print Runs

## Context

`docs/ROADMAP.md` Phase 6: status lifecycle, Print Runs, association to links/QR,
soft-delete/archive enforcement (I-7). The `campaigns` module already has basic CRUD from Phase 2
(create/list/end). This phase adds `print_runs` and closes a gap that's existed since Phase 2:
`links`/`short_links`/`qr_codes`/`campaigns` all have a status column capable of archiving, but
nothing in the UI has ever used it — no delete action exists anywhere either, by design, but
"archive" was never wired up.

## Scope

**In**: `print_runs` table, `scan_rate` computed on read (never stored), an "Archive" action on
links/short links/QR codes (status flip only, no hard-delete anywhere), a "Record print run"
control on the link detail page next to each short link/QR.

**Out**: campaign-level archiving UI (campaigns already have `endCampaign` from Phase 2, which is
the campaign-specific equivalent — no separate "archive a campaign" action needed). Print run
editing/deletion — a recorded print run is itself historical record; SPEC.md doesn't call for
correcting it, and I-7's spirit argues against making print run counts mutable.

## `print_runs` Table (`src/modules/campaigns/db.ts` — same module as `campaigns`, since a print
run's only purpose is print-quantity tracking against a campaign asset)

```
id                uuid PK
organization_id   uuid FK -> organizations
qr_code_id        uuid FK -> qr_codes, nullable
short_link_id     uuid FK -> short_links, nullable
quantity          integer NOT NULL
created_at        timestamptz NOT NULL default now()
```

CHECK (mirrors the `qr_codes` mode CHECK from Phase 5): exactly one of `qr_code_id` /
`short_link_id` is set, never both, never neither.

`scan_rate` is **never stored** — computed on read as `scans / SUM(quantity)`, where `scans` comes
from counting `tracking_events` rows for the associated `qr_code_id`/`short_link_id`. No print run
recorded for a resource → the UI shows "no print run recorded", never a misleading 0% or 100%
(`DATABASE.md`'s explicit rule).

## I-7 Enforcement

No module has ever exposed a hard-delete action — that stays true; this phase doesn't add one.
What's added: an "Archive" button on `/links/[id]` for the link itself and for each listed short
link/QR, which only sets `status = 'archived'` (link) or `'disabled'` (short link/QR — matching the
existing `resource_status` enum values already in the schema). Two-layer protection: the
application never offers hard-delete, and `tracking_events`/`print_runs`' foreign keys are already
`ON DELETE NO ACTION` from when they were created (Phases 3 and this phase respectively) — even a
direct SQL delete attempt against a referenced row is rejected by Postgres.

## UI

On `/links/[id]`, next to each listed short link/QR: a "Record print run" control (quantity input)
and the computed scan rate. An "Archive" button appears on the link itself and on each short
link/QR row; archived items stay visible (filtered or visually de-emphasized) rather than
disappearing, since a printed QR must keep resolving after being archived from active management
view (SPEC.md §14's "printed QR outlives the campaign" principle extends here).

**Resolved conflict with Phase 3** (caught during design review, before implementation): the
redirect engine (`resolveShortLinkByHostAndSlug`) previously checked `shortLink.status !== "active"`
and 404'd on anything else — meaning "Archive" would have silently broken already-printed QR
codes, directly contradicting the product's core promise. Fixed by narrowing that check to
`status === "disabled"` only. The `resource_status` enum's two non-active states now have distinct
meaning:

- **`archived`** — taken out of active management view; the redirect keeps resolving. This is
  what "Archive" (this phase's new button) sets.
- **`disabled`** — deliberately taken offline (abuse, legal takedown, operator error); the
  redirect 404s. No UI sets this yet in this phase — it's reserved for a future moderation/abuse
  action, not exposed as a casual button next to "Archive."

## Testing

No new pure-logic unit worth TDD'ing here — `scan_rate` is a straightforward on-read aggregate
query, not branching logic like the slug/lockout/logo rules in prior phases. Verified via the
established pattern: real queries against the local Supabase stack, exercised through the actual
UI once a browser is available; the print_run CHECK constraint and the archive status flow are
confirmed with direct SQL/service calls if a browser session isn't available when implementing.

## Open Questions

None.
