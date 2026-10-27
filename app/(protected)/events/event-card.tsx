"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import type { EventRow } from "@/modules/events";
import type { UserRole } from "@/modules/users";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { archiveEventAction, deleteEventAction, restoreEventAction } from "./actions";

const statusLabels = { draft: "Borrador", published: "Publicado", closed: "Cerrado", archived: "Archivado" } as const;

export function EventCard({ event, role = "ADMIN" }: { event: EventRow; role?: UserRole }) {
  const status = statusLabels[event.status as keyof typeof statusLabels] ?? event.status;
  const date = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(event.startsAt);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteEventAction, {});
  const isArchived = event.status === "archived";
  const landingHref = `/events/${event.id}/dashboard`;

  return (
    <article className="relative w-full rounded-xl border border-border bg-card p-5 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-accent hover:shadow-[0_0_0_1px_var(--accent)]">
      <Link href={landingHref} aria-label={`Abrir evento ${event.name}`} className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="sr-only">Abrir evento {event.name}</span>
      </Link>
      <div className="relative z-10 pointer-events-none">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">{event.name}</h2>
          <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium">{status}</span>
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
          <dl className="grid w-full gap-4 text-sm text-muted-foreground sm:grid-cols-[1fr_1.6fr_0.7fr]">
            <div><dt className="text-xs uppercase tracking-wide">Fecha del evento</dt><dd className="mt-1 text-foreground">{date}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide">Contexto</dt><dd className="mt-1 line-clamp-2 text-foreground">{event.description || "Sin contexto"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide">Capacidad</dt><dd className="mt-1 text-foreground">{event.capacity ?? "Sin límite"}</dd></div>
          </dl>
        </div>
      </div>
      <div className="relative z-20 mt-3 flex justify-end gap-3 pointer-events-auto sm:absolute sm:right-5 sm:bottom-5 sm:mt-0">
        {role === "ADMIN" ? <div className="flex shrink-0 items-center gap-3">
        <form action={isArchived ? restoreEventAction : archiveEventAction}>
          <input type="hidden" name="id" value={event.id} />
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="submit"
                  aria-label={isArchived ? "Restaurar evento" : "Archivar evento"}
                  className="inline-flex size-11 items-center justify-center text-muted-foreground outline-none focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {isArchived ? <ArchiveRestore aria-hidden="true" className="size-4" /> : <Archive aria-hidden="true" className="size-4" />}
                </button>
              }
            />
            <TooltipContent>{isArchived ? "Restaurar evento" : "Archivar evento"}</TooltipContent>
          </Tooltip>
        </form>
        <form action={deleteAction} onSubmit={(submitEvent) => { if (!window.confirm("¿Querés eliminar este evento? Esta acción no se puede deshacer.")) submitEvent.preventDefault(); }}>
          <input type="hidden" name="id" value={event.id} />
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="submit"
                  disabled={deletePending}
                  aria-label="Eliminar evento"
                  className="inline-flex size-11 items-center justify-center text-destructive outline-none focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              }
            />
            <TooltipContent>Eliminar evento</TooltipContent>
          </Tooltip>
        </form>
        </div> : null}
        {deleteState.error ? <p role="alert" className="basis-full text-xs text-destructive">{deleteState.error}</p> : null}
      </div>
    </article>
  );
}
