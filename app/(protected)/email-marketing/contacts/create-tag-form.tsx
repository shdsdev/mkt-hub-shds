"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createEmailTagAction, type ContactActionState } from "./actions";

export function CreateTagForm() {
  const [state, action, pending] = useActionState<ContactActionState, FormData>(createEmailTagAction, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);
  return (
    <form action={action} className="mt-5 space-y-2">
      <label className="block text-xs font-medium">Nueva etiqueta<input name="name" required maxLength={80} placeholder="Ej. Drapery" className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
      <button type="submit" disabled={pending} className="h-9 w-full rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50">{pending ? "Creando…" : "Crear etiqueta"}</button>
      {state.error ? <p role="alert" className="text-xs text-destructive">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-xs text-accent">{state.success}</p> : null}
    </form>
  );
}
