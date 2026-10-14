"use client";

import { useActionState, useState } from "react";
import type { RegistrationFormConfig } from "@/modules/events";
import { Tooltip } from "@/components/tooltip";
import { registerForEventAction, type RegisterFormState } from "./actions";

const initialState: RegisterFormState = {};
const occupationOptions = [
  ["distributor", "Distribuidor/a"],
  ["manufacturer", "Fabricante"],
  ["architect", "Arquitecto/a"],
  ["decorator", "Decorador/a"],
  ["installer-technician", "Instalador/a o técnico/a"],
] as const;

// Matches the reference's clean white-card world (rounded-card, ring-1 black/5) instead of the
// dark admin theme's <Input> (craft-floor: "a stock component inside a committed form is a
// lapse") — this surface owns its own input vocabulary.
const fieldClass =
  "h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-base text-[#202020] shadow-[0_2px_8px_rgba(0,0,0,0.025)] placeholder:text-[#9a9a9a] outline-none transition-[border-color,box-shadow,transform] focus:border-[#7d66b0]/50 focus:ring-4 focus:ring-[#7d66b0]/10";

const choiceClass =
  "group relative flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 text-sm text-[#4a4a4a] shadow-[0_2px_8px_rgba(0,0,0,0.025)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-black/30 hover:shadow-[0_8px_18px_rgba(0,0,0,0.06)] has-[:checked]:border-[#202020] has-[:checked]:bg-[#faf9ff] has-[:checked]:text-[#202020] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#7d66b0]/15";

const checkboxClass =
  "peer sr-only";

function HelpTooltip({ label }: { label: string }) {
  return (
    <Tooltip label={label}>
      <span
        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-black/20 text-[11px] font-bold text-[#6b6b6b]"
        aria-label="Más información"
      >
        ?
      </span>
    </Tooltip>
  );
}

function Field({
  label,
  required = false,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-[#4a4a4a]">
      <span className="flex items-center gap-1.5">
        {label}
        {required ? <span className="ml-1 text-[#c0335a]" aria-hidden="true">•</span> : null}
        <HelpTooltip label={help} />
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
  const [companionCompanyMode, setCompanionCompanyMode] = useState<"same" | "other">("same");
  const [selectedBrands, setSelectedBrands] = useState<string[]>(formConfig.clientBrands.options[0] === "none" ? ["none"] : []);

  function toggleBrand(brand: string, checked: boolean) {
    setSelectedBrands((current) => {
      if (!checked) return current.filter((value) => value !== brand);
      if (brand === "none") return ["none"];
      return [...current.filter((value) => value !== "none" && value !== brand), brand];
    });
  }

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
         <Field label="Nombre completo" required help="Usá tu nombre completo tal como aparece en tu identificación.">
           <input name="fullName" required aria-required="true" maxLength={255} placeholder="Ej. María González" className={fieldClass} />
         </Field>
         <Field label="Correo" required help="Te enviaremos aquí la confirmación y tu pase de acceso.">
           <input name="email" type="email" required aria-required="true" maxLength={255} placeholder="nombre@empresa.com" className={fieldClass} />
         </Field>
         {formConfig.fields.phone.visible ? (
           <Field label="Teléfono" required={formConfig.fields.phone.required} help="Usaremos este número solo para comunicarnos sobre el evento.">
             <input name="phone" required={formConfig.fields.phone.required} aria-required={formConfig.fields.phone.required} maxLength={50} placeholder="Ej. +52 55 1234 5678" className={fieldClass} />
           </Field>
         ) : null}
         {formConfig.fields.company.visible ? (
           <Field label="Empresa" required={formConfig.fields.company.required} help="Indicá la empresa, estudio o negocio con el que trabajás.">
             <input name="company" required={formConfig.fields.company.required} aria-required={formConfig.fields.company.required} maxLength={255} placeholder="Ej. Estudio Norte" className={fieldClass} />
           </Field>
         ) : null}
         {formConfig.fields.jobTitle.visible ? (
           <Field label="Puesto" required={formConfig.fields.jobTitle.required} help="Escribí tu cargo o función dentro de tu empresa.">
             <input name="jobTitle" required={formConfig.fields.jobTitle.required} aria-required={formConfig.fields.jobTitle.required} maxLength={255} placeholder="Ej. Director de compras" className={fieldClass} />
           </Field>
         ) : null}
         <Field label="¿A qué te dedicás profesionalmente?" required help="Elegí la opción que mejor describe tu actividad profesional.">
           <select name="occupation" required aria-required="true" defaultValue="" className={fieldClass}>
             <option value="" disabled>Seleccioná una opción</option>
             {occupationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
           </select>
         </Field>
       </div>

       {formConfig.clientBrands.enabled ? (
           <fieldset className="flex flex-col gap-2">
           <legend className="flex items-center gap-1.5 text-sm font-medium text-[#4a4a4a]">¿Con qué marca trabajás? <HelpTooltip label="Seleccioná las marcas con las que trabajás habitualmente." /></legend>
           <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
             {formConfig.clientBrands.options.filter((option) => option !== "none").map((option) => (
               <label key={option} className={choiceClass}>
                 <input
                   type="checkbox"
                   name="clientBrands"
                   value={option}
                   checked={selectedBrands.includes(option)}
                   onChange={(event) => toggleBrand(option, event.target.checked)}
                   className={checkboxClass}
                 />
                 <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-black/20 bg-white text-xs font-bold text-white transition-colors peer-checked:border-[#202020] peer-checked:bg-[#202020]" aria-hidden="true">✓</span>
                 {option === "bmighty" ? "BMighty" : option[0].toUpperCase() + option.slice(1)}
               </label>
             ))}
           </div>
         </fieldset>
       ) : null}

       {formConfig.interests.enabled ? (
         <fieldset className="flex flex-col gap-2">
           <legend className="flex items-center gap-1.5 text-sm font-medium text-[#4a4a4a]">¿Qué temas te interesan? <HelpTooltip label="Seleccioná los temas que querés conocer o profundizar durante el evento." /></legend>
           <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
             {formConfig.interests.options.map((option) => {
               const labels: Record<string, string> = {
                 "battery-motors": "Motores de baterías",
                 "wifi-automation": "Motores WiFi y automatización",
                 curtains: "Cortinería",
                 "manual-and-motorized-rods": "Cortineros manuales y motorizados",
               };
               return (
                 <label key={option} className={choiceClass}>
                   <input type="checkbox" name="interests" value={option} className={checkboxClass} />
                   <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-black/20 bg-white text-xs font-bold text-white transition-colors peer-checked:border-[#202020] peer-checked:bg-[#202020]" aria-hidden="true">✓</span>
                   {labels[option]}
                 </label>
               );
             })}
           </div>
         </fieldset>
       ) : null}

       {hasCompanion ? (
         <div className="grid grid-cols-1 gap-4 border-t border-black/[0.06] pt-6 sm:grid-cols-2">
           <Field label="Nombre del acompañante" required help="Usá el nombre completo de la persona que te acompañará.">
             <input name="companionFullName" required aria-required="true" maxLength={255} placeholder="Ej. Ana López" className={fieldClass} />
           </Field>
           <Field label="Correo del acompañante" required help="Te enviaremos su confirmación y pase de acceso a este correo.">
             <input name="companionEmail" type="email" required aria-required="true" maxLength={255} placeholder="nombre@empresa.com" className={fieldClass} />
           </Field>
           {formConfig.fields.phone.visible ? (
             <Field label="Teléfono del acompañante" required={formConfig.fields.phone.required} help="Usaremos este número solo para comunicarnos sobre el evento.">
               <input name="companionPhone" required={formConfig.fields.phone.required} maxLength={50} placeholder="Ej. +52 55 1234 5678" className={fieldClass} />
             </Field>
           ) : null}
           {formConfig.fields.company.visible ? (
             <fieldset className="flex flex-col gap-2 sm:col-span-2">
               <legend className="flex items-center gap-1.5 text-sm font-medium text-[#4a4a4a]">
                 Empresa del acompañante
                 {formConfig.fields.company.required ? <span className="ml-1 text-[#c0335a]" aria-hidden="true">•</span> : null}
                 <HelpTooltip label="Indicá la empresa, estudio o negocio con el que trabaja." />
               </legend>
               <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                 <label className={choiceClass}>
                   <input
                     type="radio"
                     name="companionCompanyMode"
                     value="same"
                     checked={companionCompanyMode === "same"}
                     onChange={() => setCompanionCompanyMode("same")}
                     className={checkboxClass}
                   />
                   <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-black/20 bg-white transition-colors after:h-2 after:w-2 after:rounded-full after:bg-white after:opacity-0 after:transition-opacity peer-checked:border-[#202020] peer-checked:bg-[#202020] peer-checked:after:opacity-100" aria-hidden="true" />
                   <span>
                     <span className="block">Misma empresa</span>
                     <span className="block text-xs text-[#6b6b6b]">Se usará la empresa del titular.</span>
                   </span>
                 </label>
                 <label className={choiceClass}>
                   <input
                     type="radio"
                     name="companionCompanyMode"
                     value="other"
                     checked={companionCompanyMode === "other"}
                     onChange={() => setCompanionCompanyMode("other")}
                     className={checkboxClass}
                   />
                   <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-black/20 bg-white transition-colors after:h-2 after:w-2 after:rounded-full after:bg-white after:opacity-0 after:transition-opacity peer-checked:border-[#202020] peer-checked:bg-[#202020] peer-checked:after:opacity-100" aria-hidden="true" />
                   Otra empresa
                 </label>
               </div>
               {companionCompanyMode === "other" ? (
                  <input
                    name="companionCompany"
                    required
                    aria-required="true"
                    aria-label="Empresa alternativa del acompañante"
                    maxLength={255}
                   placeholder="Ej. Estudio Norte"
                   className={fieldClass}
                 />
               ) : null}
             </fieldset>
           ) : null}
           {formConfig.fields.jobTitle.visible ? (
             <Field label="Puesto del acompañante" required={formConfig.fields.jobTitle.required} help="Escribí su cargo o función dentro de su empresa.">
               <input name="companionJobTitle" required={formConfig.fields.jobTitle.required} maxLength={255} placeholder="Ej. Director de compras" className={fieldClass} />
             </Field>
           ) : null}
           <Field label="¿A qué se dedica tu acompañante?" required help="Elegí la opción que mejor describe su actividad profesional.">
             <select name="companionOccupation" required aria-required="true" defaultValue="" className={fieldClass}>
               <option value="" disabled>Seleccioná una opción</option>
               {occupationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
             </select>
           </Field>
           <label className="flex cursor-pointer items-center gap-3 text-sm text-[#4a4a4a] sm:col-span-2">
             <input type="checkbox" name="requestMoreCompanions" value="true" className={checkboxClass} />
             <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-black/20 bg-white text-xs font-bold text-white transition-colors peer-checked:border-[#202020] peer-checked:bg-[#202020]" aria-hidden="true">✓</span>
             Quiero agregar más acompañantes
           </label>
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
         <label className="flex cursor-pointer items-start gap-3">
           <input type="checkbox" name="privacyAccepted" value="true" required aria-required="true" className={checkboxClass} />
           <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-black/20 bg-white text-xs font-bold text-white transition-colors peer-checked:border-[#202020] peer-checked:bg-[#202020]" aria-hidden="true">✓</span>
           <span><a href={formConfig.consent.privacy.url} target="_blank" rel="noreferrer" className="underline">{formConfig.consent.privacy.text}</a><span className="ml-1 text-[#c0335a]" aria-hidden="true">•</span></span>
         </label>
         <label className="flex cursor-pointer items-start gap-3">
           <input type="checkbox" name="termsAccepted" value="true" required aria-required="true" className={checkboxClass} />
           <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-black/20 bg-white text-xs font-bold text-white transition-colors peer-checked:border-[#202020] peer-checked:bg-[#202020]" aria-hidden="true">✓</span>
           <span><a href={formConfig.consent.terms.url} target="_blank" rel="noreferrer" className="underline">{formConfig.consent.terms.text}</a><span className="ml-1 text-[#c0335a]" aria-hidden="true">•</span></span>
         </label>
         {formConfig.consent.marketing.enabled ? (
           <label className="flex cursor-pointer items-start gap-3">
             <input type="checkbox" name="marketingAccepted" value="true" className={checkboxClass} />
             <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-black/20 bg-white text-xs font-bold text-white transition-colors peer-checked:border-[#202020] peer-checked:bg-[#202020]" aria-hidden="true">✓</span>
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
