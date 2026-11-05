import type { ChecklistAssignee, EventChecklist } from "@/modules/events";

const BASE_HEADERS = ["grupo", "tarea", "responsable", "responsable_email", "fecha_limite", "estado", "prioridad", "subtarea_de", "detalle"];
const PRIORITY_LABELS: Record<string, string> = { low: "Baja", medium: "Media", high: "Alta" };

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function displayName(email: string): string {
  if (!email) return "";
  const local = email.split("@")[0] || email;
  return local.split(/[._-]+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function statusFor(completed: boolean, dueDate: string | null, today: string): string {
  if (completed) return "completada";
  if (dueDate && dueDate < today) return "vencida";
  return "pendiente";
}

export function buildChecklistCsv(
  groups: EventChecklist[],
  assignees: ChecklistAssignee[],
  today: string = todayIso(),
): string {
  const emailById = new Map(assignees.map((assignee) => [assignee.id, assignee.email]));
  const rows: string[][] = [];

  for (const group of groups) {
    for (const task of group.tasks) {
      const email = task.assigneeId ? emailById.get(task.assigneeId) ?? "" : "";
      rows.push([
        group.title,
        task.title,
        displayName(email),
        email,
        task.dueDate ?? "",
        statusFor(task.completed, task.dueDate, today),
        PRIORITY_LABELS[task.priority] ?? task.priority,
        "",
        task.notes ?? "",
      ]);
      for (const subtask of task.subtasks) {
        const subtaskEmail = subtask.assigneeId ? emailById.get(subtask.assigneeId) ?? "" : "";
        rows.push([
          group.title,
          subtask.title,
          displayName(subtaskEmail),
          subtaskEmail,
          subtask.dueDate ?? "",
          statusFor(subtask.completed, subtask.dueDate, today),
          PRIORITY_LABELS[subtask.priority] ?? subtask.priority,
          task.title,
          subtask.notes ?? "",
        ]);
      }
    }
  }

  const header = BASE_HEADERS.map(escapeCsvField).join(",");
  const lines = [header, ...rows.map((row) => row.map(escapeCsvField).join(","))];
  return `\uFEFF${lines.map((line) => `${line}\r\n`).join("")}`;
}
