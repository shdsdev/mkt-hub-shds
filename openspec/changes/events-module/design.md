# Design: Events Module

## Technical Approach

Two additive modules in the modular monolith. `src/modules/events` ({`db.ts`,`service.ts`,`http.ts`,`index.ts`}) owns the event/registration/attendee/check-in domain. `src/modules/notifications` is a leaf Resend adapter plus a send log — no business logic, no dependency on `events`. `events` consumes `notifications`, `qr`, `utm`, `users`, and `auth` only through their `index.ts` surfaces (config rule `design`). All tables carry `organization_id → organizations.id` and use the `pgTable`/`pgEnum`/uuid-PK/`check` conventions of `src/modules/qr/db.ts` and `src/modules/campaigns/db.ts`; `src/db/schema.ts` gains two `export *` lines.

## Architecture Decisions

| Decision | Choice and rationale | Rejected |
|---|---|---|
| Contact identity | No `contacts` table now. Person data (`full_name`, `email`, `email_normalized`, `phone`, optional `company`/`job_title`) lives on **exactly one** table, `event_attendees`, and is never copied onto `events` or `event_registrations`. A future CRM migrates by `INSERT INTO contacts SELECT DISTINCT ON (email_normalized) …` then adding a nullable `contact_id`. Identity is therefore not fused to the event (the event link is one FK column, not the shape of the contact data), and no cross-event identity semantics are invented before the CRM defines them. | A `contacts`/`attendee_identity` table now (invents merge/dedupe/ownership rules the CRM will overwrite); contact fields on the registration row (loses companions' own identity). |
| Booking vs person | `event_registrations` = one checkout action (status, source, UTM, cancel token). `event_attendees` = 1 primary + N companions, each with own contact data, pass token, backup code, check-in. Capacity counts attendees (seats), not registrations. | Flat registration-per-person (no atomic group booking, no single cancel link for the party). |
| Active-email uniqueness | Denormalize `event_id` and `is_active boolean` onto `event_attendees` and add `CREATE UNIQUE INDEX … ON event_attendees (event_id, email_normalized) WHERE is_active`. A Postgres partial unique index cannot reference the parent registration's status, so the flag is maintained inside the same transaction as every status change. | Composite unique + CHECK (cannot express "only when not cancelled"); app-level check (racy). |
| Waitlist concurrency | Reuse the `src/modules/users/management.ts` precedent: inside `db.transaction`, `tx.execute(sql\`select id from event_registrations where event_id = ${eventId} for update\`)` serializes every capacity decision for one event, then count confirmed seats → insert `confirmed` or `waitlisted`. Cancellation takes the same lock, flips status + `is_active`, recomputes free seats, and promotes the oldest waitlisted registration that fits. Emails are sent **after** commit, never inside the lock. | Advisory locks (no precedent here); optimistic retry (visible double-overbooking window). |
| Pass + cancel tokens | Opaque `randomBytes(32).toString("base64url")` columns (`pass_token`, `cancel_token`), the `src/modules/agents/tools/contracts.ts` precedent. Unguessable, revocable by column update, no new signing secret, no expiry clock. | Signed JWT/HMAC (new secret, unrevocable until expiry); raw ids (enumerable/forgeable). |
| Backup code | 8 chars Crockford base32 (no I/L/O/U), unique per event, regenerated on collision. Human-typeable at the door. | Sequential/short numeric (guessable, collides across events). |
| Reminder trigger | External cron-job.org POSTs `/api/jobs/event-reminders`, Bearer-guarded against `EVENTS_REMINDER_JOB_SECRET` — identical shape to the existing `app/api/jobs/rollup/route.ts`. | Vercel cron (Hobby is daily-only); in-app scheduler (no long-lived process). |
| Reminder idempotency | `notification_log` has `UNIQUE (subject_id, notification_type)`. The job claims work with `INSERT … ON CONFLICT DO NOTHING RETURNING id`; only a claimed row is emailed. Over-frequent pings and retries after timeout are therefore free. One reminder per event in scope, so attendee+type needs no occurrence discriminator; adding one later is an additive column. | Timestamp-window check (double-sends on retry). |

## Data Flow

    Public: app/events/[slug] (UTM in URL) → registerForEvent()
      → tx[FOR UPDATE] seats → registration + attendees (+ is_active)
      → commit → per attendee: exportQrPng(pass URL) + sendConfirmationEmail()

    Cancel: app/events/cancel/[token] | admin action
      → tx[FOR UPDATE] cancel + is_active=false + promote next waitlisted
      → commit → sendWaitlistPromotionEmail()

    Cron-job.org ──POST(Bearer)──> /api/jobs/event-reminders
      → due events → claim notification_log rows → sendReminderEmail()

    Staff: /(protected)/events/check-in (pass_token | backup_code)
      → one attendee → checked_in_at/by (idempotent: re-scan returns prior time)

## File Changes

| File | Action | Description |
|---|---|---|
| `src/modules/events/db.ts` | Create | `events`, `event_registrations`, `event_attendees`; enums `event_status`, `event_registration_status`, `event_registration_source`; partial unique index; `eventsTables`. |
| `src/modules/events/service.ts` | Create | `createEvent`/`updateEvent`/`publishEvent`, `registerForEvent`, `cancelRegistration`, `promoteFromWaitlist`, `checkInAttendee`, `listRegistrations`, `getEventDashboard`, `dueReminders`. |
| `src/modules/events/{http,index}.ts` | Create | Reminder-job handler logic; public surface only. |
| `src/modules/notifications/{db,service,index}.ts` | Create | `notification_log` (+ enums), `claimNotification`, `sendConfirmationEmail`, `sendReminderEmail`, `sendWaitlistPromotionEmail`. |
| `src/db/schema.ts` | Modify | `export * from "@/modules/events/db"` and `.../notifications/db"`. |
| `drizzle/00XX_events_module.sql` | Create | Additive migration; confirm `_journal.json` head first (uncommitted migrations in tree). |
| `app/events/[slug]/page.tsx`, `.../register-form.tsx`, `.../actions.ts` | Create | Landing (hero/agenda/location/form), UTM capture from `searchParams`. |
| `app/events/cancel/[token]/page.tsx` | Create | Token-scoped self-cancel, no edit. |
| `app/(protected)/events/**` | Create | Admin CRUD, registrations list/export, check-in screen, ADMIN-only dashboard. |
| `app/api/jobs/event-reminders/route.ts` | Create | Bearer-guarded POST, mirrors `jobs/rollup`. |
| `.env.example` | Modify | `RESEND_API_KEY`, `RESEND_FROM`, `EVENTS_REMINDER_JOB_SECRET`, `NEXT_PUBLIC_APP_ORIGIN`. |

## Interfaces / Contracts

```ts
// src/modules/notifications/index.ts — leaf: generic subject, no FK into events
type NotificationType = "confirmation" | "reminder" | "waitlist_promotion";
function claimNotification(i: { organizationId: string; subjectType: "event_attendee";
  subjectId: string; type: NotificationType }): Promise<{ claimed: boolean; logId?: string }>;
function sendConfirmationEmail(i: { logId: string; to: string; attendeeName: string;
  eventName: string; startsAt: Date; location: string; backupCode: string;
  cancelUrl: string; qrPng: Buffer }): Promise<{ ok: boolean; providerMessageId?: string }>;
```

`notification_log`: `id, organization_id, subject_type, subject_id, notification_type, status('pending'|'sent'|'failed'), provider_message_id, error, created_at, sent_at`, `UNIQUE (subject_id, notification_type)`.

`events` reads UTM naming from `@/modules/utm` (`SOURCE_OPTIONS`/`validateSourceValue`) and persists the `utm_source…utm_id` column set exactly as `src/modules/links/db.ts` names them — convention reuse through the public index, no schema sharing.

Reminder job contract: `POST /api/jobs/event-reminders`, `Authorization: Bearer <EVENTS_REMINDER_JOB_SECRET>`; 401 unauthenticated, 500 unconfigured, `200 {ok:true,claimed:n,sent:n}`. Safe at any ping frequency.

RBAC: existing `ADMIN` | `MARKETING_USER` via `isAdmin` from `@/modules/users`; every admin/dashboard/export path is ADMIN-gated, check-in requires any active session (`getCurrentUser` from `@/modules/auth`). No new role.

## Testing Strategy

| Layer | Approach |
|---|---|
| Unit | Backup-code alphabet/length, token opacity, reminder-due window arithmetic, seat counting, email normalization, `is_active` transitions. |
| Integration | Partial unique index rejects a second active registration and allows re-register after cancel; concurrent cancellations promote exactly one waitlisted registration; duplicate reminder-job calls send once; check-in by token and by backup code; re-check-in returns prior timestamp without mutation; 401 on bad Bearer; ADMIN-only guards. |
| E2E | N/A — no E2E suite in this repository (`openspec/config.yaml`). |

## Threat Matrix

| Boundary | Applicability | Safe/failure behavior and planned RED test |
|---|---|---|
| Routing / public route exposure | Applicable | `app/events/[slug]` serves only `published` events (404 for draft); `app/events/cancel/[token]` resolves one registration by opaque token and can only cancel. RED: draft slug 404s, unknown/consumed token cancels nothing, token for registration A cannot cancel B. |
| Process integration (external cron webhook) | Applicable | Constant-compare Bearer; no secret → 500 and no work. RED: missing/wrong/empty header performs zero sends; repeated identical POSTs send once. |
| Executable-file classification | N/A | No file upload or extraction in scope. |
| Shell / subprocess | N/A | No shell or child process. |
| VCS / PR automation | N/A | No VCS operation. |

## Migration / Rollout

Additive only. Confirm `drizzle/meta/_journal.json` head before generating (uncommitted migrations are already in the tree), apply locally, verify the partial unique index and `FOR UPDATE` plan. Configure Resend domain + secrets, then create the first event as `draft`. Auto-chain slices: (1) schema + module core, (2) public landing + registration + confirmation email, (3) waitlist/cancel + reminder job, (4) check-in, (5) insights/dashboard. Rollback per proposal: unpublish, drop the two barrel lines, delete routes, revoke the Resend key, reverse migrations after exporting registrations.

## Open Questions

- [ ] `reminder_offset` storage: Postgres `interval` vs `reminder_offset_minutes integer`. Integer minutes is proposed (trivially comparable in Drizzle, no interval driver mapping); confirm in tasks.
- [ ] Does capacity count waitlisted seats toward any ceiling, or is the waitlist unbounded? Assumed unbounded.
- [ ] Dashboard "visits" source: `app/events/[slug]` has no tracking today; needs a lightweight page-view counter decided in tasks (must not write `tracking_events`).
