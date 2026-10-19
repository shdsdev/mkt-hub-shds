# Registration Review Quick Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the slow review-status dropdown workflow with clear quick actions protected by confirmation before any decision is saved.

**Architecture:** Keep the existing review-status server action and domain state machine. Add a client-side action bar in the registration detail sheet that opens a confirmation dialog, then submits the selected review status only after confirmation; retain a secondary status menu for operational states such as `En revisión` and `Nuevo`.

**Tech Stack:** Next.js, React, Base UI Dialog, Base UI Select, Vitest, TypeScript.

## Global Constraints

- Every review-status change requires explicit confirmation.
- `En revisión` remains an operational state, not a final decision.
- Approval still validates capacity and triggers the existing confirmation email side effect.
- Rejection and waitlisting keep their existing server-side behavior.
- Preserve the existing premium dialog/select components and accessible keyboard behavior.
- Do not change database enums or migration files.

---

### Task 1: Add Confirmed Review Actions

**Files:**
- Modify: `app/(protected)/events/[id]/registrations/registration-detail-sheet.tsx`
- Test: `app/(protected)/events/[id]/registrations/registration-detail-sheet.test.tsx`

**Interfaces:**
- Consumes: `updateRegistrationReviewStatusAction`, `REVIEW_STATUS_LABELS`, and the current `registration.reviewStatus`.
- Produces: quick actions for `approved`, `waitlisted`, and `rejected`; a secondary action for `in_review`/`new`; an accessible confirmation dialog before submit.

- [ ] **Step 1: Write failing tests**

Cover that clicking `Aprobar`, `Lista de espera`, or `Rechazar` opens confirmation instead of submitting immediately, and that confirming submits the selected `reviewStatus`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run "app/(protected)/events/[id]/registrations/registration-detail-sheet.test.tsx"`

Expected: FAIL because the action bar and confirmation state do not exist yet.

- [ ] **Step 3: Implement the action bar and confirmation dialog**

Use the existing dialog primitives in the sheet. The action bar should show `Aprobar` as the primary action, `Lista de espera` and `Rechazar` as secondary/destructive actions, and a compact `Más` menu for `En revisión` and `Nuevo`. Store the pending review status locally and render a confirmation message using `REVIEW_STATUS_LABELS[pendingStatus]` before calling the existing `reviewAction`.

- [ ] **Step 4: Run focused tests and static checks**

Run: `pnpm vitest run "app/(protected)/events/[id]/registrations/registration-detail-sheet.test.tsx"`

Run: `pnpm typecheck`

Expected: Tests pass and the action payload still contains the existing `registrationId`, `eventId`, and selected `reviewStatus` fields.

- [ ] **Step 5: Review the diff**

Run: `git diff -- app/(protected)/events/[id]/registrations/registration-detail-sheet.tsx app/(protected)/events/[id]/registrations/registration-detail-sheet.test.tsx`

Confirm the server action and database contracts remain unchanged.
