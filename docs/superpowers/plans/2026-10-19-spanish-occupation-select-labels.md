# Spanish Occupation Select Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public occupation selectors display Spanish labels while preserving their technical form values.

**Architecture:** Use the existing Base UI Select `items` metadata so `SelectValue` can resolve the selected value to its visible label. Apply the same option list to the primary attendee and companion selectors without changing form names, values, validation, or backend behavior.

**Tech Stack:** Next.js, React, TypeScript, Base UI Select, Vitest.

## Global Constraints

- Preserve the existing premium Select component and transitions.
- Keep submitted values such as `wholesaler` and `architect-decorator` unchanged.
- Use Spanish only for visible labels.
- Do not modify backend schemas or migration files.

---

### Task 1: Map Occupation Values to Visible Labels

**Files:**
- Modify: `app/events/[id]/register-form.tsx:264-267, 404-408`
- Test: `app/events/[id]/actions.test.ts` or the existing public registration UI test location if a component test is already present

**Interfaces:**
- Consumes: the existing `occupationOptions` tuple list.
- Produces: both public occupation `Select` components configured with `items` metadata.

- [x] **Step 1: Add the regression assertion**

Verify that the public registration selectors associate each technical value with its Spanish label, including `wholesaler` → `Mayorista` and `architect-decorator` → `Arquitecto / Decorador`.

- [x] **Step 2: Run the focused test to verify the current behavior is uncovered or fails**

Run: `pnpm vitest run app/events/[id]/actions.test.ts`

Expected: The existing suite runs; if it has no rendered selector assertion, add the smallest component-level assertion using the repository's established test setup.

- [x] **Step 3: Pass item metadata to both Select roots**

Use the existing options without changing the form values:

```tsx
<Select
  name="occupation"
  defaultValue=""
  items={occupationOptions.map(([value, label]) => ({ value, label }))}
>
```

Apply the same `items` prop to the companion selector, preserving its existing `name`, default value, and `SelectItem` children.

- [x] **Step 4: Run the focused tests and static checks**

Run: `pnpm vitest run app/events/[id]/actions.test.ts`

Run: `pnpm typecheck`

Expected: Both commands exit successfully and the selector values remain unchanged for form submission.

- [x] **Step 5: Review the diff**

Run: `git diff -- app/events/[id]/register-form.tsx docs/superpowers/plans/2026-10-19-spanish-occupation-select-labels.md`

Confirm only the visible-label mapping and plan documentation changed; do not commit unless explicitly requested.
