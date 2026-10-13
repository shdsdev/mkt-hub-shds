"use client";

import { useActionState, useState } from "react";
import type { RegistrationFormConfig } from "@/modules/events";
import { registerForEventAction, type RegisterFormState } from "./actions";

const initialState: RegisterFormState = {};

// Matches the reference's clean white-card world (rounded-card, ring-1 black/5) instead of the
// dark admin theme's <Input> (craft-floor: "a stock component inside a committed form is a
// lapse") — this surface owns its own input vocabulary.
const fieldClass =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base text-[#202020] placeholder:text-[#9a9a9a] outline-none transition-shadow focus:border-[#7d66b0]/50 focus:ring-4 focus:ring-[#7d66b0]/10";

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-[#4a4a4a]">
      <span>
        {label}
        {required ? <span className="ml-1 text-[#c0335a]" aria-hidden="true">•</span> : null}
      </span>
      {children}
    </label>
  );
}

export function RegisterForm({
  slug,
  formConfig,
  utm,
}: {
  slug: string;
  formConfig: RegistrationFormConfig;
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
  const [hasCompanion, setHasCompanion] = useState(false);

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
         <Field label="Nombre completo" required>
           <input name="fullName" required aria-required="true" maxLength={255} className={fieldClass} />
         </Field>
         <Field label="Correo" required>
           <input name="email" type="email" required aria-required="true" maxLength={255} className={fieldClass} />
         </Field>
         {formConfig.fields.phone.visible ? (
           <Field label="Teléfono" required={formConfig.fields.phone.required}>
             <input name="phone" required={formConfig.fields.phone.required} aria-required={formConfig.fields.phone.required} maxLength={50} className={fieldClass} />
           </Field>
         ) : null}
         {formConfig.fields.company.visible ? (
           <Field label="Empresa" required={formConfig.fields.company.required}>
             <input name="company" required={formConfig.fields.company.required} aria-required={formConfig.fields.company.required} maxLength={255} className={fieldClass} />
           </Field>
         ) : null}
         {formConfig.fields.jobTitle.visible ? (
           <Field label="Puesto" required={formConfig.fields.jobTitle.required}>
             <input name="jobTitle" required={formConfig.fields.jobTitle.required} aria-required={formConfig.fields.jobTitle.required} maxLength={255} className={fieldClass} />
           </Field>
         ) : null}
       </div>

       {formConfig.clientBrands.enabled ? (
         <fieldset className="flex flex-col gap-2">
           <legend className="text-sm font-medium text-[#4a4a4a]">¿Con qué marca trabajás?</legend>
           <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
             {formConfig.clientBrands.options.map((option) => (
               <label key={option} className="flex items-center gap-2 text-sm text-[#4a4a4a]">
                 <input type="checkbox" name="clientBrands" value={option} />
                 {option === "bmighty" ? "BMighty" : option[0].toUpperCase() + option.slice(1)}
               </label>
             ))}
           </div>
         </fieldset>
       ) : null}

       {formConfig.interests.enabled ? (
         <fieldset className="flex flex-col gap-2">
           <legend className="text-sm font-medium text-[#4a4a4a]">¿Qué temas te interesan?</legend>
           <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
             {formConfig.interests.options.map((option) => {
               const labels: Record<string, string> = {
                 "battery-motors": "Motores de baterías",
                 "wifi-automation": "Motores WiFi y automatización",
                 curtains: "Cortinería",
                 "manual-and-motorized-rods": "Cortineros manuales y motorizados",
               };
               return (
                 <label key={option} className="flex items-center gap-2 text-sm text-[#4a4a4a]">
                   <input type="checkbox" name="interests" value={option} />
                   {labels[option]}
                 </label>
               );
             })}
           </div>
         </fieldset>
       ) : null}

       {formConfig.companion.enabled ? (
         <label className="flex items-center gap-2 text-sm text-[#4a4a4a]">
           <input type="checkbox" name="requestMoreCompanions" value="true" />
           Quiero agregar más acompañantes
         </label>
       ) : null}

       {hasCompanion ? (
         <div className="grid grid-cols-1 gap-4 border-t border-black/[0.06] pt-6 sm:grid-cols-2">
           <Field label="Nombre del acompañante" required>
             <input name="companionFullName" required aria-required="true" maxLength={255} className={fieldClass} />
           </Field>
           <Field label="Correo del acompañante" required>
             <input name="companionEmail" type="email" required aria-required="true" maxLength={255} className={fieldClass} />
           </Field>
           {formConfig.fields.phone.visible ? (
             <Field label="Teléfono del acompañante" required={formConfig.fields.phone.required}>
               <input name="companionPhone" required={formConfig.fields.phone.required} maxLength={50} className={fieldClass} />
             </Field>
           ) : null}
           <button
             type="button"
             className="self-start text-sm text-[#6b6b6b] underline underline-offset-2 hover:text-[#202020] sm:col-span-2"
             onClick={() => setHasCompanion(false)}
           >
             Quitar acompañante
           </button>
         </div>
       ) : null}

       {formConfig.companion.enabled && !hasCompanion ? (
         <button
           type="button"
           className="self-start rounded-full border border-black/10 px-5 py-2 text-sm font-medium text-[#4a4a4a] transition-colors hover:bg-black/[0.03]"
           onClick={() => setHasCompanion(true)}
         >
           + Agregar acompañante
         </button>
       ) : null}

       <div className="flex flex-col gap-3 border-t border-black/[0.06] pt-6 text-sm text-[#4a4a4a]">
         <label className="flex items-start gap-2">
           <input type="checkbox" name="privacyAccepted" value="true" required aria-required="true" />
           <span><a href={formConfig.consent.privacy.url} target="_blank" rel="noreferrer" className="underline">{formConfig.consent.privacy.text}</a><span className="ml-1 text-[#c0335a]" aria-hidden="true">•</span></span>
         </label>
         <label className="flex items-start gap-2">
           <input type="checkbox" name="termsAccepted" value="true" required aria-required="true" />
           <span><a href={formConfig.consent.terms.url} target="_blank" rel="noreferrer" className="underline">{formConfig.consent.terms.text}</a><span className="ml-1 text-[#c0335a]" aria-hidden="true">•</span></span>
         </label>
         {formConfig.consent.marketing.enabled ? (
           <label className="flex items-start gap-2">
             <input type="checkbox" name="marketingAccepted" value="true" />
             <span>{formConfig.consent.marketing.text}</span>
           </label>
         ) : null}
       </div>

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
