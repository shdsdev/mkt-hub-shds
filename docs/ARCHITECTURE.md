# Architecture: Marketing Hub

> Reconstructed from Engram memory (project "hub marketing") after the original repository at
> `E:/PROYECTOS/MKT/HUB Marketing` was deleted. Source observations:
> `sdd/marketing-hub-design/design`, `.../explore`, `.../proposal`. Faithful in content and
> decisions; wording may differ from the original file.

## Technical Approach

Modular monolith on Next.js/React/TypeScript + PostgreSQL, one deployable, one database, ten
internal modules: `auth`, `users`, `links`, `redirects`, `qr`, `utm`, `campaigns`, `analytics`,
`integrations`, `audit`. Link Core is the shared spine; a single Tracking Engine ingests all
events.

## Module Boundary Rule

Cross-module access happens **only** through public module interfaces — no direct cross-module
ORM/database access. This is an explicit architectural rule, not just an aspiration, and should be
lint-enforced (import boundaries) once code exists. Without enforcement, the "add a module without
touching others" property erodes over time.

## Locked Invariants (must match SPEC.md and DATABASE.md)

| # | Invariant |
|---|---|
| I-1 | `qr_codes` / `short_links` have NO destination column; `link_id` FK only. Destinations change on `links` only. |
| I-2 | 302 only; 301/308 forbidden; `Cache-Control: no-store`. |
| I-3 | One `tracking_events` table with `source_type` discriminator (qr_scan / link_click / campaign_click). |
| I-4 | Module boundaries: public interfaces only, no cross-module ORM access; lint-enforced once code exists. |
| I-5 | Tracking never blocks the redirect (302 sent first, then buffered async insert). |
| I-6 | `organization_id` on every core table; no RLS, no tenant switching in MVP. |
| I-7 | No hard delete once a resource has ≥1 tracking event or ≥1 print run — archive/disable only. |
| I-8 | No fingerprinting; hashed IP only; geo explicitly approximate; bots flagged not dropped. |

## Architecture Decision Records

### ADR-001 — ORM: Drizzle ORM (uniformly, single ORM)
- **Alternatives rejected**: Prisma (better DX but slower writes; partitioning/batch inserts on the
  hot path need raw-SQL escape hatches anyway); Drizzle-hot-path + Prisma-elsewhere (two
  schemas/migration tools, drift risk for a small team); raw SQL only.
- **Rationale**: the schema's hardest requirements — monthly range partitioning, batched multi-row
  inserts on the redirect path, composite/partial indexes — are native in Drizzle, and Prisma's DX
  advantage disappears exactly where it matters. ~5x write throughput extends the runway of the
  PostgreSQL-only decision.
- **Trade-offs**: more SQL literacy required (mitigated by service-interface encapsulation),
  smaller ecosystem, no Prisma Studio equivalent, costly to reverse later (accepted deliberately).

### ADR-002 — `tracking_events` uses typed nullable FKs, not a polymorphic `resource_type`/`resource_id`
- **Chosen**: `link_id NOT NULL` FK + nullable `short_link_id`, `qr_code_id`, `campaign_id` +
  `source_type` enum; `campaign_id` denormalized at ingest.
- **Rejected**: polymorphic pair (no referential integrity on the highest-volume table, CASE/UNION
  joins, less selective indexes); per-type tables (violates I-3).
- **Rationale**: every trackable event resolves through a link, so `link_id` is universally
  non-null → the dominant query (events for link X in range Y) is one composite index seek. New
  trackable types cost a small explicit migration, preferable to permanently unconstrained
  references.
- **Trade-offs**: nullable columns grow with new types; requires a CHECK tying `source_type` to the
  populated FK; denormalized `campaign_id` can diverge from the current campaign (intentional —
  historical attribution).

### ADR-003 — 302 redirects only
301/308 are aggressively cached (destination becomes uneditable AND scans go uncounted, silently);
307 is equivalent to 302 but method preservation is meaningless for GET-only traffic. Trade-off: no
CDN-cached shortcut, so the redirect path must stay fast and free of auth/rendering middleware.

### ADR-004 — PostgreSQL only for analytics (no ClickHouse/Kafka)
Monthly partitioning (required anyway for retention) + composite indexes + daily rollups cover
internal-tool volume. Scaling triggers are documented, not implemented.

## Data Flow

Final destination → `links` (holds destination + UTM) → `short_links` (domain_id + slug + link_id)
→ Redirect `GET /r/:slug` or `/q/:code` → 302 → async tracking write → `qr_codes` (link_id +
short_link_id).

**Redirect path**: resolve `(host, slug)` via `UNIQUE(domain_id, slug)` → build target =
destination + UTM → send 302 → hand event to bounded in-process buffer (≈500 events / 1s timer,
batch INSERT, SIGTERM flush) → `tracking_events`. No Redis/Kafka/queue in MVP; a queue is a
documented scaling trigger keyed on measured p95 regression or buffer drops. Ingest failures are
logged and dropped — analytics is best-effort, redirect correctness is not.

**Retention lifecycle**: raw events retained a configurable **14 months** (never hardcoded — open
LFPDPPP legal question) → nightly rollup into `tracking_rollup_daily` (kept indefinitely, no
visitor/IP hashes) → monthly job verifies rollup coverage → `DROP TABLE tracking_events_YYYY_MM`.
Roll up first, drop second, always.

## RBAC / GA4 / UI (cross-reference)

- **RBAC MVP**: `users.role` enum only, coarse ADMIN-vs-rest gate for destructive actions; granular
  permission matrix + policy table deferred to Phase 2 (documented in the `auth` module section).
- **GA4**: no MVP schema impact beyond storing/passing UTM correctly; Measurement Protocol push is
  Phase 2, inside the `integrations` module.
- **UI**: Next.js + React + TS + Tailwind + shadcn/ui; dark theme, `#ff6f2c` primary, `#30ffe3`
  accent, glassmorphism, Poppins/Inter — full detail lives in SPEC.md §29 UI Architecture. Exact
  theming mechanism is an apply-phase implementation detail.

## Deployment

Docker-compatible single app image (Hub + Tools + redirect handlers) + PostgreSQL; migrations as a
one-shot pre-start step. Environments: dev (compose), staging (separate DB and separate redirect
domain so test QRs never resolve against prod), prod. One web process + one scheduled job runner
(daily rollup, partition pre-create/drop). All env-specific values as env vars — no hardcoded
domain, retention period, or organization id.

## Threat Matrix (redirect routing boundary)

- **Open redirect**: Applicable. `destination_url` CHECK restricts to `http(s)://`; destination is
  operator-supplied, never request-supplied. Test: request-provided URL parameters must never
  influence the `Location` header.
- **Slug enumeration / injection**: Applicable. Slug CHECK `^[A-Za-z0-9_-]{3,64}$`; parameterized
  lookup only.
- **Header/host spoofing**: Applicable. Unknown `Host` must not resolve; falls back to 404/domain
  fallback, never a default domain guess.
- **Cache poisoning of redirects**: Applicable. `Cache-Control: no-store`, no ETag; test asserting
  status is exactly 302.
- Shell commands, subprocesses, VCS/PR automation, executable-file classification: N/A.

## Open Questions

- [ ] Legal retention period under LFPDPPP (14 months is a configurable default, not a legal answer).
- [ ] Primary redirect domain(s) and whether custom domains ship in MVP.
- [ ] Exact permission matrix per role — specifically who may edit link destinations.
- [ ] Formal soft-delete/archive policy wording and who may perform it.
- [ ] GA4 Measurement Protocol timing (assumed Phase 2).
