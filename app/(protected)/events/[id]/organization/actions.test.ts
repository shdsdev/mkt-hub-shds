import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  canAccessEvent: vi.fn(),
  createChecklistGroup: vi.fn(),
  createChecklistTask: vi.fn(),
  createChecklistSubtask: vi.fn(),
  getChecklistTask: vi.fn(),
  updateChecklistTask: vi.fn(),
  duplicateChecklistTask: vi.fn(),
  deleteChecklistTask: vi.fn(),
  saveEventChecklistAsTemplate: vi.fn(),
  applyChecklistTemplate: vi.fn(),
  deleteChecklistTemplate: vi.fn(),
  createChecklistComment: vi.fn(),
  bulkUpdateChecklistTasks: vi.fn(),
  bulkDeleteChecklistTasks: vi.fn(),
  reorderChecklistGroups: vi.fn(),
  moveChecklistTask: vi.fn(),
  revalidatePath: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive }));
vi.mock("@/modules/events", () => ({
  canAccessEvent: mocks.canAccessEvent,
  createChecklistGroup: mocks.createChecklistGroup,
  createChecklistTask: mocks.createChecklistTask,
  createChecklistSubtask: mocks.createChecklistSubtask,
  getChecklistTask: mocks.getChecklistTask,
  updateChecklistTask: mocks.updateChecklistTask,
  duplicateChecklistTask: mocks.duplicateChecklistTask,
  deleteChecklistTask: mocks.deleteChecklistTask,
  saveEventChecklistAsTemplate: mocks.saveEventChecklistAsTemplate,
  applyChecklistTemplate: mocks.applyChecklistTemplate,
  deleteChecklistTemplate: mocks.deleteChecklistTemplate,
  createChecklistComment: mocks.createChecklistComment,
  bulkUpdateChecklistTasks: mocks.bulkUpdateChecklistTasks,
  bulkDeleteChecklistTasks: mocks.bulkDeleteChecklistTasks,
  reorderChecklistGroups: mocks.reorderChecklistGroups,
  moveChecklistTask: mocks.moveChecklistTask,
}));
vi.mock("@/modules/audit", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  createGroupAction,
  createSubtaskAction,
  createTaskAction,
  deleteTaskAction,
  duplicateTaskAction,
  moveTaskAction,
  reorderGroupsAction,
  toggleTaskCompletionAction,
  updateTaskAction,
  createCommentAction,
  bulkTasksAction,
  saveTemplateAction,
  applyTemplateAction,
  deleteTemplateAction,
} from "./actions";

const adminUser = {
  id: "actor-1",
  profile: { organizationId: "org-1", role: "ADMIN", status: "active" },
};

const responsibleUser = {
  id: "responsible-1",
  profile: { organizationId: "org-1", role: "RECEPTION", status: "active" },
};

const taskId = "22222222-2222-4222-8222-222222222222";
const eventId = "11111111-1111-4111-8111-111111111111";
const groupId = "33333333-3333-4333-8333-333333333333";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("event organization actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(true);
    mocks.canAccessEvent.mockResolvedValue(true);
    mocks.createChecklistGroup.mockResolvedValue({ ok: true, value: { id: "group-1" } });
    mocks.createChecklistTask.mockResolvedValue({ ok: true, value: { id: "task-1" } });
    mocks.createChecklistSubtask.mockResolvedValue({ ok: true, value: { id: "subtask-1" } });
    mocks.updateChecklistTask.mockResolvedValue({ ok: true, value: { id: "task-1" } });
  });

  it("rejects an empty group title before calling the service", async () => {
    const result = await createGroupAction(form({ eventId: "11111111-1111-4111-8111-111111111111", title: " " }));

    expect(result).toEqual({ error: "El nombre del grupo es obligatorio." });
    expect(mocks.createChecklistGroup).not.toHaveBeenCalled();
  });

  it("creates an authorized group and revalidates the event organization route", async () => {
    const result = await createGroupAction(form({ eventId: "11111111-1111-4111-8111-111111111111", title: "Producción" }));

    expect(result).toEqual({ success: "Grupo creado." });
    expect(mocks.createChecklistGroup).toHaveBeenCalledWith({
      eventId: "11111111-1111-4111-8111-111111111111",
      organizationId: "org-1",
      title: "Producción",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/events/11111111-1111-4111-8111-111111111111/organization");
  });

  it("updates a task only for a writable event role", async () => {
    const result = await updateTaskAction(form({
      eventId: "11111111-1111-4111-8111-111111111111",
      taskId: "22222222-2222-4222-8222-222222222222",
      title: "Confirmar proveedores",
      completed: "true",
    }));

    expect(result).toEqual({ success: "Tarea actualizada." });
    expect(mocks.updateChecklistTask).toHaveBeenCalledWith(expect.objectContaining({
      id: "22222222-2222-4222-8222-222222222222",
      completed: true,
      title: "Confirmar proveedores",
    }));
  });

  it("records an audit entry when a task is updated", async () => {
    mocks.updateChecklistTask.mockResolvedValue({ ok: true, value: { id: taskId } });
    await updateTaskAction(form({ eventId, taskId, title: "Confirmar proveedores", completed: "true" }));

    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      eventId,
      action: "event_change",
      resourceType: "event_checklist_task",
      resourceId: taskId,
    }));
  });

  it("creates a subtask with an assignee for an editor", async () => {
    const result = await createSubtaskAction(form({
      eventId,
      parentTaskId: taskId,
      title: "Validar cantidades",
      assigneeId: "44444444-4444-4444-8444-444444444444",
    }));

    expect(result).toEqual({ success: "Subtarea creada." });
    expect(mocks.createChecklistSubtask).toHaveBeenCalledWith(expect.objectContaining({
      assigneeId: "44444444-4444-4444-8444-444444444444",
    }));
  });

  it("denies a responsible user from assigning a subtask", async () => {
    mocks.getCurrentUser.mockResolvedValue(responsibleUser);
    mocks.getChecklistTask.mockResolvedValue({ id: taskId, assigneeId: responsibleUser.id, parentTaskId: null });

    await expect(createSubtaskAction(form({
      eventId,
      parentTaskId: taskId,
      title: "Validar cantidades",
      assigneeId: "44444444-4444-4444-8444-444444444444",
    }))).resolves.toEqual({ error: "No tienes permiso para modificar esta tarea." });
  });

  it("allows an editor to clear the responsible user", async () => {
    await updateTaskAction(form({ eventId, taskId, assigneeId: "" }));

    expect(mocks.updateChecklistTask).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: null }));
  });

  it("duplicates a task for an editor", async () => {
    mocks.duplicateChecklistTask.mockResolvedValue({ ok: true, value: { id: "task-copy" } });

    const result = await duplicateTaskAction(form({ eventId, taskId }));

    expect(result).toEqual({ success: "Tarea duplicada." });
    expect(mocks.duplicateChecklistTask).toHaveBeenCalledWith(expect.objectContaining({ id: taskId, eventId, organizationId: "org-1" }));
  });

  it("denies the responsible user from duplicating a task", async () => {
    mocks.getCurrentUser.mockResolvedValue(responsibleUser);
    mocks.getChecklistTask.mockResolvedValue({ id: taskId, assigneeId: responsibleUser.id, parentTaskId: null });

    await expect(duplicateTaskAction(form({ eventId, taskId }))).resolves.toEqual({
      error: "No tienes permiso para modificar la organización del evento.",
    });
    expect(mocks.duplicateChecklistTask).not.toHaveBeenCalled();
  });

  it("records the creator and priority when creating a task", async () => {
    await createTaskAction(form({ eventId, groupId, title: "Montar escenario", priority: "high" }));

    expect(mocks.createChecklistTask).toHaveBeenCalledWith(expect.objectContaining({
      priority: "high",
      createdBy: adminUser.id,
    }));
  });

  it("creates a task with its optional detail and assignee", async () => {
    const result = await createTaskAction(form({
      eventId: "11111111-1111-4111-8111-111111111111",
      groupId: "33333333-3333-4333-8333-333333333333",
      title: "Confirmar proveedores",
      notes: "Validar cantidades y horarios.",
      assigneeId: "44444444-4444-4444-8444-444444444444",
    }));

    expect(result).toEqual({ success: "Tarea creada." });
    expect(mocks.createChecklistTask).toHaveBeenCalledWith(expect.objectContaining({
      title: "Confirmar proveedores",
      notes: "Validar cantidades y horarios.",
      assigneeId: "44444444-4444-4444-8444-444444444444",
    }));
  });

  it("creates a subtask for a top-level task", async () => {
    const result = await createSubtaskAction(form({
      eventId: "11111111-1111-4111-8111-111111111111",
      parentTaskId: "22222222-2222-4222-8222-222222222222",
      title: "Validar cantidades",
    }));

    expect(result).toEqual({ success: "Subtarea creada." });
    expect(mocks.createChecklistSubtask).toHaveBeenCalledWith(expect.objectContaining({
      parentTaskId: "22222222-2222-4222-8222-222222222222",
      title: "Validar cantidades",
    }));
  });

  it("allows the responsible user to toggle completion on their task", async () => {
    mocks.getCurrentUser.mockResolvedValue(responsibleUser);
    mocks.getChecklistTask.mockResolvedValue({ id: taskId, assigneeId: responsibleUser.id, parentTaskId: null });

    const result = await toggleTaskCompletionAction(form({ eventId, taskId, completed: "true" }));

    expect(result).toEqual({ success: "Tarea actualizada." });
    expect(mocks.updateChecklistTask).toHaveBeenCalledWith(expect.objectContaining({ id: taskId, completed: true }));
  });

  it("allows the responsible user to create a direct subtask", async () => {
    mocks.getCurrentUser.mockResolvedValue(responsibleUser);
    mocks.getChecklistTask.mockResolvedValue({ id: taskId, assigneeId: responsibleUser.id, parentTaskId: null });

    const result = await createSubtaskAction(form({ eventId, parentTaskId: taskId, title: "Validar cantidades" }));

    expect(result).toEqual({ success: "Subtarea creada." });
  });

  it("denies an unassigned user completion and subtask creation", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...responsibleUser, id: "other-user" });
    mocks.getChecklistTask.mockResolvedValue({ id: taskId, assigneeId: responsibleUser.id, parentTaskId: null });

    await expect(toggleTaskCompletionAction(form({ eventId, taskId, completed: "true" }))).resolves.toEqual({
      error: "No tienes permiso para modificar esta tarea.",
    });
    await expect(createSubtaskAction(form({ eventId, parentTaskId: taskId, title: "No permitido" }))).resolves.toEqual({
      error: "No tienes permiso para modificar esta tarea.",
    });
  });

  it.each([
    ["title", { title: "Renamed" }],
    ["assignee", { assigneeId: "44444444-4444-4444-8444-444444444444" }],
    ["due date", { dueDate: "2026-11-04" }],
    ["notes", { notes: "Changed" }],
  ])("denies the responsible user from changing the task %s", async (_field, changes) => {
    mocks.getCurrentUser.mockResolvedValue(responsibleUser);
    mocks.getChecklistTask.mockResolvedValue({ id: taskId, assigneeId: responsibleUser.id, parentTaskId: null });

    await expect(updateTaskAction(form({ eventId, taskId, ...changes }))).resolves.toEqual({
      error: "No tienes permiso para modificar esta tarea.",
    });
  });

  it.each([
    ["delete", () => deleteTaskAction(form({ eventId, taskId }))],
    ["reorder", () => reorderGroupsAction(form({ eventId, orderedIds: JSON.stringify([groupId]) }))],
    ["move", () => moveTaskAction(form({ eventId, taskId, destinationGroupId: groupId, destinationIndex: "0" }))],
  ])("denies the responsible user from %s structural mutations", async (_action, invoke) => {
    mocks.getCurrentUser.mockResolvedValue(responsibleUser);
    mocks.getChecklistTask.mockResolvedValue({ id: taskId, assigneeId: responsibleUser.id, parentTaskId: null });

    await expect(invoke()).resolves.toEqual({ error: "No tienes permiso para modificar la organización del evento." });
  });
});

describe("checklist template actions", () => {
  const templateId = "55555555-5555-4555-8555-555555555555";

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(true);
    mocks.canAccessEvent.mockResolvedValue(true);
    mocks.saveEventChecklistAsTemplate.mockResolvedValue({ ok: true, value: { id: templateId, name: "Boda" } });
    mocks.applyChecklistTemplate.mockResolvedValue({ ok: true, value: { groups: 2, tasks: 4 } });
    mocks.deleteChecklistTemplate.mockResolvedValue({ ok: true, value: true });
  });

  it("saves the current checklist as a named template", async () => {
    const result = await saveTemplateAction(form({ eventId, name: "Boda" }));

    expect(result).toEqual({ success: "Plantilla guardada." });
    expect(mocks.saveEventChecklistAsTemplate).toHaveBeenCalledWith({ eventId, organizationId: "org-1", name: "Boda" });
  });

  it("applies a template and reports how much was copied", async () => {
    const result = await applyTemplateAction(form({ eventId, templateId }));

    expect(result).toEqual({ success: "Plantilla aplicada: 2 grupos y 4 tareas." });
    expect(mocks.applyChecklistTemplate).toHaveBeenCalledWith(expect.objectContaining({ templateId, eventId, organizationId: "org-1" }));
  });

  it("deletes a template", async () => {
    const result = await deleteTemplateAction(form({ eventId, templateId }));

    expect(result).toEqual({ success: "Plantilla eliminada." });
    expect(mocks.deleteChecklistTemplate).toHaveBeenCalledWith({ templateId, organizationId: "org-1" });
  });

  it("denies template changes to reception users", async () => {
    mocks.getCurrentUser.mockResolvedValue(responsibleUser);

    await expect(saveTemplateAction(form({ eventId, name: "Boda" }))).resolves.toEqual({
      error: "No tienes permiso para modificar la organización del evento.",
    });
    expect(mocks.saveEventChecklistAsTemplate).not.toHaveBeenCalled();
  });
});

describe("checklist comment actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(responsibleUser);
    mocks.isActive.mockReturnValue(true);
    mocks.canAccessEvent.mockResolvedValue(true);
    mocks.getChecklistTask.mockResolvedValue({ id: taskId, assigneeId: responsibleUser.id, parentTaskId: null });
    mocks.createChecklistComment.mockResolvedValue({ ok: true, value: { id: "comment-1", taskId, body: "Listo" } });
  });

  it("lets the responsible user comment on their task", async () => {
    const result = await createCommentAction(form({ eventId, taskId, body: "Listo" }));

    expect(result).toEqual({ success: "Comentario agregado." });
    expect(mocks.createChecklistComment).toHaveBeenCalledWith(expect.objectContaining({
      taskId,
      eventId,
      authorId: responsibleUser.id,
      body: "Listo",
    }));
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ resourceType: "event_checklist_comment" }));
  });

  it("rejects an empty comment", async () => {
    await expect(createCommentAction(form({ eventId, taskId, body: "   " }))).resolves.toEqual({
      error: "El comentario no puede estar vacío.",
    });
    expect(mocks.createChecklistComment).not.toHaveBeenCalled();
  });

  it("denies an unassigned user", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...responsibleUser, id: "other-user" });

    await expect(createCommentAction(form({ eventId, taskId, body: "Listo" }))).resolves.toEqual({
      error: "No tienes permiso para modificar esta tarea.",
    });
    expect(mocks.createChecklistComment).not.toHaveBeenCalled();
  });
});

describe("bulk task actions", () => {
  const ids = JSON.stringify([taskId]);

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(true);
    mocks.canAccessEvent.mockResolvedValue(true);
    mocks.bulkUpdateChecklistTasks.mockResolvedValue({ ok: true, value: { updated: 1, skipped: 0 } });
    mocks.bulkDeleteChecklistTasks.mockResolvedValue({ ok: true, value: { deleted: 1 } });
  });

  it("completes the selected tasks", async () => {
    const result = await bulkTasksAction(form({ eventId, ids, operation: "complete" }));

    expect(result).toEqual({ success: "1 tareas actualizadas." });
    expect(mocks.bulkUpdateChecklistTasks).toHaveBeenCalledWith(expect.objectContaining({ ids: [taskId], completed: true }));
  });

  it("reassigns the selected tasks", async () => {
    const result = await bulkTasksAction(form({ eventId, ids, operation: "reassign", assigneeId: "44444444-4444-4444-8444-444444444444" }));

    expect(result).toEqual({ success: "1 tareas actualizadas." });
    expect(mocks.bulkUpdateChecklistTasks).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: "44444444-4444-4444-8444-444444444444" }));
  });

  it("deletes the selected tasks", async () => {
    const result = await bulkTasksAction(form({ eventId, ids, operation: "delete" }));

    expect(result).toEqual({ success: "1 tareas eliminadas." });
    expect(mocks.bulkDeleteChecklistTasks).toHaveBeenCalledWith({ ids: [taskId], eventId, organizationId: "org-1" });
  });

  it("denies bulk changes to reception users", async () => {
    mocks.getCurrentUser.mockResolvedValue(responsibleUser);

    await expect(bulkTasksAction(form({ eventId, ids, operation: "complete" }))).resolves.toEqual({
      error: "No tienes permiso para modificar la organización del evento.",
    });
    expect(mocks.bulkUpdateChecklistTasks).not.toHaveBeenCalled();
  });
});
