# Design: Phase 3 — Redirect Engine

## Context

`docs/ROADMAP.md` Phase 3 objective: `/r/:slug` and `/q/:code` resolution, 302-only, async
tracking write that never blocks the redirect (I-2, I-5). `docs/DATABASE.md`'s own migration order
puts `tracking_events` in Phase 7 (Analytics) — but the redirect route can't honestly claim to
track without a real table to write to. Resolved with the user: pull `tracking_events` forward
into this phase (schema only, not the rollup job / retention automation / breakdowns UI, which
stay Phase 7), and build it **partitioned from day one** since Postgres can't partition an existing
table without recreating it — deferring that would mean a painful migration later for no benefit.

## Scope

**In**: `tracking_events` table (partitioned, minimal-but-correct row shape), `/r/[slug]` and
`/q/[code]` route handlers, the in-process buffered batch-insert tracking engine (per
`ARCHITECTURE.md`'s locked design — not simplified), basic bot UA-list flagging and a
session/visitor cookie for uniqueness dedup, redirect threat-matrix mitigations.

**Out**: `tracking_rollup_daily`, the nightly rollup job, retention/partition-drop automation,
analytics breakdowns UI, CSV export, GA4 Measurement Protocol push, precise geo IP lookup (all
Phase 7 — `geo_country`/`device_type` are nullable columns for now, filled in without touching the
rest of the pipeline once a lookup approach is chosen).

## `tracking_events` Table

Logical shape declared in `src/modules/analytics/db.ts` (Drizzle `pgTable`, for typed queries):

```
id                uuid, part of composite PK (id, created_at) — partitioning requirement
organization_id   uuid NOT NULL
link_id           uuid NOT NULL
short_link_id     uuid (nullable)
qr_code_id        uuid (nullable)
campaign_id       uuid (nullable, denormalized at ingest)
source_type       tracking_source_type enum NOT NULL (qr_scan | link_click)
is_bot            boolean NOT NULL default false
visitor_hash      text NOT NULL (session cookie value, hashed)
session_started_at timestamptz NOT NULL
device_type       text (nullable — Phase 7)
geo_country       text (nullable — Phase 7)
created_at        timestamptz NOT NULL default now()
```

Drizzle-kit cannot express `PARTITION BY` — the generated migration's `CREATE TABLE` statement is
hand-edited to add `PARTITION BY RANGE (created_at)` plus an explicit first partition
(`tracking_events_YYYY_MM` for the current month), matching the naming pattern already documented
in `DATABASE.md`. Indexes from `DATABASE.md` are created on the partitioned parent as originally
specified.

## Routes

`app/r/[slug]/route.ts` and `app/q/[code]/route.ts` (both outside `(protected)/` — public,
unauthenticated by design):

1. Validate the path segment against the slug CHECK pattern before any DB query; malformed → 404.
2. Resolve `(host, slug)`: look up `domains` by request hostname, then `short_links` by
   `(domain_id, slug)`. Not found → 404 (never a default-domain fallback).
3. Load the associated `links` row for `destination_url` + UTM params; build the final URL.
4. Respond **302**, `Cache-Control: no-store`, no `ETag`. Never 301/308 (ADR-003).
5. Enqueue a tracking event (see below) — fire-and-forget from the response's perspective, the
   redirect has already been sent.

The two routes differ only in `source_type` (`link_click` vs `qr_scan`) — a dynamic QR's payload
encodes the same short link slug it's associated with (Phase 2's `qr/service.ts` already builds it
this way), so both routes resolve through the same `short_links` lookup.

## Tracking Buffer

`src/modules/analytics/buffer.ts` — an in-process singleton (valid because the deployment target
is one persistent Node container, not serverless/edge, per `ARCHITECTURE.md`'s deployment
section):

- `enqueue(event)` pushes into an in-memory array.
- A `setInterval` timer flushes every 1s; `enqueue` also triggers an immediate flush if the buffer
  reaches 500 events, whichever comes first.
- Flush = one Drizzle batch `insert` of the buffered rows, then clear the buffer. A failed insert
  is logged and the batch is dropped — analytics is best-effort (NFR-05); it never retries at the
  cost of blocking anything.
- `SIGTERM`/`SIGINT` handlers force a final flush so a container restart doesn't silently drop the
  last <1s of events.

## Bot Flagging & Visitor Identity

`src/modules/analytics/bot.ts` — UA-list matching (WhatsApp, Slack, Facebook, Discord, Telegram,
LinkedIn, common search bots) sets `is_bot`; unmatched traffic is `is_bot = false`, never dropped
either way (I-8). `src/modules/analytics/visitor.ts` — reads/sets a first-party, short-lived,
non-cross-site cookie (or generates one) as `visitor_hash`; no fingerprinting, no persistent
personal identifier.

## Threat Matrix (already named in `ARCHITECTURE.md`, applied here)

- **Open redirect**: destination always comes from the `links` row, never from request params.
- **Slug enumeration / injection**: CHECK-pattern validated before any query; parameterized lookup
  only.
- **Header/host spoofing**: unrecognized `Host` → 404, never a default-domain guess.
- **Cache poisoning**: `Cache-Control: no-store`, no `ETag`; a test asserts the status is exactly
  302.

## Testing

TDD, matching the pattern from Phases 1-2, on the pure-logic pieces: bot UA matching, the buffer's
accumulate/flush-at-500-or-1s/clear behavior (with a fake timer). Route resolution and the actual
302 response are verified in a real browser against the local Supabase stack, the same way prior
phases caught real bugs `pnpm check` couldn't see.

## Open Questions

None new. `DATABASE.md`'s existing open questions (retention period, permission matrix) still
don't affect this phase.
