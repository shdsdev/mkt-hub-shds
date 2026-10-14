# Reception Check-in and Internal Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add event-scoped Reception access, tablet QR check-in, manual folio fallback, and an Admin-only internal registration form.

**Architecture:** Add `RECEPTION` and an event/user assignment table, then centralize server-side event authorization. Keep attendee-level check-in authoritative, expose a shared result contract to both QR and manual flows, and isolate Admin-only companion/registration mutations in a separate internal-form route.

**Tech Stack:** Next.js 16.3.4 App Router, React 19, TypeScript, Drizzle/Postgres, Supabase Auth, Base UI/shadcn components, Vitest, `@zxing/browser`.

## Global Constraints

- Reception is limited to `Registros` and `Check-in` for assigned events.
- Admin retains full event and registration administration.
- QR payload is the existing eight-character uppercase alphanumeric backup code.
- QR scanning is the primary flow; manual folio entry is the fallback.
- Confirmation-before-entry is event-scoped and defaults to enabled.
- A check-in is complete only when the individual attendee has `checkedInAt`.
- Repeated scans are idempotent and must not rewrite an existing check-in.
- The implementation must support Android/Chrome and iPad/Safari.
- Do not expose information from another event when a code is submitted.
- Every mutation must validate organization, role, event assignment, and active status on the server.
- Do not modify unrelated worktree changes.

---

### Task 1: Add Event Reception Data Model

**Files:**
- Modify: `src/modules/users/db.ts:4-10`
- Modify: `src/modules/events/db.ts:45-105`
- Create: `src/modules/events/reception-db.ts`
- Create: `drizzle/0023_reception_checkin.sql`
- Test: `src/modules/events/reception-db.test.ts`

**Interfaces:**
- Produces `RECEPTION` as a `UserRole`.
- Produces `eventReceptionists` with `eventId`, `userId`, `createdAt`, and a unique `(eventId, userId)` constraint.
- Produces `events.checkInConfirmationRequired: boolean` with default `true`.

- [ ] **Step 1: Write the failing schema tests**

Assert the role enum includes `RECEPTION`, the event table exposes `checkInConfirmationRequired`, and the assignment table exposes the two foreign keys and unique key.

- [ ] **Step 2: Run the focused schema tests**

Run: `pnpm vitest run src/modules/events/reception-db.test.ts`

Expected: FAIL because the new enum/columns/table do not exist.

- [ ] **Step 3: Implement the Drizzle schema**

Add `RECEPTION` to `userRole`, add the boolean event column, and create `src/modules/events/reception-db.ts` with a table scoped to the existing `events` and `users` tables. Use `onDelete: "cascade"` for both references.

- [ ] **Step 4: Generate and inspect the migration**

Run: `pnpm drizzle-kit generate`

Expected: migration adds the enum value, boolean column with default `true`, assignment table, foreign keys, and unique constraint. Rename/retain the generated file as the next migration only if Drizzle generated a different filename; do not edit prior migrations.

- [ ] **Step 5: Run schema tests and typecheck**

Run: `pnpm vitest run src/modules/events/reception-db.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the data-model unit**

```bash
git add src/modules/users/db.ts src/modules/events/db.ts src/modules/events/reception-db.ts src/modules/events/reception-db.test.ts drizzle/0023_reception_checkin.sql
git commit -m "feat(events): add reception assignments"
```

### Task 2: Centralize Event Authorization

**Files:**
- Modify: `src/modules/users/service.ts:71-75`
- Create: `src/modules/events/access.ts`
- Create: `src/modules/events/access.test.ts`
- Modify: `src/modules/events/index.ts`

**Interfaces:**
- `canAccessEvent(input: { userId: string; organizationId: string; role: UserRole; eventId: string; capability: "registrations" | "check-in" | "internal-form" | "edit" }): Promise<boolean>`
- `isReception(profile): boolean`
- `isAdmin(profile): boolean` remains the Admin check.

- [ ] **Step 1: Write access-matrix tests**

Cover Admin on any same-organization event, Reception on assigned events for `registrations` and `check-in`, Reception denied for `internal-form` and `edit`, and Reception denied for unassigned or cross-organization events.

- [ ] **Step 2: Run the focused access tests**

Run: `pnpm vitest run src/modules/events/access.test.ts`

Expected: FAIL because the access helper and assignment lookup do not exist.

- [ ] **Step 3: Implement the access helper**

Use the existing `getEvent` organization scope first. Allow Admin after that check. For Reception, query `eventReceptionists` by event and user. Return `false` for all other roles or capabilities.

- [ ] **Step 4: Run focused tests**

Run: `pnpm vitest run src/modules/events/access.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the authorization unit**

```bash
git add src/modules/users/service.ts src/modules/events/access.ts src/modules/events/access.test.ts src/modules/events/index.ts
git commit -m "feat(auth): add event-scoped reception access"
```

### Task 3: Add Reception Role And Event Assignment UI

**Files:**
- Modify: `src/modules/users/management.ts:13-32`
- Modify: `app/(protected)/settings/users/actions.ts:26-40`
- Modify: `app/(protected)/settings/users/user-management.tsx:25-40`
- Modify: `app/(protected)/events/[id]/edit/page.tsx:15-38`
- Modify: `app/(protected)/events/[id]/edit/event-edit-form.tsx`
- Create: `app/(protected)/events/[id]/edit/reception-team.tsx`
- Create: `app/(protected)/events/[id]/edit/reception-team-actions.ts`
- Test: `src/modules/users/management.test.ts`
- Test: `app/(protected)/events/[id]/edit/page.test.tsx`

**Interfaces:**
- `ManagedRole = "ADMIN" | "MARKETING_MANAGER" | "MARKETING_USER" | "VIEWER" | "RECEPTION"` as needed by the existing role catalog.
- `listEventReceptionists(eventId, organizationId)` returns active organization users with role `RECEPTION`.
- `assignReceptionistAction` and `removeReceptionistAction` accept `eventId` and `userId`.

- [ ] **Step 1: Add failing role-management tests**

Test that Admin can invite/change a user to `RECEPTION`, disabled users cannot be assigned, and assignment/removal is organization-scoped.

- [ ] **Step 2: Run focused tests**

Run: `pnpm vitest run src/modules/users/management.test.ts app/(protected)/events/[id]/edit/page.test.tsx`

Expected: FAIL for the missing role and assignment behavior.

- [ ] **Step 3: Implement role and assignment actions**

Extend the Admin-only schemas and actions, validate target user role/status and event ownership, write the join row, record audit events, and revalidate the event edit page.

- [ ] **Step 4: Implement the event edit section**

Render active Reception users as assignable options and assigned users as removable rows. Include `Pedir confirmación antes de registrar entrada` bound to `checkInConfirmationRequired`.

- [ ] **Step 5: Run focused tests and lint**

Run: `pnpm vitest run src/modules/users/management.test.ts app/(protected)/events/[id]/edit/page.test.tsx && pnpm lint`

Expected: PASS.

- [ ] **Step 6: Commit the assignment unit**

```bash
git add src/modules/users/management.ts app/(protected)/settings/users/actions.ts app/(protected)/settings/users/user-management.tsx app/(protected)/events/[id]/edit/page.tsx app/(protected)/events/[id]/edit/event-edit-form.tsx app/(protected)/events/[id]/edit/reception-team.tsx app/(protected)/events/[id]/edit/reception-team-actions.ts src/modules/users/management.test.ts app/(protected)/events/[id]/edit/page.test.tsx
git commit -m "feat(events): manage reception team assignments"
```

### Task 4: Enforce Role-Aware Event Navigation And Pages

**Files:**
- Modify: `app/(protected)/events/event-sub-nav.tsx:5-29`
- Modify: `app/(protected)/events/[id]/check-in/page.tsx:1-31`
- Modify: `app/(protected)/events/[id]/registrations/page.tsx:1-107`
- Create: `app/(protected)/events/[id]/internal-form/page.tsx`
- Test: `app/(protected)/events/[id]/check-in/page.test.tsx`
- Test: `app/(protected)/events/[id]/registrations/page.test.tsx`

**Interfaces:**
- `EventSubNav({ eventId, current, role })` renders only allowed tabs.
- Page guards call `canAccessEvent` before loading event data for the page.

- [ ] **Step 1: Add failing page-access tests**

Cover Reception seeing only `Registros` and `Check-in` for assigned events, receiving `notFound`/denial for unassigned events, and Admin seeing `Formulario interno` plus all existing tabs.

- [ ] **Step 2: Run focused page tests**

Run: `pnpm vitest run app/(protected)/events/[id]/check-in/page.test.tsx app/(protected)/events/[id]/registrations/page.test.tsx`

Expected: FAIL until page-level guards and role-aware navigation exist.

- [ ] **Step 3: Add guards and navigation**

Load the current user, call `canAccessEvent`, pass the role into `EventSubNav`, and keep the existing Admin-only event-edit/dashboard behavior. Do not rely on sidebar hiding for authorization.

- [ ] **Step 4: Add the Admin-only internal-form route shell**

Guard it with `capability: "internal-form"` and render the internal form component placeholder only after authorization; the full form is implemented in Task 7.

- [ ] **Step 5: Run focused tests**

Run: `pnpm vitest run app/(protected)/events/[id]/check-in/page.test.tsx app/(protected)/events/[id]/registrations/page.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit navigation and guard changes**

```bash
git add app/(protected)/events/event-sub-nav.tsx app/(protected)/events/[id]/check-in/page.tsx app/(protected)/events/[id]/registrations/page.tsx app/(protected)/events/[id]/internal-form/page.tsx app/(protected)/events/[id]/check-in/page.test.tsx app/(protected)/events/[id]/registrations/page.test.tsx
git commit -m "feat(events): restrict reception event navigation"
```

### Task 5: Harden Check-in Domain Responses

**Files:**
- Modify: `src/modules/events/service.ts:560-598`
- Modify: `app/(protected)/events/[id]/check-in/actions.ts:8-71`
- Create: `src/modules/events/check-in-result.ts`
- Test: `src/modules/events/check-in-result.test.ts`
- Test: `app/(protected)/events/[id]/check-in/actions.test.ts`

**Interfaces:**
- `CheckInLookupResult = { kind: "not_found" } | { kind: "already_checked_in"; attendee: EventAttendeeRow } | { kind: "eligible"; attendee: EventAttendeeRow; registration: RegistrationWithAttendees } | { kind: "blocked"; reason: "cancelled" | "waitlisted"; attendee: EventAttendeeRow; registration: RegistrationWithAttendees }`.
- `lookupAttendeeForCheckIn({ eventId, code })` never returns data outside the requested event.
- `confirmAttendeeCheckIn({ eventId, attendeeId, checkedInBy })` performs the idempotent mutation.

- [ ] **Step 1: Write failing result-contract tests**

Cover not found, eligible, already checked-in, cancelled, waitlisted, and same-code concurrent behavior.

- [ ] **Step 2: Run focused tests**

Run: `pnpm vitest run src/modules/events/check-in-result.test.ts app/(protected)/events/[id]/check-in/actions.test.ts`

Expected: FAIL because the lookup contract does not exist.

- [ ] **Step 3: Implement lookup and confirmation actions**

Separate lookup from mutation. Do not set `checkedInAt` during lookup when confirmation is enabled. Keep the existing webhook behavior only after the first successful mutation. Return attendee identity, full registration details, previous check-in metadata, and blocked status.

- [ ] **Step 4: Verify idempotence and authorization**

Require `canAccessEvent(..., "check-in")` in both lookup and confirmation server actions. Use a conditional update or transaction so only the first mutation writes `checkedInAt`.

- [ ] **Step 5: Run focused tests**

Run: `pnpm vitest run src/modules/events/check-in-result.test.ts app/(protected)/events/[id]/check-in/actions.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the check-in domain unit**

```bash
git add src/modules/events/service.ts src/modules/events/check-in-result.ts src/modules/events/check-in-result.test.ts app/(protected)/events/[id]/check-in/actions.ts app/(protected)/events/[id]/check-in/actions.test.ts
git commit -m "feat(events): add structured check-in results"
```

### Task 6: Build QR Scanner And Manual Folio UI

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `app/(protected)/events/[id]/check-in/check-in-form.tsx`
- Create: `app/(protected)/events/[id]/check-in/qr-scanner.tsx`
- Create: `app/(protected)/events/[id]/check-in/check-in-result-dialog.tsx`
- Create: `app/(protected)/events/[id]/check-in/manual-folio-dialog.tsx`
- Test: `app/(protected)/events/[id]/check-in/check-in-form.test.tsx`
- Test: `app/(protected)/events/[id]/check-in/qr-scanner.test.tsx`

**Interfaces:**
- `QrScanner({ onDetected, onError })` starts only after the parent requests it, uses `BrowserMultiFormatReader`, selects the environment-facing camera, stops tracks on close/unmount, and emits one decoded string per open cycle.
- `CheckInResultDialog` receives the structured lookup result and calls `onConfirm(attendeeId)` only for eligible entries when confirmation is enabled.
- `ManualFolioDialog` accepts exactly eight uppercase alphanumeric characters and submits through the same lookup action.

- [ ] **Step 1: Add the scanner dependency**

Run: `pnpm add @zxing/browser`

Expected: `package.json` and `pnpm-lock.yaml` contain the dependency.

- [ ] **Step 2: Write failing component tests**

Test the primary `Escanear QR` action, camera inactivity on initial render, manual fallback, one-result-per-open behavior, and result modal variants. Mock only the browser camera boundary; test the parent state transitions with real components.

- [ ] **Step 3: Run focused UI tests**

Run: `pnpm vitest run app/(protected)/events/[id]/check-in/check-in-form.test.tsx app/(protected)/events/[id]/check-in/qr-scanner.test.tsx`

Expected: FAIL until the components exist.

- [ ] **Step 4: Implement camera lifecycle**

Use a client-only component, stop all media tracks in cleanup, handle permission denial with a manual-fallback message, pause after the first decode, and require a new button press after the dialog closes.

- [ ] **Step 5: Implement dialogs and manual input**

Render the status-specific copy and information. For eligible entries, show `Confirmar entrada` only when the event setting is enabled. Render each pending companion with an individual `Registrar entrada` button; close the dialog after any mutation.

- [ ] **Step 6: Run focused tests and lint**

Run: `pnpm vitest run app/(protected)/events/[id]/check-in/check-in-form.test.tsx app/(protected)/events/[id]/check-in/qr-scanner.test.tsx && pnpm lint`

Expected: PASS.

- [ ] **Step 7: Commit the scanner unit**

```bash
git add package.json pnpm-lock.yaml app/(protected)/events/[id]/check-in/check-in-form.tsx app/(protected)/events/[id]/check-in/qr-scanner.tsx app/(protected)/events/[id]/check-in/check-in-result-dialog.tsx app/(protected)/events/[id]/check-in/manual-folio-dialog.tsx app/(protected)/events/[id]/check-in/check-in-form.test.tsx app/(protected)/events/[id]/check-in/qr-scanner.test.tsx
git commit -m "feat(events): add tablet qr check-in"
```

### Task 7: Implement Admin Internal Registration Form

**Files:**
- Modify: `app/(protected)/events/[id]/internal-form/page.tsx`
- Create: `app/(protected)/events/[id]/internal-form/internal-registration-form.tsx`
- Create: `app/(protected)/events/[id]/internal-form/actions.ts`
- Create: `app/(protected)/events/[id]/internal-form/registration-search.tsx`
- Modify: `app/(protected)/events/[id]/registrations/add-companion-row.tsx`
- Modify: `src/modules/events/service.ts`
- Test: `app/(protected)/events/[id]/internal-form/actions.test.ts`
- Test: `app/(protected)/events/[id]/internal-form/page.test.tsx`

**Interfaces:**
- `searchRegistrationAction` accepts `eventId` plus name/email/backup code and returns only registrations in that event.
- `updatePrimaryAttendeeAction` validates Admin access and returns before/after audit data.
- `addAdminCompanionAction` accepts an existing `registrationId`, attendee fields, and event ID; it generates an eight-character backup code and never applies public capacity limits.

- [ ] **Step 1: Write failing Admin-only action tests**

Cover Reception denial, Admin search scoping, companion creation with generated folio, blocked cross-event IDs, and audit payloads.

- [ ] **Step 2: Run focused tests**

Run: `pnpm vitest run app/(protected)/events/[id]/internal-form/actions.test.ts app/(protected)/events/[id]/internal-form/page.test.tsx`

Expected: FAIL because the internal form and actions do not exist.

- [ ] **Step 3: Implement server actions**

Require `capability: "internal-form"`, validate all UUIDs and attendee fields with Zod, generate the existing backup code, create the attendee with a new pass token, and record audit events.

- [ ] **Step 4: Implement the Admin UI**

Add search, full registration details, principal edit fields, companion creation form, generated folio display, and QR rendering using the existing QR generation dependency. Keep companion creation separate from principal editing.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `pnpm vitest run app/(protected)/events/[id]/internal-form/actions.test.ts app/(protected)/events/[id]/internal-form/page.test.tsx && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the internal-form unit**

```bash
git add app/(protected)/events/[id]/internal-form app/(protected)/events/[id]/registrations/add-companion-row.tsx src/modules/events/service.ts
git commit -m "feat(events): add admin internal registration form"
```

### Task 8: Complete Audit, Accessibility, And End-to-End Verification

**Files:**
- Modify: `src/modules/audit/service.ts` only if a new action/resource type is required.
- Modify: `app/(protected)/events/[id]/check-in/check-in-form.tsx` for accessible labels/status announcements.
- Modify: `app/(protected)/events/[id]/internal-form/internal-registration-form.tsx` for keyboard/focus behavior.
- Test: relevant existing page/action tests and new check-in/internal-form tests.

**Interfaces:**
- Audit actions must identify actor, organization, event, target attendee/registration, previous state, and next state.

- [ ] **Step 1: Add accessibility assertions**

Test dialog labels, focus return after closing, `aria-live` result announcements, camera permission error messaging, and keyboard submission for manual folios.

- [ ] **Step 2: Run the complete test suite**

Run: `pnpm test`

Expected: all tests pass, including Android/iPad-independent component tests.

- [ ] **Step 3: Run static checks and production build**

Run: `pnpm check`

Expected: lint, typecheck, all tests, and Next.js build pass.

- [ ] **Step 4: Perform manual browser verification**

Verify in Chrome on Android and Safari on iPad:

1. Reception sees only assigned events.
2. `Escanear QR` requests camera permission only after pressing the button.
3. A valid folio opens the correct modal and pauses the camera.
4. Closing the modal does not restart the camera.
5. Confirmation on/off behaves as configured.
6. Re-scanning shows `Ya ingresó` with original timestamp and actor.
7. Manual folio fallback uses the same result states.
8. Admin can use `Formulario interno`; Reception cannot.

- [ ] **Step 5: Commit final verification fixes**

```bash
git add src/modules/audit app/(protected)/events src/modules/events
git commit -m "test(events): verify reception check-in flows"
```

## Plan Self-Review

- Spec coverage: roles, event assignments, event confirmation setting, server authorization, QR/manual flows, all result states, companion actions, internal form, audit, errors, browser support, and tests are mapped to Tasks 1-8.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation step remains.
- Type consistency: `canAccessEvent`, `getEffectiveRegistrationStatus`, `lookupAttendeeForCheckIn`, `confirmAttendeeCheckIn`, `QrScanner`, `CheckInResultDialog`, and internal-form actions are defined before their consuming tasks.
- Scope: tasks are ordered so each database/auth/UI unit can be reviewed and tested independently.
