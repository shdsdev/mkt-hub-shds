# Proposal: Events Module

## Intent

The Hub has no way to run an event. Registrations, confirmations, attendee passes, and door check-in are handled ad hoc outside the product, so capacity, attendance, and acquisition source are unknown and unauditable. Deliver the workshop MVP end-to-end: create event → publish landing → register (+companions) → confirm by email → issue QR passes → check in → view results.

## Scope

### In Scope
- `events` admin: list/create/edit/detail; fields name, type label, dates, location, status (draft/published/closed), nullable capacity, per-event reminder timing, per-event toggles over a fixed catalog of optional form fields.
- Public landing per event at `app/events/[slug]` with sections hero, agenda, location, registration form.
- Registration: primary registrant plus companions, each a near-independent attendee record (own name/email/phone, own confirmation, own pass, own backup code). One active registration per `(event, email)`, enforced at DB level.
- Capacity: full events place registrations on waitlist; cancelling a confirmed registration automatically promotes the next waitlisted one and emails its confirmation and pass.
- Cancellation/edit: ADMIN cancels or edits any registration; registrant self-cancels via emailed link (no self-edit).
- Manual ADMIN-added registrations run the same code path and emails, distinguished by `source` (`public_form` | `admin_added`).
- Acquisition source: capture landing-page UTM params via the existing UTM convention and persist on the registration.
- `notifications` module (Resend): confirmation (QR pass + backup code + self-cancel link), one configurable per-event reminder, waitlist-promotion email.
- Attendee passes rendered with the `qr` module's pure `exportQrPng`/`exportQrSvg`; no `qr_codes` rows created.
- Check-in screen on a dedicated route (not `/q/[code]`): authenticated system user scans QR or types the backup code, marks attendance, sees attendee confirmation.
- Registrations admin: search, status filter (confirmed/waitlisted/cancelled/checked-in), companions, contact info, registration date, UTM source, pass status, stats, authorized export.
- Per-event dashboard (ADMIN only): visits, registrations, attendance, conversion.
- Permissions: only ADMIN creates/edits events, adds manual registrations, and views the dashboard; check-in needs any logged-in user.

### Out of Scope (deferred, not cancelled)
- Centralized CRM (lead scoring, pipelines, cross-event identity). Registration, attendee, and contact data stay separable so this migrates cleanly.
- Drag-and-drop visual page builder. Landing pages are hand-built React; event data, public content, and presentation stay separate concerns.
- Offline check-in mode, raffle engine, speakers section, guest/tokenless check-in for external staff — none may be designed out.
- Landing visual design (colors, layout) — iterated later from user references.
- Granular RBAC beyond ADMIN/MARKETING_USER as a general system.

## Capabilities

### New Capabilities
- `event-management`: event entity, lifecycle status, capacity, reminder timing, optional-field toggles, ADMIN authorization.
- `event-public-registration`: public landing content structure, registration form, companions, UTM capture, per-event email uniqueness, waitlist placement.
- `event-attendance`: attendee passes, backup codes, authenticated check-in, attendance records.
- `event-insights`: registrations admin views, export, per-event dashboard metrics.
- `notifications-email`: transactional email delivery contract (confirmation, reminder, waitlist promotion) over Resend.

### Modified Capabilities
None. No existing OpenSpec capability changes at the requirement level.

## Approach

New standalone `src/modules/events` with the repo's `{index.ts,db.ts,service.ts,http.ts}` shape; only `index.ts` is cross-importable (eslint-plugin-boundaries). New thin `src/modules/notifications` owns the Resend adapter so `events` consumes email through a module public interface and stays free of provider SDK concerns. All new tables carry `organization_id` and follow the existing `pgTable`/`pgEnum`/uuid-PK/CHECK-constraint conventions; `src/db/schema.ts` gains one barrel re-export. Admin UI under `app/(protected)/events`; public landing at `app/events/[slug]` following the `app/r/[slug]` and `app/q/[code]` precedent for top-level unauthenticated routes. Check-in resolves on its own route to avoid the redirect module's 302-only tracking invariants. Passes reuse `qr`'s pure render functions only.

Conceptual entities (exact schema belongs to sdd-design): **Event**, **Registration** (group, status, source, UTM), **Attendee** (primary or companion, own contact info, pass code, backup code), **CheckIn**, **NotificationLog**.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/modules/events/` | New | Event, registration, attendee, pass, check-in domain |
| `src/modules/notifications/` | New | Resend transactional email adapter |
| `src/db/schema.ts` | Modified | Barrel re-exports for both new modules |
| `app/(protected)/events/` | New | Admin, registrations, check-in, dashboard |
| `app/events/[slug]/` | New | Public landing and registration |
| `drizzle/` | New | Additive migrations |
| `src/modules/qr/` | Unchanged | Read-only reuse of `exportQrPng`/`exportQrSvg` |
| `.env.example`, `src/lib/env.ts` | Modified | Resend credentials and sender identity |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Attendee identity fused to one event, blocking future CRM | Med | Keep Registration, Attendee, and contact info as separate records from day one |
| Email infrastructure built from zero (deliverability, retries, reminder scheduling) | High | Isolate in `notifications`; persist a send log; idempotent sends keyed per attendee+template |
| Migration drift — uncommitted `drizzle/` migrations already in the tree | Med | Additive migrations only; confirm journal state before generating |
| Waitlist auto-promotion races on concurrent cancellations | Med | Transactional promotion with capacity re-check |
| Check-in route confused with `/q/[code]` tracking semantics | Low | Dedicated route; never touches `tracking_events` |
| Over-scoping the first slice past the 800-line review budget | High | Auto-chain slices: schema+module core → public registration+email → check-in → insights |

## Rollback Plan

Both modules are additive. Unpublish events (status back to draft), remove the two `src/db/schema.ts` barrel lines, delete `app/events/[slug]` and `app/(protected)/events`, revoke the Resend key to stop all sends, and reverse the additive Drizzle migrations after exporting registration data. No existing module's behavior is modified, so no existing flow needs restoring.

## Dependencies

- Resend account, API key, and a verified sending domain.
- A scheduling trigger for reminder emails (cron/scheduled job) — mechanism chosen in sdd-design.
- Existing Supabase Auth session for check-in users; existing UTM capture convention.

## Success Criteria

- [ ] An ADMIN creates and publishes an event, and its public landing is reachable by slug.
- [ ] A public registration with companions produces one confirmation email per attendee, each with its own QR pass and backup code.
- [ ] A second registration with the same email for the same event is rejected.
- [ ] A full event places registrations on the waitlist; cancelling a confirmed one auto-promotes and emails the next.
- [ ] A manual ADMIN-added registration produces the identical emails and passes, recorded as `admin_added`.
- [ ] An authenticated user checks an attendee in by QR scan and by backup code.
- [ ] The registrations admin filters by status and shows UTM acquisition source; the ADMIN-only dashboard reports visits, registrations, attendance, and conversion.
