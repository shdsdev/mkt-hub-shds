"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createEmailContactAction, type ContactActionState } from "./actions";

const initialState: ContactActionState = {};

export function ContactForm() {
  const [state, action, pending] = useActionState(createEmailContactAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <form action={action} className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Alta manual</p>
      <h2 className="mt-2 font-heading text-lg font-semibold">Agregar contacto</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Se crea como pendiente y no recibirá campañas hasta contar con consentimiento.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium sm:col-span-2">Email<input name="email" type="email" required placeholder="persona@empresa.com" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
        <label className="block text-sm font-medium">Nombre completo<input name="fullName" placeholder="Nombre y apellido" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
        <label className="block text-sm font-medium">Empresa<input name="company" placeholder="Empresa" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
        <label className="block text-sm font-medium">Teléfono<input name="phone" placeholder="Teléfono" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
        <label className="block text-sm font-medium">Etiqueta opcional<input name="tag" placeholder="VIP" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><button type="submit" disabled={pending} className="h-9 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50">{pending ? "Guardando…" : "Agregar contacto"}</button>{state.error ? <p role="alert" className="text-xs text-destructive">{state.error}</p> : null}{state.success ? <p role="status" className="text-xs text-accent">{state.success}</p> : null}</div>
    </form>
  );
}
