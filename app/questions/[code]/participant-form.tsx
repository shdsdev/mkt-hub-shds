"use client";

import { useActionState } from "react";
import { registerParticipantAction } from "./actions";

export function ParticipantForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(registerParticipantAction, {});

  return (
    <form action={action} className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-black/[0.08] bg-white/90 p-6 text-[#202020] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <input type="hidden" name="code" value={code} />
      <div>
        <h1 className="font-heading text-2xl font-semibold">Preguntas de la presentación</h1>
        <p className="mt-2 text-sm text-[#6b6b6b]">Ingresá el código y tus datos una sola vez para participar.</p>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Código de acceso
        <input name="accessCode" required minLength={5} maxLength={5} autoComplete="off" spellCheck={false} className="rounded-md border border-black/[0.12] bg-white px-3 py-2 font-mono uppercase tracking-[0.3em] outline-none focus:ring-2 focus:ring-sky-500/30" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Nombre completo
        <input name="fullName" required maxLength={255} className="rounded-md border border-black/[0.12] bg-white px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-sky-500/30" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Empresa
        <input name="company" required maxLength={255} className="rounded-md border border-black/[0.12] bg-white px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-sky-500/30" />
      </label>
      <label className="flex items-start gap-2 text-xs text-[#6b6b6b]">
        <input type="checkbox" name="consentAccepted" required className="mt-0.5" />
        <span>Acepto que mi nombre, empresa y preguntas se almacenen para este evento y sean visibles sólo para el equipo autorizado.</span>
      </label>
      {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 disabled:opacity-60">
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
