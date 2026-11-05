"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, Clock3, Copy, Download, GripVertical, LayoutTemplate, Search, Trash2, Undo2 } from "lucide-react";
import type { ChecklistAssignee, ChecklistComment, ChecklistTaskPriority, ChecklistTemplateSummary, EventChecklist } from "@/modules/events";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  bulkTasksAction,
  createGroupAction,
  createCommentAction,
  createSubtaskAction,
  createTaskAction,
  deleteGroupAction,
  deleteTaskAction,
  deleteTemplateAction,
  duplicateTaskAction,
  moveTaskAction,
  reorderGroupsAction,
  saveTemplateAction,
  toggleTaskCompletionAction,
  applyTemplateAction,
  updateGroupAction,
  updateTaskAction,
} from "./actions";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Props = {
  eventId: string;
  groups: EventChecklist[];
  assignees: ChecklistAssignee[];
  templates?: ChecklistTemplateSummary[];
  comments?: ChecklistComment[];
  canEdit: boolean;
  currentUserId: string;
  initialSelectedTaskId?: string;
};

export const ORGANIZATION_REFRESH_INTERVAL_MS = 5000;
export const CHECKLIST_ERROR_EVENT = "event-checklist:error";
export const CHECKLIST_REALTIME_TABLES = ["event_checklist_groups", "event_checklist_tasks", "event_checklist_comments"] as const;
export const TASK_DETAIL_PANEL_LABEL = "Detalle de la tarea";
export const SUBTASKS_SECTION_LABEL = "Subtareas";
export const TASK_ACTIONS_LABEL = "Acciones";
export const COMPLETED_GROUP_LABEL = "Completado";
export const PRIORITY_LABELS: Record<ChecklistTaskPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};
const PRIORITY_BADGE_CLASSES: Record<ChecklistTaskPriority, string> = {
  low: "border-emerald-400/40 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
  medium: "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300",
  high: "border-red-400/40 bg-red-400/10 text-red-700 dark:text-red-300",
};
const INTERACTIVE_SELECTOR = "a, button, input, select, textarea, label, [role='button']";
const NO_ASSIGNEE = "__none__";
const OPEN_GROUPS_STORAGE_PREFIX = "event-checklist-open-groups:";

export type ChecklistFilter = "all" | "mine" | "pending" | "overdue";

export const CHECKLIST_FILTER_LABELS: Record<ChecklistFilter, string> = {
  all: "Todas",
  mine: "Solo mis tareas",
  pending: "Pendientes",
  overdue: "Vencidas",
};

export type DueDateState = "none" | "completed" | "overdue" | "today" | "upcoming";

export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function getDueDateState(dueDate: string | null, completed: boolean, today: string = todayIso()): DueDateState {
  if (!dueDate) return "none";
  if (completed) return "completed";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  return "upcoming";
}

export function formatChecklistDate(dueDate: string): string {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${dueDate}T12:00:00`));
}

function dueDateBadgeClasses(state: DueDateState): string {
  if (state === "overdue") return "border-red-400/40 bg-red-400/10 text-red-700 dark:text-red-300";
  if (state === "today") return "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300";
  if (state === "completed") return "border-border bg-muted text-muted-foreground";
  return "border-accent/40 bg-accent/10 text-accent";
}

export function assigneeDisplayName(email?: string | null): string {
  if (!email) return "Sin responsable";
  const local = email.split("@")[0] || email;
  const words = local.split(/[._-]+/).filter(Boolean);
  if (words.length === 0) return local;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export function getChecklistProgress(groups: EventChecklist[]): { completed: number; total: number; percent: number } {
  const total = groups.reduce((count, group) => count + group.tasks.length, 0);
  const completed = groups.reduce((count, group) => count + group.tasks.filter((task) => task.completed).length, 0);
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}

export function filterChecklistGroups(
  groups: EventChecklist[],
  options: { query?: string; filter?: ChecklistFilter; currentUserId: string; assignees: ChecklistAssignee[]; today?: string },
): EventChecklist[] {
  const query = (options.query ?? "").trim().toLowerCase();
  const filter = options.filter ?? "all";
  if (!query && filter === "all") return groups;

  const today = options.today ?? todayIso();
  const emailById = new Map(options.assignees.map((assignee) => [assignee.id, assignee.email.toLowerCase()]));

  return groups
    .map((group) => ({
      ...group,
      tasks: group.tasks.filter((task) => {
        if (filter === "mine" && task.assigneeId !== options.currentUserId) return false;
        if (filter === "pending" && task.completed) return false;
        if (filter === "overdue" && getDueDateState(task.dueDate, task.completed, today) !== "overdue") return false;
        if (!query) return true;
        const assignee = task.assigneeId ? emailById.get(task.assigneeId) ?? "" : "";
        return [task.title, task.notes ?? "", assignee].some((value) => value.toLowerCase().includes(query));
      }),
    }))
    .filter((group) => group.tasks.length > 0);
}

export function parseOpenGroupIds(raw: string | null, fallback: string[]): string[] {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return fallback;
  }
}

export function OrganizationChecklist({ eventId, groups: initialGroups, assignees, templates = [], comments = [], canEdit, currentUserId, initialSelectedTaskId }: Props) {
  const router = useRouter();
  const refreshRef = useRef(router.refresh);
  refreshRef.current = router.refresh;
  const [groups, setGroups] = useState(initialGroups);
  const [openGroups, setOpenGroups] = useState(() => new Set(initialGroups.map((group) => group.id)));
  const [openGroupsHydrated, setOpenGroupsHydrated] = useState(false);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialSelectedTaskId ?? null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ChecklistFilter>("all");
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const refreshTimeoutRef = useRef<number | undefined>(undefined);
  const progress = getChecklistProgress(groups);
  const isFiltering = query.trim().length > 0 || filter !== "all";
  const visibleGroups = filterChecklistGroups(groups, { query, filter, currentUserId, assignees });
  const storageKey = `${OPEN_GROUPS_STORAGE_PREFIX}${eventId}`;

  useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);

  useEffect(() => {
    setSelectedTaskIds(new Set());
  }, [initialGroups]);

  function toggleTaskSelected(taskId: string) {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedTaskIds(new Set());
  }

  useEffect(() => {
    setSelectedTaskId(initialSelectedTaskId ?? null);
  }, [initialSelectedTaskId]);

  useEffect(() => {
    setOpenGroups(new Set(parseOpenGroupIds(window.localStorage.getItem(storageKey), initialGroups.map((group) => group.id))));
    setOpenGroupsHydrated(true);
  }, [storageKey, initialGroups]);

  useEffect(() => {
    if (!openGroupsHydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...openGroups]));
    } catch {
      // Storage can be unavailable in private mode; keep the in-memory state.
    }
  }, [openGroups, openGroupsHydrated, storageKey]);

  useEffect(() => {
    const handleError = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      if (typeof message === "string") setError(message || undefined);
    };
    window.addEventListener(CHECKLIST_ERROR_EVENT, handleError);
    return () => window.removeEventListener(CHECKLIST_ERROR_EVENT, handleError);
  }, []);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setRealtimeStatus("disconnected");
      return;
    }

    const supabase = createClient();
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = window.setTimeout(() => refreshRef.current(), 250);
    };
    const channel = supabase.channel(`event-checklist:${eventId}`);
    for (const table of CHECKLIST_REALTIME_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `event_id=eq.${eventId}` }, scheduleRefresh);
    }
    channel.subscribe((status) => {
      setRealtimeStatus(status === "SUBSCRIBED" ? "connected" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "disconnected" : "connecting");
    });

    return () => {
      window.clearTimeout(refreshTimeoutRef.current);
      void supabase.removeChannel(channel);
    };
  }, [eventId]);

  useEffect(() => {
    if (realtimeStatus === "connected") return;

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") refreshRef.current();
    };
    const intervalId = window.setInterval(refreshIfVisible, ORGANIZATION_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [realtimeStatus]);

  function handleDragEnd(result: DropResult) {
    if (!canEdit || !result.destination) return;
    setError(undefined);
    const previous = groups;

    if (result.type === "GROUP") {
      const next = reorderItems(groups, result.source.index, result.destination.index);
      setGroups(next);
      const data = form({
        eventId,
        orderedIds: JSON.stringify(next.map((group) => group.id)),
        expectedVersions: JSON.stringify(Object.fromEntries(previous.map((group) => [group.id, new Date(group.updatedAt).toISOString()]))),
      });
      startTransition(async () => {
        const response = await reorderGroupsAction(data);
        if (response.error) {
          setGroups(previous);
          setError(response.error);
        } else {
          router.refresh();
        }
      });
      return;
    }

    const sourceGroupIndex = groups.findIndex((group) => group.id === result.source.droppableId);
    const destinationGroupIndex = groups.findIndex((group) => group.id === result.destination?.droppableId);
    if (sourceGroupIndex < 0 || destinationGroupIndex < 0) return;
    const next = groups.map((group) => ({ ...group, tasks: [...group.tasks] }));
    const [task] = next[sourceGroupIndex].tasks.splice(result.source.index, 1);
    if (!task) return;
    const movedTask = { ...task, groupId: next[destinationGroupIndex].id };
    next[destinationGroupIndex].tasks.splice(result.destination.index, 0, movedTask);
    next.forEach((group) => group.tasks.forEach((item, index) => { item.position = index; }));
    setGroups(next);
    const data = form({
      eventId,
      taskId: task.id,
      destinationGroupId: next[destinationGroupIndex].id,
      destinationIndex: String(result.destination.index),
      expectedUpdatedAt: new Date(task.updatedAt).toISOString(),
    });
    startTransition(async () => {
      const response = await moveTaskAction(data);
      if (response.error) {
        setGroups(previous);
        setError(response.error);
      } else {
        router.refresh();
      }
    });
  }

  function toggleGroup(groupId: string) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  return (
    <section className="flex flex-col gap-5" aria-labelledby="organization-title">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Planificación del evento</p>
          <h1 id="organization-title" className="mt-1 font-heading text-xl font-semibold">Organización del evento</h1>
          <p className="mt-1 text-sm text-muted-foreground">{progress.completed} de {progress.total} tareas completadas</p>
          <div className="mt-2 flex items-center gap-2">
            <div role="progressbar" aria-label="Progreso de tareas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} className="h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${progress.percent}%` }} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{progress.percent}%</span>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <a href={`/events/${eventId}/organization/export`} download className={buttonVariants({ variant: "outline" })}>
            <Download className="size-4" aria-hidden="true" /> Exportar CSV
          </a>
          {canEdit ? (
            <>
              <Button type="button" variant="outline" onClick={() => setTemplatesOpen(true)}><LayoutTemplate className="size-4" aria-hidden="true" /> Plantillas</Button>
              <form action={createRefreshingAction(createGroupAction, () => router.refresh())} className="flex w-full gap-2 sm:w-auto">
                <input type="hidden" name="eventId" value={eventId} />
                <input name="title" required maxLength={255} placeholder="Nuevo grupo" aria-label="Nombre del nuevo grupo" className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm sm:w-52" />
                <Button type="submit">Agregar grupo</Button>
              </form>
            </>
          ) : null}
        </div>
      </div>

      {progress.total > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tarea, responsable o detalle" aria-label="Buscar tareas" className="h-10 pl-9" />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filtrar tareas">
            {(Object.keys(CHECKLIST_FILTER_LABELS) as ChecklistFilter[]).map((value) => (
              <Button key={value} type="button" size="sm" variant={filter === value ? "default" : "outline"} aria-pressed={filter === value} className="h-8 shrink-0 rounded-full px-3 text-xs" onClick={() => setFilter(value)}>
                {CHECKLIST_FILTER_LABELS[value]}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {canEdit && selectedTaskIds.size > 0 ? (
        <BulkTaskToolbar
          eventId={eventId}
          ids={[...selectedTaskIds]}
          assignees={assignees}
          versions={Object.fromEntries(groups.flatMap((group) => group.tasks).filter((task) => selectedTaskIds.has(task.id)).map((task) => [task.id, new Date(task.updatedAt).toISOString()]))}
          onClear={clearSelection}
        />
      ) : null}

      {error ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <p role="status" aria-live="polite" className={isPending ? "text-sm text-muted-foreground" : "sr-only"}>{isPending ? "Guardando cambios…" : "Cambios guardados."}</p>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {canEdit ? "Creá un grupo para comenzar a organizar el evento." : "Todavía no hay grupos de organización para este evento."}
        </div>
      ) : visibleGroups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <p>No hay tareas que coincidan con el filtro.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => { setQuery(""); setFilter("all"); }}>Limpiar filtros</Button>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="organization-groups" type="GROUP">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-3">
                {visibleGroups.map((group, index) => (
                  <GroupAccordion key={group.id} eventId={eventId} group={group} index={index} assignees={assignees} canEdit={canEdit} currentUserId={currentUserId} dragDisabled={!canEdit || isFiltering} selectable={canEdit} selectedIds={selectedTaskIds} onToggleSelected={toggleTaskSelected} open={openGroups.has(group.id)} onToggle={() => toggleGroup(group.id)} onOpenTask={setSelectedTaskId} />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
      {selectedTaskId ? (() => {
        const selectedTask = groups.flatMap((group) => group.tasks).find((task) => task.id === selectedTaskId) ?? null;
        return selectedTask ? <TaskDetailSheet key={selectedTask.id} eventId={eventId} task={selectedTask} groups={groups} assignees={assignees} comments={comments.filter((comment) => comment.taskId === selectedTask.id)} canEdit={canEdit} currentUserId={currentUserId} onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }} /> : null;
      })() : null}
      {canEdit ? <TemplateSheet eventId={eventId} templates={templates} open={templatesOpen} onOpenChange={setTemplatesOpen} /> : null}
    </section>
  );
}

function GroupAccordion({ eventId, group, index, assignees, canEdit, currentUserId, dragDisabled, selectable, selectedIds, onToggleSelected, open, onToggle, onOpenTask }: {
  eventId: string;
  group: EventChecklist;
  index: number;
  assignees: ChecklistAssignee[];
  canEdit: boolean;
  currentUserId: string;
  dragDisabled: boolean;
  selectable: boolean;
  selectedIds: Set<string>;
  onToggleSelected: (taskId: string) => void;
  open: boolean;
  onToggle: () => void;
  onOpenTask: (taskId: string) => void;
}) {
  const completed = group.tasks.filter((task) => task.completed).length;
  const isComplete = group.tasks.length > 0 && completed === group.tasks.length;
  const percent = group.tasks.length === 0 ? 0 : Math.round((completed / group.tasks.length) * 100);
  return (
    <Draggable draggableId={`group:${group.id}`} index={index} isDragDisabled={dragDisabled}>
      {(provided) => (
        <article
          ref={provided.innerRef}
          {...provided.draggableProps}
          data-completed={isComplete ? "true" : undefined}
          className={`overflow-hidden rounded-xl border bg-card shadow-sm transition-colors ${isComplete ? "border-emerald-500/40" : "border-border"}`}
        >
          <div className={`flex items-center gap-2 border-b px-3 py-2 ${isComplete ? "border-emerald-500/30 bg-emerald-500/10" : "border-border/70"}`}>
            {canEdit ? <button type="button" {...provided.dragHandleProps} aria-label={`Reordenar grupo ${group.title}`} className="rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><GripVertical className="size-4" /></button> : null}
            <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
              {isComplete ? <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-emerald-500" /> : null}
              <span className="min-w-0 truncate font-medium">{group.title}</span>
              {group.tasks.length > 0 ? (
                <div
                  role="progressbar"
                  aria-label={`Progreso del grupo ${group.title}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  className="ml-2 hidden h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-muted sm:block"
                >
                  <div className={`h-full rounded-full transition-[width] duration-300 ${isComplete ? "bg-emerald-500" : "bg-primary/60"}`} style={{ width: `${percent}%` }} />
                </div>
              ) : null}
              <span className={`ml-auto shrink-0 text-xs ${isComplete ? "font-medium text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>
                {isComplete ? `${COMPLETED_GROUP_LABEL} · ${completed}/${group.tasks.length}` : `${completed}/${group.tasks.length}`}
              </span>
            </button>
            {canEdit ? <GroupActions eventId={eventId} group={group} /> : null}
          </div>
          {open ? <GroupTasks eventId={eventId} group={group} assignees={assignees} canEdit={canEdit} currentUserId={currentUserId} dragDisabled={dragDisabled} selectable={selectable} selectedIds={selectedIds} onToggleSelected={onToggleSelected} onOpenTask={onOpenTask} /> : null}
        </article>
      )}
    </Draggable>
  );
}

function GroupActions({ eventId, group }: { eventId: string; group: EventChecklist }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-1">
      <form action={createRefreshingAction(updateGroupAction, () => router.refresh())} className="hidden sm:block">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="groupId" value={group.id} />
        <input type="hidden" name="expectedUpdatedAt" value={new Date(group.updatedAt).toISOString()} />
        <input name="title" defaultValue={group.title} aria-label={`Nombre del grupo ${group.title}`} className="h-8 w-36 rounded-md border border-input bg-background px-2 text-xs" />
        <Button type="submit" variant="ghost" size="sm" className="ml-1">Guardar</Button>
      </form>
      <form action={createRefreshingAction(deleteGroupAction, () => router.refresh())} onSubmit={(event) => { if (!confirm(`¿Eliminar el grupo "${group.title}" y sus tareas?`)) event.preventDefault(); }}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="groupId" value={group.id} />
        <input type="hidden" name="expectedUpdatedAt" value={new Date(group.updatedAt).toISOString()} />
        <button type="submit" aria-label={`Eliminar grupo ${group.title}`} title="Eliminar grupo" className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Trash2 className="size-4" /></button>
      </form>
    </div>
  );
}

function GroupTasks({ eventId, group, assignees, canEdit, currentUserId, dragDisabled, selectable, selectedIds, onToggleSelected, onOpenTask }: { eventId: string; group: EventChecklist; assignees: ChecklistAssignee[]; canEdit: boolean; currentUserId: string; dragDisabled: boolean; selectable: boolean; selectedIds: Set<string>; onToggleSelected: (taskId: string) => void; onOpenTask: (taskId: string) => void }) {
  return (
    <div className="p-3">
      <Droppable droppableId={group.id} type="TASK">
        {(provided, snapshot) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className={`flex min-h-12 flex-col gap-2 rounded-lg p-1 transition-colors ${snapshot.isDraggingOver ? "bg-accent/40" : ""}`}>
            {group.tasks.length > 0 ? <div className="hidden grid-cols-[minmax(0,1fr)_10rem_8rem_5rem_5rem] gap-3 px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid"><span className="pl-14">Tarea</span><span>Responsable</span><span>Fecha límite</span><span>Prioridad</span><span className="text-right">{TASK_ACTIONS_LABEL}</span></div> : null}
            {group.tasks.length === 0 ? <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">{canEdit ? "Este grupo todavía no tiene tareas. Agregá la primera abajo." : "Este grupo todavía no tiene tareas."}</p> : null}
            {group.tasks.map((task, index) => <TaskRow key={task.id} eventId={eventId} task={task} index={index} assignees={assignees} canEdit={canEdit} currentUserId={currentUserId} dragDisabled={dragDisabled} selectable={selectable} selected={selectedIds.has(task.id)} onToggleSelected={() => onToggleSelected(task.id)} onOpen={() => onOpenTask(task.id)} />)}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      {canEdit ? <CreateTaskForm eventId={eventId} group={group} assignees={assignees} /> : null}
    </div>
  );
}

function AssigneeSelect({ assignees, value, onChange, ariaLabel, optional = false }: {
  assignees: ChecklistAssignee[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  optional?: boolean;
}) {
  return (
    <Select value={value || NO_ASSIGNEE} onValueChange={(next) => onChange(next === NO_ASSIGNEE ? "" : next ?? "")}>
      <SelectTrigger className="h-10 w-full" aria-label={ariaLabel}>
        <SelectValue>
          {(current) => current && current !== NO_ASSIGNEE ? assignees.find((assignee) => assignee.id === current)?.email ?? "Sin responsable" : optional ? "Sin responsable" : "Seleccionar responsable"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_ASSIGNEE}>Sin responsable</SelectItem>
        {assignees.map((assignee) => <SelectItem key={assignee.id} value={assignee.id}>{assignee.email}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function CreateTaskForm({ eventId, group, assignees }: { eventId: string; group: EventChecklist; assignees: ChecklistAssignee[] }) {
  const router = useRouter();
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<ChecklistTaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");

  return (
    <form action={createRefreshingAction(createTaskAction, () => router.refresh())} className="mt-3 flex flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="groupId" value={group.id} />
      <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
        Tarea
        <Input name="title" required maxLength={255} placeholder="Nueva tarea" aria-label={`Nueva tarea en ${group.title}`} className="h-10" />
      </label>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto] sm:items-end">
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
          Responsable opcional
          <AssigneeSelect assignees={assignees} value={assigneeId} onChange={setAssigneeId} ariaLabel="Responsable opcional" optional />
          <input type="hidden" name="assigneeId" value={assigneeId} />
        </label>
        <DateField label="Fecha límite (opcional)" name="dueDate" value={dueDate} onChange={setDueDate} optional buttonLabel="Seleccionar fecha límite" />
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
          Prioridad
          <Select value={priority} onValueChange={(next) => setPriority((next as ChecklistTaskPriority) ?? "medium")}>
            <SelectTrigger className="h-10 w-full" aria-label="Prioridad"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PRIORITY_LABELS) as ChecklistTaskPriority[]).map((value) => <SelectItem key={value} value={value}>{PRIORITY_LABELS[value]}</SelectItem>)}
            </SelectContent>
          </Select>
          <input type="hidden" name="priority" value={priority} />
        </label>
        <Button type="submit" variant="secondary" className="h-10">Agregar tarea</Button>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Motivo o detalle de la tarea
        <textarea name="notes" maxLength={5000} rows={3} placeholder="¿Qué hay que hacer y por qué?" className="resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-normal" />
      </label>
    </form>
  );
}

function TaskRow({ eventId, task, index, assignees, canEdit, currentUserId, dragDisabled, selectable, selected, onToggleSelected, onOpen }: { eventId: string; task: EventChecklist["tasks"][number]; index: number; assignees: ChecklistAssignee[]; canEdit: boolean; currentUserId: string; dragDisabled: boolean; selectable: boolean; selected: boolean; onToggleSelected: () => void; onOpen: () => void }) {
  const router = useRouter();
  const isResponsible = task.assigneeId !== null && task.assigneeId === currentUserId;
  const canToggle = canEdit || isResponsible;
  const hasPendingSubtasks = task.subtasks.some((subtask) => !subtask.completed);
  const canComplete = canToggle && (!hasPendingSubtasks || task.completed);
  const completionLabel = task.completed ? `Marcar ${task.title} como pendiente` : `Marcar ${task.title} como completada`;
  const assigneeEmail = assignees.find((assignee) => assignee.id === task.assigneeId)?.email;
  const dueState = getDueDateState(task.dueDate, task.completed);

  function handleRowClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest(INTERACTIVE_SELECTOR)) return;
    onOpen();
  }

  return (
    <Draggable draggableId={`task:${task.id}`} index={index} isDragDisabled={dragDisabled}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          data-testid={`task-row-${task.id}`}
          data-slot="task-row"
          onClick={handleRowClick}
          className="cursor-pointer rounded-lg border border-border/80 bg-background p-3 transition-colors hover:bg-muted/40"
        >
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_8rem_5rem_5rem] sm:items-center">
            <div className="flex min-w-0 items-center gap-2">
              {selectable ? <input type="checkbox" checked={selected} onChange={onToggleSelected} aria-label={`Seleccionar ${task.title}`} className="size-4 shrink-0 accent-primary" /> : null}
              {canEdit ? <button type="button" {...provided.dragHandleProps} aria-label={`Mover tarea ${task.title}`} title="Mover tarea" className="mt-0.5 rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><GripVertical className="size-4" /></button> : null}
              <button type="button" onClick={onOpen} aria-label={`Abrir tarea ${task.title}`} className={`min-w-0 truncate text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${task.completed ? "text-muted-foreground line-through" : ""}`}>
                {task.title}
              </button>
              {task.subtasks.length > 0 ? <span className="shrink-0 text-xs text-muted-foreground">{task.subtasks.filter((subtask) => subtask.completed).length}/{task.subtasks.length}</span> : null}
            </div>
            <span className="truncate pl-7 text-xs text-muted-foreground sm:pl-0" title={assigneeEmail}>{assigneeDisplayName(assigneeEmail)}</span>
            <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 pl-7 text-xs sm:pl-2 ${dueDateBadgeClasses(dueState)}`}>
              {dueState === "overdue" ? <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" /> : null}
              {dueState === "today" ? <Clock3 className="size-3.5 shrink-0" aria-hidden="true" /> : null}
              <span className="truncate">{task.dueDate ? formatChecklistDate(task.dueDate) : "Sin fecha"}</span>
              {dueState === "overdue" ? <span className="shrink-0 font-medium">· Vencida</span> : null}
              {dueState === "today" ? <span className="shrink-0 font-medium">· Vence hoy</span> : null}
            </span>
            <span className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 pl-7 text-[10px] font-semibold sm:pl-2 ${PRIORITY_BADGE_CLASSES[task.priority]}`}>
              {PRIORITY_LABELS[task.priority]}
            </span>
            <div className="flex justify-end pl-7 sm:pl-0">
              <form action={canComplete ? createRefreshingAction(toggleTaskCompletionAction, () => router.refresh()) : undefined}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="completed" value={String(!task.completed)} />
                <input type="hidden" name="expectedUpdatedAt" value={new Date(task.updatedAt).toISOString()} />
                <button
                  type="submit"
                  data-testid={`complete-${task.id}`}
                  aria-label={completionLabel}
                  title={canComplete ? completionLabel : "Completá las subtareas pendientes para cerrar la tarea"}
                  disabled={!canComplete}
                  className={`rounded-md p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 ${task.completed ? "text-muted-foreground hover:bg-muted" : "text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"}`}
                >
                  {task.completed ? <Undo2 className="size-5" aria-hidden="true" /> : <Check className="size-5" aria-hidden="true" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

function TaskDetailSheet({ eventId, task, groups, assignees, comments, canEdit, currentUserId, onOpenChange }: {
  eventId: string;
  task: EventChecklist["tasks"][number];
  groups: EventChecklist[];
  assignees: ChecklistAssignee[];
  comments: ChecklistComment[];
  canEdit: boolean;
  currentUserId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? "");
  const [priority, setPriority] = useState<ChecklistTaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.completed).length;
  const isResponsible = task.assigneeId !== null && task.assigneeId === currentUserId;
  const canToggle = canEdit || isResponsible;
  const canManageSubtasks = canEdit || isResponsible;
  const canComment = canEdit || isResponsible;
  const hasPendingSubtasks = task.subtasks.some((subtask) => !subtask.completed);
  const canComplete = canToggle && (!hasPendingSubtasks || task.completed);
  const completionLabel = task.completed ? `Marcar ${task.title} como pendiente` : `Marcar ${task.title} como completada`;

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="border-b border-border/70 pr-14">
          <SheetTitle>{TASK_DETAIL_PANEL_LABEL}</SheetTitle>
          <SheetDescription>{task.completed ? "Tarea completada" : "Tarea pendiente"}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-5 pb-8">
          <div className="flex items-start gap-3">
            <form action={canToggle ? createRefreshingAction(updateTaskAction, () => router.refresh()) : undefined} className="pt-1">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="completed" value={String(!task.completed)} />
              <input type="hidden" name="expectedUpdatedAt" value={new Date(task.updatedAt).toISOString()} />
              <input type="checkbox" checked={task.completed} disabled={!canComplete} onChange={(event) => event.currentTarget.form?.requestSubmit()} aria-label={completionLabel} className="size-5 accent-primary" />
            </form>
            <h2 className={`min-w-0 flex-1 text-xl font-semibold tracking-tight ${task.completed ? "text-muted-foreground line-through" : ""}`}>{task.title}</h2>
          </div>

          {task.createdByEmail || task.completedAt ? (
            <p className="text-xs text-muted-foreground">
              {task.createdByEmail ? `Creada por ${assigneeDisplayName(task.createdByEmail)}` : null}
              {task.completedAt ? `${task.createdByEmail ? " · " : ""}Completada${task.completedByEmail ? ` por ${assigneeDisplayName(task.completedByEmail)}` : ""} el ${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(task.completedAt)}` : null}
            </p>
          ) : null}

          <section className="flex flex-col gap-3" aria-labelledby={`task-info-${task.id}`}>
            <h3 id={`task-info-${task.id}`} className="text-sm font-semibold">Información de la tarea</h3>
            <form action={canEdit ? createRefreshingAction(updateTaskAction, () => router.refresh()) : undefined} className="flex flex-col gap-4">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="expectedUpdatedAt" value={new Date(task.updatedAt).toISOString()} />
              {canEdit ? <label className="flex flex-col gap-1.5 text-sm font-medium">Título<Input name="title" defaultValue={task.title} maxLength={255} className="h-10" /></label> : null}
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">Responsable
                  {canEdit ? <><AssigneeSelect assignees={assignees} value={assigneeId} onChange={setAssigneeId} ariaLabel="Responsable" optional /><input type="hidden" name="assigneeId" value={assigneeId} /></> : <span title={assignees.find((assignee) => assignee.id === task.assigneeId)?.email} className="min-w-0 break-all rounded-md border border-border px-3 py-2 font-normal text-muted-foreground">{assigneeDisplayName(assignees.find((assignee) => assignee.id === task.assigneeId)?.email)}</span>}
                </label>
                {canEdit ? (
                  <DateField label="Fecha límite" name="dueDate" value={dueDate} onChange={setDueDate} optional buttonLabel="Seleccionar fecha límite" />
                ) : (
                  <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">Fecha límite
                    <span className={`inline-flex min-w-0 items-center rounded-full border px-3 py-2 font-normal ${dueDateBadgeClasses(getDueDateState(task.dueDate, task.completed))}`}>
                      {task.dueDate ? formatChecklistDate(task.dueDate) : "Sin fecha"}
                    </span>
                  </label>
                )}
                <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">Prioridad
                  {canEdit ? (
                    <>
                      <Select value={priority} onValueChange={(next) => setPriority((next as ChecklistTaskPriority) ?? "medium")}>
                        <SelectTrigger className="h-10 w-full" aria-label="Prioridad"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(PRIORITY_LABELS) as ChecklistTaskPriority[]).map((value) => <SelectItem key={value} value={value}>{PRIORITY_LABELS[value]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <input type="hidden" name="priority" value={priority} />
                    </>
                  ) : (
                    <span className={`inline-flex min-w-0 items-center rounded-full border px-3 py-2 font-normal ${PRIORITY_BADGE_CLASSES[task.priority]}`}>
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                  )}
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-medium">Motivo o detalle
                {canEdit ? <textarea name="notes" defaultValue={task.notes ?? ""} rows={5} maxLength={5000} className="resize-y rounded-md border border-input bg-background px-3 py-2 font-normal" /> : <p className="min-h-24 rounded-md border border-border px-3 py-2 font-normal text-muted-foreground">{task.notes || "Sin detalle"}</p>}
              </label>
              {canEdit ? <Button type="submit" className="self-start bg-accent text-accent-foreground shadow-sm hover:bg-accent/85 focus-visible:ring-accent">Guardar cambios</Button> : null}
            </form>
          </section>

          {canEdit ? (
            <section className="flex flex-col gap-4 border-t border-border/70 pt-5" aria-labelledby={`task-actions-${task.id}`}>
              <h3 id={`task-actions-${task.id}`} className="text-sm font-semibold">Organización</h3>
              {groups.length > 1 ? (
                <form action={createRefreshingAction(moveTaskAction, () => router.refresh())} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <input type="hidden" name="expectedUpdatedAt" value={new Date(task.updatedAt).toISOString()} />
                  <input type="hidden" name="destinationIndex" value="9999" />
                  <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium">
                    Mover a otro grupo
                    <Select name="destinationGroupId" defaultValue={task.groupId}>
                      <SelectTrigger className="h-10 w-full" aria-label="Grupo destino"><SelectValue>{(value) => groups.find((group) => group.id === value)?.title ?? "Seleccionar grupo"}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {groups.map((group) => <SelectItem key={group.id} value={group.id}>{group.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>
                  <Button type="submit" className="h-10 min-w-24 bg-accent text-accent-foreground shadow-sm hover:bg-accent/85 focus-visible:ring-accent">Mover</Button>
                </form>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
              <form action={createRefreshingAction(duplicateTaskAction, () => router.refresh())}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="taskId" value={task.id} />
                <Button type="submit" size="sm" className="h-10 bg-accent text-accent-foreground shadow-sm hover:bg-accent/85 focus-visible:ring-accent"><Copy className="size-4" aria-hidden="true" /> Duplicar</Button>
              </form>
              <form
                action={createRefreshingAction(deleteTaskAction, () => router.refresh())}
                onSubmit={(event) => {
                  const message = task.subtasks.length > 0 ? `¿Eliminar la tarea "${task.title}" y sus ${task.subtasks.length} subtareas?` : `¿Eliminar la tarea "${task.title}"?`;
                  if (!confirm(message)) event.preventDefault();
                }}
              >
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="expectedUpdatedAt" value={new Date(task.updatedAt).toISOString()} />
                <Button type="submit" size="sm" aria-label={`Eliminar tarea ${task.title}`} className="h-10 bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/85 focus-visible:ring-destructive"><Trash2 className="size-4" aria-hidden="true" /> Eliminar</Button>
              </form>
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-3 border-t border-border/70 pt-5" aria-labelledby={`subtasks-${task.id}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 id={`subtasks-${task.id}`} className="font-semibold">{SUBTASKS_SECTION_LABEL}</h3>
                <p className="text-xs text-muted-foreground">{completedSubtasks} de {task.subtasks.length} completadas</p>
              </div>
            </div>
            {task.subtasks.length > 0 ? <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {task.subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2 px-3 py-2.5">
                  <form action={canManageSubtasks ? createRefreshingAction(updateTaskAction, () => router.refresh()) : undefined}>
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="taskId" value={subtask.id} />
                    <input type="hidden" name="completed" value={String(!subtask.completed)} />
                    <input type="hidden" name="expectedUpdatedAt" value={new Date(subtask.updatedAt).toISOString()} />
                    <input type="checkbox" checked={subtask.completed} disabled={!canManageSubtasks} onChange={(event) => event.currentTarget.form?.requestSubmit()} aria-label={`Marcar ${subtask.title} como completada`} className="size-4 accent-primary" />
                  </form>
                  <span className={`min-w-0 flex-1 text-sm ${subtask.completed ? "text-muted-foreground line-through" : ""}`}>{subtask.title}</span>
                  {subtask.assigneeId ? <span className="shrink-0 text-xs text-muted-foreground">{assigneeDisplayName(assignees.find((assignee) => assignee.id === subtask.assigneeId)?.email)}</span> : null}
                  {canEdit ? <form action={createRefreshingAction(deleteTaskAction, () => router.refresh())}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="taskId" value={subtask.id} /><input type="hidden" name="expectedUpdatedAt" value={new Date(subtask.updatedAt).toISOString()} /><button type="submit" aria-label={`Eliminar subtarea ${subtask.title}`} className="rounded p-1 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Trash2 className="size-4" /></button></form> : null}
                </div>
              ))}
            </div> : <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">Todavía no hay subtareas.</p>}
            {canManageSubtasks ? <CreateSubtaskForm eventId={eventId} taskId={task.id} assignees={assignees} canAssign={canEdit} /> : null}
          </section>

          <section className="flex flex-col gap-3 border-t border-border/70 pt-5" aria-labelledby={`comments-${task.id}`}>
            <div>
              <h3 id={`comments-${task.id}`} className="font-semibold">Comentarios</h3>
              <p className="text-xs text-muted-foreground">{comments.length} comentarios</p>
            </div>
            {comments.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {comments.map((comment) => (
                  <li key={comment.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{comment.authorEmail ? assigneeDisplayName(comment.authorEmail) : "Usuario"}</span>
                      <time className="shrink-0 text-[11px] text-muted-foreground" dateTime={comment.createdAt.toISOString()}>
                        {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(comment.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{comment.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">Todavía no hay comentarios.</p>
            )}
            {canComment ? (
              <form action={createRefreshingAction(createCommentAction, () => router.refresh())} className="flex flex-col gap-2">
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="taskId" value={task.id} />
                <textarea name="body" required maxLength={2000} rows={3} placeholder="Escribe un comentario…" aria-label="Nuevo comentario" className="resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <Button type="submit" className="self-start bg-accent text-accent-foreground shadow-sm hover:bg-accent/85 focus-visible:ring-accent">Comentar</Button>
              </form>
            ) : null}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BulkTaskToolbar({ eventId, ids, assignees, versions, onClear }: { eventId: string; ids: string[]; assignees: ChecklistAssignee[]; versions: Record<string, string>; onClear: () => void }) {
  const router = useRouter();
  const [assigneeId, setAssigneeId] = useState("");
  const idsJson = JSON.stringify(ids);
  const versionsJson = JSON.stringify(versions);

  const actionFor = () => createRefreshingAction(async (formData) => {
    const result = await bulkTasksAction(formData);
    if (result.success) onClear();
    return result;
  }, () => router.refresh());

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{ids.length} seleccionadas</p>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>Limpiar</Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <form action={actionFor()}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="ids" value={idsJson} />
          <input type="hidden" name="expectedVersions" value={versionsJson} />
          <input type="hidden" name="operation" value="complete" />
          <Button type="submit" variant="secondary" size="sm">Completar</Button>
        </form>
        <form action={actionFor()}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="ids" value={idsJson} />
          <input type="hidden" name="expectedVersions" value={versionsJson} />
          <input type="hidden" name="operation" value="reopen" />
          <Button type="submit" variant="outline" size="sm">Reabrir</Button>
        </form>
        <form action={actionFor()} className="flex items-end gap-2">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="ids" value={idsJson} />
          <input type="hidden" name="expectedVersions" value={versionsJson} />
          <input type="hidden" name="operation" value="reassign" />
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium">
            Reasignar a
            <AssigneeSelect assignees={assignees} value={assigneeId} onChange={setAssigneeId} ariaLabel="Responsable para reasignar" optional />
            <input type="hidden" name="assigneeId" value={assigneeId} />
          </label>
          <Button type="submit" variant="outline" size="sm" className="h-10">Reasignar</Button>
        </form>
        <form action={actionFor()} onSubmit={(event) => { if (!confirm(`¿Eliminar ${ids.length} tareas seleccionadas?`)) event.preventDefault(); }}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="ids" value={idsJson} />
          <input type="hidden" name="expectedVersions" value={versionsJson} />
          <input type="hidden" name="operation" value="delete" />
          <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">Eliminar</Button>
        </form>
      </div>
    </div>
  );
}

function TemplateSheet({ eventId, templates, open, onOpenChange }: {
  eventId: string;
  templates: ChecklistTemplateSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b border-border/70 pr-14">
          <SheetTitle>Plantillas de checklist</SheetTitle>
          <SheetDescription>Guardá este checklist como plantilla o aplicá una existente al final del evento.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-8">
          <form action={createRefreshingAction(saveTemplateAction, () => router.refresh())} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4">
            <input type="hidden" name="eventId" value={eventId} />
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Guardar checklist actual como plantilla
              <Input name="name" required maxLength={255} placeholder="Ej. Boda estándar" className="h-10" />
            </label>
            <Button type="submit" className="self-start">Guardar plantilla</Button>
          </form>

          <section className="flex flex-col gap-3" aria-labelledby="checklist-templates-title">
            <h3 id="checklist-templates-title" className="font-semibold">Plantillas guardadas</h3>
            {templates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">Todavía no hay plantillas guardadas.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {templates.map((template) => (
                  <li key={template.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{template.name}</p>
                      <p className="text-xs text-muted-foreground">{template.groupCount} grupos · {template.taskCount} tareas</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <form
                        action={createRefreshingAction(applyTemplateAction, () => router.refresh())}
                        onSubmit={(event) => {
                          if (!confirm(`¿Agregar la plantilla "${template.name}" al final del checklist?`)) event.preventDefault();
                        }}
                      >
                        <input type="hidden" name="eventId" value={eventId} />
                        <input type="hidden" name="templateId" value={template.id} />
                        <Button type="submit" size="sm" variant="secondary">Aplicar</Button>
                      </form>
                      <form
                        action={createRefreshingAction(deleteTemplateAction, () => router.refresh())}
                        onSubmit={(event) => {
                          if (!confirm(`¿Eliminar la plantilla "${template.name}"?`)) event.preventDefault();
                        }}
                      >
                        <input type="hidden" name="eventId" value={eventId} />
                        <input type="hidden" name="templateId" value={template.id} />
                        <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" aria-hidden="true" /> Eliminar</Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CreateSubtaskForm({ eventId, taskId, assignees, canAssign }: { eventId: string; taskId: string; assignees: ChecklistAssignee[]; canAssign: boolean }) {
  const router = useRouter();
  const [assigneeId, setAssigneeId] = useState("");

  return (
    <form action={createRefreshingAction(createSubtaskAction, () => router.refresh())} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/10 p-3">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="parentTaskId" value={taskId} />
      <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
        Nueva subtarea
        <Input name="title" required maxLength={255} placeholder="Escribí el nombre de la subtarea" aria-label="Nueva subtarea" className="h-10 w-full" />
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {canAssign ? (
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium">
            Responsable opcional
            <AssigneeSelect assignees={assignees} value={assigneeId} onChange={setAssigneeId} ariaLabel="Responsable de la subtarea" optional />
            <input type="hidden" name="assigneeId" value={assigneeId} />
          </label>
        ) : null}
        <Button type="submit" className="h-10 w-full min-w-40 bg-accent text-accent-foreground shadow-sm hover:bg-accent/85 focus-visible:ring-accent sm:w-auto">
          Agregar subtarea
        </Button>
      </div>
    </form>
  );
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

export function createRefreshingAction(
  action: (formData: FormData) => Promise<{ success?: string; error?: string; conflict?: boolean }>,
  refresh: () => void,
) {
  return async (formData: FormData): Promise<void> => {
    const result = await action(formData);
    if (result.success || result.conflict) refresh();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(CHECKLIST_ERROR_EVENT, { detail: result.error ?? "" }));
    }
  };
}

function reorderItems<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}
