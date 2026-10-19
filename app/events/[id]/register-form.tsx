"use client";

import { useActionState, useRef, useState } from "react";
import { MEXICAN_STATES } from "@/lib/events/mexican-states";
import type { ClientBrandOption, RegistrationFormConfig } from "@/modules/events";
import { getPublicClientBrandOptions, toggleClientBrandOption } from "@/lib/events/registration-form-ui";
import { Tooltip } from "@/components/tooltip";
import { RegistrationFieldRenderer } from "@/components/registration-field-renderer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getRegistrationFormSteps, type RegistrationStepId } from "@/lib/events/registration-form-steps";
import { registerForEventAction, type RegisterFormState } from "./actions";

const initialState: RegisterFormState = {};
const occupationOptions = [
  ["wholesaler", "Mayorista"],
  ["manufacturer", "Fabricante"],
  ["architect-decorator", "Arquitecto / Decorador"],
  ["installer-technician", "Instalador o técnico"],
] as const;

// Matches the reference's clean white-card world (rounded-card, ring-1 black/5) instead of the
// dark admin theme's <Input> (craft-floor: "a stock component inside a committed form is a
// lapse") — this surface owns its own input vocabulary.
const fieldClass =
  "h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-base text-[#202020] shadow-[0_2px_8px_rgba(0,0,0,0.025)] placeholder:text-[#9a9a9a] outline-none transition-[border-color,box-shadow,transform] focus:border-[#7d66b0]/50 focus:ring-4 focus:ring-[#7d66b0]/10";

const selectClass = `${fieldClass} !h-12`;

const secondaryButtonClass =
  "inline-flex h-11 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-medium text-[#4a4a4a] transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7d66b0]/15";

const primaryButtonClass =
  "inline-flex h-12 items-center justify-center rounded-full bg-[#202020] px-7 text-base font-medium text-white transition-colors hover:bg-[#3a3a3a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7d66b0]/20 disabled:cursor-not-allowed disabled:opacity-60";

const choiceClass =
  "group relative flex min-h-8 cursor-pointer items-center gap-2 text-sm text-[#4a4a4a] transition-colors hover:text-[#202020] has-[:checked]:text-[#202020] has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#7d66b0]/15";

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
  error,
  children,
}: {
  label: string;
  required?: boolean;
  help: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-[#4a4a4a]">
      <span className={`flex items-center gap-1.5 ${error ? "text-[#c0335a]" : ""}`}>
        {label}
        {required ? <span className="ml-1 text-[#c0335a]" aria-hidden="true">•</span> : null}
        <HelpTooltip label={help} />
      </span>
      {children}
      {error ? <span role="alert" className="text-xs font-normal text-[#c0335a]">{error}</span> : null}
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
  const [selectedBrands, setSelectedBrands] = useState<ClientBrandOption[]>(formConfig.clientBrands.options.includes("none") ? ["none"] : []);
  const [mobileStep, setMobileStep] = useState(0);
  const [summaryItems, setSummaryItems] = useState<{ label: string; value: string }[]>([]);
  const [clientFieldErrors, setClientFieldErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const steps = getRegistrationFormSteps(formConfig);
  const activeStepId = steps[mobileStep]?.id ?? steps[steps.length - 1].id;
  const personalCustomFields = formConfig.customFields.filter((field) => field.enabled && field.section === "personal");
  const preferenceCustomFields = formConfig.customFields.filter((field) => field.enabled && field.section === "preferences");
  const hasPreferenceStep = steps.some((step) => step.id === "preferences");
  const fieldErrors = { ...clientFieldErrors, ...state.fieldErrors };

  function toggleBrand(brand: string, checked: boolean) {
    setSelectedBrands((current) => toggleClientBrandOption(current, brand as ClientBrandOption, checked));
  }

  function continueMobileStep() {
    const sections = formRef.current
      ? Array.from(formRef.current.querySelectorAll<HTMLElement>(`[data-mobile-step="${activeStepId}"]`))
      : [];
    const invalidControl = sections
      .flatMap((section) => Array.from(section.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select")))
      .find((control) => !control.checkValidity());
    if (invalidControl) {
      setClientFieldErrors((current) => ({ ...current, [invalidControl.name]: "Completá este campo." }));
      invalidControl.reportValidity();
      invalidControl.focus();
      return;
    }
    const nextStep = steps[mobileStep + 1];
    if (nextStep?.id === "confirmation" && formRef.current) {
      const data = new FormData(formRef.current);
      const items: { label: string; value: string }[] = [];
      const addItem = (label: string, name: string) => {
        const values = data.getAll(name).map(String).filter(Boolean);
        if (values.length > 0) items.push({ label, value: values.join(", ") });
      };

      addItem("Nombre", "fullName");
      addItem("Correo", "email");
      addItem("Teléfono", "phone");
      addItem("Empresa", "company");
       addItem("Puesto", "jobTitle");
       addItem("Estado", "state");
      addItem("Ocupación", "occupation");
      formConfig.customFields.filter((field) => field.enabled).forEach((field) => addItem(field.label, field.id));
      addItem("Marcas", "clientBrands");
      addItem("Intereses", "interests");
      addItem("Acompañante", "companionFullName");
      addItem("Correo del acompañante", "companionEmail");
      setSummaryItems(items);
    }
    setClientFieldErrors({});
    setMobileStep((step) => Math.min(steps.length - 1, step + 1));
  }

  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    const invalidControl = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"))
      .find((control) => !control.checkValidity());
    if (!invalidControl) return;
    event.preventDefault();
    setClientFieldErrors((current) => ({ ...current, [invalidControl.name]: "Completá este campo." }));
    invalidControl.reportValidity();
    invalidControl.focus();
  }

  function editStep(stepId: RegistrationStepId) {
    const index = steps.findIndex((step) => step.id === stepId);
    if (index >= 0) setMobileStep(index);
  }

  if (state.success) {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col items-start gap-2 rounded-[20px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/5 sm:p-8">
        <h2 className="font-sans text-xl font-medium tracking-tight">
          {state.status === "pending_review"
            ? "Tu solicitud fue recibida"
            : state.status === "waitlisted"
              ? "Quedaste en lista de espera"
              : "¡Registro confirmado!"}
        </h2>
        <p className="text-[#4a4a4a]">
          {state.status === "pending_review"
            ? "Nuestro equipo revisará tu solicitud. Si es aprobada, recibirás por correo la confirmación y tu llave de acceso."
            : state.status === "waitlisted"
              ? "Gracias por tu interés. El cupo está lleno y quedaste en lista de espera. Te comunicaremos si se libera una plaza."
              : "Te enviamos un correo con tu pase de acceso y código de respaldo."}
        </p>
      </section>
    );
  }

  return (
    <form
      action={formAction}
      ref={formRef}
      onSubmit={handleFormSubmit}
      className="mx-auto flex w-full max-w-2xl flex-col gap-8 rounded-[20px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/5 sm:p-8"
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

      <div className="flex flex-col gap-3 sm:hidden" aria-label="Progreso del formulario">
        <div className="flex items-center justify-between gap-2 text-xs text-[#6b6b6b]">
          <span>Paso {mobileStep + 1} de {steps.length}</span>
          <span className="font-medium text-[#202020]">{steps[mobileStep].label}</span>
        </div>
        <div className="flex gap-1" aria-hidden="true">
          {steps.map((step, index) => (
            <span key={step.id} className={`h-1 flex-1 rounded-full transition-colors ${index <= mobileStep ? "bg-[#202020]" : "bg-black/10"}`} />
          ))}
        </div>
      </div>

      <div data-mobile-step="personal" className={`${activeStepId === "personal" ? "block" : "hidden"} flex flex-col gap-4 sm:block`}>
      <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
          <Field label="Nombre completo" required error={fieldErrors.fullName} help="Usá tu nombre completo tal como aparece en tu identificación.">
           <input name="fullName" required aria-required="true" maxLength={255} placeholder="Ej. María González" className={fieldClass} />
         </Field>
          <Field label="Correo" required error={fieldErrors.email} help="Te enviaremos aquí la confirmación y tu pase de acceso.">
           <input name="email" type="email" required aria-required="true" maxLength={255} placeholder="nombre@empresa.com" className={fieldClass} />
         </Field>
         {formConfig.fields.phone.visible ? (
            <Field label="Teléfono" required={formConfig.fields.phone.required} error={fieldErrors.phone} help="Usaremos este número solo para comunicarnos sobre el evento.">
             <input name="phone" required={formConfig.fields.phone.required} aria-required={formConfig.fields.phone.required} maxLength={50} placeholder="Ej. +52 55 1234 5678" className={fieldClass} />
           </Field>
         ) : null}
         {formConfig.fields.company.visible ? (
            <Field label="Empresa" required={formConfig.fields.company.required} error={fieldErrors.company} help="Indicá la empresa, estudio o negocio con el que trabajás.">
             <input name="company" required={formConfig.fields.company.required} aria-required={formConfig.fields.company.required} maxLength={255} placeholder="Ej. Estudio Norte" className={fieldClass} />
           </Field>
         ) : null}
          {formConfig.fields.jobTitle.visible ? (
            <Field label="Puesto" required={formConfig.fields.jobTitle.required} error={fieldErrors.jobTitle} help="Escribí tu cargo o función dentro de tu empresa.">
             <input name="jobTitle" required={formConfig.fields.jobTitle.required} aria-required={formConfig.fields.jobTitle.required} maxLength={255} placeholder="Ej. Director de compras" className={fieldClass} />
           </Field>
          ) : null}
          {formConfig.fields.state.visible ? (
            <Field label="Estado" required={formConfig.fields.state.required} error={fieldErrors.state} help="Seleccioná el estado de México donde residís.">
              <Select name="state" defaultValue="">
                <SelectTrigger className={selectClass} aria-label="Estado" aria-required={formConfig.fields.state.required}>
                  <SelectValue placeholder="Seleccioná tu estado" />
                </SelectTrigger>
                <SelectContent>
                  {MEXICAN_STATES.map((stateOption) => (
                    <SelectItem key={stateOption.value} value={stateOption.value}>{stateOption.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field label="¿A qué te dedicás profesionalmente?" required error={fieldErrors.occupation} help="Elegí la opción que mejor describe tu actividad profesional.">
            <Select name="occupation" defaultValue="" items={occupationOptions.map(([value, label]) => ({ value, label }))}>
            <SelectTrigger className={selectClass} aria-label="Actividad profesional" aria-required="true"><SelectValue placeholder="Seleccioná una opción" /></SelectTrigger>
              <SelectContent>{occupationOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
         </Field>
        </div>

        {personalCustomFields.length > 0 ? (
          <fieldset className="flex flex-col gap-4 border-t border-black/[0.06] pt-6 sm:mt-4">
            <legend className="text-sm font-medium text-[#4a4a4a]">Información adicional</legend>
            {personalCustomFields.map((field) => <RegistrationFieldRenderer key={field.id} field={field} controlClassName={fieldClass} error={fieldErrors[field.id]} />)}
          </fieldset>
        ) : null}
      </div>

      {hasPreferenceStep ? <>
      <div data-mobile-step="preferences" className={`${activeStepId === "preferences" ? "block" : "hidden"} flex flex-col gap-6 sm:block`}>
        {formConfig.clientBrands.enabled && formConfig.clientBrands.options.length > 0 ? (
           <fieldset className="flex flex-col gap-2">
           <legend className="flex items-center gap-1.5 text-sm font-medium text-[#4a4a4a]">¿Con qué marca trabajás? <HelpTooltip label="Seleccioná las marcas con las que trabajás habitualmente." /></legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {getPublicClientBrandOptions(formConfig.clientBrands.options).map((option) => (
                <label key={option} className={choiceClass}>
                  <input
                    type="checkbox"
                    name="clientBrands"
                    value={option}
                    checked={selectedBrands.includes(option as ClientBrandOption)}
                    disabled={option === "none"
                      ? selectedBrands.some((value) => value !== "none")
                      : selectedBrands.includes("none")}
                    onChange={(event) => toggleBrand(option, event.target.checked)}
                    className={checkboxClass}
                  />
                 <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-black/20 bg-white text-xs font-bold text-white transition-colors peer-checked:border-[#202020] peer-checked:bg-[#202020]" aria-hidden="true">✓</span>
                  {option === "none" ? "Ninguna" : option === "bmighty" ? "BMighty" : option[0].toUpperCase() + option.slice(1)}
               </label>
             ))}
           </div>
         </fieldset>
       ) : null}

        {formConfig.interests.enabled && formConfig.interests.options.length > 0 ? (
         <fieldset className="flex flex-col gap-2">
           <legend className="flex items-center gap-1.5 text-sm font-medium text-[#4a4a4a]">¿Qué temas te interesan? <HelpTooltip label="Seleccioná los temas que querés conocer o profundizar durante el evento." /></legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
       {preferenceCustomFields.length > 0 ? (
          <fieldset className="flex flex-col gap-4 border-t border-black/[0.06] pt-6 sm:mt-4">
           <legend className="text-sm font-medium text-[#4a4a4a]">Información adicional</legend>
            {preferenceCustomFields.map((field) => <RegistrationFieldRenderer key={field.id} field={field} controlClassName={fieldClass} error={fieldErrors[field.id]} />)}
         </fieldset>
       ) : null}
      </div>

       <div data-mobile-step="preferences" className={`${activeStepId === "preferences" ? "block" : "hidden"} flex flex-col gap-6 sm:block`}>
        {hasCompanion ? (
         <div className="grid grid-cols-1 gap-x-5 gap-y-5 border-t border-black/[0.06] pt-8 sm:grid-cols-2">
            <Field label="Nombre del acompañante" required error={fieldErrors.companionFullName} help="Usá el nombre completo de la persona que te acompañará.">
             <input name="companionFullName" required aria-required="true" maxLength={255} placeholder="Ej. Ana López" className={fieldClass} />
           </Field>
            <Field label="Correo del acompañante" required error={fieldErrors.companionEmail} help="Te enviaremos su confirmación y pase de acceso a este correo.">
             <input name="companionEmail" type="email" required aria-required="true" maxLength={255} placeholder="nombre@empresa.com" className={fieldClass} />
           </Field>
           {formConfig.fields.phone.visible ? (
              <Field label="Teléfono del acompañante" required={formConfig.fields.phone.required} error={fieldErrors.companionPhone} help="Usaremos este número solo para comunicarnos sobre el evento.">
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
               <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <Field label="Puesto del acompañante" required={formConfig.fields.jobTitle.required} error={fieldErrors.companionJobTitle} help="Escribí su cargo o función dentro de su empresa.">
               <input name="companionJobTitle" required={formConfig.fields.jobTitle.required} maxLength={255} placeholder="Ej. Director de compras" className={fieldClass} />
             </Field>
           ) : null}
             <Field label="¿A qué se dedica tu acompañante?" required error={fieldErrors.companionOccupation} help="Elegí la opción que mejor describe su actividad profesional.">
              <Select name="companionOccupation" defaultValue="" items={occupationOptions.map(([value, label]) => ({ value, label }))}>
              <SelectTrigger className={selectClass} aria-label="Actividad profesional del acompañante" aria-required="true"><SelectValue placeholder="Seleccioná una opción" /></SelectTrigger>
                <SelectContent>{occupationOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
           <label className="flex cursor-pointer items-center gap-3 text-sm text-[#4a4a4a] sm:col-span-2">
             <input type="checkbox" name="requestMoreCompanions" value="true" className={checkboxClass} />
             <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-black/20 bg-white text-xs font-bold text-white transition-colors peer-checked:border-[#202020] peer-checked:bg-[#202020]" aria-hidden="true">✓</span>
             Quiero agregar más acompañantes
           </label>
           <button
             type="button"
              className="self-start justify-self-start text-sm text-[#6b6b6b] underline underline-offset-2 hover:text-[#202020] sm:col-span-2"
             onClick={() => setHasCompanion(false)}
           >
             Quitar acompañante
           </button>
         </div>
       ) : null}

       {formConfig.companion.enabled && !hasCompanion ? (
         <button
           type="button"
            className={secondaryButtonClass}
           onClick={() => setHasCompanion(true)}
         >
           + Agregar acompañante
         </button>
       ) : null}
      </div>
      </> : null}

      <div data-mobile-step="confirmation" className={`${activeStepId === "confirmation" ? "block" : "hidden"} flex flex-col gap-6 sm:block`}>
        {summaryItems.length > 0 ? (
          <section className="flex flex-col gap-4 border-b border-black/[0.06] pb-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-[#202020]">Revisá tu información</h3>
              <button type="button" className="text-sm text-[#6b6b6b] underline underline-offset-2 hover:text-[#202020]" onClick={() => editStep("personal")}>Editar</button>
            </div>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {summaryItems.map((item) => (
                <div key={`${item.label}-${item.value}`} className="min-w-0">
                  <dt className="text-xs text-[#6b6b6b]">{item.label}</dt>
                  <dd className="truncate text-[#202020]">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        <div className="flex flex-col gap-3 border-t border-black/[0.06] pt-8 text-sm text-[#4a4a4a]">
          <label className={`flex cursor-pointer items-start gap-3 ${fieldErrors.privacyAccepted ? "text-[#c0335a]" : ""}`}>
           <input type="checkbox" name="privacyAccepted" value="true" required aria-required="true" className={checkboxClass} />
           <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-black/20 bg-white text-xs font-bold text-white transition-colors peer-checked:border-[#202020] peer-checked:bg-[#202020]" aria-hidden="true">✓</span>
           <span><a href={formConfig.consent.privacy.url} target="_blank" rel="noreferrer" className="underline">{formConfig.consent.privacy.text}</a><span className="ml-1 text-[#c0335a]" aria-hidden="true">•</span></span>
          </label>
          {fieldErrors.privacyAccepted ? <p role="alert" className="-mt-1 ml-8 text-xs text-[#c0335a]">{fieldErrors.privacyAccepted}</p> : null}
          <label className={`flex cursor-pointer items-start gap-3 ${fieldErrors.termsAccepted ? "text-[#c0335a]" : ""}`}>
           <input type="checkbox" name="termsAccepted" value="true" required aria-required="true" className={checkboxClass} />
           <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-black/20 bg-white text-xs font-bold text-white transition-colors peer-checked:border-[#202020] peer-checked:bg-[#202020]" aria-hidden="true">✓</span>
           <span><a href={formConfig.consent.terms.url} target="_blank" rel="noreferrer" className="underline">{formConfig.consent.terms.text}</a><span className="ml-1 text-[#c0335a]" aria-hidden="true">•</span></span>
          </label>
          {fieldErrors.termsAccepted ? <p role="alert" className="-mt-1 ml-8 text-xs text-[#c0335a]">{fieldErrors.termsAccepted}</p> : null}
         {formConfig.consent.marketing.enabled ? (
           <label className="flex cursor-pointer items-start gap-3">
             <input type="checkbox" name="marketingAccepted" value="true" className={checkboxClass} />
             <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-black/20 bg-white text-xs font-bold text-white transition-colors peer-checked:border-[#202020] peer-checked:bg-[#202020]" aria-hidden="true">✓</span>
             <span>{formConfig.consent.marketing.text}</span>
           </label>
         ) : null}
       </div>

        <div className="mt-2">
        <button
          type="submit"
          disabled={pending}
           className={primaryButtonClass}
        >
          {pending ? "Registrando…" : "Registrarme"}
        </button>
       </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:hidden">
        <button
          type="button"
           className={`${secondaryButtonClass} disabled:invisible`}
          disabled={mobileStep === 0}
          onClick={() => setMobileStep((step) => Math.max(0, step - 1))}
        >
          Atrás
        </button>
        {mobileStep < steps.length - 1 ? (
          <button
            type="button"
             className={`${primaryButtonClass} h-11 px-5 text-sm`}
            onClick={continueMobileStep}
          >
            Continuar
          </button>
        ) : null}
      </div>
      {state.error ? <p className="text-sm text-[#c0335a]">{state.error}</p> : null}
    </form>
  );
}
