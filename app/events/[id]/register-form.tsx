"use client";

import { useActionState, useState } from "react";
import { registerForEventAction, type RegisterFormState } from "./actions";

const initialState: RegisterFormState = {};

type Companion = { id: number };

// Matches the reference's clean white-card world (rounded-card, ring-1 black/5) instead of the
// dark admin theme's <Input> (craft-floor: "a stock component inside a committed form is a
// lapse") — this surface owns its own input vocabulary.
const fieldClass =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base text-[#202020] placeholder:text-[#9a9a9a] outline-none transition-shadow focus:border-[#7d66b0]/50 focus:ring-4 focus:ring-[#7d66b0]/10";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-[#4a4a4a]">
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
      <section className="flex flex-col items-start gap-2 rounded-[20px] bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/5">
        <h2 className="font-sans text-xl font-medium tracking-tight">
          {state.status === "waitlisted" ? "Quedaste en lista de espera" : "¡Registro confirmado!"}
        </h2>
        <p className="text-[#4a4a4a]">
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
      className="flex flex-col gap-6 rounded-[20px] bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/5"
    >
      <h2 className="font-sans text-xl font-medium tracking-tight">Reserva tu lugar</h2>

      <input type="hidden" name="slug" value={slug} />
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[10000px] h-px w-px overflow-hidden"
      />
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
          className="grid grid-cols-1 gap-4 border-t border-black/[0.06] pt-6 sm:grid-cols-2"
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
            className="self-start text-sm text-[#6b6b6b] underline underline-offset-2 hover:text-[#202020] sm:col-span-2"
            onClick={() => setCompanions((prev) => prev.filter((c) => c.id !== companion.id))}
          >
            Quitar acompañante
          </button>
        </div>
      ))}

      <button
        type="button"
        className="self-start rounded-full border border-black/10 px-5 py-2 text-sm font-medium text-[#4a4a4a] transition-colors hover:bg-black/[0.03]"
        onClick={() => setCompanions((prev) => [...prev, { id: nextCompanionId++ }])}
      >
        + Agregar acompañante
      </button>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#202020] px-7 py-3.5 text-base font-medium text-white transition-colors hover:bg-[#3a3a3a] disabled:opacity-60"
        >
          {pending ? "Registrando…" : "Registrarme"}
        </button>
      </div>
      {state.error ? <p className="text-sm text-[#c0335a]">{state.error}</p> : null}
    </form>
  );
}
