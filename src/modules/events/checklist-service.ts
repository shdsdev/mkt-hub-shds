import { and, asc, eq, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { authUsers } from "@/db/auth-schema-ref";
import { db } from "@/db/client";
import { listManagedUsers, type ManagedUser } from "@/modules/users";
import {
  eventChecklistGroups,
  eventChecklistTasks,
  eventEditors,
  eventReceptionists,
  events,
} from "./db";

export type ChecklistGroupRow = typeof eventChecklistGroups.$inferSelect;
export type ChecklistTaskRow = typeof eventChecklistTasks.$inferSelect;
export type ChecklistTaskPriority = "low" | "medium" | "high";
export type ChecklistTaskFields = ChecklistTaskRow & { createdByEmail: string | null; completedByEmail: string | null };
export type ChecklistTask = ChecklistTaskFields & { subtasks: ChecklistTaskFields[] };
export type EventChecklist = ChecklistGroupRow & { tasks: ChecklistTask[] };
export type ChecklistAssignee = Pick<ManagedUser, "id" | "email" | "role">;

export type DueChecklistReminder = {
  id: string;
  organizationId: string;
  eventId: string;
  eventName: string;
  title: string;
  dueDate: string;
  assigneeId: string;
};

export type ChecklistResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "not_found" | "invalid_assignee" | "invalid_group" | "pending_subtasks" | "conflict" };

type ChecklistDb = Pick<typeof db, "select" | "update" | "delete">;
type CheckableColumn = typeof eventChecklistGroups.updatedAt | typeof eventChecklistTasks.updatedAt;

// `updated_at` defaults to `now()`, which carries microseconds in Postgres,
// while the browser only receives millisecond precision from a JS Date. Compare
// the truncated column so a version echoed by the client still matches.
function matchesVersion(column: CheckableColumn, expectedUpdatedAt: string | undefined) {
  if (!expectedUpdatedAt) return undefined;
  return sql`date_trunc('milliseconds', ${column}) = ${new Date(expectedUpdatedAt).toISOString()}::timestamptz`;
}

export function reorderChecklistItems<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return [...items];
  }

  const reordered = [...items];
  const [item] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, item);
  return reordered;
}

export async function listEventChecklist(eventId: string, organizationId: string): Promise<EventChecklist[]> {
  const [groups, tasks] = await Promise.all([
    db
      .select()
      .from(eventChecklistGroups)
      .where(and(eq(eventChecklistGroups.eventId, eventId), eq(eventChecklistGroups.organizationId, organizationId)))
      .orderBy(asc(eventChecklistGroups.position), asc(eventChecklistGroups.createdAt)),
    db
      .select()
      .from(eventChecklistTasks)
      .where(and(eq(eventChecklistTasks.eventId, eventId), eq(eventChecklistTasks.organizationId, organizationId)))
      .orderBy(asc(eventChecklistTasks.position), asc(eventChecklistTasks.createdAt)),
  ]);

  const userIds = Array.from(new Set(tasks.flatMap((task) => [task.createdBy, task.completedBy]).filter((id): id is string => Boolean(id))));
  const emailRows = userIds.length > 0
    ? await db.select({ id: authUsers.id, email: authUsers.email }).from(authUsers).where(inArray(authUsers.id, userIds))
    : [];
  const emailById = new Map(emailRows.map((row) => [row.id, row.email]));
  const withEmails = (task: ChecklistTaskRow): ChecklistTaskFields => ({
    ...task,
    createdByEmail: task.createdBy ? emailById.get(task.createdBy) ?? null : null,
    completedByEmail: task.completedBy ? emailById.get(task.completedBy) ?? null : null,
  });

  const topLevelTasks = tasks.filter((task) => task.parentTaskId === null);
  return groups.map((group) => ({
    ...group,
    tasks: topLevelTasks
      .filter((task) => task.groupId === group.id)
      .map((task) => ({
        ...withEmails(task),
        subtasks: tasks.filter((subtask) => subtask.parentTaskId === task.id).map(withEmails),
      })),
  }));
}

export async function listEventAssignees(eventId: string, organizationId: string): Promise<ChecklistAssignee[]> {
  const [editorRows, receptionistRows, users] = await Promise.all([
    db.select({ userId: eventEditors.userId }).from(eventEditors).where(eq(eventEditors.eventId, eventId)),
    db.select({ userId: eventReceptionists.userId }).from(eventReceptionists).where(eq(eventReceptionists.eventId, eventId)),
    listManagedUsers(organizationId),
  ]);
  const assignedIds = new Set([...editorRows, ...receptionistRows].map((row) => row.userId));

  return users
    .filter((user) => user.status === "active" && assignedIds.has(user.id))
    .map(({ id, email, role }) => ({ id, email, role }));
}

function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export async function listDueChecklistReminders(today: string = todayIso()): Promise<DueChecklistReminder[]> {
  const rows = await db
    .select({
      id: eventChecklistTasks.id,
      organizationId: eventChecklistTasks.organizationId,
      eventId: eventChecklistTasks.eventId,
      eventName: events.name,
      title: eventChecklistTasks.title,
      dueDate: eventChecklistTasks.dueDate,
      assigneeId: eventChecklistTasks.assigneeId,
    })
    .from(eventChecklistTasks)
    .innerJoin(events, eq(events.id, eventChecklistTasks.eventId))
    .where(and(
      eq(eventChecklistTasks.completed, false),
      isNotNull(eventChecklistTasks.assigneeId),
      isNotNull(eventChecklistTasks.dueDate),
      lte(eventChecklistTasks.dueDate, today),
    ));
  return rows.map((row) => ({
    ...row,
    dueDate: row.dueDate as string,
    assigneeId: row.assigneeId as string,
  }));
}

export async function getChecklistTask(input: {
  id: string;
  eventId: string;
  organizationId: string;
}): Promise<ChecklistTaskRow | undefined> {
  const [task] = await db
    .select()
    .from(eventChecklistTasks)
    .where(and(eq(eventChecklistTasks.id, input.id), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId)))
    .limit(1);
  return task;
}

export async function createChecklistGroup(input: {
  eventId: string;
  organizationId: string;
  title: string;
}): Promise<ChecklistResult<ChecklistGroupRow>> {
  const [last] = await db
    .select({ position: sql<number>`coalesce(max(${eventChecklistGroups.position}), -1)` })
    .from(eventChecklistGroups)
    .where(and(eq(eventChecklistGroups.eventId, input.eventId), eq(eventChecklistGroups.organizationId, input.organizationId)));
  const [group] = await db
    .insert(eventChecklistGroups)
    .values({ ...input, position: Number(last?.position ?? -1) + 1 })
    .returning();
  return { ok: true, value: group };
}

export async function updateChecklistGroup(input: {
  id: string;
  eventId: string;
  organizationId: string;
  title: string;
  expectedUpdatedAt?: string;
}): Promise<ChecklistResult<ChecklistGroupRow>> {
  const [group] = await db
    .update(eventChecklistGroups)
    .set({ title: input.title, updatedAt: new Date() })
    .where(and(eq(eventChecklistGroups.id, input.id), eq(eventChecklistGroups.eventId, input.eventId), eq(eventChecklistGroups.organizationId, input.organizationId), matchesVersion(eventChecklistGroups.updatedAt, input.expectedUpdatedAt)))
    .returning();
  if (group) return { ok: true, value: group };
  return { ok: false, reason: input.expectedUpdatedAt ? "conflict" : "not_found" };
}

export async function deleteChecklistGroup(input: {
  id: string;
  eventId: string;
  organizationId: string;
  expectedUpdatedAt?: string;
}): Promise<ChecklistResult<true>> {
  return db.transaction(async (tx) => {
    const deleted = await tx
      .delete(eventChecklistGroups)
      .where(and(eq(eventChecklistGroups.id, input.id), eq(eventChecklistGroups.eventId, input.eventId), eq(eventChecklistGroups.organizationId, input.organizationId), matchesVersion(eventChecklistGroups.updatedAt, input.expectedUpdatedAt)))
      .returning({ id: eventChecklistGroups.id });
    if (deleted.length === 0) return { ok: false, reason: input.expectedUpdatedAt ? "conflict" : "not_found" };
    await normalizeGroupPositions(tx, input.eventId, input.organizationId);
    return { ok: true, value: true };
  });
}

export async function createChecklistTask(input: {
  eventId: string;
  organizationId: string;
  groupId: string;
  title: string;
  assigneeId?: string | null;
  priority?: ChecklistTaskPriority;
  dueDate?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<ChecklistResult<ChecklistTaskRow>> {
  if (!(await groupExists(input.groupId, input.eventId, input.organizationId))) return { ok: false, reason: "invalid_group" };
  if (input.assigneeId && !(await isEventAssignee(input.eventId, input.organizationId, input.assigneeId))) {
    return { ok: false, reason: "invalid_assignee" };
  }
  const [last] = await db
    .select({ position: sql<number>`coalesce(max(${eventChecklistTasks.position}), -1)` })
    .from(eventChecklistTasks)
    .where(and(eq(eventChecklistTasks.groupId, input.groupId), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId), isNull(eventChecklistTasks.parentTaskId)));
  const [task] = await db
    .insert(eventChecklistTasks)
    .values({ ...input, parentTaskId: null, position: Number(last?.position ?? -1) + 1 })
    .returning();
  return { ok: true, value: task };
}

export async function createChecklistSubtask(input: {
  eventId: string;
  organizationId: string;
  parentTaskId: string;
  title: string;
  assigneeId?: string | null;
  priority?: ChecklistTaskPriority;
  createdBy?: string | null;
}): Promise<ChecklistResult<ChecklistTaskRow>> {
  const [parent] = await db
    .select({ groupId: eventChecklistTasks.groupId, parentTaskId: eventChecklistTasks.parentTaskId })
    .from(eventChecklistTasks)
    .where(and(eq(eventChecklistTasks.id, input.parentTaskId), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId)))
    .limit(1);
  if (!parent || parent.parentTaskId !== null) return { ok: false, reason: "invalid_group" };
  if (input.assigneeId && !(await isEventAssignee(input.eventId, input.organizationId, input.assigneeId))) {
    return { ok: false, reason: "invalid_assignee" };
  }

  const [last] = await db
    .select({ position: sql<number>`coalesce(max(${eventChecklistTasks.position}), -1)` })
    .from(eventChecklistTasks)
    .where(and(eq(eventChecklistTasks.parentTaskId, input.parentTaskId), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId)));
  const [task] = await db
    .insert(eventChecklistTasks)
    .values({
      eventId: input.eventId,
      organizationId: input.organizationId,
      groupId: parent.groupId,
      parentTaskId: input.parentTaskId,
      title: input.title,
      assigneeId: input.assigneeId ?? null,
      priority: input.priority ?? "medium",
      createdBy: input.createdBy ?? null,
      position: Number(last?.position ?? -1) + 1,
    })
    .returning();
  return { ok: true, value: task };
}

export async function updateChecklistTask(input: {
  id: string;
  eventId: string;
  organizationId: string;
  title?: string;
  completed?: boolean;
  assigneeId?: string | null;
  priority?: ChecklistTaskPriority;
  dueDate?: string | null;
  notes?: string | null;
  actorId?: string;
  expectedUpdatedAt?: string;
}): Promise<ChecklistResult<ChecklistTaskRow>> {
  if (input.assigneeId && !(await isEventAssignee(input.eventId, input.organizationId, input.assigneeId))) {
    return { ok: false, reason: "invalid_assignee" };
  }
  return db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: eventChecklistTasks.id, parentTaskId: eventChecklistTasks.parentTaskId, updatedAt: eventChecklistTasks.updatedAt })
        .from(eventChecklistTasks)
        .where(and(eq(eventChecklistTasks.id, input.id), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId)))
        .limit(1);
    if (!existing) return { ok: false, reason: "not_found" };

    if (input.expectedUpdatedAt && existing.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) {
      return { ok: false, reason: "conflict" };
    }

    if (input.completed === true && existing.parentTaskId === null) {
      const [pendingSubtask] = await tx
        .select({ id: eventChecklistTasks.id })
        .from(eventChecklistTasks)
        .where(and(
          eq(eventChecklistTasks.parentTaskId, input.id),
          eq(eventChecklistTasks.completed, false),
          eq(eventChecklistTasks.eventId, input.eventId),
          eq(eventChecklistTasks.organizationId, input.organizationId),
        ))
        .limit(1);
      if (pendingSubtask) return { ok: false, reason: "pending_subtasks" };
    }

    const [task] = await tx
      .update(eventChecklistTasks)
      .set({
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.completed === undefined ? {} : { completed: input.completed }),
        ...(input.completed === undefined ? {} : input.completed ? { completedAt: new Date(), completedBy: input.actorId ?? null } : { completedAt: null, completedBy: null }),
        ...(input.assigneeId === undefined ? {} : { assigneeId: input.assigneeId }),
        ...(input.priority === undefined ? {} : { priority: input.priority }),
        ...(input.dueDate === undefined ? {} : { dueDate: input.dueDate }),
        ...(input.notes === undefined ? {} : { notes: input.notes }),
        updatedAt: new Date(),
      })
      .where(and(eq(eventChecklistTasks.id, input.id), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId), matchesVersion(eventChecklistTasks.updatedAt, input.expectedUpdatedAt)))
      .returning();
    if (!task) return { ok: false, reason: input.expectedUpdatedAt ? "conflict" : "not_found" };

    if (input.completed !== undefined && existing.parentTaskId !== null) {
      const subtasks = await tx
        .select({ completed: eventChecklistTasks.completed })
        .from(eventChecklistTasks)
        .where(and(eq(eventChecklistTasks.parentTaskId, existing.parentTaskId), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId)));
      const parentCompleted = subtasks.length > 0 && subtasks.every((subtask) => subtask.completed);
      await tx
        .update(eventChecklistTasks)
        .set({
          completed: parentCompleted,
          ...(parentCompleted ? { completedAt: new Date(), completedBy: input.actorId ?? null } : { completedAt: null, completedBy: null }),
          updatedAt: new Date(),
        })
        .where(and(
          eq(eventChecklistTasks.id, existing.parentTaskId),
          eq(eventChecklistTasks.eventId, input.eventId),
          eq(eventChecklistTasks.organizationId, input.organizationId),
        ));
    }

    return { ok: true, value: task };
  });
}

export async function duplicateChecklistTask(input: {
  id: string;
  eventId: string;
  organizationId: string;
  createdBy?: string | null;
}): Promise<ChecklistResult<ChecklistTaskRow>> {
  return db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(eventChecklistTasks)
      .where(and(eq(eventChecklistTasks.id, input.id), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId), isNull(eventChecklistTasks.parentTaskId)))
      .limit(1);
    if (!source) return { ok: false, reason: "not_found" };

    const [last] = await tx
      .select({ position: sql<number>`coalesce(max(${eventChecklistTasks.position}), -1)` })
      .from(eventChecklistTasks)
      .where(and(eq(eventChecklistTasks.groupId, source.groupId), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId), isNull(eventChecklistTasks.parentTaskId)));
    const [copy] = await tx
      .insert(eventChecklistTasks)
      .values({
        eventId: input.eventId,
        organizationId: input.organizationId,
        groupId: source.groupId,
        parentTaskId: null,
        title: `${source.title} (copia)`,
        completed: false,
        assigneeId: source.assigneeId,
        priority: source.priority,
        dueDate: source.dueDate,
        notes: source.notes,
        createdBy: input.createdBy ?? null,
        completedAt: null,
        completedBy: null,
        position: Number(last?.position ?? -1) + 1,
      })
      .returning();
    if (!copy) return { ok: false, reason: "not_found" };

    const subtasks = await tx
      .select()
      .from(eventChecklistTasks)
      .where(and(eq(eventChecklistTasks.parentTaskId, source.id), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId)))
      .orderBy(asc(eventChecklistTasks.position), asc(eventChecklistTasks.createdAt));
    if (subtasks.length > 0) {
      await tx
        .insert(eventChecklistTasks)
        .values(subtasks.map((subtask, position) => ({
          eventId: input.eventId,
          organizationId: input.organizationId,
          groupId: source.groupId,
          parentTaskId: copy.id,
          title: subtask.title,
          completed: false,
          assigneeId: subtask.assigneeId,
          priority: subtask.priority,
          dueDate: subtask.dueDate,
          notes: subtask.notes,
          createdBy: input.createdBy ?? null,
          position,
        })))
        .returning();
    }

    return { ok: true, value: copy };
  });
}

export async function deleteChecklistTask(input: {
  id: string;
  eventId: string;
  organizationId: string;
  expectedUpdatedAt?: string;
}): Promise<ChecklistResult<true>> {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select({ groupId: eventChecklistTasks.groupId, parentTaskId: eventChecklistTasks.parentTaskId })
      .from(eventChecklistTasks)
      .where(and(eq(eventChecklistTasks.id, input.id), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId)))
      .limit(1);
    if (!task) return { ok: false, reason: "not_found" };
    const deleted = await tx
      .delete(eventChecklistTasks)
      .where(and(eq(eventChecklistTasks.id, input.id), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId), matchesVersion(eventChecklistTasks.updatedAt, input.expectedUpdatedAt)))
      .returning({ id: eventChecklistTasks.id });
    if (deleted.length === 0) return { ok: false, reason: "conflict" };
    await normalizeTaskPositions(tx, task.groupId, input.eventId, input.organizationId, task.parentTaskId);
    return { ok: true, value: true };
  });
}

export async function reorderChecklistGroups(input: {
  eventId: string;
  organizationId: string;
  orderedIds: string[];
  expectedUpdatedAtById?: Record<string, string>;
}): Promise<ChecklistResult<true>> {
  return db.transaction(async (tx) => {
    const groups = await tx
      .select({ id: eventChecklistGroups.id })
      .from(eventChecklistGroups)
      .where(and(eq(eventChecklistGroups.eventId, input.eventId), eq(eventChecklistGroups.organizationId, input.organizationId)));
    if (groups.length !== input.orderedIds.length || !input.orderedIds.every((id) => groups.some((group) => group.id === id))) {
      return { ok: false, reason: "not_found" };
    }
    for (const [position, id] of input.orderedIds.entries()) {
      const expected = input.expectedUpdatedAtById?.[id];
      if (input.expectedUpdatedAtById && !expected) return { ok: false, reason: "conflict" };
      const updated = await tx
        .update(eventChecklistGroups)
        .set({ position, updatedAt: new Date() })
        .where(and(eq(eventChecklistGroups.id, id), matchesVersion(eventChecklistGroups.updatedAt, expected)))
        .returning({ id: eventChecklistGroups.id });
      if (updated.length === 0) return { ok: false, reason: "conflict" };
    }
    return { ok: true, value: true };
  });
}

export async function moveChecklistTask(input: {
  id: string;
  eventId: string;
  organizationId: string;
  destinationGroupId: string;
  destinationIndex: number;
  expectedUpdatedAt?: string;
}): Promise<ChecklistResult<true>> {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select({ groupId: eventChecklistTasks.groupId, parentTaskId: eventChecklistTasks.parentTaskId })
      .from(eventChecklistTasks)
      .where(and(eq(eventChecklistTasks.id, input.id), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId)))
      .limit(1);
    if (!task) return { ok: false, reason: "not_found" };
    if (task.parentTaskId !== null) return { ok: false, reason: "invalid_group" };
    if (!(await groupExistsWith(tx, input.destinationGroupId, input.eventId, input.organizationId))) return { ok: false, reason: "invalid_group" };

    const movedRow = await tx
      .update(eventChecklistTasks)
      .set({ groupId: input.destinationGroupId, updatedAt: new Date() })
      .where(and(eq(eventChecklistTasks.id, input.id), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId), matchesVersion(eventChecklistTasks.updatedAt, input.expectedUpdatedAt)))
      .returning({ id: eventChecklistTasks.id });
    if (movedRow.length === 0) return { ok: false, reason: "conflict" };
    await normalizeTaskPositions(tx, task.groupId, input.eventId, input.organizationId, null, input.id);
    await normalizeTaskPositions(tx, input.destinationGroupId, input.eventId, input.organizationId, null);
    const destination = await tx
      .select({ id: eventChecklistTasks.id })
      .from(eventChecklistTasks)
      .where(and(eq(eventChecklistTasks.groupId, input.destinationGroupId), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId), isNull(eventChecklistTasks.parentTaskId)))
      .orderBy(asc(eventChecklistTasks.position), asc(eventChecklistTasks.createdAt));
    const boundedIndex = Math.max(0, Math.min(input.destinationIndex, destination.length - 1));
    const orderedIds = destination.map((item) => item.id);
    const movedIndex = orderedIds.indexOf(input.id);
    const [moved] = orderedIds.splice(movedIndex, 1);
    orderedIds.splice(boundedIndex, 0, moved);
    for (const [position, id] of orderedIds.entries()) {
      await tx.update(eventChecklistTasks).set({ position, updatedAt: new Date() }).where(eq(eventChecklistTasks.id, id));
    }
    return { ok: true, value: true };
  });
}

export async function bulkUpdateChecklistTasks(input: {
  ids: string[];
  eventId: string;
  organizationId: string;
  completed?: boolean;
  assigneeId?: string | null;
  actorId?: string;
  expectedUpdatedAtById?: Record<string, string>;
}): Promise<ChecklistResult<{ updated: number; skipped: number }>> {
  if (input.ids.length === 0) return { ok: true, value: { updated: 0, skipped: 0 } };
  if (input.assigneeId && !(await isEventAssignee(input.eventId, input.organizationId, input.assigneeId))) {
    return { ok: false, reason: "invalid_assignee" };
  }

  return db.transaction(async (tx) => {
    let updated = 0;
    let skipped = 0;

    for (const id of input.ids) {
      const [task] = await tx
        .select({ id: eventChecklistTasks.id, parentTaskId: eventChecklistTasks.parentTaskId })
        .from(eventChecklistTasks)
        .where(and(eq(eventChecklistTasks.id, id), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId)))
        .limit(1);
      if (!task) {
        skipped += 1;
        continue;
      }

      if (input.completed === true && task.parentTaskId === null) {
        const [pendingSubtask] = await tx
          .select({ id: eventChecklistTasks.id })
          .from(eventChecklistTasks)
          .where(and(
            eq(eventChecklistTasks.parentTaskId, id),
            eq(eventChecklistTasks.completed, false),
            eq(eventChecklistTasks.eventId, input.eventId),
            eq(eventChecklistTasks.organizationId, input.organizationId),
          ))
          .limit(1);
        if (pendingSubtask) {
          skipped += 1;
          continue;
        }
      }

      const expected = input.expectedUpdatedAtById?.[id];
      if (input.expectedUpdatedAtById && !expected) return { ok: false, reason: "conflict" };
      const written = await tx
        .update(eventChecklistTasks)
        .set({
          ...(input.completed === undefined ? {} : { completed: input.completed }),
          ...(input.completed === undefined ? {} : input.completed ? { completedAt: new Date(), completedBy: input.actorId ?? null } : { completedAt: null, completedBy: null }),
          ...(input.assigneeId === undefined ? {} : { assigneeId: input.assigneeId }),
          updatedAt: new Date(),
        })
        .where(and(eq(eventChecklistTasks.id, id), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId), matchesVersion(eventChecklistTasks.updatedAt, expected)))
        .returning({ id: eventChecklistTasks.id });
      if (written.length === 0) return { ok: false, reason: "conflict" };
      updated += 1;
    }

    return { ok: true, value: { updated, skipped } };
  });
}

export async function bulkDeleteChecklistTasks(input: {
  ids: string[];
  eventId: string;
  organizationId: string;
  expectedUpdatedAtById?: Record<string, string>;
}): Promise<ChecklistResult<{ deleted: number }>> {
  if (input.ids.length === 0) return { ok: true, value: { deleted: 0 } };

  return db.transaction(async (tx) => {
    if (input.expectedUpdatedAtById) {
      let deleted = 0;
      for (const id of input.ids) {
        const expected = input.expectedUpdatedAtById[id];
        if (!expected) return { ok: false, reason: "conflict" };
        const rows = await tx
          .delete(eventChecklistTasks)
          .where(and(
            eq(eventChecklistTasks.id, id),
            eq(eventChecklistTasks.eventId, input.eventId),
            eq(eventChecklistTasks.organizationId, input.organizationId),
            matchesVersion(eventChecklistTasks.updatedAt, expected),
          ))
          .returning({ id: eventChecklistTasks.id });
        if (rows.length === 0) return { ok: false, reason: "conflict" };
        deleted += 1;
      }
      return { ok: true, value: { deleted } };
    }

    const deleted = await tx
      .delete(eventChecklistTasks)
      .where(and(
        inArray(eventChecklistTasks.id, input.ids),
        eq(eventChecklistTasks.eventId, input.eventId),
        eq(eventChecklistTasks.organizationId, input.organizationId),
      ))
      .returning({ id: eventChecklistTasks.id });
    return { ok: true, value: { deleted: deleted.length } };
  });
}

async function groupExists(groupId: string, eventId: string, organizationId: string): Promise<boolean> {
  const rows = await db.select({ id: eventChecklistGroups.id }).from(eventChecklistGroups).where(and(eq(eventChecklistGroups.id, groupId), eq(eventChecklistGroups.eventId, eventId), eq(eventChecklistGroups.organizationId, organizationId))).limit(1);
  return rows.length > 0;
}

async function groupExistsWith(executor: ChecklistDb, groupId: string, eventId: string, organizationId: string): Promise<boolean> {
  const rows = await executor.select({ id: eventChecklistGroups.id }).from(eventChecklistGroups).where(and(eq(eventChecklistGroups.id, groupId), eq(eventChecklistGroups.eventId, eventId), eq(eventChecklistGroups.organizationId, organizationId))).limit(1);
  return rows.length > 0;
}

async function isEventAssignee(eventId: string, organizationId: string, userId: string): Promise<boolean> {
  return (await listEventAssignees(eventId, organizationId)).some((user) => user.id === userId);
}

async function normalizeGroupPositions(executor: ChecklistDb, eventId: string, organizationId: string): Promise<void> {
  const groups = await executor.select({ id: eventChecklistGroups.id }).from(eventChecklistGroups).where(and(eq(eventChecklistGroups.eventId, eventId), eq(eventChecklistGroups.organizationId, organizationId))).orderBy(asc(eventChecklistGroups.position), asc(eventChecklistGroups.createdAt));
  for (const [position, group] of groups.entries()) {
    await executor.update(eventChecklistGroups).set({ position, updatedAt: new Date() }).where(eq(eventChecklistGroups.id, group.id));
  }
}

async function normalizeTaskPositions(executor: ChecklistDb, groupId: string, eventId: string, organizationId: string, parentTaskId: string | null, excludingId?: string): Promise<void> {
  const parentCondition = parentTaskId === null ? isNull(eventChecklistTasks.parentTaskId) : eq(eventChecklistTasks.parentTaskId, parentTaskId);
  const tasks = await executor.select({ id: eventChecklistTasks.id }).from(eventChecklistTasks).where(and(eq(eventChecklistTasks.groupId, groupId), eq(eventChecklistTasks.eventId, eventId), eq(eventChecklistTasks.organizationId, organizationId), parentCondition, excludingId ? sql`${eventChecklistTasks.id} <> ${excludingId}` : undefined)).orderBy(asc(eventChecklistTasks.position), asc(eventChecklistTasks.createdAt));
  for (const [position, task] of tasks.entries()) {
    await executor.update(eventChecklistTasks).set({ position, updatedAt: new Date() }).where(eq(eventChecklistTasks.id, task.id));
  }
}
