"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RegistrationWithAttendees } from "@/modules/events";
import { addInternalCompanionAction, searchInternalRegistrationAction, updatePrimaryAttendeeAction } from "./actions";

const occupations = [
  ["distributor", "Distribuidor/a"],
  ["manufacturer", "Fabricante"],
  ["architect", "Arquitecto/a"],
  ["decorator", "Decorador/a"],
  ["installer-technician", "Instalador/a o técnico/a"],
] as const;

export function InternalRegistrationForm({ eventId }: { eventId: string }) {
  const [query, setQuery] = useState("");
  const [registration, setRegistration] = useState<RegistrationWithAttendees>();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

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

  async function mutate(action: (data: FormData) => Promise<{ error?: string; registration?: RegistrationWithAttendees }>, form: HTMLFormElement) {
    setPending(true);
    const result = await action(new FormData(form));
    setPending(false);
    setMessage(result.error);
  }

  const primary = registration?.attendees[0];

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={search} className="flex gap-2">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, correo o folio" />
        <Button type="submit" disabled={pending || !query.trim()}>Buscar</Button>
      </form>
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      {registration && primary ? (
        <div className="flex flex-col gap-6">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-heading font-medium">Registro encontrado</h2>
            <p className="mt-1 text-sm text-muted-foreground">{registration.attendees.length} asistente(s) · Estado: {registration.status}</p>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void mutate(updatePrimaryAttendeeAction, event.currentTarget); }}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="registrationId" value={registration.id} />
              <Input name="fullName" defaultValue={primary.fullName} placeholder="Nombre completo" required />
              <Input name="email" type="email" defaultValue={primary.email} placeholder="Correo" required />
              <Input name="phone" defaultValue={primary.phone ?? ""} placeholder="Teléfono" />
              <Input name="company" defaultValue={primary.company ?? ""} placeholder="Empresa" />
              <Input name="jobTitle" defaultValue={primary.jobTitle ?? ""} placeholder="Puesto" />
              <Select name="occupation" defaultValue={primary.occupation ?? "installer-technician"}>
                <SelectTrigger><SelectValue placeholder="Actividad profesional" /></SelectTrigger>
                <SelectContent>{occupations.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="submit" variant="outline" disabled={pending}>Guardar titular</Button>
            </form>
          </section>
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-heading font-medium">Agregar acompañante</h2>
            <p className="mt-1 text-sm text-muted-foreground">Esta alta no aplica el límite público del evento.</p>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void mutate(addInternalCompanionAction, event.currentTarget); }}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="registrationId" value={registration.id} />
              <Input name="fullName" placeholder="Nombre completo" required />
              <Input name="email" type="email" placeholder="Correo" required />
              <Input name="phone" placeholder="Teléfono" />
              <Input name="company" placeholder="Empresa" />
              <Input name="jobTitle" placeholder="Puesto" />
              <Select name="occupation" defaultValue="installer-technician">
                <SelectTrigger><SelectValue placeholder="Actividad profesional" /></SelectTrigger>
                <SelectContent>{occupations.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="submit" disabled={pending}>Agregar acompañante</Button>
            </form>
          </section>
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-heading font-medium">Acompañantes actuales</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">{registration.attendees.slice(1).map((attendee) => <li key={attendee.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2"><span>{attendee.fullName}</span><span className="font-mono text-xs text-muted-foreground">{attendee.backupCode}</span></li>)}</ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
