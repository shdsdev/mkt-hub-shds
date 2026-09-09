# Design: Phase 7 — Analytics

## Context

`docs/ROADMAP.md` Phase 7: tracking_events writes and bot flagging already exist (Phase 3).
Missing: `tracking_rollup_daily` (named in `docs/DATABASE.md` but never created), the nightly
rollup job, a breakdowns view, and CSV export. GA4 UTM passthrough is already satisfied
structurally by Phase 4's UTM Builder — no server-side Measurement Protocol push is in scope
(`docs/SPEC.md` §17 defers that to Phase 2 of the *product* roadmap, a different axis from this
implementation roadmap's phases).

## Scope

**In**: `tracking_rollup_daily` table, a secret-protected HTTP endpoint for an external cron to
trigger the daily rollup, a per-link breakdowns page with totals + daily table (bot vs human,
clicks vs scans) sourced from the rollup table, CSV export of that same data.

**Out**: automatic partition-drop/retention enforcement (documented as a future need, matching how
Phase 3 already deferred the rollup job itself once); charts, cross-campaign comparison, or any
polished dashboard IA (Phase 8); GA4 Measurement Protocol server-side push (product-roadmap Phase
2, not this implementation phase).

## `tracking_rollup_daily` (`src/modules/analytics/db.ts`)

```
id                uuid PK
organization_id   uuid FK -> organizations
link_id           uuid FK -> links
date              date (day granularity, not timestamp)
clicks_human      integer NOT NULL default 0
clicks_bot        integer NOT NULL default 0
scans_human       integer NOT NULL default 0
scans_bot         integer NOT NULL default 0
created_at        timestamptz NOT NULL default now()
```

`UNIQUE(link_id, date)` — the rollup job upserts on conflict. No `visitor_hash`/IP-derived columns,
matching `DATABASE.md`'s explicit design for this table (kept indefinitely after raw events are
dropped).

## Rollup Job

`POST /api/jobs/rollup`, guarded by a bearer-token check against a new `ROLLUP_JOB_SECRET` env var
(server-only, not `NEXT_PUBLIC_`). Groups `tracking_events` by `link_id` + `source_type` + `is_bot`
for any day not yet present in `tracking_rollup_daily` (not just "yesterday" — covers a missed run
without manual intervention), upserts the aggregated counts. An external free cron service (e.g.
cron-job.org) or the deployment host's own cron calls this once daily. No in-app scheduler process
— keeps the single-container deployment model from `ARCHITECTURE.md` unchanged.

## UI

`/analytics/[linkId]`: total clicks/scans split human vs bot, a day-by-day table from
`tracking_rollup_daily`, and an "Export CSV" button streaming that same table. A link from
`/links/[id]` to its analytics page. No charts, no cross-resource comparison — that's Phase 8.

## Testing

TDD on the one piece of pure logic: the CSV-row-formatting function (given rollup rows, produce
correct CSV text — header, escaping, ordering). The rollup job's aggregation query and the
breakdowns page are verified against the live local Supabase stack, matching every prior phase —
including inserting synthetic `tracking_events` rows, running the rollup endpoint, and confirming
the resulting `tracking_rollup_daily` rows and page output are numerically correct.

## Open Questions

None.
