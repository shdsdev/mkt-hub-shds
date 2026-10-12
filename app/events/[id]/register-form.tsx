"use client";

import { useActionState, useState } from "react";
import { registerForEventAction, type RegisterFormState } from "./actions";

const initialState: RegisterFormState = {};

type Companion = { id: number };

// This surface's own input vocabulary — soft white fields on the pastel ground, not the dark
// admin theme's <Input> (craft-floor: "a stock component inside a committed form is a lapse").
const fieldClass =
  "w-full rounded-2xl border border-[#201D1A]/12 bg-white px-4 py-3 text-base text-[#201D1A] placeholder:text-[#9B968C] outline-none transition-shadow focus:border-[#9F84C9]/60 focus:ring-4 focus:ring-[#9F84C9]/15";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-[#4A4740]">
      {label}
      {children}
    </label>
  );
}

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
      <section className="flex flex-col items-start gap-2 rounded-[2rem] border border-[#201D1A]/10 bg-white/80 p-8 backdrop-blur-sm">
        <h2 className="font-display text-2xl italic">
          {state.status === "waitlisted" ? "Quedaste en lista de espera" : "¡Registro confirmado!"}
        </h2>
        <p className="text-[#4A4740]">
          {state.status === "waitlisted"
            ? "El evento está a capacidad. Te avisaremos por correo si se libera un lugar."
            : "Te enviamos un correo con tu pase de acceso y código de respaldo."}
        </p>
      </section>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-6 rounded-[2rem] border border-[#201D1A]/10 bg-white/80 p-8 backdrop-blur-sm"
    >
      <h2 className="font-display text-2xl italic">Reserva tu lugar</h2>

      <input type="hidden" name="slug" value={slug} />
      {utm.utmSource ? <input type="hidden" name="utmSource" value={utm.utmSource} /> : null}
      {utm.utmMedium ? <input type="hidden" name="utmMedium" value={utm.utmMedium} /> : null}
      {utm.utmCampaign ? <input type="hidden" name="utmCampaign" value={utm.utmCampaign} /> : null}
      {utm.utmTerm ? <input type="hidden" name="utmTerm" value={utm.utmTerm} /> : null}
      {utm.utmContent ? <input type="hidden" name="utmContent" value={utm.utmContent} /> : null}
      {utm.utmId ? <input type="hidden" name="utmId" value={utm.utmId} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre completo">
          <input name="fullName" required maxLength={255} className={fieldClass} />
        </Field>
        <Field label="Correo">
          <input name="email" type="email" required maxLength={255} className={fieldClass} />
        </Field>
        <Field label="Teléfono (opcional)">
          <input name="phone" maxLength={50} className={fieldClass} />
        </Field>
        {collectCompany ? (
          <Field label="Empresa">
            <input name="company" maxLength={255} className={fieldClass} />
          </Field>
        ) : null}
        {collectJobTitle ? (
          <Field label="Puesto">
            <input name="jobTitle" maxLength={255} className={fieldClass} />
          </Field>
        ) : null}
      </div>

      {companions.map((companion) => (
        <div
          key={companion.id}
          className="grid grid-cols-1 gap-4 border-t border-[#201D1A]/10 pt-6 sm:grid-cols-2"
        >
          <Field label="Nombre del acompañante">
            <input name="companionFullName" maxLength={255} className={fieldClass} />
          </Field>
          <Field label="Correo del acompañante">
            <input name="companionEmail" type="email" maxLength={255} className={fieldClass} />
          </Field>
          <Field label="Teléfono (opcional)">
            <input name="companionPhone" maxLength={50} className={fieldClass} />
          </Field>
          {collectCompany ? (
            <Field label="Empresa">
              <input name="companionCompany" maxLength={255} className={fieldClass} />
            </Field>
          ) : null}
          {collectJobTitle ? (
            <Field label="Puesto">
              <input name="companionJobTitle" maxLength={255} className={fieldClass} />
            </Field>
          ) : null}
          <button
            type="button"
            className="self-start text-sm text-[#6B6A63] underline underline-offset-2 hover:text-[#201D1A] sm:col-span-2"
            onClick={() => setCompanions((prev) => prev.filter((c) => c.id !== companion.id))}
          >
            Quitar acompañante
          </button>
        </div>
      ))}

      <button
        type="button"
        className="self-start rounded-full border border-[#201D1A]/15 px-5 py-2 text-sm font-medium text-[#4A4740] transition-colors hover:bg-[#201D1A]/5"
        onClick={() => setCompanions((prev) => [...prev, { id: nextCompanionId++ }])}
      >
        + Agregar acompañante
      </button>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#201D1A] px-7 py-3.5 text-base font-medium text-[#FBF7F1] transition-colors hover:bg-[#3A3530] disabled:opacity-60"
        >
          {pending ? "Registrando…" : "Registrarme"}
        </button>
      </div>
      {state.error ? <p className="text-sm text-[#C2577B]">{state.error}</p> : null}
    </form>
  );
}
