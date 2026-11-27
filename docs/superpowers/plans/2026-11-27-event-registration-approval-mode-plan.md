# Event Registration Approval Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-event manual/automatic registration approval, including automatic confirmation of new and existing pending registrations.

**Architecture:** Store `approvalMode` inside the existing `RegistrationFormConfig`, defaulting to `manual` for backward compatibility. Centralize automatic approval and capacity handling in the events service, then invoke it from both public registration creation and the event configuration transition. Keep email delivery after database commits and reuse the existing confirmation/audit paths.

**Tech Stack:** Next.js, React, Zod, Drizzle ORM, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-27-event-registration-approval-mode-design.md`

## Global Constraints

- `approvalMode` values are exactly `"manual"` and `"automatic"`.
- Missing or invalid approval mode values resolve to `"manual"`.
- Existing events and existing manual-review behavior remain compatible.
- Capacity is enforced for every automatic approval.
- Email is sent only when the event email field is enabled.
- Email failures do not roll back a confirmed registration.
- Switching back to manual never reverts confirmed registrations.

## Review Focus

- Legacy configs without `approvalMode` resolve to manual and preserve pending registrations.
- Automatic approval stops at capacity without changing later registrations.
- Enabling automatic mode processes pending registrations exactly once.
- Email-disabled events never attempt confirmation or decision email delivery.
- Automatic events do not expose manual review actions for already confirmed registrations.

---

### Task 1: Add approval mode to the shared registration configuration

**Files:**
- Modify: `src/modules/events/registration-form-config.ts`
- Test: `src/modules/events/registration-form-config.test.ts`

**Interfaces:**
- Consumes: existing persisted `registrationFormConfig` objects.
- Produces: `RegistrationFormConfig.approvalMode` with a backward-compatible default.

- [ ] **Step 1: Write failing schema tests**

Add tests asserting:

- A config without `approvalMode` resolves to `"manual"`.
- `"automatic"` is accepted.
- Invalid values fall back to the default config with `"manual"`.
- `getDefaultRegistrationFormConfig()` includes `approvalMode: "manual"`.

- [ ] **Step 2: Run the focused schema tests and verify failure**

```bash
pnpm vitest run "src/modules/events/registration-form-config.test.ts"
```

Expected: the new assertions fail because `approvalMode` is not yet part of the schema/default.

- [ ] **Step 3: Implement the schema default**

Add the enum and default to `registrationFormConfigSchema`, and include the same value in `getDefaultRegistrationFormConfig()`.

- [ ] **Step 4: Run the focused schema tests**

Expected: all registration configuration tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/events/registration-form-config.ts src/modules/events/registration-form-config.test.ts
git commit -m "feat(events): add registration approval mode"
```

### Task 2: Add the approval mode control to the event editor

**Files:**
- Modify: `app/(protected)/events/event-registration-fields.tsx`
- Test: `app/(protected)/events/event-registration-fields.test.tsx`

**Interfaces:**
- Consumes: `RegistrationFormConfig.approvalMode`.
- Produces: editor control that updates and serializes the selected mode.

- [ ] **Step 1: Write failing editor tests**

Assert that the editor renders an approval mode control, defaults to manual for legacy input, and changes the hidden serialized configuration to automatic when selected. Include helper text explaining that switching to automatic also processes pending registrations and may send emails.

- [ ] **Step 2: Run the focused editor tests and verify failure**

```bash
pnpm vitest run "app/(protected)/events/event-registration-fields.test.tsx"
```

- [ ] **Step 3: Implement the editor control**

Render the control using the project's existing premium `Select` component. Keep it in the registration settings section, use English identifiers and existing Spanish UI copy, and update only `approvalMode`.

- [ ] **Step 4: Run the focused editor tests**

Expected: editor tests pass and existing occupation/color/focus tests remain green.

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/events/event-registration-fields.tsx" "app/(protected)/events/event-registration-fields.test.tsx"
git commit -m "feat(events): configure registration approval mode"
```

### Task 3: Centralize automatic approval and pending transition logic

**Files:**
- Modify: `src/modules/events/service.ts`
- Test: `src/modules/events/service.test.ts`

**Interfaces:**
- Consumes: event ID, organization ID, reviewer ID, and current registration configuration.
- Produces: a service function such as `approvePendingRegistrationsForEvent()` returning `{ approvedCount, pendingCount }`.

- [ ] **Step 1: Write failing service tests**

Cover:

- Automatic approval confirms pending registrations in creation order.
- Capacity prevents registrations after the available seats are exhausted.
- Already confirmed, rejected, waitlisted, and cancelled registrations are unchanged.
- Re-running the transition does not approve the same registration twice.

- [ ] **Step 2: Run the focused service tests and verify failure**

```bash
pnpm vitest run "src/modules/events/service.test.ts"
```

- [ ] **Step 3: Implement the service transition**

Use the existing transaction and capacity-locking primitives. Process pending registrations deterministically and return counts. Keep the database mutation separate from email delivery so callers can send notifications only after successful commits.

- [ ] **Step 4: Run the focused service tests**

Expected: transition and capacity tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/events/service.ts src/modules/events/service.test.ts
git commit -m "feat(events): approve pending registrations automatically"
```

### Task 4: Apply automatic mode to public registrations

**Files:**
- Modify: `app/events/[id]/actions.ts`
- Modify: `src/modules/events/service.ts` if the registration service boundary requires it
- Test: `app/events/[id]/actions.test.ts`

**Interfaces:**
- Consumes: resolved event configuration and the existing registration result.
- Produces: confirmed registrations for automatic-mode events, pending registrations for manual-mode events, and post-commit confirmation email/audit behavior.

- [ ] **Step 1: Write failing action tests**

Assert:

- Manual mode preserves pending review.
- Automatic mode confirms a new registration.
- Automatic mode respects capacity.
- Automatic mode with email disabled does not call the email provider.
- Automatic mode with email enabled sends the confirmation after the registration succeeds.

- [ ] **Step 2: Run the focused action tests and verify failure**

```bash
pnpm vitest run "app/events/[id]/actions.test.ts"
```

- [ ] **Step 3: Implement mode-aware registration**

Resolve the event configuration before creating the registration. Select the existing manual path or the automatic confirmation path. Preserve the existing post-commit email and audit conventions, and do not send email from inside the transaction.

- [ ] **Step 4: Run the focused action tests**

Expected: all new and existing registration action tests pass.

- [ ] **Step 5: Commit**

```bash
git add "app/events/[id]/actions.ts" "app/events/[id]/actions.test.ts" src/modules/events/service.ts
git commit -m "feat(events): auto-approve new registrations"
```

### Task 5: Process pending registrations when enabling automatic mode

**Files:**
- Modify: `app/(protected)/events/actions.ts`
- Modify: `app/(protected)/events/[id]/edit/event-edit-form.tsx` if the save response needs a transition summary
- Test: `app/(protected)/events/actions.test.ts`
- Test: `app/(protected)/events/[id]/edit/event-edit-form.test.tsx` if present or create it alongside the existing editor tests

**Interfaces:**
- Consumes: saved event configuration and the service transition from Task 3.
- Produces: automatic processing of existing pending registrations with an approval/pending summary.

- [ ] **Step 1: Write failing transition tests**

Assert that changing manual to automatic:

- saves the new configuration;
- approves pending registrations;
- sends confirmation emails only when email collection is enabled;
- leaves registrations beyond capacity pending;
- reports the processed counts.

Assert that automatic to manual does not modify confirmed registrations.

- [ ] **Step 2: Run the focused action/editor tests and verify failure**

```bash
pnpm vitest run "app/(protected)/events/actions.test.ts" "app/(protected)/events/[id]/edit/event-edit-form.test.tsx"
```

- [ ] **Step 3: Implement the configuration transition**

Detect the mode transition after validating the new configuration. Persist the event first, then call the service transition only when moving into automatic mode. Perform post-commit emails and auditing for newly confirmed pending registrations, and return a Spanish summary suitable for the editor.

- [ ] **Step 4: Run focused transition tests**

Expected: pending transition, capacity, email, and reverse-transition tests pass.

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/events/actions.ts" "app/(protected)/events/[id]/edit/event-edit-form.tsx" "app/(protected)/events/actions.test.ts" "app/(protected)/events/[id]/edit/event-edit-form.test.tsx"
git commit -m "feat(events): process pending registrations on auto approval"
```

### Task 6: Adjust registration review actions and complete verification

**Files:**
- Modify: `app/(protected)/events/[id]/registrations/registration-detail-sheet.tsx`
- Modify: `app/(protected)/events/[id]/registrations/registrations-table.tsx`
- Test: `app/(protected)/events/[id]/registrations/registration-detail-sheet.test.tsx`
- Test: `app/(protected)/events/[id]/registrations/registrations-table.test.tsx`

**Interfaces:**
- Consumes: registration status/review status and event approval configuration.
- Produces: review controls that remain available for manual pending registrations and are hidden or disabled for automatically confirmed registrations.

- [ ] **Step 1: Write failing UI tests**

Assert that manual pending registrations show review actions, while confirmed registrations from automatic events do not show Aprobar, Lista de espera, or Rechazar.

- [ ] **Step 2: Run focused UI tests and verify failure**

```bash
pnpm vitest run "app/(protected)/events/[id]/registrations/registration-detail-sheet.test.tsx" "app/(protected)/events/[id]/registrations/registrations-table.test.tsx"
```

- [ ] **Step 3: Implement conditional action rendering**

Use the event configuration already passed to the registrations page. Preserve delete and attendee-management permissions independently from review actions.

- [ ] **Step 4: Run complete verification**

```bash
pnpm test
pnpm typecheck
pnpm lint
git diff --check
```

Expected: the full suite passes, aside from any already documented unrelated environment warnings or intermittent failures.

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/events/[id]/registrations/registration-detail-sheet.tsx" "app/(protected)/events/[id]/registrations/registrations-table.tsx" "app/(protected)/events/[id]/registrations/registration-detail-sheet.test.tsx" "app/(protected)/events/[id]/registrations/registrations-table.test.tsx"
git commit -m "feat(events): hide manual review actions for auto approval"
```
