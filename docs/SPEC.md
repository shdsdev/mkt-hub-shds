# Specification: Marketing Hub

> Reconstructed from Engram memory (project "hub marketing") after the original repository at
> `E:/PROYECTOS/MKT/HUB Marketing` was deleted. Source observation:
> `sdd/marketing-hub-design/spec`, cross-checked against `.../proposal` and `.../explore`. The
> original file held full prose for each of the 51 sections below; what survived in memory is a
> detailed section-by-section index. Sections are reconstructed here at the level of detail the
> index preserved — treat wording as a faithful summary, not a verbatim restore.

## 1. Executive Summary

Marketing Hub is an internal, modular replacement for paid external SaaS tools (Bitly-style URL
shortener, QR code generator) used by the marketing team. Goal: cut recurring subscription cost,
own the click/scan data instead of handing it to a third party, and centralize metrics across
links, QR codes, and campaigns in one dashboard.

## 2. Product Vision

One internal Hub, many Tools (modules) sharing a common core: a link gets shortened, tagged with
UTM parameters, optionally turned into a QR code, and associated with a campaign — all tracked
through a single analytics pipeline the team owns outright.

## 3. Business Objectives

- Eliminate recurring third-party SaaS subscription cost.
- Own first-party click/scan data instead of exporting it from an external vendor.
- Centralize link, QR, and campaign metrics in one dashboard instead of several tools.
- Make QR codes safely reusable across print runs (destination editable after printing).

## 4. Problem Statement

The team currently depends on external shorteners/QR generators that charge recurring fees, silo
analytics behind their own dashboards, and don't integrate destination changes with already
printed QR codes cleanly. There is no single internal source of truth correlating a campaign to
its links, QR scans, and clicks.

## 5. User Types

| Role | Summary |
|---|---|
| `ADMIN` | Full access, including destructive actions and org-level configuration. |
| `MARKETING_MANAGER` | Can edit link destinations, manage campaigns, view all analytics. |
| `MARKETING_USER` | Can create links/QR/campaigns; narrower edit rights than manager (exact matrix is an open question, see §51). |
| `VIEWER` | Read-only access to dashboards and analytics. |

## 6. User Stories

Representative stories driving the functional requirements below: creating a short link with UTM
parameters in one flow; generating a dynamic QR code that can point to a new destination after
being printed on physical material; grouping links/QR codes under a campaign and seeing aggregate
scan/click counts; exporting a campaign's analytics as CSV; recovering a link's destination history
after an accidental edit via the audit log.

## 7. Functional Requirements (FR-01..23)

Each requirement below is classified **MUST** / **SHOULD** / **NICE** / **NOT-RECOMMENDED-YET**.

| ID | Requirement | Class |
|---|---|---|
| FR-01 | Create a `link` holding a destination URL | MUST |
| FR-02 | Create a `short_link` (slug + domain) pointing to a `link` | MUST |
| FR-03 | Edit a link's destination without regenerating any short link or QR | MUST |
| FR-04 | Generate a dynamic QR code pointing to a `link` | MUST |
| FR-05 | Generate a static QR code with a fixed payload (no tracking) | SHOULD |
| FR-06 | Customize QR code appearance (colors, logo, error-correction level) | SHOULD |
| FR-07 | Export QR code as PNG and SVG | MUST |
| FR-08 | Build and validate UTM parameters via presets | MUST |
| FR-09 | Attach UTM parameters directly during link/QR creation | MUST |
| FR-10 | Create a campaign and associate links/QR codes with it | MUST |
| FR-11 | Record a "print run" (physical quantity distributed) against a QR/short link | MUST |
| FR-12 | Compute scan rate as scans ÷ print run quantity | SHOULD |
| FR-13 | Track every redirect as a `tracking_events` row without blocking the redirect | MUST |
| FR-14 | Flag known-bot traffic without dropping it | MUST |
| FR-15 | Deduplicate repeat visits into "unique" counts via cookie/session window, no fingerprinting | MUST |
| FR-16 | Show analytics breakdowns (by link, QR, campaign, device, geo) | MUST |
| FR-17 | Export analytics as CSV | SHOULD |
| FR-18 | Pass UTM parameters through to GA4 (no Measurement Protocol push in MVP) | SHOULD |
| FR-19 | Organize links/QR codes into folders and tags | SHOULD |
| FR-20 | Coarse role-based access control (4 roles) | MUST |
| FR-21 | Record an append-only audit log, with mandatory before/after capture on destination changes | MUST |
| FR-22 | Soft-delete/archive only — no hard delete once a resource has been scanned/clicked or printed | MUST |
| FR-23 | Bulk operations (bulk create/edit) | NOT-RECOMMENDED-YET (Phase 2) |

## 8. Non-Functional Requirements (NFR-01..07)

| ID | Requirement |
|---|---|
| NFR-01 | Redirect endpoint responds fast enough that tracking never adds perceptible latency (async write). |
| NFR-02 | No personally-identifying fingerprinting technique is used for uniqueness. |
| NFR-03 | All environment-specific values (domains, retention period, org id) come from env vars, never hardcoded. |
| NFR-04 | Staging uses a separate database and a separate redirect domain so test QR codes never resolve against production data. |
| NFR-05 | System tolerates tracking-write failures without breaking the redirect (best-effort analytics). |
| NFR-06 | Schema supports multi-tenancy (`organization_id` everywhere) without requiring a rewrite to add a second tenant later. |
| NFR-07 | No 301/308 redirect is ever used on the dynamic redirect endpoints. |

## 9. Module Architecture

Modular monolith, one deployable, one database. Modules: `auth`, `users`, `links`, `redirects`,
`qr`, `utm`, `campaigns`, `analytics`, `integrations`, `audit`. Hub (shell) hosts navigation and
cross-cutting concerns; each module is a Tool exposing a public interface only — see
`ARCHITECTURE.md` for the module-boundary rule and the module dependency diagram.

## 10. Link Management Core

The shared spine: `links` holds the destination (+ UTM). `short_links` and `qr_codes` hold a
`link_id` FK **only** — never a destination column (invariant I-1). Editing a destination means
updating the `links` row; every short link and QR code pointing at it picks up the change
immediately, including already-printed QR codes.

## 11. QR System

Two modes: **dynamic** (has `link_id` + `short_link_id`, trackable, editable after print) and
**static** (fixed `static_payload`, untrackable, uneditable by design). See DATABASE.md's CHECK
constraint enforcing mutual exclusivity between the two modes.

## 12. URL Shortener

A `short_link` = `(domain_id, slug)` unique pair resolving to a `link_id`. Multiple short links
(different domains/channels) can point at the same link for separate attribution.

## 13. UTM Builder

Validates and encodes UTM parameters, offers reusable presets (`utm_presets`), and enforces naming
conventions so campaign reporting stays consistent. Can be invoked directly from the link/QR
creation flow.

## 14. Campaign System

A `campaign` groups links/QR codes for reporting. Campaign status (active/ended/etc.) is
**independent of redirect availability** — ending a campaign never disables the links or QR codes
it contains, because a printed QR must keep working after the campaign that created it ends.

## 15. Tracking Engine

Single `tracking_events` table for all event types (`qr_scan`, `link_click`, `campaign_click`),
discriminated by `source_type`. See ADR-002 in `ARCHITECTURE.md` for why typed nullable FKs were
chosen over a polymorphic `resource_type`/`resource_id` pair.

## 16. Analytics System

Aggregates `tracking_events` by link, QR, campaign, device, and geography. Nightly rollup job
populates `tracking_rollup_daily` for fast historical queries without hitting raw partitioned
event tables.

## 17. GA4 Integration

**MVP**: UTM parameters are correctly generated and passed through in redirect URLs so GA4 (or any
external analytics already embedded on the destination page) attributes traffic correctly. **Phase
2**: server-side GA4 Measurement Protocol push, so scans/clicks can be sent to GA4 directly from
the Hub, not just via the destination page's own tracking.

## 18. Authentication

Standard session-based authentication (`sessions` table, secure cookies). Exact provider/flow
(credentials vs SSO) is an apply-phase implementation detail not locked at the design stage.

## 19. Authorization / RBAC

MVP: coarse `users.role` enum check (ADMIN vs. everyone else) gating destructive actions. A
granular permission matrix per role (who can edit destinations, who can view analytics, who can
create campaigns) is **deferred to Phase 2** — see Open Questions.

## 20. Security

Standard-Web protections apply: parameterized queries only (no string-built SQL), CSRF protection
on state-changing requests, XSS-safe output encoding, secure/`HttpOnly`/`SameSite` cookies, rate
limiting on auth and redirect endpoints, brute-force protection on login.

**Soft-delete rule (verbatim invariant)**: no hard delete once a resource has ≥1 tracking event or
≥1 print run — archive/disable only.

## 21. Privacy

No device fingerprinting (canvas/WebGL/font enumeration) — first-party cookie or server-generated
anonymous session id, ~30-minute session window for uniqueness dedup instead. IP stored as a
truncated/salted hash only, never raw, used only for approximate (country/city-level) geo — never
sold or used internally as exact location. Retention period is a **configurable default of 14
months**, not asserted as legally sufficient under Mexican law (LFPDPPP) — see Open Questions.
Known bots (UA-list matching) are flagged (`is_bot = true`), never silently dropped.

## 22. Database Architecture

`organization_id` on every core table from day one; no Row-Level Security and no tenant-switching
UI/logic in MVP (insurance against a costly future retrofit, not premature complexity). Full
schema in `DATABASE.md`.

## 23. ER Model

See `DATABASE.md` for the full table list, enums, and relational decisions (short_links as a
separate table, static-QR CHECK constraint, print_runs single-FK CHECK, three-layer soft-delete
enforcement, `audit_logs` append-only semantics).

## 24. API Architecture

REST-style module endpoints, e.g. `POST /api/links`, `POST /api/short-links`, `POST /api/qr`,
`POST /api/campaigns`, `GET /api/analytics/:resourceType/:id`. Each module owns its own endpoint
namespace; cross-module reads happen through the module's public interface, never a direct
cross-schema join from another module's route handler.

## 25. Redirect Architecture

Two public routes: `GET /r/:slug` (short link) and `GET /q/:code` (QR code). Both resolve to a
`link_id`, build the final destination URL (destination + UTM), and respond with **302 only**
(never 301/308 — see ADR-003), `Cache-Control: no-store`, no `ETag`. Tracking write happens
asynchronously after the 302 is sent, so a tracking failure never delays or breaks the redirect.

## 26. Analytics Event Schema

Every `tracking_events` row carries: `link_id` (NOT NULL), nullable `short_link_id` / `qr_code_id`
/ `campaign_id` (denormalized at ingest), `source_type` enum, `device_type`, `geo_country` (and
city, approximate), `is_bot`, `visitor_hash`, `session_started_at`, `created_at`. See
`DATABASE.md` for the full index list on this table.

## 27. Folder & Tag System

`folders` group links/QR codes hierarchically for organization; `tags` (many-to-many via
`link_tags`) allow cross-cutting labeling independent of folder structure.

## 28. Audit Log

`audit_logs` (plural) is append-only. Every `destination_change` action MUST capture the
before/after `destination_url` — this is the only way to recover from an accidental or malicious
edit that would otherwise silently redirect every already-printed piece pointing at that link.

## 29. UI Architecture

Dark theme. Palette: background `#1c130f`, foreground `#f7eeeb`, surface `#201915`, muted
`#3d2f29`, primary `#ff6f2c`, primary-hover `#ff8b68`, accent `#30ffe3`. Glassmorphism panels.
Typography: Poppins (headings) / Inter (body). Sidebar uses accordion grouping by module.

## 30. Main Screens

Dashboard Overview, Links list + detail, QR Codes list + detail, Campaigns list + detail,
Analytics (per-resource and aggregate), Folders/Tags management, Audit Log viewer, Settings
(organization, users, roles).

## 31. User Flows

See §32–35 for the four Mermaid-diagrammed creation/consumption flows in the original document
(QR Creation, Short Link Creation, Campaign Creation, Analytics). General pattern: create → tag
(UTM/folder/tags) → optionally attach to a campaign → share/print → track → review analytics.

## 32. QR Creation Flow

Select or create a `link` → choose dynamic or static mode → (dynamic) apply UTM preset and
customize appearance → generate → export PNG/SVG → optionally record a print run.

## 33. Short Link Creation Flow

Enter destination → apply UTM preset (optional) → choose domain + slug (or auto-generate slug) →
create `link` + `short_link` in one step → share the resulting short URL.

## 34. Campaign Creation Flow

Create campaign shell → associate existing links/QR codes or create new ones directly from within
the campaign context → set campaign status → (optional) record print runs against contained QR
codes.

## 35. Analytics Flow

Select a resource (link, QR, campaign) or the aggregate dashboard → choose date range → view
breakdown (device, geo, source_type) → export CSV if needed.

## 36. Error Handling

Redirect endpoints: unknown slug/code → 404, not a default-domain guess. Malformed slug → rejected
before a DB lookup (CHECK-pattern validated). Tracking-write failure → logged and dropped, redirect
unaffected (best-effort analytics per NFR-05).

## 37. Performance

Redirect path is the system's hot path: no auth/rendering middleware in front of it, tracking write
is async and buffered (batch insert, ~500 events/1s timer, flush on SIGTERM).

## 38. Scalability

PostgreSQL-only for MVP (no ClickHouse/Kafka — ADR-004). Documented scaling triggers, not MVP
tasks: introduce a queue if measured p95 regresses or the in-process buffer drops events; rely on
monthly partitioning + rollups before considering a different analytics store.

## 39. Backup Strategy

Standard PostgreSQL backup/restore for the single database; migrations run as a one-shot pre-start
step so backups and schema state stay in lockstep. Full operational detail is a deployment-phase
task (Phase 10).

## 40. Testing Strategy

No test runner exists yet (pre-code stage at the time this spec was written; Strict TDD Mode was
detected as **disabled** — re-detect once a stack is scaffolded). Testing strategy detail belongs
to Phase 0/10 of `ROADMAP.md`.

## 41. Deployment Architecture

Single Docker-compatible app image (Hub + all Tools + redirect handlers) + PostgreSQL. One web
process + one scheduled job runner (daily rollup, partition pre-create/drop). Environments: dev
(Docker Compose), staging (separate DB + separate redirect domain), production.

## 42. Environment Variables

All env-specific values (redirect domain(s), retention period, default organization id, database
connection, GA4 credentials once Phase 2 lands) are environment variables — never hardcoded. Full
inventory is an apply-phase deliverable once the stack is scaffolded (Phase 0).

## 43. Third-Party Dependencies

Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM (ADR-001), PostgreSQL. QR
generation and CSV export libraries to be chosen at implementation time (not locked here).

## 44. Potential Infrastructure Costs

Single app container + single PostgreSQL instance for MVP scale — no message queue, no separate
analytics warehouse, no third-party shortener/QR SaaS fee (the cost this project eliminates).
Exact hosting figures are deployment-phase detail, not fixed in this spec.

## 45. MVP Scope (verbatim from proposal)

**MVP 1**: Auth, Dashboard, Short Links, Dynamic QR, Static QR, UTM Builder, Campaigns, Basic
Analytics, Folders, Tags, QR customization, PNG/SVG export, CSV export, basic Audit Log.

## 46. Phase 2 (verbatim)

GA4 integration (Measurement Protocol), advanced custom domains, bulk operations, advanced reports,
automations, API keys, webhooks. Granular RBAC permission matrix also lands here.

## 47. Future Modules

Remaining Hub modules beyond this shortener/QR/campaign scope — e.g. SEO tools, asset manager,
content generators — named in the roadmap but not detailed in this spec.

## 48. Risks

See `ARCHITECTURE.md` and the proposal's risk table: invariant drift across documents, spec bloat,
open questions silently decided without human input, module-boundary rule staying aspirational
without lint enforcement, legal exposure from IP/geo retention guidance.

## 49. Technical Decisions (ADRs)

Full ADRs live in `ARCHITECTURE.md`:

- **ADR-001** — ORM: Drizzle (uniformly, single ORM).
- **ADR-002** — `tracking_events` uses typed nullable FKs, not a polymorphic pair.
- **ADR-003** — 302-only redirects.
- **ADR-004** — PostgreSQL only for analytics (no ClickHouse/Kafka).

(The design-phase source additionally referenced ADR-numbering for the redirect-code and
polymorphic-tracking decisions under the labels ADR-01/ADR-02 in the original spec draft; they are
the same decisions as ADR-003/ADR-002 above, consolidated here to avoid duplicate numbering.)

## 50. Acceptance Criteria

- [ ] A link's destination can be edited without touching any short link or QR row (I-1 holds).
- [ ] Every redirect response is exactly 302 with `Cache-Control: no-store` (I-2 holds).
- [ ] Every `tracking_events` row has a non-null `link_id` (I-3/ADR-002 holds).
- [ ] A tracking-write failure never delays or breaks a redirect (I-5 holds).
- [ ] Every core table carries `organization_id` (I-6 holds).
- [ ] No resource with ≥1 tracking event or ≥1 print run can be hard-deleted (I-7 holds).
- [ ] No fingerprinting technique is present anywhere in the tracking code path (I-8 holds).
- [ ] Every `destination_change` audit entry captures both before and after values.

## 51. Open Questions

- [ ] Exact legal retention period for IP-derived data under Mexican law (LFPDPPP) — 14 months is
      a configurable default, not a legal answer. Needs legal review.
- [ ] Granular RBAC permission matrix per role (MARKETING_MANAGER vs. MARKETING_USER specifics) —
      deferred to Phase 2; MVP assumption is that only ADMIN and MARKETING_MANAGER may edit link
      destinations.

**Assumptions taken pending the above** (from the proposal, so implementation isn't blocked):
Hub works fully without GA4 in MVP; custom domains are designed-for in the schema but not
MVP-shipped; hard-delete is forbidden once a QR is printed or scanned; primary redirect domain
choice does not block document authorship but does block implementation.
