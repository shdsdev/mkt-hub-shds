"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerForEventAction, type RegisterFormState } from "./actions";

const initialState: RegisterFormState = {};

type Companion = { id: number };

export function RegisterForm({
  slug,
  collectCompany,
  collectJobTitle,
  utm,
}: {
  slug: string;
  collectCompany: boolean;
  collectJobTitle: boolean;
  utm: Partial<{
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    utmTerm: string;
    utmContent: string;
    utmId: string;
  }>;
}) {
  const [state, formAction, pending] = useActionState(registerForEventAction, initialState);
  const [companions, setCompanions] = useState<Companion[]>([]);
  let nextCompanionId = companions.length > 0 ? Math.max(...companions.map((c) => c.id)) + 1 : 0;

  if (state.success) {
    return (
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        <h2 className="font-heading font-medium">
          {state.status === "waitlisted" ? "Quedaste en lista de espera" : "¡Registro confirmado!"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {state.status === "waitlisted"
            ? "El evento está a capacidad. Te avisaremos por correo si se libera un lugar."
            : "Te enviamos un correo con tu pase de acceso y código de respaldo."}
        </p>
      </section>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <input type="hidden" name="slug" value={slug} />
      {utm.utmSource ? <input type="hidden" name="utmSource" value={utm.utmSource} /> : null}
      {utm.utmMedium ? <input type="hidden" name="utmMedium" value={utm.utmMedium} /> : null}
      {utm.utmCampaign ? <input type="hidden" name="utmCampaign" value={utm.utmCampaign} /> : null}
      {utm.utmTerm ? <input type="hidden" name="utmTerm" value={utm.utmTerm} /> : null}
      {utm.utmContent ? <input type="hidden" name="utmContent" value={utm.utmContent} /> : null}
      {utm.utmId ? <input type="hidden" name="utmId" value={utm.utmId} /> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Nombre completo
          <Input name="fullName" required maxLength={255} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Correo
          <Input name="email" type="email" required maxLength={255} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Teléfono (opcional)
          <Input name="phone" maxLength={50} />
        </label>
        {collectCompany ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Empresa
            <Input name="company" maxLength={255} />
          </label>
        ) : null}
        {collectJobTitle ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Puesto
            <Input name="jobTitle" maxLength={255} />
          </label>
        ) : null}
      </div>

      {companions.map((companion) => (
        <div key={companion.id} className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Nombre del acompañante
            <Input name="companionFullName" maxLength={255} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Correo del acompañante
            <Input name="companionEmail" type="email" maxLength={255} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Teléfono (opcional)
            <Input name="companionPhone" maxLength={50} />
          </label>
          {collectCompany ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Empresa
              <Input name="companionCompany" maxLength={255} />
            </label>
          ) : null}
          {collectJobTitle ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Puesto
              <Input name="companionJobTitle" maxLength={255} />
            </label>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="sm:col-span-2"
            onClick={() => setCompanions((prev) => prev.filter((c) => c.id !== companion.id))}
          >
            Quitar acompañante
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        onClick={() => setCompanions((prev) => [...prev, { id: nextCompanionId++ }])}
      >
        Agregar acompañante
      </Button>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Registrando…" : "Registrarme"}
        </Button>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
