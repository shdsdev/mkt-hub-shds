# Roadmap: Marketing Hub

> Reconstructed from Engram memory (project "hub marketing") after the original repository at
> `E:/PROYECTOS/MKT/HUB Marketing` was deleted. Source observation:
> `sdd/marketing-hub-design/tasks`. Phase objectives/dependencies are faithful to the original
> planning; per-phase acceptance-criteria wording is condensed since only the task breakdown (not
> full prose) survived in memory.

## How to Read This Roadmap

This document is a sequencing plan for a **future implementation change** — writing it is a
documentation task, not the phases themselves. Phases 0–10 below are what a future `sdd-propose` /
`sdd-design` / `sdd-tasks` cycle will actually build, in order. Everything here must stay
consistent with `SPEC.md` (§45 MVP Scope, §46 Phase 2, §47 Future Modules), `ARCHITECTURE.md`
(module list, invariants), and `DATABASE.md` (migration order).

## Phase 0 — Foundation

**Objective**: repo scaffold and toolchain, so every later phase has a working
build/lint/typecheck/test/compose pipeline.
**Features**: Next.js (App Router, `app/` at repo root) + React + TypeScript + Tailwind + shadcn/ui
scaffold via `pnpm`, Drizzle setup pointed at Supabase Postgres (ADR-005), ten `src/modules/*`
stubs with `eslint-plugin-boundaries` enforcing I-4, locked dark palette + fonts, app-only Docker
image (no db container — Supabase owns Postgres). No CI workflow yet — added once a git remote
exists.
**Dependencies**: none (greenfield).
**Acceptance criteria**: `pnpm check` (lint + typecheck + test + build) runs green on a fresh
clone; a deliberate cross-module `db.ts` import fails lint; the placeholder page renders the locked
palette/fonts; `docker compose up` starts the `app` service and reaches the configured Supabase
Postgres instance (local via `supabase start`, or a real project).

## Phase 1 — Auth + Database

**Objective**: identity and tenancy foundation.
**Features**: Supabase Auth for identity/sessions (ADR-005 — email+password via Argon2id-backed
Supabase infra, CAPTCHA and rate-limiting built in); `organizations` and a `public.users` profile
table (FK to `auth.users.id`, holds `organization_id` + `role` + `status`); coarse 4-role gate
(ADMIN / MARKETING_MANAGER / MARKETING_USER / VIEWER); seed script creates the first ADMIN
organization + profile; no public sign-up.
**Dependencies**: Phase 0.
**Acceptance criteria**: a user can authenticate via Supabase Auth, a session persists, and
role-gated routes reject the wrong role; account-level lockout after repeated failed logins closes
the distributed-brute-force gap that per-IP rate limiting alone doesn't cover.

## Phase 2 — Link Management Core

**Objective**: the shared spine every other module builds on.
**Features**: `links`, `short_links`, `qr_codes` (link_id-FK-only invariant, I-1), `domains`,
`folders`, `tags`, `campaigns` CRUD.
**Dependencies**: Phase 1.
**Acceptance criteria**: creating/updating a link's destination never requires touching a
`short_link` or `qr_code` row; I-1 holds under a direct DB check.

## Phase 3 — Redirect Engine

**Objective**: the actual `/r/:slug` and `/q/:code` resolution paths.
**Features**: 302-only redirects (I-2), async tracking write that never blocks the redirect (I-5).
**Dependencies**: Phase 2.
**Acceptance criteria**: redirect responses are always exactly 302 with `Cache-Control: no-store`;
tracking failures never delay or break the redirect.

## Phase 4 — UTM Builder

**Objective**: campaign-consistent link tagging.
**Features**: validation/encoding, presets, naming enforcement, direct-to-short-link/QR creation
flow.
**Dependencies**: Phase 2.
**Acceptance criteria**: a UTM preset applied to a new link produces a destination URL with
correctly encoded, validated parameters.

## Phase 5 — QR Generator

**Objective**: dynamic and static QR codes.
**Features**: static/dynamic modes (DATABASE.md CHECK constraint), customization,
error-correction level, PNG/SVG export.
**Dependencies**: Phase 2.
**Acceptance criteria**: a static QR never has a `link_id`; a dynamic QR always does; both export
to PNG and SVG.

## Phase 6 — Campaigns

**Objective**: campaign lifecycle and physical print tracking.
**Features**: status lifecycle, Print Runs, association to links/QR, soft-delete/archive
enforcement (I-7).
**Dependencies**: Phase 2.
**Acceptance criteria**: ending a campaign never disables the redirects it created; a resource with
≥1 tracking event or ≥1 print run cannot be hard-deleted.

## Phase 7 — Analytics

**Objective**: the Tracking Engine and reporting surface.
**Features**: `tracking_events` writes (ADR-002 typed FKs), bot flagging (UA-list, I-8),
breakdowns, nightly rollup job, CSV export, GA4 UTM passthrough (Measurement Protocol push
deferred to Phase 2 of the product roadmap, not this phase).
**Dependencies**: Phase 3, Phase 6.
**Acceptance criteria**: every trackable event resolves through a non-null `link_id`; bots are
flagged, not dropped; rollups run nightly before any partition drop.

## Phase 8 — Dashboard

**Objective**: the human-facing surface tying every module together.
**Features**: Overview screen, per-asset detail screens, accordion sidebar information
architecture.
**Dependencies**: Phase 7.
**Acceptance criteria**: a user can go from the dashboard to any link/QR/campaign's detail and
analytics without leaving the Hub shell.

## Phase 9 — Security + Audit

**Objective**: harden the system for production traffic.
**Features**: `audit_logs` wiring (destination-change before/after capture is mandatory), rate
limiting, CSRF/XSS/SQLi protections, secure cookies, brute-force protection.
**Dependencies**: Phase 1 through Phase 8 (cross-cutting).
**Acceptance criteria**: every destination change is recoverable from `audit_logs`; standard OWASP
checks pass on auth and redirect endpoints.

## Phase 10 — Testing + Production

**Objective**: ship it.
**Features**: full test suite, backup strategy, deployment pipeline, monitoring.
**Dependencies**: all prior phases.
**Acceptance criteria**: automated tests cover the redirect/tracking hot path; backups are
verified restorable; deploy pipeline is repeatable without manual steps.

## Cross-Phase Traceability

Every phase above maps back to the MVP scope boundary in `SPEC.md` §45: **MVP 1** = Auth,
Dashboard, Short Links, Dynamic QR, Static QR, UTM Builder, Campaigns, Basic Analytics, Folders,
Tags, QR customization, PNG/SVG export, CSV export, basic Audit Log. Explicitly deferred to
**Phase 2** of the product (not to be silently pulled into Phases 0–10 above): GA4 Measurement
Protocol, advanced custom domains, bulk operations, advanced reports, automations, API keys,
webhooks. **Phase 3**: remaining Hub modules beyond this shortener/QR/campaign scope (e.g. SEO
tools, asset manager, generators).

## Note on Phase 0 Implementation Attempt

A first attempt to execute Phase 0 (`sdd/marketing-hub-phase0-foundation`) got **blocked at Task 0
(toolchain verification), 0/17 tasks complete** — the Bash tool was non-functional in that
execution session. No scaffold code was produced before the repository was lost. That attempt's
design phase, however, DID lock nine concrete decisions (DD1–DD9) that this reconstruction honors:
`app/` at the repo root (not `src/app/`), `pnpm`, Supabase for Postgres/Auth/Storage (ADR-005,
superseding a self-hosted-Postgres framing considered in the original proposal),
`eslint-plugin-boundaries` enforcing the I-4 module rule, ten module stubs
(`src/modules/<m>/{index,service,db,http}.ts`), the exact locked CSS palette, a single Drizzle
schema barrel, and no CI workflow until a git remote exists. A second Phase 0 scaffold was built
directly against npm + `src/app/` + a self-hosted Postgres container before these DD1–DD9 decisions
were located in memory; it was discarded and rebuilt once found.
