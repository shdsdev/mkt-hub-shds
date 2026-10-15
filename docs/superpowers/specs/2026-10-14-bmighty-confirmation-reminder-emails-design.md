# BMIGHTY Connect — Confirmation & 48h Reminder Emails

## Context

The events module already sends attendee emails (`confirmation`, `waitlist_promotion`, `reminder`)
through `src/modules/notifications/service.ts`, but the HTML is a placeholder stub
(`attendeePassEmailHtml`, PR2 scope note: "Stub content only ... real copy/branding is a later
concern"). The external cron (`cron-job.org` → `POST /api/jobs/event-reminders`, Bearer-guarded by
`EVENTS_REMINDER_JOB_SECRET`) is already wired and tested for delivery/idempotency, but has never
been exercised against real branded content or the 48h offset specifically.

This change replaces the stub with the BMIGHTY Connect branded templates supplied by the user, and
adds targeted test coverage proving the 48h reminder cron path actually fires on schedule.

**Explicitly out of scope** (deferred to a future generalization pass): per-organization/per-event
branding, a generic template system, a hosted per-attendee QR/pass page, a dedicated registration
management page distinct from the existing cancel page.

## Decisions (confirmed with user)

1. **Branding stays hardcoded.** BMIGHTY Connect copy, colors, and the fixed 3-session agenda ship
   as the one template used for *every* event for now. A comment in the code marks this as a known
   simplification pending generalization.
2. **Google Maps link is auto-generated** from `events.location` (free text) via
   `https://www.google.com/maps/search/?api=1&query=<encodeURIComponent(location)>` — no new DB
   column.
3. **QR stays embedded as base64** (`<img src="data:image/png;base64,...">`), same as today. The
   template's "VER MI QR DE ACCESO" fallback button is dropped — there is no hosted pass page to
   link it to.
4. **"CONSULTAR MI INSCRIPCIÓN" reuses the existing self-cancel page** (`/events/cancel/[token]`),
   keyed by the registration's `cancelToken`. No new page.
5. **`confirmation` and `waitlist_promotion` share one template**, parameterized only by the
   headline/intro line — matching the existing `sendAttendeeEmail` pattern (same content shape,
   different `intro` string).
6. **`reminder` gets its own 48h-copy template** (agenda highlights + discount banner). The
   *trigger* mechanism is unchanged — still the existing single `reminderOffsetMinutes` per event,
   set to `2880` (48×60) for this event. No new scheduling concept.

## Data additions

`AttendeeEmailInput` (notifications/service.ts) gains four fields needed to render the templates:

```ts
eventStartsAt: Date;
eventEndsAt: Date | null;
eventLocation: string | null;
manageUrl: string; // fully-built `${origin}/events/cancel/${cancelToken}`, built by the caller
```

Keeping `manageUrl` as a plain pre-built string (not a token+origin pair) preserves the
notifications module's leaf status (design.md "notifications stays a leaf" — no knowledge of the
events module's route shape).

### Call-site changes (4 places)

| Call site | Has `event` | Has `cancelToken` today | Change |
|---|---|---|---|
| `app/events/[id]/actions.ts` (public registration) | yes | yes (`result.registration.cancelToken`) | pass the 4 new fields |
| `app/(protected)/events/[id]/registrations/actions.ts` → `addCompanionAction` | yes | no | `addAttendeeToRegistration`'s success result gains `cancelToken` (the `registration` row is already loaded inside that transaction — just return the field) |
| same file → `resendInvitationAction` | yes | yes, but only on the parent registration object, dropped by the current `flatMap` | look up the owning registration alongside the attendee instead of flat-mapping it away |
| `app/api/jobs/event-reminders/route.ts` | yes (via `listDueReminderAttendees`) | no | `listDueReminderAttendees`'s JOIN already includes `eventRegistrations` for the status filter — add `cancelToken` to the selected columns and to the `DueReminderAttendee` type |

All four construct `manageUrl` the same way: `` `${env.NEXT_PUBLIC_APP_ORIGIN}/events/cancel/${cancelToken}` ``.

## Template implementation (`notifications/service.ts`)

- New pure helpers (unit-tested in isolation):
  - `formatEventDateEs(date: Date): string` — e.g. `"Viernes 6 de noviembre de 2026"` (`Intl.DateTimeFormat("es-MX", { weekday, day, month: "long", year: "numeric" })`).
  - `formatEventTimeRangeEs(start: Date, end: Date | null): string` — e.g. `"09:00 a 15:00 h"`; falls back to just the start time when `end` is null.
  - `buildGoogleMapsUrl(location: string): string`.
- `confirmationEmailHtml(input: AttendeeEmailInput, headline: string, introLine: string): string` — the BMIGHTY confirmation markup, used by both `sendConfirmationEmail` and `sendWaitlistPromotionEmail`.
- `reminderEmailHtml(input: AttendeeEmailInput): string` — the 48h BMIGHTY markup.
- `attendeePassEmailHtml` (the old stub) is deleted.
- Every admin/user-supplied string (`attendeeName`, `eventName`, `eventLocation`) continues through the existing `escapeHtml`; `manageUrl` is self-built from a UUID-based token + validated origin, but is still escaped before going into an `href` attribute, matching the module's existing defense-in-depth posture. `qrPngBase64` keeps going through `assertBase64`, unchanged.

## Isolation from the parallel check-in work

Another agent is working on `app/(protected)/events/[id]/check-in/*` and
`src/modules/events/check-in-result.ts`. This change's full touch list:

- `src/modules/notifications/service.ts` (+ `service.test.ts`)
- `src/modules/events/service.ts` — only `listDueReminderAttendees` and `addAttendeeToRegistration` (+ `service.test.ts`)
- `app/events/[id]/actions.ts` (+ `actions.test.ts`)
- `app/(protected)/events/[id]/registrations/actions.ts` (+ `actions.test.ts`)
- `app/api/jobs/event-reminders/route.ts` (+ `route.test.ts`)
- this spec file

No overlap with the check-in file set — safe to work in parallel.

## Testing strategy (TDD, RED then GREEN per file)

Standard unit coverage for every new/changed function above, plus — per explicit request —
**dedicated coverage proving the 48h cron path actually works end to end**:

1. **`isReminderDue` boundary tests** (already exists as a pure function in `events/service.ts`;
   add cases pinned to the 48h number specifically, not just generic offsets):
   - `reminderOffsetMinutes = 2880`, `now` exactly 48h before `startsAt` → due (inclusive boundary).
   - `now` one minute before the 48h mark → not due.
   - `now` one minute after `startsAt` (event already started) → not due.
2. **`listDueReminderAttendees` integration-style test** (mocked DB, existing pattern in
   `service.test.ts`): an event with `reminderOffsetMinutes: 2880` and a confirmed, active attendee
   returns that attendee at `now = startsAt - 48h`, and the row includes `cancelToken`.
3. **`event-reminders/route.test.ts`**: extend the existing Bearer-auth/claim tests with a case
   using a 48h-due attendee end to end — asserts `sendReminderEmail` is called with
   `eventStartsAt`/`eventEndsAt`/`eventLocation`/`manageUrl` all populated (not just that it was
   called), and that the HTML produced actually renders the "48 horas" copy and the correct
   Spanish-formatted date/time for that event's `startsAt`.
4. **Template snapshot-ish assertions** in `notifications/service.test.ts`: `sendReminderEmail`
   with a fixed `eventStartsAt` produces HTML containing the expected formatted date string, the
   Maps URL built from `eventLocation`, and the `manageUrl`, with HTML-escaping verified for a
   name/location containing `<`, `>`, `&`.

This gives direct proof — not just "the function was called" — that a cron ping 48 hours before an
event's `startsAt` results in a reminder email carrying correct, real event data.

## Non-goals (explicit)

- No new DB columns or migrations.
- No hosted per-attendee QR/pass page.
- No generic/per-event template system — follow-up work, out of scope here.
