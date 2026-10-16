"use client";

import { useActionState } from "react";
import { registerParticipantAction } from "./actions";

export function ParticipantForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(registerParticipantAction, {});

  return (
    <form action={action} className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <input type="hidden" name="code" value={code} />
      <div>
        <h1 className="font-heading text-2xl font-semibold">Preguntas de la presentación</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ingresá tus datos una sola vez para participar.</p>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Nombre completo
        <input name="fullName" required maxLength={255} className="rounded-md border border-input bg-background px-3 py-2 font-normal" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Empresa
        <input name="company" required maxLength={255} className="rounded-md border border-input bg-background px-3 py-2 font-normal" />
      </label>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" name="consentAccepted" required className="mt-0.5" />
        <span>Acepto que mi nombre, empresa y preguntas se almacenen para este evento y sean visibles sólo para el equipo autorizado.</span>
      </label>
      {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
