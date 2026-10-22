"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { EventRow } from "@/modules/events";
import type { UserRole } from "@/modules/users";
import { archiveEventAction, deleteEventAction, restoreEventAction } from "./actions";

const statusLabels = { draft: "Borrador", published: "Publicado", closed: "Cerrado", archived: "Archivado" } as const;

export function EventCard({ event, role = "ADMIN" }: { event: EventRow; role?: UserRole }) {
  const status = statusLabels[event.status as keyof typeof statusLabels] ?? event.status;
  const date = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(event.startsAt);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteEventAction, {});
  const isArchived = event.status === "archived";
  const landingHref = role === "RECEPTION" ? `/events/${event.id}/registrations` : `/events/${event.id}/dashboard`;

  return (
    <article className="w-full max-w-4xl rounded-xl border border-border bg-card p-5 shadow-sm">
      <Link href={landingHref} className="group block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-heading text-lg font-semibold group-hover:text-primary">{event.name}</h2>
          <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium">{status}</span>
        </div>
        <dl className="mt-5 grid gap-4 text-sm text-muted-foreground sm:grid-cols-[1fr_1.6fr_0.7fr]">
          <div><dt className="text-xs uppercase tracking-wide">Fecha del evento</dt><dd className="mt-1 text-foreground">{date}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide">Contexto</dt><dd className="mt-1 line-clamp-2 text-foreground">{event.description || "Sin contexto"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide">Capacidad</dt><dd className="mt-1 text-foreground">{event.capacity ?? "Sin límite"}</dd></div>
        </dl>
      </Link>
      {role === "ADMIN" ? <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <form action={isArchived ? restoreEventAction : archiveEventAction}>
          <input type="hidden" name="id" value={event.id} />
          <button type="submit" aria-label={isArchived ? "Restaurar evento" : "Archivar evento"} className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
            {isArchived ? "Restaurar" : "Archivar"}
          </button>
        </form>
        <form action={deleteAction} onSubmit={(submitEvent) => { if (!window.confirm("¿Querés eliminar este evento? Esta acción no se puede deshacer.")) submitEvent.preventDefault(); }}>
          <input type="hidden" name="id" value={event.id} />
          <button type="submit" disabled={deletePending} aria-label="Eliminar evento" className="rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50">Eliminar</button>
        </form>
        {deleteState.error ? <p role="alert" className="basis-full text-xs text-destructive">{deleteState.error}</p> : null}
      </div> : null}
    </article>
  );
}
