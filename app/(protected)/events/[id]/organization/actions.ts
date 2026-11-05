"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { recordAudit } from "@/modules/audit";
import { applyChecklistTemplate, bulkDeleteChecklistTasks, bulkUpdateChecklistTasks, canAccessEvent, createChecklistComment, createChecklistGroup, createChecklistSubtask, createChecklistTask, deleteChecklistGroup, deleteChecklistTask, deleteChecklistTemplate, duplicateChecklistTask, getChecklistTask, moveChecklistTask, reorderChecklistGroups, saveEventChecklistAsTemplate, updateChecklistGroup, updateChecklistTask } from "@/modules/events";
import { isActive } from "@/modules/users";

export type OrganizationActionState = { error?: string; success?: string; conflict?: boolean };

const uuid = z.string().uuid();
const title = z.string().trim().min(1).max(255);
const optionalDate = z.string().trim().max(10).optional().or(z.literal(""));
const optionalVersion = z.string().datetime().optional().or(z.literal(""));
const versionsById = z.record(z.string(), z.string().datetime());
const TASK_PERMISSION_ERROR = "No tienes permiso para modificar esta tarea.";
const TASK_CONFLICT_ERROR = "La tarea fue modificada por otro usuario. Recargá la página y volvé a intentarlo.";
const GROUP_CONFLICT_ERROR = "El grupo fue modificado por otro usuario. Recargá la página y volvé a intentarlo.";
const TASKS_CONFLICT_ERROR = "Algunas tareas fueron modificadas por otro usuario. Recargá la página y volvé a intentarlo.";

async function authorize(eventId: string): Promise<{ user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; error?: undefined } | { user?: undefined; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Iniciá sesión para continuar." };
  if (!isActive(user.profile) || (user.profile.role !== "ADMIN" && user.profile.role !== "EVENT_EDITOR")) {
    return { error: "No tienes permiso para modificar la organización del evento." };
  }
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId, capability: "organization" }))) {
    return { error: "El evento no está disponible." };
  }
  return { user };
}

async function authorizeResponsible(eventId: string, taskId: string): Promise<{ user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; error?: undefined } | { user?: undefined; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Iniciá sesión para continuar." };
  if (!isActive(user.profile)) return { error: TASK_PERMISSION_ERROR };
  if (user.profile.role === "ADMIN" || user.profile.role === "EVENT_EDITOR") return authorize(eventId);
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId, capability: "organization" }))) {
    return { error: "El evento no está disponible." };
  }

  const task = await getChecklistTask({ id: taskId, eventId, organizationId: user.profile.organizationId });
  const responsibleTask = task?.parentTaskId
    ? await getChecklistTask({ id: task.parentTaskId, eventId, organizationId: user.profile.organizationId })
    : task;
  if (!responsibleTask || responsibleTask.assigneeId !== user.id) return { error: TASK_PERMISSION_ERROR };
  return { user };
}

function pathFor(eventId: string) {
  return `/events/${eventId}/organization`;
}

function invalid(message: string): OrganizationActionState {
  return { error: message };
}

function conflict(message: string): OrganizationActionState {
  return { error: message, conflict: true };
}

async function auditChecklist(input: {
  access: { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> };
  eventId: string;
  resourceType: "event_checklist_group" | "event_checklist_task" | "event_checklist_comment";
  resourceId: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  await recordAudit({
    organizationId: input.access.user.profile.organizationId,
    userId: input.access.user.id,
    eventId: input.eventId,
    action: "event_change",
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    before: input.before,
    after: input.after,
  });
}

function isFullEditor(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>): boolean {
  return user.profile.role === "ADMIN" || user.profile.role === "EVENT_EDITOR";
}

export async function createGroupAction(formData: FormData): Promise<OrganizationActionState> {
  const parsed = z.object({ eventId: uuid, title }).safeParse({ eventId: formData.get("eventId"), title: formData.get("title") });
  if (!parsed.success) return invalid("El nombre del grupo es obligatorio.");
  const access = await authorize(parsed.data.eventId);
  if (!access.user) return invalid(access.error);
  const result = await createChecklistGroup({ eventId: parsed.data.eventId, organizationId: access.user.profile.organizationId, title: parsed.data.title });
  if (!result.ok) return invalid("No se pudo crear el grupo.");
  await auditChecklist({ access, eventId: parsed.data.eventId, resourceType: "event_checklist_group", resourceId: result.value.id, after: { title: result.value.title } });
  revalidatePath(pathFor(parsed.data.eventId));
  return { success: "Grupo creado." };
}

export async function updateGroupAction(formData: FormData): Promise<OrganizationActionState> {
  const parsed = z.object({ eventId: uuid, groupId: uuid, title, expectedUpdatedAt: optionalVersion }).safeParse({ eventId: formData.get("eventId"), groupId: formData.get("groupId"), title: formData.get("title"), expectedUpdatedAt: formData.get("expectedUpdatedAt") ?? undefined });
  if (!parsed.success) return invalid("El nombre del grupo es obligatorio.");
  const access = await authorize(parsed.data.eventId);
  if (!access.user) return invalid(access.error);
  const result = await updateChecklistGroup({ id: parsed.data.groupId, eventId: parsed.data.eventId, organizationId: access.user.profile.organizationId, title: parsed.data.title, expectedUpdatedAt: parsed.data.expectedUpdatedAt || undefined });
  if (!result.ok) return result.reason === "conflict" ? conflict(GROUP_CONFLICT_ERROR) : invalid("No se encontró el grupo.");
  await auditChecklist({ access, eventId: parsed.data.eventId, resourceType: "event_checklist_group", resourceId: result.value.id, after: { title: result.value.title } });
  revalidatePath(pathFor(parsed.data.eventId));
  return { success: "Grupo actualizado." };
}

export async function deleteGroupAction(formData: FormData): Promise<OrganizationActionState> {
  const parsed = z.object({ eventId: uuid, groupId: uuid, expectedUpdatedAt: optionalVersion }).safeParse({ eventId: formData.get("eventId"), groupId: formData.get("groupId"), expectedUpdatedAt: formData.get("expectedUpdatedAt") ?? undefined });
  if (!parsed.success) return invalid("Los datos del grupo no son válidos.");
  const access = await authorize(parsed.data.eventId);
  if (!access.user) return invalid(access.error);
  const result = await deleteChecklistGroup({ id: parsed.data.groupId, eventId: parsed.data.eventId, organizationId: access.user.profile.organizationId, expectedUpdatedAt: parsed.data.expectedUpdatedAt || undefined });
  if (!result.ok) return result.reason === "conflict" ? conflict(GROUP_CONFLICT_ERROR) : invalid("No se encontró el grupo.");
  await auditChecklist({ access, eventId: parsed.data.eventId, resourceType: "event_checklist_group", resourceId: parsed.data.groupId, before: { id: parsed.data.groupId } });
  revalidatePath(pathFor(parsed.data.eventId));
  return { success: "Grupo eliminado." };
}

export async function createTaskAction(formData: FormData): Promise<OrganizationActionState> {
  const parsed = z.object({ eventId: uuid, groupId: uuid, title, assigneeId: uuid.optional().or(z.literal("")), priority: z.enum(["low", "medium", "high"]).optional(), dueDate: optionalDate, notes: z.string().max(5000).optional() }).safeParse({
    eventId: formData.get("eventId"), groupId: formData.get("groupId"), title: formData.get("title"), assigneeId: formData.get("assigneeId") || undefined, priority: formData.get("priority") ?? undefined, dueDate: formData.get("dueDate") ?? undefined, notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) return invalid("Revisá los datos de la tarea.");
  const access = await authorize(parsed.data.eventId);
  if (!access.user) return invalid(access.error);
  const result = await createChecklistTask({ ...parsed.data, organizationId: access.user.profile.organizationId, assigneeId: parsed.data.assigneeId || null, priority: parsed.data.priority, createdBy: access.user.id, dueDate: parsed.data.dueDate || null, notes: parsed.data.notes || null });
  if (!result.ok) return invalid(result.reason === "invalid_assignee" ? "El responsable no está asignado a este evento." : "No se encontró el grupo.");
  await auditChecklist({ access, eventId: parsed.data.eventId, resourceType: "event_checklist_task", resourceId: result.value.id, after: { title: result.value.title, assigneeId: result.value.assigneeId } });
  revalidatePath(pathFor(parsed.data.eventId));
  return { success: "Tarea creada." };
}

export async function updateTaskAction(formData: FormData): Promise<OrganizationActionState> {
  const assigneeValue = formData.get("assigneeId");
  const parsed = z.object({ eventId: uuid, taskId: uuid, title: title.optional(), completed: z.enum(["true", "false"]).optional(), assigneeId: uuid.optional().or(z.literal("")), priority: z.enum(["low", "medium", "high"]).optional(), dueDate: optionalDate, notes: z.string().max(5000).optional(), expectedUpdatedAt: optionalVersion }).safeParse({
    eventId: formData.get("eventId"), taskId: formData.get("taskId"), title: formData.get("title") || undefined, completed: formData.get("completed") ?? undefined, assigneeId: assigneeValue === null ? undefined : String(assigneeValue), priority: formData.get("priority") ?? undefined, dueDate: formData.get("dueDate") ?? undefined, notes: formData.get("notes") ?? undefined, expectedUpdatedAt: formData.get("expectedUpdatedAt") ?? undefined,
  });
  if (!parsed.success) return invalid("Revisá los datos de la tarea.");
  const access = await authorizeResponsible(parsed.data.eventId, parsed.data.taskId);
  if (!access.user) return invalid(access.error);
  if (!isFullEditor(access.user) && (parsed.data.title !== undefined || parsed.data.assigneeId !== undefined || parsed.data.priority !== undefined || parsed.data.dueDate !== undefined || parsed.data.notes !== undefined)) {
    return invalid(TASK_PERMISSION_ERROR);
  }
  const result = await updateChecklistTask({ id: parsed.data.taskId, eventId: parsed.data.eventId, organizationId: access.user.profile.organizationId, title: parsed.data.title, completed: parsed.data.completed === undefined ? undefined : parsed.data.completed === "true", assigneeId: parsed.data.assigneeId === undefined ? undefined : parsed.data.assigneeId || null, priority: parsed.data.priority, dueDate: parsed.data.dueDate === undefined ? undefined : parsed.data.dueDate || null, notes: parsed.data.notes, actorId: access.user.id, expectedUpdatedAt: parsed.data.expectedUpdatedAt || undefined });
  if (!result.ok) return result.reason === "conflict" ? conflict(TASK_CONFLICT_ERROR) : invalid(result.reason === "invalid_assignee" ? "El responsable no está asignado a este evento." : "No se encontró la tarea.");
  await auditChecklist({ access, eventId: parsed.data.eventId, resourceType: "event_checklist_task", resourceId: result.value.id, after: { title: result.value.title, completed: result.value.completed, assigneeId: result.value.assigneeId, dueDate: result.value.dueDate } });
  revalidatePath(pathFor(parsed.data.eventId));
  return { success: "Tarea actualizada." };
}

export async function createSubtaskAction(formData: FormData): Promise<OrganizationActionState> {
  const assigneeValue = formData.get("assigneeId");
  const parsed = z.object({ eventId: uuid, parentTaskId: uuid, title, assigneeId: uuid.optional().or(z.literal("")) }).safeParse({
    eventId: formData.get("eventId"),
    parentTaskId: formData.get("parentTaskId"),
    title: formData.get("title"),
    assigneeId: assigneeValue === null ? undefined : String(assigneeValue),
  });
  if (!parsed.success) return invalid("El nombre de la subtarea es obligatorio.");
  const access = await authorizeResponsible(parsed.data.eventId, parsed.data.parentTaskId);
  if (!access.user) return invalid(access.error);
  if (parsed.data.assigneeId && !isFullEditor(access.user)) return invalid(TASK_PERMISSION_ERROR);
  const result = await createChecklistSubtask({ eventId: parsed.data.eventId, parentTaskId: parsed.data.parentTaskId, title: parsed.data.title, organizationId: access.user.profile.organizationId, assigneeId: parsed.data.assigneeId || null, createdBy: access.user.id });
  if (!result.ok) return invalid(result.reason === "invalid_assignee" ? "El responsable no está asignado a este evento." : "Solo se pueden agregar subtareas a una tarea principal.");
  await auditChecklist({ access, eventId: parsed.data.eventId, resourceType: "event_checklist_task", resourceId: result.value.id, after: { title: result.value.title, parentTaskId: result.value.parentTaskId, assigneeId: result.value.assigneeId } });
  revalidatePath(pathFor(parsed.data.eventId));
  return { success: "Subtarea creada." };
}

export async function toggleTaskCompletionAction(formData: FormData): Promise<OrganizationActionState> {
  const parsed = z.object({ eventId: uuid, taskId: uuid, completed: z.enum(["true", "false"]), expectedUpdatedAt: optionalVersion }).safeParse({
    eventId: formData.get("eventId"),
    taskId: formData.get("taskId"),
    completed: formData.get("completed"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt") ?? undefined,
  });
  if (!parsed.success) return invalid("El estado de la tarea no es válido.");
  const access = await authorizeResponsible(parsed.data.eventId, parsed.data.taskId);
  if (!access.user) return invalid(access.error);
  const result = await updateChecklistTask({
    id: parsed.data.taskId,
    eventId: parsed.data.eventId,
    organizationId: access.user.profile.organizationId,
    completed: parsed.data.completed === "true",
    actorId: access.user.id,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt || undefined,
  });
  if (!result.ok) return result.reason === "conflict" ? conflict(TASK_CONFLICT_ERROR) : invalid(result.reason === "pending_subtasks" ? "La tarea tiene subtareas pendientes." : "No se encontró la tarea.");
  await auditChecklist({ access, eventId: parsed.data.eventId, resourceType: "event_checklist_task", resourceId: result.value.id, after: { completed: result.value.completed } });
  revalidatePath(pathFor(parsed.data.eventId));
  return { success: "Tarea actualizada." };
}

export async function duplicateTaskAction(formData: FormData): Promise<OrganizationActionState> {
  const parsed = z.object({ eventId: uuid, taskId: uuid }).safeParse({ eventId: formData.get("eventId"), taskId: formData.get("taskId") });
  if (!parsed.success) return invalid("Los datos de la tarea no son válidos.");
  const access = await authorize(parsed.data.eventId);
  if (!access.user) return invalid(access.error);
  const result = await duplicateChecklistTask({ id: parsed.data.taskId, eventId: parsed.data.eventId, organizationId: access.user.profile.organizationId, createdBy: access.user.id });
  if (!result.ok) return invalid("No se pudo duplicar la tarea.");
  await auditChecklist({ access, eventId: parsed.data.eventId, resourceType: "event_checklist_task", resourceId: result.value.id, after: { title: result.value.title, duplicatedFrom: parsed.data.taskId } });
  revalidatePath(pathFor(parsed.data.eventId));
  return { success: "Tarea duplicada." };
}

export async function deleteTaskAction(formData: FormData): Promise<OrganizationActionState> {
  const parsed = z.object({ eventId: uuid, taskId: uuid, expectedUpdatedAt: optionalVersion }).safeParse({ eventId: formData.get("eventId"), taskId: formData.get("taskId"), expectedUpdatedAt: formData.get("expectedUpdatedAt") ?? undefined });
  if (!parsed.success) return invalid("Los datos de la tarea no son válidos.");
  const access = await authorize(parsed.data.eventId);
  if (!access.user) return invalid(access.error);
  const result = await deleteChecklistTask({ id: parsed.data.taskId, eventId: parsed.data.eventId, organizationId: access.user.profile.organizationId, expectedUpdatedAt: parsed.data.expectedUpdatedAt || undefined });
  if (!result.ok) return result.reason === "conflict" ? conflict(TASK_CONFLICT_ERROR) : invalid("No se encontró la tarea.");
  await auditChecklist({ access, eventId: parsed.data.eventId, resourceType: "event_checklist_task", resourceId: parsed.data.taskId, before: { id: parsed.data.taskId } });
  revalidatePath(pathFor(parsed.data.eventId));
  return { success: "Tarea eliminada." };
}

export async function reorderGroupsAction(formData: FormData): Promise<OrganizationActionState> {
  const parsed = z.object({
    eventId: uuid,
    orderedIds: z.string().min(1).transform((value, ctx) => { try { return JSON.parse(value); } catch { ctx.addIssue({ code: z.ZodIssueCode.custom }); return z.NEVER; } }).pipe(z.array(uuid)),
    expectedVersions: z.string().optional().transform((value, ctx) => {
      if (!value) return undefined;
      try { return JSON.parse(value); } catch { ctx.addIssue({ code: z.ZodIssueCode.custom }); return z.NEVER; }
    }).pipe(versionsById.optional()),
  }).safeParse({ eventId: formData.get("eventId"), orderedIds: formData.get("orderedIds"), expectedVersions: formData.get("expectedVersions") ?? undefined });
  if (!parsed.success) return invalid("El orden de los grupos no es válido.");
  const access = await authorize(parsed.data.eventId);
  if (!access.user) return invalid(access.error);
  const result = await reorderChecklistGroups({ eventId: parsed.data.eventId, organizationId: access.user.profile.organizationId, orderedIds: parsed.data.orderedIds, expectedUpdatedAtById: parsed.data.expectedVersions });
  if (!result.ok) return result.reason === "conflict" ? conflict(GROUP_CONFLICT_ERROR) : invalid("No se pudo guardar el orden de los grupos.");
  await auditChecklist({ access, eventId: parsed.data.eventId, resourceType: "event_checklist_group", resourceId: parsed.data.orderedIds[0] ?? parsed.data.eventId, after: { orderedIds: parsed.data.orderedIds } });
  revalidatePath(pathFor(parsed.data.eventId));
  return { success: "Orden guardado." };
}

export async function moveTaskAction(formData: FormData): Promise<OrganizationActionState> {
  const parsed = z.object({ eventId: uuid, taskId: uuid, destinationGroupId: uuid, destinationIndex: z.coerce.number().int().min(0), expectedUpdatedAt: optionalVersion }).safeParse({ eventId: formData.get("eventId"), taskId: formData.get("taskId"), destinationGroupId: formData.get("destinationGroupId"), destinationIndex: formData.get("destinationIndex"), expectedUpdatedAt: formData.get("expectedUpdatedAt") ?? undefined });
  if (!parsed.success) return invalid("El movimiento de la tarea no es válido.");
  const access = await authorize(parsed.data.eventId);
  if (!access.user) return invalid(access.error);
  const result = await moveChecklistTask({ id: parsed.data.taskId, eventId: parsed.data.eventId, destinationGroupId: parsed.data.destinationGroupId, destinationIndex: parsed.data.destinationIndex, organizationId: access.user.profile.organizationId, expectedUpdatedAt: parsed.data.expectedUpdatedAt || undefined });
  if (!result.ok) return result.reason === "conflict" ? conflict(TASK_CONFLICT_ERROR) : invalid("No se pudo mover la tarea.");
  await auditChecklist({ access, eventId: parsed.data.eventId, resourceType: "event_checklist_task", resourceId: parsed.data.taskId, after: { destinationGroupId: parsed.data.destinationGroupId, destinationIndex: parsed.data.destinationIndex } });
  revalidatePath(pathFor(parsed.data.eventId));
  return { success: "Orden guardado." };
}

export async function saveTemplateAction(formData: FormData): Promise<OrganizationActionState> {
  const parsed = z.object({ eventId: uuid, name: title }).safeParse({ eventId: formData.get("eventId"), name: formData.get("name") });
  if (!parsed.success) return invalid("El nombre de la plantilla es obligatorio.");
  const access = await authorize(parsed.data.eventId);
  if (!access.user) return invalid(access.error);
  const result = await saveEventChecklistAsTemplate({ eventId: parsed.data.eventId, organizationId: access.user.profile.organizationId, name: parsed.data.name });
  if (!result.ok) return invalid("No se pudo guardar la plantilla.");
  await auditChecklist({ access, eventId: parsed.data.eventId, resourceType: "event_checklist_group", resourceId: result.value.id, after: { template: result.value.name } });
  revalidatePath(pathFor(parsed.data.eventId));
  return { success: "Plantilla guardada." };
}

export async function applyTemplateAction(formData: FormData): Promise<OrganizationActionState> {
  const parsed = z.object({ eventId: uuid, templateId: uuid }).safeParse({ eventId: formData.get("eventId"), templateId: formData.get("templateId") });
  if (!parsed.success) return invalid("Los datos de la plantilla no son válidos.");
  const access = await authorize(parsed.data.eventId);
  if (!access.user) return invalid(access.error);
  const result = await applyChecklistTemplate({ templateId: parsed.data.templateId, eventId: parsed.data.eventId, organizationId: access.user.profile.organizationId, createdBy: access.user.id });
  if (!result.ok) return invalid("No se encontró la plantilla.");
  await auditChecklist({ access, eventId: parsed.data.eventId, resourceType: "event_checklist_group", resourceId: parsed.data.templateId, after: { applied: result.value } });
  revalidatePath(pathFor(parsed.data.eventId));
  return { success: `Plantilla aplicada: ${result.value.groups} grupos y ${result.value.tasks} tareas.` };
}

export async function bulkTasksAction(formData: FormData): Promise<OrganizationActionState> {
  const parsed = z.object({
    eventId: uuid,
    ids: z.string().min(1).transform((value, ctx) => { try { return JSON.parse(value); } catch { ctx.addIssue({ code: z.ZodIssueCode.custom }); return z.NEVER; } }).pipe(z.array(uuid).min(1).max(200)),
    operation: z.enum(["complete", "reopen", "reassign", "delete"]),
    assigneeId: uuid.optional().or(z.literal("")),
    expectedVersions: z.string().optional().transform((value, ctx) => {
      if (!value) return undefined;
      try { return JSON.parse(value); } catch { ctx.addIssue({ code: z.ZodIssueCode.custom }); return z.NEVER; }
    }).pipe(versionsById.optional()),
  }).safeParse({
    eventId: formData.get("eventId"),
    ids: formData.get("ids"),
    operation: formData.get("operation"),
    assigneeId: formData.get("assigneeId") ?? undefined,
    expectedVersions: formData.get("expectedVersions") ?? undefined,
  });
  if (!parsed.success) return invalid("La selección de tareas no es válida.");
  const access = await authorize(parsed.data.eventId);
  if (!access.user) return invalid(access.error);
  const organizationId = access.user.profile.organizationId;

  if (parsed.data.operation === "delete") {
    const result = await bulkDeleteChecklistTasks({ ids: parsed.data.ids, eventId: parsed.data.eventId, organizationId, expectedUpdatedAtById: parsed.data.expectedVersions });
    if (!result.ok) return result.reason === "conflict" ? conflict(TASKS_CONFLICT_ERROR) : invalid("No se pudieron eliminar las tareas.");
    await auditChecklist({ access, eventId: parsed.data.eventId, resourceType: "event_checklist_task", resourceId: parsed.data.ids[0], after: { operation: "bulk_delete", count: result.value.deleted } });
    revalidatePath(pathFor(parsed.data.eventId));
    return { success: `${result.value.deleted} tareas eliminadas.` };
  }

  const completed = parsed.data.operation === "complete" ? true : parsed.data.operation === "reopen" ? false : undefined;
  const assigneeId = parsed.data.operation === "reassign" ? parsed.data.assigneeId || null : undefined;
  const result = await bulkUpdateChecklistTasks({ ids: parsed.data.ids, eventId: parsed.data.eventId, organizationId, completed, assigneeId, actorId: access.user.id, expectedUpdatedAtById: parsed.data.expectedVersions });
  if (!result.ok) return result.reason === "conflict" ? conflict(TASKS_CONFLICT_ERROR) : invalid(result.reason === "invalid_assignee" ? "El responsable no está asignado a este evento." : "No se pudieron actualizar las tareas.");
  await auditChecklist({ access, eventId: parsed.data.eventId, resourceType: "event_checklist_task", resourceId: parsed.data.ids[0], after: { operation: parsed.data.operation, updated: result.value.updated, skipped: result.value.skipped } });
  revalidatePath(pathFor(parsed.data.eventId));
  const skipped = result.value.skipped > 0 ? ` (${result.value.skipped} omitidas)` : "";
  return { success: `${result.value.updated} tareas actualizadas${skipped}.` };
}

export async function createCommentAction(formData: FormData): Promise<OrganizationActionState> {
  const parsed = z.object({ eventId: uuid, taskId: uuid, body: z.string().trim().min(1).max(2000) }).safeParse({
    eventId: formData.get("eventId"),
    taskId: formData.get("taskId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return invalid("El comentario no puede estar vacío.");
  const access = await authorizeResponsible(parsed.data.eventId, parsed.data.taskId);
  if (!access.user) return invalid(access.error);
  const result = await createChecklistComment({
    taskId: parsed.data.taskId,
    eventId: parsed.data.eventId,
    organizationId: access.user.profile.organizationId,
    authorId: access.user.id,
    body: parsed.data.body,
  });
  if (!result.ok) return invalid("No se encontró la tarea.");
  await auditChecklist({ access, eventId: parsed.data.eventId, resourceType: "event_checklist_comment", resourceId: result.value.id, after: { taskId: parsed.data.taskId, body: parsed.data.body } });
  revalidatePath(pathFor(parsed.data.eventId));
  return { success: "Comentario agregado." };
}

export async function deleteTemplateAction(formData: FormData): Promise<OrganizationActionState> {
  const parsed = z.object({ eventId: uuid, templateId: uuid }).safeParse({ eventId: formData.get("eventId"), templateId: formData.get("templateId") });
  if (!parsed.success) return invalid("Los datos de la plantilla no son válidos.");
  const access = await authorize(parsed.data.eventId);
  if (!access.user) return invalid(access.error);
  const result = await deleteChecklistTemplate({ templateId: parsed.data.templateId, organizationId: access.user.profile.organizationId });
  if (!result.ok) return invalid("No se encontró la plantilla.");
  revalidatePath(pathFor(parsed.data.eventId));
  return { success: "Plantilla eliminada." };
}
