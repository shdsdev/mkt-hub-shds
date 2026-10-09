"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createEventAction, type EventFormState } from "./actions";

const initialState: EventFormState = {};

export function EventCreateForm() {
  const [state, formAction, pending] = useActionState(createEventAction, initialState);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="font-heading font-medium">Crear evento</h2>
        <p className="text-xs text-muted-foreground">
          El evento se crea en estado borrador y no es visible públicamente hasta publicarlo.
        </p>
      </div>
      <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Nombre
          <Input name="name" required maxLength={255} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Slug
          <Input name="slug" required maxLength={255} pattern="[a-z0-9-]+" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Inicio
          <Input name="startsAt" type="datetime-local" required />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Fin (opcional)
          <Input name="endsAt" type="datetime-local" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Ubicación (opcional)
          <Input name="location" maxLength={255} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Capacidad (opcional, vacío = ilimitada)
          <Input name="capacity" type="number" min={1} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
          Descripción (opcional)
          <textarea
            name="description"
            maxLength={5000}
            className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Recordatorio (minutos antes, opcional)
          <Input name="reminderOffsetMinutes" type="number" min={0} />
        </label>
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Creando…" : "Crear evento"}
          </Button>
        </div>
        {state.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}
        {state.success ? (
          <p className="text-sm text-muted-foreground sm:col-span-2">{state.success}</p>
        ) : null}
      </form>
    </section>
  );
}
