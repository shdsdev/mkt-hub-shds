"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const premiumTrigger = "h-10 w-full min-w-44 rounded-xl border-border/80 bg-background/80 px-3 text-sm shadow-sm transition-colors hover:border-primary/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

export type EventAuditLogRow = {
  id: string;
  action: string;
  resourceType: string;
  actor: string;
  actorType: "user" | "system";
  when: string;
  dateKey: string;
  before: unknown;
  after: unknown;
};

const ACTION_LABEL: Record<string, string> = {
  event_change: "Cambio",
  event_send: "Envío exitoso",
  event_send_failed: "Envío fallido",
};

const RESOURCE_LABEL: Record<string, string> = {
  event: "Evento",
  event_attendee: "Asistente",
  event_registration: "Registro",
  event_editor: "Equipo de editores",
  event_receptionist: "Equipo de recepción",
  event_benefit: "Beneficio",
  event_benefit_redemption: "Canje de beneficio",
  event_check_in: "Check-in",
  event_notification: "Notificación",
  event_webhook: "Webhook",
  event_question: "Pregunta",
  event_raffle: "Sorteo",
};

const RESULT_LABEL: Record<string, string> = {
  all: "Todos los resultados",
  success: "Exitosos y cambios",
  failed: "Envíos fallidos",
};

function Detail({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  return <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>;
}

export type EventAuditFilters = { resource: string; result: string; date: string };

export function filterAuditLogs(logs: EventAuditLogRow[], filters: EventAuditFilters): EventAuditLogRow[] {
  return logs.filter((log) =>
    (filters.resource === "all" || log.resourceType === filters.resource) &&
    (filters.result === "all" || (filters.result === "failed" ? log.action === "event_send_failed" : log.action !== "event_send_failed")) &&
    (!filters.date || log.dateKey === filters.date),
  );
}

export function EventAuditLogTable({ logs }: { logs: EventAuditLogRow[] }) {
  const [resourceFilter, setResourceFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | undefined>();

  const resourceTypes = useMemo(
    () => [...new Set(logs.map((log) => log.resourceType))].sort(),
    [logs],
  );
  const filteredLogs = filterAuditLogs(logs, { resource: resourceFilter, result: resultFilter, date: dateFilter });

  return (
    <section className="space-y-4" aria-label="Historial del evento">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/20 p-4">
        <div className="flex min-w-44 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Sección</span>
          <Select value={resourceFilter} onValueChange={(value) => setResourceFilter(value ?? "all")}>
            <SelectTrigger aria-label="Filtrar por sección" className={premiumTrigger}>
              <SelectValue>{resourceFilter === "all" ? "Todas las secciones" : RESOURCE_LABEL[resourceFilter] ?? resourceFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent positionerClassName="z-[70]" alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectItem value="all">Todas las secciones</SelectItem>
                {resourceTypes.map((resourceType) => (
                  <SelectItem key={resourceType} value={resourceType}>{RESOURCE_LABEL[resourceType] ?? resourceType}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-40 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Resultado</span>
          <Select value={resultFilter} onValueChange={(value) => setResultFilter(value ?? "all")}>
            <SelectTrigger aria-label="Filtrar por resultado" className={premiumTrigger}>
              <SelectValue>{RESULT_LABEL[resultFilter] ?? resultFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent positionerClassName="z-[70]" alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectItem value="all">Todos los resultados</SelectItem>
                <SelectItem value="success">Exitosos y cambios</SelectItem>
                <SelectItem value="failed">Envíos fallidos</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-44 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Fecha</span>
          <Popover>
            <PopoverTrigger
              aria-label="Filtrar por fecha"
              render={
                <Button type="button" variant="outline" className={cn(premiumTrigger, "justify-start gap-2 font-normal")}>
                  <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{dateFilter ? format(parseISO(dateFilter), "dd MMM yyyy") : "Todas las fechas"}</span>
                </Button>
              }
            />
            <PopoverContent align="start" className="w-auto gap-0 p-2">
              <Calendar
                mode="single"
                selected={dateFilter ? parseISO(dateFilter) : undefined}
                onSelect={(next) => setDateFilter(next ? format(next, "yyyy-MM-dd") : "")}
                numberOfMonths={1}
                className="[--cell-size:--spacing(8)]"
              />
              <div className="mt-2 flex justify-end border-t border-border pt-2">
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setDateFilter("")}>
                  Todas las fechas
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <p className="ml-auto text-xs text-muted-foreground">{filteredLogs.length} {filteredLogs.length === 1 ? "acción" : "acciones"}</p>
      </div>

      {filteredLogs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No hay actividad que coincida con los filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left font-mono text-[13px]">
            <thead className="bg-muted/30 font-sans text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Acción</th>
                <th className="px-4 py-3 font-medium">Sección</th>
                <th className="px-4 py-3 font-medium">Quién</th>
                <th className="px-4 py-3 font-medium">Cuándo</th>
                <th className="px-4 py-3 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const expanded = expandedId === log.id;
                const expandable = log.before !== null || log.after !== null;
                return (
                  <EventAuditRow key={log.id} log={log} expanded={expanded} expandable={expandable} onToggle={() => setExpandedId(expanded ? undefined : log.id)} />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EventAuditRow({ log, expanded, expandable, onToggle }: { log: EventAuditLogRow; expanded: boolean; expandable: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className={`border-t border-border ${expandable ? "cursor-pointer hover:bg-muted/20" : ""}`} onClick={() => expandable && onToggle()}>
        <td className="px-4 py-3 font-medium">{ACTION_LABEL[log.action] ?? log.action}</td>
        <td className="px-4 py-3 text-muted-foreground">{RESOURCE_LABEL[log.resourceType] ?? log.resourceType}</td>
        <td className="px-4 py-3">{log.actorType === "system" ? "Sistema" : log.actor}</td>
        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{log.when}</td>
        <td className="px-4 py-3 text-muted-foreground">{expandable ? (expanded ? "Ocultar" : "Ver cambios") : "—"}</td>
      </tr>
      {expanded && (
        <tr className="border-t border-border bg-muted/10">
          <td colSpan={5} className="px-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><p className="mb-1 text-xs font-medium text-muted-foreground">Antes</p><Detail value={log.before} /></div>
              <div><p className="mb-1 text-xs font-medium text-muted-foreground">Después</p><Detail value={log.after} /></div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
