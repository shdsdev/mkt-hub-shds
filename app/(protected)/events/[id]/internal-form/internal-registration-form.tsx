"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RegistrationWithAttendees } from "@/modules/events";
import { getOccupationPresentation } from "@/lib/events/occupation-presentation";
import { Tag } from "lucide-react";
import { CompanionAddedDialog, type AddedCompanion } from "../../companion-added-dialog";
import { addInternalCompanionAction, searchInternalRegistrationAction, updatePrimaryAttendeeAction } from "./actions";

const occupations = [
  ["wholesaler", "Mayorista"],
  ["manufacturer", "Fabricante"],
  ["architect-decorator", "Arquitecto / Decorador"],
  ["installer-technician", "Instalador o técnico"],
] as const;

export function InternalRegistrationForm({ eventId, phoneRequired }: { eventId: string; phoneRequired: boolean }) {
  const [query, setQuery] = useState("");
  const [registration, setRegistration] = useState<RegistrationWithAttendees>();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [addedCompanion, setAddedCompanion] = useState<AddedCompanion | null>(null);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const data = new FormData();
    data.set("eventId", eventId);
    data.set("query", query);
    const result = await searchInternalRegistrationAction(data);
    setPending(false);
    setRegistration(result.registration);
    setMessage(result.error);
  }

  async function mutate(action: (data: FormData) => Promise<{ error?: string; registration?: RegistrationWithAttendees; addedCompanion?: AddedCompanion }>, form: HTMLFormElement) {
    setPending(true);
    const result = await action(new FormData(form));
    setPending(false);
    setMessage(result.addedCompanion ? undefined : result.error);
    if (result.addedCompanion) setAddedCompanion(result.addedCompanion);
  }

  const primary = registration?.attendees[0];

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3">
          <h2 className="font-heading text-base font-semibold">Buscar registro</h2>
          <p className="mt-1 text-sm text-muted-foreground">Buscá por nombre, correo o folio.</p>
        </div>
        <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
          <Input aria-label="Buscar registro por nombre, correo o folio" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, correo o folio" />
          <Button type="submit" disabled={pending || !query.trim()} className="bg-[#242424] text-white hover:bg-[#393e41] disabled:bg-[#242424] disabled:text-white">Buscar</Button>
        </form>
      </section>
      {message ? <p role="status" aria-live="polite" className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">{message}</p> : null}
      {registration && primary ? (
        <section>
          <div className="mb-3">
            <h2 className="font-heading text-base font-semibold">Registro encontrado</h2>
            <p className="mt-1 text-sm text-muted-foreground">Editá el titular o gestioná sus acompañantes.</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-4 xl:col-span-2">
              <h2 className="font-heading font-medium">Registro encontrado</h2>
              <p className="mt-1 text-sm text-muted-foreground">{registration.attendees.length} asistente(s) · Estado: {registration.status}</p>
              {primary.occupation ? (() => { const presentation = getOccupationPresentation(primary.occupation); return <span className={`mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.className}`}><Tag className="size-3.5" aria-hidden="true" />{presentation.label}</span>; })() : null}
              <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void mutate(updatePrimaryAttendeeAction, event.currentTarget); }}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="registrationId" value={registration.id} />
                <Input aria-label="Nombre completo del titular" name="fullName" defaultValue={primary.fullName} placeholder="Nombre completo" required />
                <Input aria-label="Correo del titular" name="email" type="email" defaultValue={primary.email} placeholder="Correo" required />
                <Input aria-label="Teléfono del titular" name="phone" defaultValue={primary.phone ?? ""} placeholder="Teléfono" required={phoneRequired} aria-required={phoneRequired} />
                <Input aria-label="Empresa del titular" name="company" defaultValue={primary.company ?? ""} placeholder="Empresa" />
                <Input aria-label="Puesto del titular" name="jobTitle" defaultValue={primary.jobTitle ?? ""} placeholder="Puesto" />
                <Select name="occupation" defaultValue={primary.occupation ?? "installer-technician"}>
                  <SelectTrigger aria-label="Actividad profesional del titular"><SelectValue placeholder="Actividad profesional" /></SelectTrigger>
                  <SelectContent>{occupations.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="submit" variant="outline" disabled={pending}>Guardar titular</Button>
              </form>
            </section>
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-heading font-medium">Agregar acompañante</h2>
              <p className="mt-1 text-sm text-muted-foreground">Esta alta no aplica el límite público del evento.</p>
              <p className="mt-1 text-sm text-muted-foreground">Empresa heredada: {primary.company?.trim() || "No configurada"}</p>
              <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void mutate(addInternalCompanionAction, event.currentTarget); }}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="registrationId" value={registration.id} />
                <Input aria-label="Nombre completo del acompañante" name="fullName" placeholder="Nombre completo" required />
                <Input aria-label="Correo del acompañante" name="email" type="email" placeholder="Correo" required />
                <Input aria-label="Teléfono del acompañante" name="phone" placeholder="Teléfono" required={phoneRequired} aria-required={phoneRequired} />
                <Input aria-label="Puesto del acompañante" name="jobTitle" placeholder="Puesto" />
                <Select name="occupation" defaultValue="installer-technician">
                  <SelectTrigger aria-label="Actividad profesional del acompañante"><SelectValue placeholder="Actividad profesional" /></SelectTrigger>
                  <SelectContent>{occupations.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="submit" disabled={pending}>Agregar acompañante</Button>
              </form>
            </section>
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-heading font-medium">Acompañantes actuales</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm">{registration.attendees.slice(1).map((attendee) => { const presentation = getOccupationPresentation(attendee.occupation); return <li key={attendee.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"><span className="flex min-w-0 flex-wrap items-center gap-2"><span>{attendee.fullName}</span><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${presentation.className}`}><Tag className="size-3" aria-hidden="true" />{presentation.label}</span></span><span className="shrink-0 font-mono text-xs text-muted-foreground">{attendee.backupCode}</span></li>; })}</ul>
            </section>
          </div>
        </section>
      ) : null}
      <CompanionAddedDialog
        open={Boolean(addedCompanion)}
        onOpenChange={(open) => { if (!open) setAddedCompanion(null); }}
        companion={addedCompanion}
      />
    </div>
  );
}
