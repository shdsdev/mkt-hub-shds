# Protected Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix tablet layout failures in event registrations, dashboard, event navigation, and users settings.

**Architecture:** Keep existing server/data boundaries and shared navigation. Change only responsive presentation classes and small presentational wrappers. Use internal scroll containers where tabular data cannot compress safely.

**Tech Stack:** Next.js 16.3.4, React 19.2.8, TypeScript, Tailwind CSS, Vitest.

## Global Constraints

- Cards are phone-only; tablet uses compact tables.
- No page-level horizontal overflow.
- Preserve existing permissions, routes, labels, and selection/detail behavior.
- Keep the existing visual language and accent states.

### Task 1: Registration Responsive Modes

**Files:**
- Modify: `app/(protected)/events/[id]/registrations/registrations-table.tsx`

- [x] Change the card wrapper to `sm:hidden` and the table wrapper to `hidden sm:block`.
- [x] Keep the table inside `max-w-full overflow-x-auto overscroll-x-contain`.
- [x] Reduce tablet table columns to operational fields while retaining the full desktop table at `xl`.
- [x] Replace the card metadata gray block with a compact two-column grid using existing labels and values.
- [x] Run focused registration tests.

### Task 2: Dashboard Tablet Flow

**Files:**
- Modify: `app/(protected)/events/[id]/dashboard/page.tsx`

- [x] Change metric layout to two columns below `xl`, one column below `sm`, and six columns only at `xl`.
- [x] Change the activity/content grid to a single column below `xl` and retain the side column at `xl`.
- [x] Ensure chart and section children have `min-w-0` and no fixed child width can expand the document.
- [x] Run the dashboard page tests.

### Task 3: Event Sub-navigation Containment

**Files:**
- Modify: `app/(protected)/events/event-sub-nav.tsx`

- [x] Add viewport containment and touch scrolling to the nav container.
- [x] Tune tablet padding/gaps while preserving the active tab and automatic active-tab visibility.
- [x] Run the event sub-navigation tests.

### Task 4: Users Tablet Composition

**Files:**
- Modify: `app/(protected)/settings/users/user-management.tsx`

- [x] Inspect the invitation and toolbar wrappers for fixed or non-wrapping widths.
- [x] Stack invitation controls at tablet width and allow toolbar controls to wrap within the card.
- [x] Keep the data table in an internal scroll container.
- [x] Run users settings tests.

### Task 5: Full Verification

- [x] Run `pnpm lint`.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
- [x] Run Impeccable detector on changed UI targets.
