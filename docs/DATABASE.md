# Database: Marketing Hub

> Reconstructed from Engram memory (project "hub marketing") after the original repository at
> `E:/PROYECTOS/MKT/HUB Marketing` was deleted. Source observation:
> `sdd/marketing-hub-design/design`. Faithful in content and decisions; wording may differ from the
> original file. See `ARCHITECTURE.md` for the invariants this schema must satisfy.

## Tables

`organizations`, `users`, `sessions`, `domains`, `folders`, `tags`, `link_tags`, `campaigns`,
`utm_presets`, `links`, `short_links`, `qr_codes`, `print_runs`, `tracking_events`,
`tracking_rollup_daily`, `audit_logs`.

## Enums

- `user_role`: ADMIN / MARKETING_MANAGER / MARKETING_USER / VIEWER
- `user_status`
- `resource_status`: active / disabled / archived
- `campaign_status`
- `domain_verification_status`
- `short_link_kind`: link / qr
- `qr_mode`: dynamic / static
- `tracking_source_type`
- `device_type`
- `audit_action`

## Key Relational Decisions

- **`short_links` is a separate table, not a slug column on `links`**: one destination can need
  multiple published addresses (per domain, per channel) with separate attribution. Folding it
  into `links` would duplicate link rows and destroy the single-source-of-truth invariant.
  `links` = destination, `short_links` = addresses resolving to it.
- **Static QR** is handled without weakening I-1 via a CHECK constraint:
  `(dynamic AND link_id NOT NULL AND short_link_id NOT NULL AND static_payload NULL) OR (static AND link_id NULL AND short_link_id NULL AND static_payload NOT NULL)`.
  A static QR is by definition untrackable and uneditable.
- **`print_runs`** references exactly one of `qr_code_id` / `short_link_id` (CHECK); `scan_rate =
  scans / SUM(quantity)`; no print run recorded → UI shows "no print run recorded", never 0% or
  100%.
- **Soft-delete** is enforced in three layers: application check (authoritative for MVP), `ON
  DELETE RESTRICT` FKs from `tracking_events` / `print_runs`, and an optional `BEFORE DELETE`
  trigger as defense in depth (noted because partition drops eventually lapse the FK protection).
- **`audit_logs`** (plural) is append-only; `action = 'destination_change'` MUST capture
  before/after `destination_url` — recoverable forever, because a destination change silently
  redirects every printed piece.
- **Campaign status never gates redirect resolution** — a printed QR outlives the campaign it was
  created for.

## `tracking_events` (ADR-002)

`link_id NOT NULL` FK + nullable `short_link_id`, `qr_code_id`, `campaign_id` (denormalized at
ingest for historical attribution) + `source_type` enum (`qr_scan` / `link_click` /
`campaign_click`). A CHECK ties `source_type` to the populated FK. This table is monthly-range
**partitioned** by `created_at`; primary key is `(id, created_at)` because of partitioning.

### Indexes on `tracking_events` (all on the partitioned parent)

- `(link_id, created_at DESC)`
- `(campaign_id, created_at DESC) WHERE campaign_id IS NOT NULL`
- `(organization_id, created_at DESC)`
- `(qr_code_id, created_at DESC) WHERE qr_code_id IS NOT NULL`
- `(short_link_id, created_at DESC) WHERE short_link_id IS NOT NULL`
- `(visitor_hash, session_started_at)`
- `(organization_id, created_at DESC) WHERE is_bot = false`
- `(organization_id, geo_country, created_at DESC)`

### Hot-path index

`UNIQUE (domain_id, slug)` on `short_links`.

## Multi-Tenancy

`organization_id` on every core table from day one (I-6). No Row-Level Security and no
tenant-switching UI/logic in MVP — this locks in the expensive schema decision cheaply now while
deferring actual multi-tenant enforcement until/unless a second tenant is needed.

## Retention / Partitioning

Raw `tracking_events` rows: configurable **14-month** default retention (open legal question under
LFPDPPP, not a fixed engineering default) → nightly rollup into `tracking_rollup_daily` (kept
indefinitely, no visitor/IP hashes) → monthly job verifies rollup coverage before
`DROP TABLE tracking_events_YYYY_MM`. Roll up first, drop second, always.

## Migration Order (referenced by ROADMAP.md phase dependencies)

1. `organizations`, `users`, `sessions` (Phase 1 — Auth + Database)
2. `domains`, `folders`, `tags`, `link_tags`, `campaigns`, `links`, `short_links`, `qr_codes`
   (Phase 2 — Link Management Core)
3. `print_runs` (Phase 6 — Campaigns)
4. `tracking_events`, `tracking_rollup_daily` (Phase 7 — Analytics)
5. `audit_logs` (Phase 9 — Security + Audit)

## Open Questions

- [ ] Legal retention period under LFPDPPP for IP-derived data.
- [ ] Exact permission matrix per role, specifically who may edit link destinations.
- [ ] Formal soft-delete/archive policy wording and who may perform it.
