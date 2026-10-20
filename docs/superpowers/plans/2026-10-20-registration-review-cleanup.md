# Registration Review Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify Telegram when a public registration is created, keep email delivery tied to approval, and allow authorized users to permanently delete rejected registrations.

**Architecture:** Keep the public registration action as the only Telegram notification entry point. Remove Telegram side effects from review decisions. Add a server-side, organization-scoped deletion service that deletes attendees before their registration in one transaction, then expose it through a confirmation-gated admin action.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, Vitest.

## Global Constraints

- Telegram failures must never fail the primary registration or review action.
- Email confirmation remains sent only after approval.
- Rejected records are deleted manually, never automatically.
- Deletion is restricted to active admins and rejected registrations in the current organization/event.
- Tests must cover notification timing, deletion authorization, status restrictions, and attendee cleanup.

---

### Task 1: Separate Telegram timing from review decisions

**Files:**
- Modify: `app/(protected)/events/[id]/registrations/actions.ts`
- Test: `app/(protected)/events/[id]/registrations/actions.test.ts`

- [ ] **Step 1: Add a failing test** asserting a rejected review does not call `sendTelegramMessage`, while the existing public registration test continues to assert Telegram delivery for a newly submitted registration.
- [ ] **Step 2: Run** `pnpm test "app/(protected)/events/[id]/registrations/actions.test.ts" "app/events/[id]/actions.test.ts"` and verify the new assertion fails because review actions currently send Telegram.
- [ ] **Step 3: Remove the normal review Telegram block** from `updateRegistrationReviewStatusAction`; leave the public registration Telegram block in `registerForEventAction` unchanged.
- [ ] **Step 4: Run the same focused tests and verify they pass.**

### Task 2: Delete rejected registrations transactionally

**Files:**
- Modify: `src/modules/events/service.ts`
- Test: `src/modules/events/service.test.ts`

- [ ] **Step 1: Add a failing service test** for `deleteRejectedRegistration({ registrationId, eventId, organizationId })` that expects attendees to be deleted first and the matching rejected registration to be deleted.
- [ ] **Step 2: Add a failing test** that returns `undefined` when the registration is missing or not rejected.
- [ ] **Step 3: Run** `pnpm test src/modules/events/service.test.ts` and verify both tests fail because the service function does not exist.
- [ ] **Step 4: Implement `deleteRejectedRegistration` using `db.transaction`: select the organization/event-scoped registration, return `undefined` unless `status === "rejected"`, delete `eventAttendees` by `registrationId`, then delete the parent registration by id, returning the deleted row.
- [ ] **Step 5: Run the focused service tests and verify they pass.

### Task 3: Add the authorized deletion action

**Files:**
- Modify: `app/(protected)/events/[id]/registrations/actions.ts`
- Test: `app/(protected)/events/[id]/registrations/actions.test.ts`

- [ ] **Step 1: Add a failing action test** for an inactive/non-admin user and assert the deletion service is not called.
- [ ] **Step 2: Add a failing action test** for a valid admin deletion and assert the service receives the current organization, event, and registration ids.
- [ ] **Step 3: Run** `pnpm test "app/(protected)/events/[id]/registrations/actions.test.ts"` and verify the new tests fail.
- [ ] **Step 4: Implement `deleteRejectedRegistrationAction` with `getCurrentUser`, `isActive`, `isAdmin`, UUID validation, `deleteRejectedRegistration`, and `revalidatePath`.
- [ ] **Step 5: Run the focused action tests and verify they pass.

### Task 4: Add confirmation-gated UI cleanup

**Files:**
- Modify: `app/(protected)/events/[id]/registrations/registration-detail-sheet.tsx`
- Test: `app/(protected)/events/[id]/registrations/registration-detail-sheet.test.tsx` if the existing test harness supports this component; otherwise rely on action tests and typecheck.

- [ ] **Step 1: Add a destructive “Eliminar registro” button only when `registration.status === "rejected"`.
- [ ] **Step 2: Add a confirmation dialog requiring an explicit confirmation before submitting `deleteRejectedRegistrationAction`.
- [ ] **Step 3: On success, close the confirmation and detail dialog, then call `router.refresh()`; show returned errors in the dialog without closing it.
- [ ] **Step 4: Run the component test if available, then run `pnpm typecheck` and `pnpm lint`.

### Task 5: Full verification

- [ ] **Step 1: Run** `pnpm test` and confirm all tests pass.
- [ ] **Step 2: Run** `pnpm typecheck`, `pnpm lint`, and `git diff --check`.
- [ ] **Step 3: Review the final diff and confirm only the approved behavior changed.
