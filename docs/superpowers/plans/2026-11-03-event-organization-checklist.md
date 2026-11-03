# Event Organization Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an event-scoped Organization tab with ordered accordion groups and checklist tasks, including assignment, due dates, notes, completion, and drag-and-drop movement.

**Architecture:** Keep checklist data in organization-scoped relational tables rather than the existing event JSON fields. Expose focused module queries/mutations through server actions, enforce access through the existing event capability policy, and render a dedicated route after Edit in the shared event navigation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM/Postgres, Zod, Vitest, existing Tailwind/shadcn-style components, accessible drag-and-drop dependency selected during implementation.

## Global Constraints

- `ADMIN` and `EVENT_EDITOR` can mutate; `RECEPTION` is read-only; other roles are denied.
- Every query and mutation is scoped by `organizationId` and `eventId`.
- Assignees must already be assigned to the event.
- Tasks can move between groups and all affected positions are normalized atomically.
- The UI must work on mobile and provide a keyboard-accessible reordering alternative.
- Do not modify unrelated dirty worktree files.

---

### Task 1: Add checklist schema and access capability

**Files:**
- Modify: `src/modules/events/db.ts`
- Modify: `src/modules/events/access-policy.ts`
- Modify: `src/modules/events/access.ts`
- Create: generated Drizzle migration under `drizzle/`
- Test: `src/modules/events/db.test.ts`
- Test: `src/modules/events/access-authorization.test.ts`

**Interfaces:**
- Produce `eventChecklistGroups` and `eventChecklistTasks` Drizzle tables and `organization`/`event` scoped types.
- Produce `organization` as an `EventCapability` accepted by `canRoleAccessCapability` for all three allowed roles.

- [ ] Write failing schema assertions for both tables, foreign keys, defaults, positions, and nullable task metadata.
- [ ] Write failing access assertions for ADMIN, EVENT_EDITOR, RECEPTION, and a denied role.
- [ ] Run `pnpm vitest run src/modules/events/db.test.ts src/modules/events/access-authorization.test.ts` and confirm the new assertions fail.
- [ ] Add the two tables with indexes for `(organization_id,event_id,position)` and `(organization_id,event_id,group_id,position)` and task/group foreign keys.
- [ ] Extend the capability union and role policy; update `canAccessEvent` consumers only where the compiler requires it.
- [ ] Generate the migration with `pnpm db:generate` and inspect that only the checklist tables/indexes are included.
- [ ] Run the focused tests and confirm they pass.
- [ ] Commit with `feat(events): add organization checklist schema`.

### Task 2: Implement checklist module queries and mutations

**Files:**
- Modify: `src/modules/events/service.ts` or create `src/modules/events/checklist-service.ts` if the existing service boundary becomes unwieldy.
- Modify: `src/modules/events/index.ts`
- Modify: `src/modules/events/service.test.ts` or create `src/modules/events/checklist-service.test.ts`

**Interfaces:**
- `listEventChecklist(eventId: string, organizationId: string)` returns ordered groups with ordered tasks.
- `listEventAssignees(eventId: string, organizationId: string)` returns only active users assigned as editors or receptionists to the event.
- Mutations accept `eventId`, `organizationId`, and validated input; write operations additionally accept actor identity/role where the existing service convention requires it.
- `createChecklistGroup`, `updateChecklistGroup`, `deleteChecklistGroup`, `createChecklistTask`, `updateChecklistTask`, `deleteChecklistTask`, `reorderChecklistGroups`, and `moveChecklistTask` return typed success/not-found/forbidden/validation results.

- [ ] Write failing tests for event/org isolation, ordered listing, assignee membership, CRUD, completion updates, and group deletion.
- [ ] Write failing tests proving task movement updates `groupId` and both source/destination positions in one transaction.
- [ ] Implement organization-scoped selectors and active event-assignment lookup using existing `eventEditors`/`eventReceptionists` relationships.
- [ ] Implement transactional position normalization for group reorder and task reorder/move.
- [ ] Keep assignee validation in the service boundary, not only in the form.
- [ ] Run the focused service tests and confirm they pass.
- [ ] Commit with `feat(events): add checklist service operations`.

### Task 3: Add server actions and route authorization

**Files:**
- Create: `app/(protected)/events/[id]/organization/actions.ts`
- Create: `app/(protected)/events/[id]/organization/page.tsx`
- Create: `app/(protected)/events/[id]/organization/organization-checklist.tsx`
- Modify: `app/(protected)/events/event-sub-nav.tsx`
- Modify: `app/(protected)/events/[id]/organization` route tests or create route/component tests beside the new files.

**Interfaces:**
- Server actions validate FormData with Zod, authenticate the current user, call `canAccessEvent`, enforce writable roles for mutations, and revalidate `/events/${eventId}/organization`.
- The page loads the event, checklist, and event assignees using the current organization context.
- The client component receives serializable groups, tasks, assignees, and `canEdit`.

- [ ] Write failing tests for navigation ordering and role filtering.
- [ ] Write failing action tests for read access, write access, invalid UUIDs, invalid text/date fields, cross-organization event IDs, and unauthorized assignees.
- [ ] Add `Organization` immediately after `Edit` and include it for ADMIN, EVENT_EDITOR, and RECEPTION.
- [ ] Add the page using the existing event page shell and `EventSubNav current="organization"`.
- [ ] Add actions for group/task CRUD, completion, group reorder, and task move/reorder.
- [ ] Run focused action and navigation tests and confirm they pass.
- [ ] Commit with `feat(events): add organization checklist route`.

### Task 4: Build the accordion checklist UI

**Files:**
- Create or modify: `app/(protected)/events/[id]/organization/organization-checklist.tsx`
- Create: `app/(protected)/events/[id]/organization/checklist-dnd.tsx` if the drag-and-drop adapter needs isolation.
- Create: `app/(protected)/events/[id]/organization/organization-checklist.test.tsx`

**Interfaces:**
- Render group accordion state locally; do not persist open/closed state.
- Render read-only controls for RECEPTION and writable controls for ADMIN/EVENT_EDITOR.
- Use the server action contracts from Task 3 for optimistic mutations with rollback/error feedback.

- [ ] Write failing component tests for empty state, group/task creation controls, task details, progress, and read-only reception rendering.
- [ ] Write failing component tests for task movement across groups and error rollback.
- [ ] Add the approved accordion layout with group progress counters and task detail fields for title, assignee, due date, notes, and completion.
- [ ] Add accessible drag handles, drop targets, keyboard movement controls, touch support, and clear focus states.
- [ ] Add loading/disabled/error/success feedback without relying on color alone.
- [ ] Run the component tests and lint the new files.
- [ ] Commit with `feat(events): add checklist accordion interface`.

### Task 5: Verify integration and regression safety

**Files:**
- Modify: relevant event audit formatting/types if new resource labels require it.
- Modify: relevant documentation only if implementation differs from the design.

- [ ] Run `pnpm lint`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Manually verify ADMIN/EVENT_EDITOR editing, RECEPTION read-only mode, mobile overflow, keyboard reordering, cross-group task movement, and failed mutation recovery.
- [ ] Inspect `git diff` and `git status --short` to confirm only intended checklist files changed beyond pre-existing worktree changes.
- [ ] Commit any final corrections as a focused fix commit.
