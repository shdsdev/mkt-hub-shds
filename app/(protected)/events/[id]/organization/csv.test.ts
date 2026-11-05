import { describe, expect, it } from "vitest";
import type { ChecklistAssignee, EventChecklist } from "@/modules/events";
import { buildChecklistCsv } from "./csv";

const assignees: ChecklistAssignee[] = [
  { id: "user-1", email: "reception.prueba@marketinghub.local", role: "RECEPTION" },
];

const groups = [{
  id: "group-1",
  organizationId: "org-1",
  eventId: "event-1",
  title: "Hotel",
  position: 0,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  tasks: [{
    id: "task-1",
    organizationId: "org-1",
    eventId: "event-1",
    groupId: "group-1",
    parentTaskId: null,
    title: 'Pagar, "proveedor"',
    completed: false,
    assigneeId: "user-1",
    priority: "high" as const,
    dueDate: "2026-11-03",
    notes: "Antes del mediodía",
    position: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    subtasks: [{
      id: "subtask-1",
      organizationId: "org-1",
      eventId: "event-1",
      groupId: "group-1",
      parentTaskId: "task-1",
      title: "Confirmar transferencia",
      completed: true,
      assigneeId: null,
      priority: "medium" as const,
      dueDate: null,
      notes: null,
      position: 0,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    }],
  }],
}] as unknown as EventChecklist[];

describe("buildChecklistCsv", () => {
  it("exports tasks and subtasks with status and escaping", () => {
    const csv = buildChecklistCsv(groups, assignees, "2026-11-04");

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("grupo,tarea,responsable,responsable_email,fecha_limite,estado,prioridad,subtarea_de,detalle");
    expect(csv).toContain('"Pagar, ""proveedor"""');
    expect(csv).toContain("Reception Prueba");
    expect(csv).toContain("vencida");
    expect(csv).toContain("Alta");
    expect(csv).toContain("Confirmar transferencia");
    expect(csv).toContain("subtarea_de");
    expect(csv).toContain("completada");
  });

  it("keeps an unassigned task without an email", () => {
    const unassigned = [{ ...groups[0], tasks: [{ ...groups[0].tasks[0], assigneeId: null, title: "Sin dueño" }] }] as unknown as EventChecklist[];

    const csv = buildChecklistCsv(unassigned, assignees, "2026-11-04");

    expect(csv).toContain("Sin dueño,,,2026-11-03");
  });
});
