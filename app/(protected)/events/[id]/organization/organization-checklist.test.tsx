// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  createGroupAction: vi.fn(),
  createSubtaskAction: vi.fn(),
  createTaskAction: vi.fn(),
  deleteGroupAction: vi.fn(),
  deleteTaskAction: vi.fn(),
  moveTaskAction: vi.fn(),
  reorderGroupsAction: vi.fn(),
  updateGroupAction: vi.fn(),
  updateTaskAction: vi.fn(),
  toggleTaskCompletionAction: vi.fn(),
  duplicateTaskAction: vi.fn(),
  createCommentAction: vi.fn(),
  bulkTasksAction: vi.fn(),
  saveTemplateAction: vi.fn(),
  applyTemplateAction: vi.fn(),
  deleteTemplateAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const realtime = vi.hoisted(() => ({
  channel: vi.fn(),
  removeChannel: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ channel: realtime.channel, removeChannel: realtime.removeChannel }),
}));
import {
  assigneeDisplayName,
  CHECKLIST_ERROR_EVENT,
  CHECKLIST_REALTIME_TABLES,
  COMPLETED_GROUP_LABEL,
  createRefreshingAction,
  filterChecklistGroups,
  getChecklistProgress,
  getDueDateState,
  ORGANIZATION_REFRESH_INTERVAL_MS,
  OrganizationChecklist,
  parseOpenGroupIds,
  SUBTASKS_SECTION_LABEL,
  TASK_ACTIONS_LABEL,
  TASK_DETAIL_PANEL_LABEL,
  todayIso,
} from "./organization-checklist";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
let container: HTMLDivElement | undefined;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  realtime.channel.mockReset();
  realtime.removeChannel.mockReset();
  realtime.channel.mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
  });
  realtime.removeChannel.mockResolvedValue("ok");
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = undefined;
  container?.remove();
  container = undefined;
  document.body.innerHTML = "";
});

function mount(element: React.ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(element));
  return container;
}

const groups = [
  {
    id: "group-1",
    organizationId: "org-1",
    eventId: "event-1",
    title: "Producción",
    position: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    tasks: [
      {
        id: "task-1",
        organizationId: "org-1",
        eventId: "event-1",
        groupId: "group-1",
        parentTaskId: null,
        title: "Confirmar proveedores",
        completed: false,
        assigneeId: "user-1",
        priority: "medium" as const,
        dueDate: "2026-11-05",
        notes: "Llamar por la mañana",
        createdBy: null,
        completedAt: null,
        completedBy: null,
        createdByEmail: null,
        completedByEmail: null,
        position: 0,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
        subtasks: [],
      },
    ],
  },
];

describe("OrganizationChecklist", () => {
  it("uses a short refresh interval for read-only users", () => {
    expect(ORGANIZATION_REFRESH_INTERVAL_MS).toBe(5000);
  });

  it("classifies due dates relative to today", () => {
    expect(getDueDateState(null, false, "2026-11-04")).toBe("none");
    expect(getDueDateState("2026-11-03", false, "2026-11-04")).toBe("overdue");
    expect(getDueDateState("2026-11-04", false, "2026-11-04")).toBe("today");
    expect(getDueDateState("2026-11-05", false, "2026-11-04")).toBe("upcoming");
    expect(getDueDateState("2026-11-03", true, "2026-11-04")).toBe("completed");
  });

  it("formats today as an ISO date", () => {
    expect(todayIso(new Date(2026, 10, 4))).toBe("2026-11-04");
  });

  it("turns an email into a readable assignee name", () => {
    expect(assigneeDisplayName("reception.prueba@marketinghub.local")).toBe("Reception Prueba");
    expect(assigneeDisplayName("ada_lovelace@example.com")).toBe("Ada Lovelace");
    expect(assigneeDisplayName(null)).toBe("Sin responsable");
  });

  it("computes global checklist progress", () => {
    expect(getChecklistProgress(groups)).toEqual({ completed: 0, total: 1, percent: 0 });
    expect(getChecklistProgress([{ ...groups[0], tasks: [{ ...groups[0].tasks[0], completed: true }] }])).toEqual({
      completed: 1,
      total: 1,
      percent: 100,
    });
  });

  it("filters tasks by query, owner, pending and overdue", () => {
    const assignees = [{ id: "user-1", email: "ada@example.com", role: "RECEPTION" as const }];
    const withOverdue = [{
      ...groups[0],
      tasks: [
        groups[0].tasks[0],
        { ...groups[0].tasks[0], id: "task-2", title: "Pagar proveedor", assigneeId: null, dueDate: "2026-01-01" },
      ],
    }];

    expect(filterChecklistGroups(withOverdue, { query: "proveedor", currentUserId: "user-1", assignees, today: "2026-11-04" })[0].tasks).toHaveLength(2);
    expect(filterChecklistGroups(withOverdue, { filter: "mine", currentUserId: "user-1", assignees, today: "2026-11-04" })[0].tasks).toHaveLength(1);
    expect(filterChecklistGroups(withOverdue, { filter: "overdue", currentUserId: "user-1", assignees, today: "2026-11-04" })[0].tasks.map((task) => task.id)).toEqual(["task-2"]);
    expect(filterChecklistGroups(withOverdue, { filter: "pending", currentUserId: "user-1", assignees, today: "2026-11-04" })[0].tasks).toHaveLength(2);
  });

  it("restores persisted open group ids safely", () => {
    expect(parseOpenGroupIds('["group-1"]', ["group-2"])).toEqual(["group-1"]);
    expect(parseOpenGroupIds("not-json", ["group-2"])).toEqual(["group-2"]);
    expect(parseOpenGroupIds(null, ["group-2"])).toEqual(["group-2"]);
  });

  it("refreshes server data after a successful mutation", async () => {
    const action = vi.fn().mockResolvedValue({ success: "Guardado." });
    const refresh = vi.fn();

    await createRefreshingAction(action, refresh)(new FormData());

    expect(action).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("subscribes to realtime checklist changes and cleans up", () => {
    mount(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[{ id: "user-1", email: "ada@example.com", role: "EVENT_EDITOR" }]} canEdit currentUserId="editor-1" />,
    );

    expect(realtime.channel).toHaveBeenCalledWith("event-checklist:event-1");
    const channel = realtime.channel.mock.results[0]?.value as { on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> };
    expect(channel.on).toHaveBeenCalledTimes(CHECKLIST_REALTIME_TABLES.length);
    for (const table of CHECKLIST_REALTIME_TABLES) {
      expect(channel.on).toHaveBeenCalledWith(
        "postgres_changes",
        expect.objectContaining({ event: "*", schema: "public", table, filter: "event_id=eq.event-1" }),
        expect.any(Function),
      );
    }
    expect(channel.subscribe).toHaveBeenCalledOnce();

    act(() => root?.unmount());
    root = undefined;
    expect(realtime.removeChannel).toHaveBeenCalledWith(channel);
  });

  it("refreshes and surfaces a conflict returned by an action", async () => {
    const action = vi.fn().mockResolvedValue({ error: "La tarea fue modificada.", conflict: true });
    const refresh = vi.fn();
    const listener = vi.fn();
    window.addEventListener(CHECKLIST_ERROR_EVENT, listener);

    await createRefreshingAction(action, refresh)(new FormData());

    expect(refresh).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(CHECKLIST_ERROR_EVENT, listener);
  });

  it("renders the checklist in read-only mode for reception", () => {
    const html = renderToStaticMarkup(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[{ id: "user-1", email: "ada@example.com", role: "RECEPTION" }]} canEdit={false} currentUserId="other-user" />,
    );

    expect(html).toContain("Organización del evento");
    expect(html).toContain("Confirmar proveedores");
    expect(html).toContain("ada@example.com");
    expect(html).not.toContain("Agregar grupo");
    expect(html).not.toContain("Eliminar grupo");
  });

  it("renders writable group and task controls for event editors", () => {
    const html = renderToStaticMarkup(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[{ id: "user-1", email: "ada@example.com", role: "EVENT_EDITOR" }]} canEdit currentUserId="editor-1" />,
    );

    expect(html).toContain("Agregar grupo");
    expect(html).toContain("Agregar tarea");
    expect(html).toContain("Eliminar grupo");
    expect(html).toContain("Mover tarea");
    expect(html).toContain("Motivo o detalle de la tarea");
    expect(html).toContain("Responsable opcional");
    expect(html).toContain("Abrir tarea Confirmar proveedores");
    expect(html).toContain(TASK_ACTIONS_LABEL);
  });

  it("renders a task sidepanel with one-level subtasks", () => {
    renderToStaticMarkup(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[{ id: "user-1", email: "ada@example.com", role: "EVENT_EDITOR" }]} canEdit initialSelectedTaskId="task-1" currentUserId="editor-1" />,
    );

    expect(TASK_DETAIL_PANEL_LABEL).toBe("Detalle de la tarea");
    expect(SUBTASKS_SECTION_LABEL).toBe("Subtareas");
  });

  it("lets the assigned responsible user toggle completion but not edit task fields", () => {
    mount(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[{ id: "user-1", email: "ada@example.com", role: "RECEPTION" }]} canEdit={false} currentUserId="user-1" initialSelectedTaskId="task-1" />,
    );

    const panel = document.querySelector('[data-slot="sheet-content"]');
    expect(panel).not.toBeNull();
    const completionToggle = panel?.querySelector('[aria-label="Marcar Confirmar proveedores como completada"]');
    expect(completionToggle).not.toBeNull();
    expect(completionToggle?.hasAttribute("disabled")).toBe(false);
    expect(panel?.textContent).toContain("Agregar");
    expect(panel?.textContent).not.toContain("Guardar cambios");
  });

  it("disables completion for a user who is not the task responsible", () => {
    const html = renderToStaticMarkup(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[{ id: "user-1", email: "ada@example.com", role: "RECEPTION" }]} canEdit={false} currentUserId="other-user" />,
    );

    expect(html).toContain("Marcar Confirmar proveedores como completada");
    expect(html).toMatch(/aria-label="Marcar Confirmar proveedores como completada"[^>]*disabled/);
  });

  it("opens the task panel when clicking the row body", () => {
    const view = mount(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[{ id: "user-1", email: "ada@example.com", role: "RECEPTION" }]} canEdit={false} currentUserId="other-user" />,
    );

    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();

    act(() => {
      view.querySelector<HTMLElement>('[data-testid="task-row-task-1"]')?.click();
    });

    expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeNull();
    expect(document.body.textContent).toContain(TASK_DETAIL_PANEL_LABEL);
  });

  it("keeps the completion action from opening the task panel", () => {
    const view = mount(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[{ id: "user-1", email: "ada@example.com", role: "RECEPTION" }]} canEdit={false} currentUserId="user-1" />,
    );

    act(() => {
      view.querySelector<HTMLElement>('[data-testid="complete-task-1"]')?.click();
    });

    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();
    expect(view.querySelectorAll('[aria-label="Marcar Confirmar proveedores como completada"]')).toHaveLength(1);
  });

  it("uses the premium select and date field in the create task form", () => {
    const html = renderToStaticMarkup(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[{ id: "user-1", email: "ada@example.com", role: "EVENT_EDITOR" }]} canEdit currentUserId="editor-1" />,
    );

    expect(html).not.toContain("<select");
    expect(html).toContain('aria-label="Responsable opcional"');
    expect(html).toContain('placeholder="AAAA-MM-DD"');
  });

  it("uses the premium select and date field in the editable task panel", () => {
    mount(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[{ id: "user-1", email: "ada@example.com", role: "EVENT_EDITOR" }]} canEdit currentUserId="editor-1" initialSelectedTaskId="task-1" />,
    );

    const panel = document.querySelector('[data-slot="sheet-content"]');
    expect(panel).not.toBeNull();
    expect(panel?.querySelector("select")).toBeNull();
    expect(panel?.querySelector('input[placeholder="AAAA-MM-DD"]')).not.toBeNull();
  });

  it("keeps a long responsible email contained in the read-only detail panel", () => {
    const longEmail = "reception.prueba@marketinghub.local.example.com";
    mount(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[{ id: "user-1", email: longEmail, role: "RECEPTION" }]} canEdit={false} currentUserId="other-user" initialSelectedTaskId="task-1" />,
    );

    const panel = document.querySelector('[data-slot="sheet-content"]');
    const value = Array.from(panel?.querySelectorAll("span") ?? []).find((element) => element.getAttribute("title") === longEmail);

    expect(value).toBeDefined();
    expect(value?.textContent).toBe("Reception Prueba");
    expect(value?.className).toContain("min-w-0");
    expect(value?.className).toContain("break-all");
  });

  it("marks a group as completed only when all its tasks are complete", () => {
    const completedGroup = {
      ...groups[0],
      tasks: [{ ...groups[0].tasks[0], completed: true }],
    };

    const html = renderToStaticMarkup(
      <OrganizationChecklist eventId="event-1" groups={[completedGroup]} assignees={[]} canEdit={false} currentUserId="other-user" />,
    );

    expect(html).toContain(COMPLETED_GROUP_LABEL);
    expect(html).toContain("border-emerald-500/40");
  });

  it("keeps an empty group neutral", () => {
    const emptyGroup = { ...groups[0], tasks: [] };

    const html = renderToStaticMarkup(
      <OrganizationChecklist eventId="event-1" groups={[emptyGroup]} assignees={[]} canEdit={false} currentUserId="other-user" />,
    );

    expect(html).not.toContain(COMPLETED_GROUP_LABEL);
    expect(html).toContain("Este grupo todavía no tiene tareas");
  });

  it("shows global and per-group progress", () => {
    const html = renderToStaticMarkup(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[]} canEdit={false} currentUserId="other-user" />,
    );

    expect(html).toContain("0%");
    expect(html).toContain("0/1");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain("Progreso del grupo Producción");
  });

  it("highlights overdue tasks with a visible label", () => {
    const overdue = [{ ...groups[0], tasks: [{ ...groups[0].tasks[0], dueDate: "2020-01-01" }] }];

    const html = renderToStaticMarkup(
      <OrganizationChecklist eventId="event-1" groups={overdue} assignees={[]} canEdit={false} currentUserId="other-user" />,
    );

    expect(html).toContain("Vencida");
    expect(html).toContain("border-red-400/40");
  });

  it("renders the search and filter toolbar", () => {
    const html = renderToStaticMarkup(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[]} canEdit={false} currentUserId="other-user" />,
    );

    expect(html).toContain('aria-label="Buscar tareas"');
    expect(html).toContain("Solo mis tareas");
    expect(html).toContain("Pendientes");
    expect(html).toContain("Vencidas");
  });

  it("filters visible tasks by search text", () => {
    const twoTasks = [{
      ...groups[0],
      tasks: [groups[0].tasks[0], { ...groups[0].tasks[0], id: "task-2", title: "Pagar proveedor" }],
    }];
    const view = mount(
      <OrganizationChecklist eventId="event-1" groups={twoTasks} assignees={[]} canEdit={false} currentUserId="other-user" />,
    );
    const search = view.querySelector<HTMLInputElement>('input[aria-label="Buscar tareas"]');

    expect(search).not.toBeNull();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(search, "pagar");
      search?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(view.textContent).toContain("Pagar proveedor");
    expect(view.textContent).not.toContain("Confirmar proveedores");
  });

  it("filters to only my tasks", () => {
    const twoTasks = [{
      ...groups[0],
      tasks: [groups[0].tasks[0], { ...groups[0].tasks[0], id: "task-2", title: "Pagar proveedor", assigneeId: null }],
    }];
    const view = mount(
      <OrganizationChecklist eventId="event-1" groups={twoTasks} assignees={[{ id: "user-1", email: "ada@example.com", role: "RECEPTION" }]} canEdit={false} currentUserId="user-1" />,
    );

    act(() => {
      Array.from(view.querySelectorAll("button")).find((button) => button.textContent === "Solo mis tareas")?.click();
    });

    expect(view.textContent).toContain("Confirmar proveedores");
    expect(view.textContent).not.toContain("Pagar proveedor");
  });

  it("offers duplicate and delete actions in the editor panel", () => {
    mount(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[]} canEdit currentUserId="editor-1" initialSelectedTaskId="task-1" />,
    );

    expect(document.body.textContent).toContain("Duplicar");
    expect(document.querySelector('[aria-label="Eliminar tarea Confirmar proveedores"]')).not.toBeNull();
  });

  it("lets editors assign a responsible when creating a subtask", () => {
    mount(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[{ id: "user-1", email: "ada@example.com", role: "EVENT_EDITOR" }]} canEdit currentUserId="editor-1" initialSelectedTaskId="task-1" />,
    );

    expect(document.querySelector('[aria-label="Responsable de la subtarea"]')).not.toBeNull();
  });

  it("does not let the responsible user assign a subtask", () => {
    mount(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[{ id: "user-1", email: "ada@example.com", role: "RECEPTION" }]} canEdit={false} currentUserId="user-1" initialSelectedTaskId="task-1" />,
    );

    expect(document.querySelector('[aria-label="Responsable de la subtarea"]')).toBeNull();
  });

  it("shows the templates entry point only to editors", () => {
    const editor = renderToStaticMarkup(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[]} templates={[]} canEdit currentUserId="editor-1" />,
    );
    const reception = renderToStaticMarkup(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[]} templates={[]} canEdit={false} currentUserId="user-1" />,
    );

    expect(editor).toContain("Plantillas");
    expect(reception).not.toContain("Plantillas");
  });

  it("lets editors move a task to another group", () => {
    const twoGroups = [groups[0], { ...groups[0], id: "group-2", title: "Sala", position: 1, tasks: [] }];
    mount(
      <OrganizationChecklist eventId="event-1" groups={twoGroups} assignees={[]} canEdit currentUserId="editor-1" initialSelectedTaskId="task-1" />,
    );

    expect(document.querySelector('[aria-label="Grupo destino"]')).not.toBeNull();
  });

  it("does not show the move control to reception readers", () => {
    const twoGroups = [groups[0], { ...groups[0], id: "group-2", title: "Sala", position: 1, tasks: [] }];
    mount(
      <OrganizationChecklist eventId="event-1" groups={twoGroups} assignees={[]} canEdit={false} currentUserId="other-user" initialSelectedTaskId="task-1" />,
    );

    expect(document.querySelector('[aria-label="Grupo destino"]')).toBeNull();
  });

  it("lets editors select tasks and shows the bulk toolbar", () => {
    const view = mount(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[{ id: "user-1", email: "ada@example.com", role: "EVENT_EDITOR" }]} canEdit currentUserId="editor-1" />,
    );
    const checkbox = view.querySelector<HTMLInputElement>('[aria-label="Seleccionar Confirmar proveedores"]');

    expect(checkbox).not.toBeNull();
    act(() => checkbox?.click());

    expect(view.textContent).toContain("1 seleccionadas");
    expect(view.textContent).toContain("Completar");
    expect(view.textContent).toContain("Reabrir");
    expect(view.textContent).toContain("Reasignar");
  });

  it("does not show selection checkboxes to readers", () => {
    const html = renderToStaticMarkup(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[]} canEdit={false} currentUserId="other-user" />,
    );

    expect(html).not.toContain("Seleccionar Confirmar proveedores");
  });

  it("shows a priority badge and task traceability", () => {
    const highPriority = [{
      ...groups[0],
      tasks: [{
        ...groups[0].tasks[0],
        completed: true,
        priority: "high" as const,
        createdByEmail: "editor@example.com",
        completedAt: new Date("2026-11-04T10:00:00Z"),
        completedByEmail: "reception.prueba@example.com",
      }],
    }];

    mount(
      <OrganizationChecklist eventId="event-1" groups={highPriority} assignees={[]} canEdit currentUserId="editor-1" initialSelectedTaskId="task-1" />,
    );

    expect(document.body.textContent).toContain("Alta");
    expect(document.body.textContent).toContain("Creada por Editor");
    expect(document.body.textContent).toContain("Completada por Reception Prueba");
  });

  it("shows the priority field in the editor panel", () => {
    mount(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[]} canEdit currentUserId="editor-1" initialSelectedTaskId="task-1" />,
    );

    expect(document.querySelector('[aria-label="Prioridad"]')).not.toBeNull();
  });

  it("shows task comments and lets editors comment", () => {
    mount(
      <OrganizationChecklist
        eventId="event-1"
        groups={groups}
        assignees={[]}
        comments={[{ id: "comment-1", taskId: "task-1", authorId: "user-1", authorEmail: "ada@example.com", body: "Todo listo", createdAt: new Date("2026-11-04T10:00:00Z") }]}
        canEdit
        currentUserId="editor-1"
        initialSelectedTaskId="task-1"
      />,
    );

    const panel = document.querySelector('[data-slot="sheet-content"]');
    expect(panel?.textContent).toContain("Comentarios");
    expect(panel?.textContent).toContain("Todo listo");
    expect(panel?.textContent).toContain("Ada");
    expect(panel?.querySelector('textarea[aria-label="Nuevo comentario"]')).not.toBeNull();
  });

  it("shows comments read-only to an unassigned reader", () => {
    mount(
      <OrganizationChecklist
        eventId="event-1"
        groups={groups}
        assignees={[]}
        comments={[{ id: "comment-1", taskId: "task-1", authorId: "user-1", authorEmail: "ada@example.com", body: "Todo listo", createdAt: new Date("2026-11-04T10:00:00Z") }]}
        canEdit={false}
        currentUserId="other-user"
        initialSelectedTaskId="task-1"
      />,
    );

    const panel = document.querySelector('[data-slot="sheet-content"]');
    expect(panel?.textContent).toContain("Todo listo");
    expect(panel?.querySelector('textarea[aria-label="Nuevo comentario"]')).toBeNull();
  });

  it("offers a CSV export link to every reader", () => {
    const html = renderToStaticMarkup(
      <OrganizationChecklist eventId="event-1" groups={groups} assignees={[]} canEdit={false} currentUserId="other-user" />,
    );

    expect(html).toContain('href="/events/event-1/organization/export"');
    expect(html).toContain("Exportar CSV");
  });

  it("opens the template sheet with saved templates", () => {
    const view = mount(
      <OrganizationChecklist
        eventId="event-1"
        groups={groups}
        assignees={[]}
        templates={[{ id: "template-1", name: "Boda estándar", groupCount: 2, taskCount: 5, createdAt: new Date("2026-01-01") }]}
        canEdit
        currentUserId="editor-1"
      />,
    );

    act(() => {
      Array.from(view.querySelectorAll("button")).find((button) => button.textContent?.includes("Plantillas"))?.click();
    });

    expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Plantillas de checklist");
    expect(document.body.textContent).toContain("Boda estándar");
    expect(document.body.textContent).toContain("2 grupos · 5 tareas");
    expect(document.body.textContent).toContain("Aplicar");
  });
});
