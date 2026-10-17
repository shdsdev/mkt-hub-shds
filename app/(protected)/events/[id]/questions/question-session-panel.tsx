"use client";

import { useActionState } from "react";
import Image from "next/image";
import { CopyButton } from "@/components/copy-button";
import type { QuestionSessionRow } from "@/modules/questions";
import { closeQuestionSessionAction, createQuestionSessionAction } from "./actions";

export function QuestionSessionPanel({ eventId, session, publicUrl }: { eventId: string; session?: QuestionSessionRow; publicUrl?: string }) {
  const [state, formAction, pending] = useActionState(createQuestionSessionAction, {});
  const isOpen = session?.status === "open";
  const canShowActionArtifacts = !session || isOpen;
  const code = canShowActionArtifacts ? state.code ?? session?.displayCode : undefined;
  const publicToken = canShowActionArtifacts ? state.publicToken ?? session?.publicToken : undefined;
  const resolvedPublicUrl = canShowActionArtifacts ? state.publicUrl ?? publicUrl : undefined;

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">Acceso público</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isOpen ? "La sesión está abierta." : session ? "La sesión está cerrada." : "Generá un código para abrir la sesión."}
          </p>
        </div>
        <form action={formAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <button type="submit" disabled={pending} className={isOpen ? "rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60" : "rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"}>
            {pending ? "Generando…" : isOpen ? "Regenerar código" : "Generar código"}
          </button>
        </form>
      </div>

      {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-sm text-emerald-600">{state.success}</p> : null}
      {code ? (
        <div className="grid gap-4 rounded-md border border-primary/30 bg-primary/5 p-4 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Código actual</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.3em]">{code}</p>
            <div className="mt-2 flex min-w-0 items-center gap-2">
              <p className="min-w-0 break-all text-sm text-muted-foreground">{resolvedPublicUrl}</p>
              {resolvedPublicUrl ? <CopyButton value={resolvedPublicUrl} /> : null}
            </div>
          </div>
          {resolvedPublicUrl && publicToken ? (
            <a
              href={`/questions/${publicToken}/qr`}
              download={`question-qr-${code}.png`}
              title="Descargar código QR"
              aria-label="Descargar código QR"
              className="group shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Image src={`/questions/${publicToken}/qr`} alt="Código QR para preguntas" width={128} height={128} className="h-32 w-32 rounded-md bg-white p-2 transition-transform group-hover:scale-[1.02]" />
            </a>
          ) : null}
        </div>
      ) : null}

      {session?.status === "open" ? (
        <form action={closeQuestionSessionAction} className="flex justify-end">
          <input type="hidden" name="eventId" value={eventId} />
          <button type="submit" className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">
            Cerrar portal
          </button>
        </form>
      ) : null}
    </section>
  );
}
