import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  checklistTemplateGroups,
  checklistTemplateTasks,
  checklistTemplates,
  eventChecklistGroups,
  eventChecklistTasks,
} from "./db";
import type { ChecklistResult } from "./checklist-service";

export type ChecklistTemplateRow = typeof checklistTemplates.$inferSelect;
export type ChecklistTemplateGroupRow = typeof checklistTemplateGroups.$inferSelect;
export type ChecklistTemplateTaskRow = typeof checklistTemplateTasks.$inferSelect;
export type ChecklistTemplateTask = ChecklistTemplateTaskRow & { subtasks: ChecklistTemplateTaskRow[] };
export type ChecklistTemplateGroup = ChecklistTemplateGroupRow & { tasks: ChecklistTemplateTask[] };
export type ChecklistTemplate = ChecklistTemplateRow & { groups: ChecklistTemplateGroup[] };
export type ChecklistTemplateSummary = {
  id: string;
  name: string;
  groupCount: number;
  taskCount: number;
  createdAt: Date;
};

type TemplateDb = Pick<typeof db, "select">;

export function buildTemplateTree(
  groups: ChecklistTemplateGroupRow[],
  tasks: ChecklistTemplateTaskRow[],
): ChecklistTemplateGroup[] {
  const topLevel = tasks.filter((task) => task.parentTaskId === null);
  return groups.map((group) => ({
    ...group,
    tasks: topLevel
      .filter((task) => task.groupId === group.id)
      .map((task) => ({
        ...task,
        subtasks: tasks.filter((subtask) => subtask.parentTaskId === task.id),
      })),
  }));
}

async function loadTemplate(executor: TemplateDb, templateId: string, organizationId: string): Promise<ChecklistTemplate | undefined> {
  const [template] = await executor
    .select()
    .from(checklistTemplates)
    .where(and(eq(checklistTemplates.id, templateId), eq(checklistTemplates.organizationId, organizationId)))
    .limit(1);
  if (!template) return undefined;

  const groups = await executor
    .select()
    .from(checklistTemplateGroups)
    .where(eq(checklistTemplateGroups.templateId, template.id))
    .orderBy(asc(checklistTemplateGroups.position));
  const groupIds = groups.map((group) => group.id);
  const tasks = groupIds.length > 0
    ? await executor
        .select()
        .from(checklistTemplateTasks)
        .where(inArray(checklistTemplateTasks.groupId, groupIds))
        .orderBy(asc(checklistTemplateTasks.position))
    : [];

  return { ...template, groups: buildTemplateTree(groups, tasks) };
}

export async function listChecklistTemplates(organizationId: string): Promise<ChecklistTemplateSummary[]> {
  const templates = await db
    .select()
    .from(checklistTemplates)
    .where(eq(checklistTemplates.organizationId, organizationId))
    .orderBy(asc(checklistTemplates.name));
  if (templates.length === 0) return [];

  const groups = await db
    .select()
    .from(checklistTemplateGroups)
    .where(inArray(checklistTemplateGroups.templateId, templates.map((template) => template.id)));
  const groupIds = groups.map((group) => group.id);
  const tasks = groupIds.length > 0
    ? await db
        .select({ id: checklistTemplateTasks.id, groupId: checklistTemplateTasks.groupId })
        .from(checklistTemplateTasks)
        .where(inArray(checklistTemplateTasks.groupId, groupIds))
    : [];

  const groupCountByTemplate = new Map<string, number>();
  const taskCountByTemplate = new Map<string, number>();
  for (const group of groups) {
    groupCountByTemplate.set(group.templateId, (groupCountByTemplate.get(group.templateId) ?? 0) + 1);
  }
  const taskCountByGroup = new Map<string, number>();
  for (const task of tasks) {
    taskCountByGroup.set(task.groupId, (taskCountByGroup.get(task.groupId) ?? 0) + 1);
  }
  for (const group of groups) {
    taskCountByTemplate.set(group.templateId, (taskCountByTemplate.get(group.templateId) ?? 0) + (taskCountByGroup.get(group.id) ?? 0));
  }

  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    groupCount: groupCountByTemplate.get(template.id) ?? 0,
    taskCount: taskCountByTemplate.get(template.id) ?? 0,
    createdAt: template.createdAt,
  }));
}

export async function getChecklistTemplate(organizationId: string, templateId: string): Promise<ChecklistTemplate | undefined> {
  return loadTemplate(db, templateId, organizationId);
}

export async function saveEventChecklistAsTemplate(input: {
  eventId: string;
  organizationId: string;
  name: string;
}): Promise<ChecklistResult<ChecklistTemplateRow>> {
  return db.transaction(async (tx) => {
    const groups = await tx
      .select()
      .from(eventChecklistGroups)
      .where(and(eq(eventChecklistGroups.eventId, input.eventId), eq(eventChecklistGroups.organizationId, input.organizationId)))
      .orderBy(asc(eventChecklistGroups.position), asc(eventChecklistGroups.createdAt));
    const tasks = await tx
      .select()
      .from(eventChecklistTasks)
      .where(and(eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId)))
      .orderBy(asc(eventChecklistTasks.position), asc(eventChecklistTasks.createdAt));

    const [template] = await tx
      .insert(checklistTemplates)
      .values({ organizationId: input.organizationId, name: input.name })
      .returning();
    if (!template) return { ok: false, reason: "not_found" };

    const groupIdMap = new Map<string, string>();
    for (const [position, group] of groups.entries()) {
      const [inserted] = await tx
        .insert(checklistTemplateGroups)
        .values({ templateId: template.id, title: group.title, position })
        .returning({ id: checklistTemplateGroups.id });
      if (inserted) groupIdMap.set(group.id, inserted.id);
    }

    const taskIdMap = new Map<string, string>();
    for (const task of tasks.filter((item) => item.parentTaskId === null)) {
      const targetGroupId = groupIdMap.get(task.groupId);
      if (!targetGroupId) continue;
      const [inserted] = await tx
        .insert(checklistTemplateTasks)
        .values({ groupId: targetGroupId, parentTaskId: null, title: task.title, notes: task.notes, position: task.position })
        .returning({ id: checklistTemplateTasks.id });
      if (inserted) taskIdMap.set(task.id, inserted.id);
    }
    for (const task of tasks.filter((item) => item.parentTaskId !== null)) {
      const targetGroupId = groupIdMap.get(task.groupId);
      const targetParentId = task.parentTaskId ? taskIdMap.get(task.parentTaskId) : undefined;
      if (!targetGroupId || !targetParentId) continue;
      await tx
        .insert(checklistTemplateTasks)
        .values({ groupId: targetGroupId, parentTaskId: targetParentId, title: task.title, notes: task.notes, position: task.position });
    }

    return { ok: true, value: template };
  });
}

export async function applyChecklistTemplate(input: {
  templateId: string;
  eventId: string;
  organizationId: string;
  createdBy?: string | null;
}): Promise<ChecklistResult<{ groups: number; tasks: number }>> {
  return db.transaction(async (tx) => {
    const template = await loadTemplate(tx, input.templateId, input.organizationId);
    if (!template) return { ok: false, reason: "not_found" };

    const [last] = await tx
      .select({ position: sql<number>`coalesce(max(${eventChecklistGroups.position}), -1)` })
      .from(eventChecklistGroups)
      .where(and(eq(eventChecklistGroups.eventId, input.eventId), eq(eventChecklistGroups.organizationId, input.organizationId)));
    const groupOffset = Number(last?.position ?? -1) + 1;
    let taskCount = 0;

    for (const [groupIndex, group] of template.groups.entries()) {
      const [insertedGroup] = await tx
        .insert(eventChecklistGroups)
        .values({ eventId: input.eventId, organizationId: input.organizationId, title: group.title, position: groupOffset + groupIndex })
        .returning({ id: eventChecklistGroups.id });
      if (!insertedGroup) continue;

      for (const [taskIndex, task] of group.tasks.entries()) {
        const [insertedTask] = await tx
          .insert(eventChecklistTasks)
          .values({
            eventId: input.eventId,
            organizationId: input.organizationId,
            groupId: insertedGroup.id,
            parentTaskId: null,
            title: task.title,
            notes: task.notes,
            createdBy: input.createdBy ?? null,
            position: taskIndex,
          })
          .returning({ id: eventChecklistTasks.id });
        if (!insertedTask) continue;
        taskCount += 1;

        for (const [subtaskIndex, subtask] of task.subtasks.entries()) {
          await tx
            .insert(eventChecklistTasks)
            .values({
              eventId: input.eventId,
              organizationId: input.organizationId,
              groupId: insertedGroup.id,
              parentTaskId: insertedTask.id,
              title: subtask.title,
              notes: subtask.notes,
              createdBy: input.createdBy ?? null,
              position: subtaskIndex,
            });
          taskCount += 1;
        }
      }
    }

    return { ok: true, value: { groups: template.groups.length, tasks: taskCount } };
  });
}

export async function deleteChecklistTemplate(input: {
  templateId: string;
  organizationId: string;
}): Promise<ChecklistResult<true>> {
  const deleted = await db
    .delete(checklistTemplates)
    .where(and(eq(checklistTemplates.id, input.templateId), eq(checklistTemplates.organizationId, input.organizationId)))
    .returning({ id: checklistTemplates.id });
  return deleted.length > 0 ? { ok: true, value: true } : { ok: false, reason: "not_found" };
}
