# Event Organization Checklist Design

## Summary

Add an event-scoped `Organization` tab immediately after `Edit` in the event navigation. The tab provides a Notion-like planning workspace with collapsible groups and checklist tasks. The workspace is private to one event, visible to `ADMIN`, `EVENT_EDITOR`, and `RECEPTION`, and editable only by `ADMIN` and `EVENT_EDITOR`.

## Goals

- Give each event its own planning checklist.
- Organize tasks into collapsible, ordered groups.
- Support task completion, assignment, due dates, and notes.
- Allow groups and tasks to be reordered with drag and drop.
- Allow tasks to move between groups.
- Restrict assignees to users already assigned to the event.
- Keep reception users in read-only mode.
- Preserve responsive and keyboard-accessible interaction.

## Non-goals

- Reusable organization-wide checklist templates.
- Nested groups beyond one group level.
- Dependencies, comments, file attachments, reminders, or recurring tasks.
- A separate project-management dashboard outside an event.

## Navigation and Access

Add a new event sub-navigation entry after `Edit`:

- Label: `Organization`
- Route: `/events/[id]/organization`
- Capability: a new event capability for organization checklist access

Access rules:

- `ADMIN`: read and write access.
- `EVENT_EDITOR`: read and write access.
- `RECEPTION`: read-only access.
- Other roles: no navigation entry and no route access.

Every read and mutation must be scoped by both `eventId` and the authenticated user's `organizationId`. Server-side authorization is authoritative; hiding controls in the client is not sufficient.

## Data Model

Create two organization-scoped relational tables.

### `event_checklist_groups`

- `id` UUID primary key
- `organization_id` UUID, required foreign key
- `event_id` UUID, required foreign key
- `title` text, required
- `position` integer, required
- `created_at` timestamp, required
- `updated_at` timestamp, required

### `event_checklist_tasks`

- `id` UUID primary key
- `organization_id` UUID, required foreign key
- `event_id` UUID, required foreign key
- `group_id` UUID, required foreign key
- `title` text, required
- `completed` boolean, required, default `false`
- `assignee_id` UUID, nullable foreign key to users
- `due_date` date, nullable
- `notes` text, nullable
- `position` integer, required
- `created_at` timestamp, required
- `updated_at` timestamp, required

Constraints and invariants:

- A group belongs to exactly one event.
- A task belongs to exactly one group and event.
- Mutations must verify that the task's assignee is assigned to the same event.
- Group ordering is represented by `position` within an event.
- Task ordering is represented by `position` within a group.
- Moving a task updates its `group_id` and normalizes affected positions atomically.
- Deleting a group deletes its tasks after an explicit confirmation.
- Accordion open/closed state is client state and is not persisted.

## User Interface

The page contains:

- Header with event name and completed-task progress.
- `Add group` action for writable roles.
- Ordered accordion groups.
- Group title editing and group deletion controls for writable roles.
- An expanded group containing ordered task rows and an `Add task` action.
- Task rows showing checkbox, title, assignee, and due date.
- Expanded task details containing notes and editable fields.
- Drag handles and drop targets for writable roles only.

Drag-and-drop behavior:

- Groups can be reordered within the event.
- Tasks can be reordered within their current group.
- Tasks can be dropped into another group, updating their group and position.
- Drop operations persist through server mutations and normalize positions.
- Keyboard-accessible alternatives must exist for reordering and moving items.
- Touch interaction must work on mobile layouts.

Read-only behavior for `RECEPTION`:

- Groups, task details, assignments, dates, notes, and progress are visible.
- Checkboxes are not interactive.
- Add, edit, delete, and drag controls are hidden or disabled.

## Server API and Mutations

Implement organization-scoped module functions and server actions for:

- Listing groups and tasks for an event.
- Creating, renaming, and deleting groups.
- Creating, editing, completing, and deleting tasks.
- Reordering groups.
- Reordering tasks within a group.
- Moving a task to another group.

All mutations validate UUIDs, text lengths, optional dates, nullable notes, and assignee membership. Reordering and moving operations must run in a database transaction. Mutations should revalidate the event organization route after success and return actionable errors without losing the current client state on failure.

## Auditing

Checklist mutations should use the existing event audit mechanism with event association and organization scope. Record the resource type, actor, operation, and relevant before/after values for group/task creation, editing, deletion, completion changes, assignment changes, and movement/reordering.

## Testing

Add coverage for:

- Access policy for all three allowed roles and denied roles.
- Organization and event isolation on reads and mutations.
- Assignee validation against event assignments.
- Group and task CRUD validation.
- Atomic task movement and position normalization.
- Read-only rendering for `RECEPTION`.
- Writable rendering for `ADMIN` and `EVENT_EDITOR`.
- Completing a task, editing details, and saving notes.
- Reordering groups and tasks, including moving a task across groups.
- Empty states, loading states, mutation errors, and responsive overflow.

## Acceptance Criteria

1. An authorized user sees `Organization` immediately after `Edit` in the event navigation.
2. A newly created event can receive groups and tasks without affecting another event.
3. Tasks support title, completion state, assignee, due date, and notes.
4. Assignee selection only offers users assigned to the event.
5. Groups and tasks can be reordered with drag and drop, including moving tasks between groups.
6. `RECEPTION` can inspect the checklist but cannot mutate it.
7. Unauthorized roles cannot access the route or mutation actions.
8. Position and movement mutations remain consistent after concurrent or failed requests.
9. The interface remains usable with keyboard navigation and on mobile screens.
