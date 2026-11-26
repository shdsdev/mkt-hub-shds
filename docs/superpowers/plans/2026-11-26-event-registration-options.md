# Event Registration Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make registration email collection, companions, and client categories configurable per event while preserving existing attendee data.

**Architecture:** Extend the existing versioned `registrationFormConfig` JSON rather than adding a second settings system. Store event-scoped category definitions in that configuration, use them for public/internal registration and presentation, and keep archived categories available for historical attendees.

**Tech Stack:** Next.js 16.3.4, React 19, TypeScript, Zod, Vitest, Drizzle/Supabase.

**Spec:** Approved conversation design.

## Global Constraints

- Existing legacy event configurations must resolve safely with compatibility defaults.
- Hidden fields must not be required.
- Existing companion and email data must not be deleted when settings are disabled.
- Premium/custom select behavior must remain intact.

## Review Focus

- Legacy configuration without new keys resolves to current behavior.
- Disabling email removes the public field and prevents server-side email validation from requiring it.
- Disabling companions hides the add flow and rejects direct companion mutations.
- Categories can be renamed/colored/archived without changing historical attendee values.
- Invalid or duplicate custom category definitions fall back safely or fail validation.

---

### Task 1: Versioned registration configuration

**Files:**
- Modify: `src/modules/events/registration-form-config.ts`
- Test: `src/modules/events/registration-form-config.test.ts`

- [x] Add failing tests for email visibility, companion compatibility, and event-scoped category definitions.
- [x] Run the focused config tests and verify they fail for the missing behavior.
- [x] Add validated `email` and `occupations` configuration with legacy defaults.
- [x] Run focused config tests and then the existing events config tests.

### Task 2: Category presentation and registration choices

**Files:**
- Modify: `src/lib/events/occupation-presentation.ts`
- Modify: public/internal registration components and their tests

- [x] Add failing tests proving configured labels/colors are used and archived categories are not offered to new registrations.
- [x] Implement presentation from event config with a safe neutral fallback.
- [x] Verify focused UI tests.

### Task 3: Event editor controls

**Files:**
- Modify: `app/(protected)/events/event-registration-fields.tsx`
- Modify: related event create/edit tests

- [x] Add failing tests for email and companion toggles plus category add/edit/archive controls.
- [x] Implement controls using existing checkbox and custom select patterns.
- [x] Verify form serialization and accessibility states.

### Task 4: Server-side enforcement and email behavior

**Files:**
- Modify: public registration actions and companion actions
- Modify: `app/(protected)/events/[id]/registrations/actions.ts`
- Test: corresponding action/config tests

- [x] Add failing tests for disabled email and disabled companions.
- [x] Enforce resolved event configuration on the server, not only in the UI.
- [x] Prevent confirmation/invitation email dispatch when event email collection is disabled while preserving stored data.
- [x] Run focused action tests.

### Task 5: Full verification

- [x] Run `pnpm lint`.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
- [x] Review the diff and confirm unrelated user changes were not modified.
