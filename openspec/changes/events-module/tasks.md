# Tasks: Events Module

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 3400-4400 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 5 (feature-branch-chain) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema + events/notifications module core + env secret | PR1→tracker | `pnpm test src/modules/events/db src/modules/notifications src/lib/env` | `drizzle-kit generate` dry-run against local Supabase | drop `drizzle/00XX_events_module.sql`, revert 2 schema.ts barrel lines |
| 2 | Admin event CRUD + notifications send/idempotency | PR2→PR1 | `pnpm test src/modules/events/service app/\(protected\)/events/actions src/modules/notifications` | `pnpm dev`, create/edit event as ADMIN | revert `app/(protected)/events/**`, feature stays unreachable (no public route yet) |
| 3 | Public landing + registration + confirmation email + waitlist + self-cancel | PR3→PR2 | `pnpm test app/events src/modules/events/service` | `pnpm dev`, register against seeded event incl. concurrent waitlist test | revert `app/events/**`, registration route unwired |
| 4 | Check-in route + reminder webhook | PR4→PR3 | `pnpm test app/\(protected\)/events/check-in app/api/jobs/event-reminders` | `curl` webhook with Bearer header against dev DB | revert check-in route + `app/api/jobs/event-reminders/route.ts` |
| 5 | Registrations/participants admin + per-event dashboard | PR5→PR4 | `pnpm test app/\(protected\)/events/registrations app/\(protected\)/events/dashboard` | `pnpm dev`, ADMIN views dashboard/export | revert admin insights routes only |

## Phase 1: Schema & Module Core (PR1) — COMPLETE (commit `8d97e01` on `feature/events-module-pr1-schema-core`, off tracker `feature/events-module`)

- [x] 1.1 RED: `src/modules/events/db.test.ts` — asserts `events`, `event_registrations`, `event_attendees` tables exist with `organization_id` FK, status enums, nullable capacity, `reminder_offset_minutes`, partial unique index `(event_id, email_normalized) WHERE is_active`.
- [x] 1.2 RED: `src/modules/notifications/db.test.ts` — asserts `notification_log` table with `UNIQUE(subject_id, notification_type)`, generic `subject_type`/`subject_id` columns (no FK into events).
- [x] 1.3 GREEN: define `events`, `event_registrations`, `event_attendees` tables in `src/modules/events/db.ts` following `src/modules/qr/db.ts` conventions; add `notification_log` in `src/modules/notifications/db.ts`.
- [x] 1.4 GREEN: `drizzle/0027_events_module.sql` — **hand-authored**, not raw `drizzle-kit generate` output. Confirmed drift: `drizzle/meta/_journal.json`/snapshot chain is missing snapshots for 0021/0022 and has no journal entries at all for 0024-0026 (on-disk `.sql` files exist for all of them). A scratch `drizzle-kit generate` run reproduced `CREATE TABLE` for `agent_version_tool_bindings`/`agent_tool_confirmations`/`agent_draft_tool_assignments`/`agent_pending_tool_interactions` (already created by the un-journaled 0024-0026 files) mixed into the real diff; that output was discarded, not committed. Migration content verified against that same clean subset. **Needs maintainer action**: reconcile/regenerate `meta/0021,0022,0024,0025,0026_snapshot.json` and journal entries for idx 24-26 before the next `drizzle-kit generate` in this repo.
- [x] 1.5 GREEN: add two `export *` barrel lines to `src/db/schema.ts` for the new modules.
- [x] 1.6 RED: `src/lib/env.test.ts` — add case asserting `env.EVENTS_REMINDER_JOB_SECRET` throws a named error when unset (same `required()` pattern as `AI_CREDENTIALS_ENCRYPTION_KEY`), never read via raw `process.env`.
- [x] 1.7 GREEN: add `EVENTS_REMINDER_JOB_SECRET` getter to `env` object in `src/lib/env.ts`; add `RESEND_API_KEY`, `RESEND_FROM`, `NEXT_PUBLIC_APP_ORIGIN` getters. `.env.example` update **BLOCKED** — sandbox permission deny rule refused both Read and Bash access to that path; user must manually add the 4 keys.
- [x] 1.8 RED/GREEN: `src/modules/events/service.test.ts` + `service.ts` skeleton — backup-code alphabet/length (8-char Crockford base32, no I/L/O/U), opaque pass/cancel token generation (`randomBytes(32).toString("base64url")`), email normalization.
- [x] 1.9 GREEN: `src/modules/events/index.ts` and `src/modules/notifications/index.ts` public barrels only (no internal exports), matching boundary rules.

## Phase 2: Admin Event CRUD + Notifications (PR2) — COMPLETE (commit `95693e2` on `feature/events-module-pr2-admin-notifications`, off PR1 branch)

- [x] 2.1 RED: `src/modules/events/service.test.ts` — ADMIN-only event create/update/publish/close; draft events rejected from public read path; nullable capacity accepted.
- [x] 2.2 GREEN: event CRUD functions in `src/modules/events/service.ts` (`createEvent`/`updateEvent`/`setEventStatus`/`listEvents`/`getEvent`/`getPublishedEventBySlug`).
- [x] 2.3 RED: `app/(protected)/events/actions.test.ts` — server actions call `isAdmin`/`isActive` from `@/modules/users`, reject non-admin/inactive without touching the service or revalidating.
- [x] 2.4 GREEN: `app/(protected)/events/page.tsx`, `app/(protected)/events/[id]/edit/page.tsx`, `app/(protected)/events/actions.ts` (list/create/edit/publish/close) + `event-create-form.tsx`/`event-edit-form.tsx` client components. No sidebar nav link added (out of scope).
- [x] 2.5 RED: `src/modules/notifications/service.test.ts` — `claimNotification` uses `INSERT ... ON CONFLICT DO NOTHING RETURNING id`; duplicate claim for same `(subject_id, notification_type)` returns no row; `status` transitions pending→sent/failed recorded.
- [x] 2.6 GREEN: `src/modules/notifications/service.ts` — minimal fetch-based Resend REST adapter (no new npm dependency), `claimNotification`, `sendConfirmationEmail`, `sendReminderEmail`, `sendWaitlistPromotionEmail` (stub content only; callers wired in later PRs). **Post-review fix**: added `escapeHtml()`/`assertBase64()` to prevent HTML injection via attendee name/event name and to validate the QR base64 payload before embedding it in an `<img src>` data URI — see apply-progress for detail.

**Runtime-ledger note**: this PR2 attempt settled `passed` (65 new tests, 297/297 full suite, lint+tsc clean) but recorded `changed_lines: 1408` against an `800`-line attempt budget — `gentle-ai sdd-attempt settle` returned `blocked`/`decision_required: true`/`next_action: reset`. This is a budget-accounting gate, not a quality failure; a maintainer/orchestrator decision is needed before the chain formally advances to PR3.

## Phase 3: Public Registration, Waitlist, Self-Cancel (PR3)

- [ ] 3.1 RED: `app/events/[slug]/page.test.tsx` (or route test) — draft event returns 404; published event renders hero/agenda/location/form sections, no speakers section.
- [ ] 3.2 GREEN: `app/events/[slug]/page.tsx` reading UTM from URL via `@/modules/utm`.
- [ ] 3.3 RED: `src/modules/events/service.test.ts` — registration + companions: each companion gets own email/backup code/pass token; per-event active-email uniqueness rejects duplicate active registration, allows re-register after cancel.
- [ ] 3.4 RED: `src/modules/events/service.test.ts` — capacity enforcement: seat count by attendees not registrations; over-capacity registration is waitlisted.
- [ ] 3.5 RED: `src/modules/events/service.test.ts` — concurrency-safe waitlist: `tx.execute(sql`select ... for update`)` serializes capacity decisions; concurrent cancellations promote exactly one waitlisted registration.
- [ ] 3.6 GREEN: `registerForEvent` in `src/modules/events/service.ts` — `db.transaction` with `FOR UPDATE`, seat counting, confirmed/waitlisted assignment, `is_active` maintained in same transaction as status change.
- [ ] 3.7 GREEN: `cancelRegistration` — same lock pattern, flips `is_active=false`, recomputes free seats, promotes oldest fitting waitlisted registration; emails sent after commit only.
- [ ] 3.8 RED: `app/events/[slug]/actions.test.ts` — manual admin-added registration uses `source=admin_added`, identical email/pass flow as public.
- [ ] 3.9 GREEN: `app/events/[slug]/register-form.tsx`, `app/events/[slug]/actions.ts`.
- [ ] 3.10 RED: `app/events/cancel/[token].test.ts` — unknown token no-op; token A cannot cancel registration B; valid token self-cancels only (no self-edit).
- [ ] 3.11 GREEN: `app/events/cancel/[token]/page.tsx`.
- [ ] 3.12 RED: `src/modules/notifications/service.test.ts` — confirmation email sent per attendee with own QR (via `exportQrPng`/`exportQrSvg` from `@/modules/qr`, no `qr_codes` rows) + backup code; waitlist promotion email has identical content shape.
- [ ] 3.13 GREEN: wire `sendConfirmationEmail` call after registration commit; wire `sendWaitlistPromotionEmail` after promotion commit.

## Phase 4: Check-In + Reminder Webhook (PR4)

- [ ] 4.1 RED: `app/(protected)/events/check-in/route.test.ts` — authenticated session required (`getCurrentUser` from `@/modules/auth`); no guest/tokenless mode; accepts pass_token or backup_code; re-scan returns prior `checked_in_at` without mutation (idempotent).
- [ ] 4.2 GREEN: dedicated check-in route — distinct from `/q/[code]`, no `tracking_events` writes; registration flips to `checked_in` on first attendee check-in.
- [ ] 4.3 RED: `app/api/jobs/event-reminders/route.test.ts` — missing/wrong Bearer header vs `env.EVENTS_REMINDER_JOB_SECRET` returns 401/500 and sends zero emails; repeated POSTs for same due event send exactly once (claim via `notification_log` unique constraint).
- [ ] 4.4 GREEN: `app/api/jobs/event-reminders/route.ts` reading secret through `env.EVENTS_REMINDER_JOB_SECRET` (NOT raw `process.env`, unlike the out-of-scope `app/api/jobs/rollup/route.ts`); claims due reminders, calls `sendReminderEmail`.

## Phase 5: Registrations Admin + Dashboard (PR5)

- [ ] 5.1 RED: `app/(protected)/events/[id]/registrations/page.test.tsx` — ADMIN-only; search/filter by status (confirmed/waitlisted/cancelled/checked-in); shows companions, contact, date, UTM source, pass status.
- [ ] 5.2 GREEN: `app/(protected)/events/[id]/registrations/page.tsx` + filter/search server action.
- [ ] 5.3 RED: `app/(protected)/events/[id]/registrations/export.test.ts` — export route rejects non-ADMIN.
- [ ] 5.4 GREEN: authorized CSV/export route.
- [ ] 5.5 RED: `app/(protected)/events/[id]/dashboard/page.test.tsx` — ADMIN-only; shows visits, registrations, attendance, conversion; visits source does not write `tracking_events`.
- [ ] 5.6 GREEN: `app/(protected)/events/[id]/dashboard/page.tsx`.
- [ ] 5.7 Full-suite check: `pnpm test` + `pnpm check` across all 5 slices; confirm flags/routes additive and existing modules (`qr`, `utm`, `users`, `auth`) untouched beyond their public `index.ts` usage.
