"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { EventRow } from "@/modules/events";
import { syncEventContactsAction, type EventContactSyncActionState } from "./actions";

const initialState: EventContactSyncActionState = {};

export function EventContactSyncForm({ events, onComplete }: { events: EventRow[]; onComplete: (summary: NonNullable<EventContactSyncActionState["summary"]>, eventIds: string[]) => void }) {
  const [state, formAction, pending] = useActionState(syncEventContactsAction, initialState);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const handledSuccess = useRef<string | null>(null);

  useEffect(() => {
    if (state.success && state.summary && handledSuccess.current !== state.success) {
      handledSuccess.current = state.success;
      onComplete(state.summary, state.selectedEventIds ?? []);
    }
  }, [onComplete, state.selectedEventIds, state.success, state.summary]);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <p className="text-sm font-medium">Eventos de origen</p>
        <p className="mt-1 text-xs text-muted-foreground">Elegí eventos específicos o dejá todo sin seleccionar para sincronizarlos todos.</p>
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
        {events.length === 0 ? <p className="text-sm text-muted-foreground">No hay eventos disponibles.</p> : events.map((event) => (
          <label key={event.id} className="flex items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/50">
            <input
              type="checkbox"
              name="eventIds"
              value={event.id}
              checked={selectedEventIds.includes(event.id)}
              onChange={(eventChange) => setSelectedEventIds((current) => eventChange.target.checked
                ? [...current, event.id]
                : current.filter((id) => id !== event.id))}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>
              <span className="block font-medium">{event.name}</span>
              <span className="text-xs text-muted-foreground">{event.status === "published" ? "Publicado" : event.status === "archived" ? "Archivado" : event.status}</span>
            </span>
          </label>
        ))}
      </div>
      {state.summary ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <p className="font-medium">Vista previa, todavía no se ha importado nada</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Registros</dt><dd className="font-semibold">{state.summary.registrations}</dd></div>
            <div><dt className="text-muted-foreground">Asistentes</dt><dd className="font-semibold">{state.summary.attendees}</dd></div>
            <div><dt className="text-muted-foreground">Contactos nuevos</dt><dd className="font-semibold">{state.summary.newContacts}</dd></div>
            <div><dt className="text-muted-foreground">Ya existentes</dt><dd className="font-semibold">{state.summary.existingContacts}</dd></div>
            <div><dt className="text-muted-foreground">Pendientes de consentimiento</dt><dd className="font-semibold">{state.summary.pendingConsent}</dd></div>
            <div><dt className="text-muted-foreground">Inválidos</dt><dd className="font-semibold">{state.summary.invalidRecords}</dd></div>
          </dl>
        </div>
      ) : null}
      {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-sm text-accent">{state.success}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || events.length === 0} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:pointer-events-none disabled:opacity-50">
          <RefreshCw size={16} /> {pending ? "Sincronizando..." : "Previsualizar sincronización"}
        </button>
        {state.preview ? <button type="submit" name="confirm" value="true" disabled={pending} className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium disabled:pointer-events-none disabled:opacity-50">Confirmar e importar</button> : null}
      </div>
    </form>
  );
}
