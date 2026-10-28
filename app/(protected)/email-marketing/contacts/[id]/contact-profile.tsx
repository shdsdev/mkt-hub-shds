"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ArrowLeft, Check, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { EmailContact, EmailContactDetail, EmailTag } from "@/modules/email-marketing";
import { assignEmailContactTagAction, removeEmailContactTagAction, updateEmailContactAction, type ContactActionState } from "../actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusLabels = { subscribed: "Suscripto", unsubscribed: "Dado de baja", suppressed: "Suprimido", pending: "Pendiente" } as const;
type Tab = "overview" | "information" | "notes" | "preferences";

export function ContactProfile({ contact, detail, tags }: { contact: EmailContact; detail: EmailContactDetail; tags: EmailTag[] }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const router = useRouter();
  const [state, action, pending] = useActionState<ContactActionState, FormData>(updateEmailContactAction, {});

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  const sourceLabel = contact.source === "csv_import" ? "Importación CSV" : contact.source === "manual" ? "Alta manual" : "Registro de evento";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-10">
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div>
          <Link href="/email-marketing/contacts" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} />Volver a Contactos</Link>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Perfil del contacto</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">{contact.fullName || "Sin nombre"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{contact.email}</p>
        </div>
        <Link href="/email-marketing/campaigns/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Crear campaña</Link>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-7 lg:sticky lg:top-6">
          <section className="rounded-2xl border border-border bg-card/60 p-5">
            <div className="flex items-center justify-between gap-3"><h2 className="font-heading text-lg font-semibold">Estado de marketing</h2><span className="text-xs text-muted-foreground">{statusLabels[contact.subscriptionStatus]}</span></div>
            <dl className="mt-5 space-y-4 text-sm"><div><dt className="text-xs text-muted-foreground">Correo electrónico</dt><dd className="mt-1 break-all">{contact.email}</dd></div><div><dt className="text-xs text-muted-foreground">Teléfono</dt><dd className="mt-1">{contact.phone || "Sin teléfono"}</dd></div><div><dt className="text-xs text-muted-foreground">Consentimiento</dt><dd className="mt-1">{contact.consentedAt ? contact.consentedAt.toLocaleDateString("es-MX") : "Sin consentimiento registrado"}</dd></div></dl>
            {contact.subscriptionStatus === "pending" ? <p className="mt-5 text-xs leading-5 text-muted-foreground">Este contacto no recibe campañas hasta registrar consentimiento.</p> : null}
          </section>

          <section className="rounded-2xl border border-border bg-card/60 p-5">
            <div className="flex items-center justify-between gap-3"><h2 className="font-heading text-lg font-semibold">Etiquetas</h2><span className="text-xs text-muted-foreground">{detail.tags.length}</span></div>
            <div className="mt-4 flex flex-wrap gap-2">{detail.tags.length ? detail.tags.map((tag) => <span key={tag.id} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs">{tag.name}<form action={removeEmailContactTagAction}><input type="hidden" name="contactId" value={contact.id} /><input type="hidden" name="tagId" value={tag.id} /><button type="submit" aria-label={`Quitar etiqueta ${tag.name}`} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X size={12} /></button></form></span>) : <p className="text-sm text-muted-foreground">Aún no tiene etiquetas.</p>}</div>
             {showTagPicker ? <form action={assignEmailContactTagAction} className="mt-4 flex gap-2"><input type="hidden" name="contactId" value={contact.id} /><label className="min-w-0 flex-1"><span className="sr-only">Agregar etiqueta</span><Select name="tagId" required defaultValue=""><SelectTrigger className="h-10 w-full"><SelectValue placeholder="Elegí una etiqueta" /></SelectTrigger><SelectContent>{tags.filter((tag) => !detail.tags.some((assigned) => assigned.id === tag.id)).map((tag) => <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>)}</SelectContent></Select></label><button type="submit" aria-label="Agregar etiqueta" className="inline-flex size-10 items-center justify-center rounded-lg border border-border hover:bg-muted"><Plus size={16} /></button></form> : <button type="button" onClick={() => setShowTagPicker(true)} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><Plus size={15} />Añadir una etiqueta</button>}
          </section>
        </aside>

        <section className="min-w-0 border-t border-border lg:border-t-0">
          <nav className="flex gap-1 overflow-x-auto border-b border-border py-2" aria-label="Secciones del perfil">{([['overview', 'Resumen'], ['information', 'Información'], ['notes', 'Notas'], ['preferences', 'Preferencias']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`min-h-10 whitespace-nowrap rounded-lg px-3 text-sm transition-colors ${tab === value ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>{label}</button>)}</nav>
          {tab === "overview" ? <div className="space-y-7 py-6"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Actividad</p><h2 className="mt-2 font-heading text-2xl font-semibold">Resumen del contacto</h2></div><div className="grid gap-5 border-b border-border pb-6 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Eventos asociados</p><p className="mt-2 text-2xl font-semibold">{detail.events.length}</p></div><div><p className="text-xs text-muted-foreground">Fuente</p><p className="mt-2 text-sm font-medium">{sourceLabel}</p></div><div><p className="text-xs text-muted-foreground">Creado</p><p className="mt-2 text-sm font-medium">{contact.createdAt.toLocaleDateString("es-MX")}</p></div></div><div><p className="font-medium">Actividad registrada</p>{detail.events.length ? <div className="mt-4 space-y-3">{detail.events.map((event) => <div key={`${event.eventId}-${event.firstSeenAt.toISOString()}`} className="border-t border-border pt-3 text-sm first:border-t-0 first:pt-0"><p className="font-medium">Registro asociado a un evento</p><p className="mt-1 text-xs text-muted-foreground">Primera relación {event.firstSeenAt.toLocaleDateString("es-MX")} · Última actualización {event.lastSeenAt.toLocaleDateString("es-MX")}</p></div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">No hay actividad de eventos registrada todavía.</p>}</div></div> : null}
          {tab === "information" ? <form action={action} className="space-y-5 py-6"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Datos del contacto</p><h2 className="mt-2 font-heading text-2xl font-semibold">Información editable</h2><p className="mt-2 text-sm text-muted-foreground">Editar estos datos no cambia el consentimiento ni reactiva una baja.</p></div><input type="hidden" name="contactId" value={contact.id} /><input type="hidden" name="tag" value="" /><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium sm:col-span-2">Email<input name="email" type="email" defaultValue={contact.email} required className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label><label className="block text-sm font-medium">Nombre completo<input name="fullName" defaultValue={contact.fullName ?? ""} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label><label className="block text-sm font-medium">Empresa<input name="company" defaultValue={contact.company ?? ""} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label><label className="block text-sm font-medium">Teléfono<input name="phone" defaultValue={contact.phone ?? ""} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label></div><div className="flex items-center gap-3 border-t border-border pt-4"><button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{pending ? "Guardando…" : "Guardar cambios"}</button>{state.success ? <p role="status" className="text-sm text-accent"><Check size={14} className="mr-1 inline" />{state.success}</p> : null}{state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}</div></form> : null}
          {tab === "notes" ? <div className="py-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Notas internas</p><h2 className="mt-2 font-heading text-2xl font-semibold">Notas</h2><div className="mt-6 border-t border-border pt-5"><p className="font-medium">Notas todavía no configuradas</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Esta sección queda reservada para notas internas con autor, fecha e historial de cambios.</p></div></div> : null}
          {tab === "preferences" ? <div className="space-y-5 py-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Preferencias</p><h2 className="mt-2 font-heading text-2xl font-semibold">Estado de comunicaciones</h2><div className="border-t border-border pt-5"><p className="font-medium">{statusLabels[contact.subscriptionStatus]}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Las bajas y supresiones se respetan en todas las campañas. El cambio de datos personales nunca modifica este estado.</p></div></div> : null}
        </section>
      </div>
    </main>
  );
}
