"use client";

import { useActionState, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { createEventAction, type EventFormState } from "./actions";
import { EventBasicFields } from "./event-basic-fields";
import { EventRegistrationFields } from "./event-registration-fields";
import { getOptionalDateTimeError } from "@/lib/events/event-date-time";
import type { RegistrationFormConfig } from "@/modules/events";

const initialState: EventFormState = {};

type Phase = 1 | 2 | 3;
type Review = {
  name?: string;
  slug?: string;
  startsAt?: string;
  endsAt?: string;
  location?: string;
  locationUrl?: string;
  capacity?: string;
  registrationFormConfig?: RegistrationFormConfig;
};

const registrationFieldLabels = {
  phone: "Teléfono",
  company: "Empresa",
  jobTitle: "Puesto",
} as const;

const brandLabels = {
  shades: "Shades",
  bmighty: "BMighty",
  drapery: "Drapery",
} as const;

const interestLabels = {
  "battery-motors": "Motores de baterías",
  "wifi-automation": "Motores WiFi y automatización",
  curtains: "Cortinería",
  "manual-and-motorized-rods": "Cortineros manuales y motorizados",
} as const;

function formatReviewDate(value: string) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function EventCreateForm({
  initialFormConfig,
}: {
  initialFormConfig: RegistrationFormConfig;
}) {
  const [state, formAction, pending] = useActionState(createEventAction, initialState);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>(1);
  const [review, setReview] = useState<Review>({});
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function close(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setPhase(1);
      setReview({});
      setDirty(false);
    }
  }

  function requestClose(nextOpen: boolean) {
    if (nextOpen || !dirty || window.confirm("¿Querés descartar los datos del evento?")) {
      close(nextOpen);
    }
  }

  function snapshotForm() {
    if (!formRef.current) return {};
    const formData = new FormData(formRef.current);
    const values = Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)]));
    let registrationFormConfig: RegistrationFormConfig | undefined;
    try {
      registrationFormConfig = JSON.parse(values.registrationFormConfig ?? "") as RegistrationFormConfig;
    } catch {
      registrationFormConfig = undefined;
    }
    return { ...values, registrationFormConfig } as Review;
  }

  function goNext() {
    const form = formRef.current;
    if (!form) return;
    if (phase === 1) {
      const endError = getOptionalDateTimeError(
        String(formDataValue(form, "endDate")),
        String(formDataValue(form, "endTime")),
      );
      if (endError) {
        form.querySelector<HTMLInputElement>('input[name="endDate"]')?.focus();
        return;
      }
      if (!form.reportValidity()) return;
    }
    setReview(snapshotForm());
    setPhase((current) => (current + 1) as Phase);
  }

  return (
    <Dialog.Root open={open} onOpenChange={requestClose}>
      <Dialog.Trigger render={<Button type="button" />}>Crear evento</Dialog.Trigger>
      <Dialog.Portal>
         <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
         <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-2xl bg-popover p-4 text-popover-foreground shadow-2xl sm:p-6">
          <Dialog.Title className="font-heading text-lg font-semibold">Crear evento</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Configurá lo esencial, el formulario de registro y revisá todo antes de crear.
          </Dialog.Description>
          <div className="mt-5 border-b border-border pb-3 text-xs text-muted-foreground" aria-label="Progreso del asistente">
            <p className="font-medium text-foreground">Paso {phase} de 3</p>
            <ol className="mt-2 grid grid-cols-3 gap-2">
              {(["Datos esenciales", "Registro", "Revisar y crear"] as const).map((label, index) => {
                const step = index + 1;
                return (
                  <li key={label} className={step === phase ? "font-semibold text-foreground" : undefined}>
                    <span className="block min-w-0 whitespace-normal text-center leading-tight">{step}. {label}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          <form
            ref={formRef}
            action={formAction}
            onInput={() => setDirty(true)}
            onChange={() => setDirty(true)}
            onSubmit={(event) => {
              const formData = new FormData(event.currentTarget);
              if (getOptionalDateTimeError(String(formData.get("endDate") ?? ""), String(formData.get("endTime") ?? ""))) {
                event.preventDefault();
              }
            }}
            className="mt-5 flex flex-col gap-5"
          >
            <section hidden={phase !== 1} aria-hidden={phase !== 1}>
              <h3 className="mb-3 font-medium">Datos esenciales</h3>
              <EventBasicFields autoSlug />
            </section>
            <section hidden={phase !== 2} aria-hidden={phase !== 2}>
              <h3 className="mb-3 font-medium">Formulario de registro</h3>
              <EventRegistrationFields initialFormConfig={initialFormConfig} />
            </section>
            <section hidden={phase !== 3} aria-hidden={phase !== 3}>
              <h3 className="font-medium">Revisá los datos antes de crear el evento</h3>
              <dl className="mt-4 grid gap-3 rounded-lg border border-border bg-background p-4 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Nombre</dt><dd className="font-medium">{review.name || "Sin nombre"}</dd></div>
                <div><dt className="text-muted-foreground">Slug</dt><dd className="font-medium">{review.slug || "Sin slug"}</dd></div>
                <div><dt className="text-muted-foreground">Inicio</dt><dd>{formatReviewDate(review.startsAt ?? "")}</dd></div>
                <div><dt className="text-muted-foreground">Finalización</dt><dd>{formatReviewDate(review.endsAt ?? "")}</dd></div>
                <div><dt className="text-muted-foreground">Ubicación</dt><dd>{review.location || "Sin ubicación"}</dd></div>
                <div><dt className="text-muted-foreground">Maps</dt><dd className="break-all">{review.locationUrl || "Sin enlace"}</dd></div>
                <div><dt className="text-muted-foreground">Capacidad</dt><dd>{review.capacity || "Sin límite"}</dd></div>
                <RegistrationReview config={review.registrationFormConfig ?? initialFormConfig} />
              </dl>
            </section>
            {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={() => phase === 1 ? requestClose(false) : setPhase((current) => (current - 1) as Phase)}>
                {phase === 1 ? "Cancelar" : "Atrás"}
              </Button>
              {phase < 3 ? (
                <Button type="button" onClick={goNext}>Siguiente</Button>
              ) : (
                <Button type="submit" disabled={pending}>{pending ? "Creando…" : "Crear evento"}</Button>
              )}
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RegistrationReview({ config }: { config: RegistrationFormConfig }) {
  const optionalFields = (Object.keys(registrationFieldLabels) as Array<keyof typeof registrationFieldLabels>)
    .filter((field) => config.fields[field].visible)
    .map((field) => `${registrationFieldLabels[field]}${config.fields[field].required ? " (obligatorio)" : ""}`);
  const brands = config.clientBrands.enabled
    ? config.clientBrands.options.map((brand) => brand === "none" ? "Ninguna" : brandLabels[brand]).join(", ") || "Sin marcas seleccionadas"
    : "No se solicita";
  const interests = config.interests.enabled
    ? config.interests.options.map((interest) => interestLabels[interest]).join(", ") || "Sin intereses seleccionados"
    : "No se solicitan";
  const consents = ["Privacidad", "Términos", ...(config.consent.marketing.enabled ? ["Comunicaciones comerciales"] : [])].join(" y ");

  return (
    <>
      <div><dt className="text-muted-foreground">Campos opcionales</dt><dd>{optionalFields.join(", ") || "Ninguno"}</dd></div>
      <div><dt className="text-muted-foreground">Acompañante</dt><dd>{config.companion.enabled ? "Permitido" : "No permitido"}</dd></div>
      <div><dt className="text-muted-foreground">Marcas</dt><dd>{brands}</dd></div>
      <div><dt className="text-muted-foreground">Intereses</dt><dd>{interests}</dd></div>
      <div><dt className="text-muted-foreground">Consentimiento</dt><dd>{consents}</dd></div>
    </>
  );
}

function formDataValue(form: HTMLFormElement, name: string) {
  return form.elements.namedItem(name) instanceof HTMLInputElement
    ? (form.elements.namedItem(name) as HTMLInputElement).value
    : "";
}
