"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/checkbox";
import { Input } from "@/components/ui/input";
import type { EventRow } from "@/modules/events";
import {
  updateEventAction,
  publishEventAction,
  closeEventAction,
  type EventFormState,
} from "../../actions";

const initialState: EventFormState = {};

// `datetime-local` inputs need "YYYY-MM-DDTHH:mm", not `Date#toISOString()`'s trailing "Z"/millis.
function toDateTimeLocal(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventEditForm({ event }: { event: EventRow }) {
  const [state, formAction, pending] = useActionState(updateEventAction, initialState);
  // spec.md "Fixed Optional Field Catalog" — seeded from the event's current toggle state.
  const [collectCompany, setCollectCompany] = useState(event.collectCompany);
  const [collectJobTitle, setCollectJobTitle] = useState(event.collectJobTitle);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={event.id} />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Nombre
          <Input name="name" defaultValue={event.name} maxLength={255} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Inicio
          <Input name="startsAt" type="datetime-local" defaultValue={toDateTimeLocal(event.startsAt)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Fin (opcional)
          <Input name="endsAt" type="datetime-local" defaultValue={toDateTimeLocal(event.endsAt)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Ubicación (opcional)
          <Input name="location" defaultValue={event.location ?? ""} maxLength={255} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Capacidad (opcional, vacío = ilimitada)
          <Input name="capacity" type="number" min={1} defaultValue={event.capacity ?? ""} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Recordatorio (minutos antes, opcional)
          <Input
            name="reminderOffsetMinutes"
            type="number"
            min={0}
            defaultValue={event.reminderOffsetMinutes ?? ""}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
          Descripción (opcional)
          <textarea
            name="description"
            defaultValue={event.description ?? ""}
            maxLength={5000}
            className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <p className="text-sm font-medium">Campos opcionales del formulario de registro</p>
          <Checkbox
            checked={collectCompany}
            onChange={setCollectCompany}
            label="Solicitar empresa"
          />
          <input type="hidden" name="collectCompany" value={collectCompany ? "true" : ""} />
          <Checkbox
            checked={collectJobTitle}
            onChange={setCollectJobTitle}
            label="Solicitar puesto"
          />
          <input type="hidden" name="collectJobTitle" value={collectJobTitle ? "true" : ""} />
        </div>
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
        {state.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}
        {state.success ? (
          <p className="text-sm text-muted-foreground sm:col-span-2">{state.success}</p>
        ) : null}
      </form>

      <div className="flex gap-3">
        {event.status !== "published" ? (
          <form action={publishEventAction}>
            <input type="hidden" name="id" value={event.id} />
            <Button type="submit" variant="secondary">
              Publicar
            </Button>
          </form>
        ) : null}
        {event.status !== "closed" ? (
          <form action={closeEventAction}>
            <input type="hidden" name="id" value={event.id} />
            <Button type="submit" variant="outline">
              Cerrar
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
