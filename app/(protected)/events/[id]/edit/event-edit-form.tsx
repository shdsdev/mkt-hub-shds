"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EventRow, RegistrationFormConfig } from "@/modules/events";
import {
  updateEventAction,
  publishEventAction,
  closeEventAction,
  type EventFormState,
} from "../../actions";
import { EventImageUpload } from "../../event-image-upload";
import { AgendaEditor } from "../../agenda-editor";
import { SponsorLogosEditor } from "../../sponsor-logos-editor";
import { WebhookSettings } from "./webhook-settings";
import { EmbedSettings } from "./embed-settings";

const initialState: EventFormState = {};

// `datetime-local` inputs need "YYYY-MM-DDTHH:mm", not `Date#toISOString()`'s trailing "Z"/millis.
function toDateTimeLocal(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventEditForm({
  event,
  formConfig: initialFormConfig,
  embedUrl,
  embedSnippet,
}: {
  event: EventRow;
  formConfig: RegistrationFormConfig;
  embedUrl: string;
  embedSnippet: string;
}) {
  const [state, formAction, pending] = useActionState(updateEventAction, initialState);
  // spec.md "Fixed Optional Field Catalog" — seeded from the event's current toggle state.
  const [formConfig, setFormConfig] = useState<RegistrationFormConfig>(initialFormConfig);
  const [heroImageUrl, setHeroImageUrl] = useState<string | undefined>(event.heroImageUrl ?? undefined);

  function updateField(field: "phone" | "company" | "jobTitle", key: "visible" | "required", value: boolean) {
    setFormConfig((current) => ({
      ...current,
      fields: {
        ...current.fields,
        [field]: {
          ...current.fields[field],
          [key]: key === "required" ? value && current.fields[field].visible : value,
          ...(key === "visible" && !value ? { required: false } : {}),
        },
      },
    }));
  }

  function updateOptionGroup(group: "clientBrands" | "interests", option: string, enabled: boolean) {
    setFormConfig((current) => ({
      ...current,
      [group]: {
        ...current[group],
        options: enabled
          ? [...current[group].options, option]
          : current[group].options.filter((value) => value !== option),
      },
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={event.id} />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Nombre
          <Input name="name" defaultValue={event.name} maxLength={255} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Inicio
          <Input name="startsAt" type="datetime-local" defaultValue={toDateTimeLocal(event.startsAt)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Fin (opcional)
          <Input name="endsAt" type="datetime-local" defaultValue={toDateTimeLocal(event.endsAt)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Ubicación (opcional)
          <Input name="location" defaultValue={event.location ?? ""} maxLength={255} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Capacidad (opcional, vacío = ilimitada)
          <Input name="capacity" type="number" min={1} defaultValue={event.capacity ?? ""} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Recordatorio (minutos antes, opcional)
          <Input
            name="reminderOffsetMinutes"
            type="number"
            min={0}
            defaultValue={event.reminderOffsetMinutes ?? ""}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
          Descripción (opcional)
          <textarea
            name="description"
            defaultValue={event.description ?? ""}
            maxLength={5000}
            className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
          Imagen de portada (opcional)
          <EventImageUpload
            organizationId={event.organizationId}
            label="Subir imagen"
            value={heroImageUrl}
            onUploaded={setHeroImageUrl}
          />
          <input type="hidden" name="heroImageUrl" value={heroImageUrl ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <AgendaEditor initial={event.agenda} />
        </div>
        <div className="sm:col-span-2">
          <SponsorLogosEditor organizationId={event.organizationId} initial={event.sponsorLogos} />
        </div>
        <div className="flex flex-col gap-4 rounded-md border border-border p-4 sm:col-span-2">
          <div>
            <p className="text-sm font-medium">Configuración del formulario de registro</p>
            <p className="text-xs text-muted-foreground">Definí qué datos solicita este evento y cuáles son obligatorios.</p>
          </div>
          <input type="hidden" name="registrationFormConfig" value={JSON.stringify(formConfig)} />
          <input type="hidden" name="collectCompany" value={formConfig.fields.company.visible ? "true" : ""} />
          <input type="hidden" name="collectJobTitle" value={formConfig.fields.jobTitle.visible ? "true" : ""} />
          <div className="grid gap-2 sm:grid-cols-3">
            <p className="text-xs font-medium">Campo</p>
            <p className="text-xs font-medium">Mostrar</p>
            <p className="text-xs font-medium">Obligatorio</p>
            <p className="text-sm">Nombre completo</p>
            <p className="text-xs text-muted-foreground">Siempre visible</p>
            <p className="text-xs text-muted-foreground">Siempre obligatorio</p>
            <p className="text-sm">Correo electrónico</p>
            <p className="text-xs text-muted-foreground">Siempre visible</p>
            <p className="text-xs text-muted-foreground">Siempre obligatorio</p>
            {(["phone", "company", "jobTitle"] as const).map((field) => {
              const labels = { phone: "Teléfono", company: "Empresa", jobTitle: "Puesto" };
              return (
                <div key={field} className="contents">
                  <p className="text-sm">{labels[field]}</p>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formConfig.fields[field].visible}
                      onChange={(e) => updateField(field, "visible", e.target.checked)}
                    />
                    Mostrar
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formConfig.fields[field].required}
                      disabled={!formConfig.fields[field].visible}
                      onChange={(e) => updateField(field, "required", e.target.checked)}
                    />
                    Obligatorio
                  </label>
                </div>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formConfig.companion.enabled}
              onChange={(e) => setFormConfig((current) => ({ ...current, companion: { enabled: e.target.checked } }))}
            />
            Permitir un acompañante
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Cliente / marca</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formConfig.clientBrands.enabled}
                onChange={(e) => setFormConfig((current) => ({ ...current, clientBrands: { ...current.clientBrands, enabled: e.target.checked } }))}
              />
              Mostrar selección de marca
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["shades", "bmighty", "drapery"] as const).map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formConfig.clientBrands.options.includes(option)}
                    disabled={!formConfig.clientBrands.enabled}
                    onChange={(e) => updateOptionGroup("clientBrands", option, e.target.checked)}
                  />
                  {option === "bmighty" ? "BMighty" : option[0].toUpperCase() + option.slice(1)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Intereses</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formConfig.interests.enabled}
                onChange={(e) => setFormConfig((current) => ({ ...current, interests: { ...current.interests, enabled: e.target.checked } }))}
              />
              Mostrar intereses
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ["battery-motors", "Motores de baterías"],
                ["wifi-automation", "Motores WiFi y automatización"],
                ["curtains", "Cortinería"],
                ["manual-and-motorized-rods", "Cortineros manuales y motorizados"],
              ] as const).map(([option, label]) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formConfig.interests.options.includes(option)}
                    disabled={!formConfig.interests.enabled}
                    onChange={(e) => updateOptionGroup("interests", option, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Texto de privacidad
              <Input value={formConfig.consent.privacy.text} onChange={(e) => setFormConfig((current) => ({ ...current, consent: { ...current.consent, privacy: { ...current.consent.privacy, text: e.target.value } } }))} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              URL de privacidad
              <Input value={formConfig.consent.privacy.url} onChange={(e) => setFormConfig((current) => ({ ...current, consent: { ...current.consent, privacy: { ...current.consent.privacy, url: e.target.value } } }))} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Texto de términos
              <Input value={formConfig.consent.terms.text} onChange={(e) => setFormConfig((current) => ({ ...current, consent: { ...current.consent, terms: { ...current.consent.terms, text: e.target.value } } }))} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              URL de términos
              <Input value={formConfig.consent.terms.url} onChange={(e) => setFormConfig((current) => ({ ...current, consent: { ...current.consent, terms: { ...current.consent.terms, url: e.target.value } } }))} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formConfig.consent.marketing.enabled}
              onChange={(e) => setFormConfig((current) => ({ ...current, consent: { ...current.consent, marketing: { ...current.consent.marketing, enabled: e.target.checked } } }))}
            />
            Solicitar consentimiento para comunicaciones comerciales
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Texto de comunicaciones comerciales
            <Input value={formConfig.consent.marketing.text} onChange={(e) => setFormConfig((current) => ({ ...current, consent: { ...current.consent, marketing: { ...current.consent.marketing, text: e.target.value } } }))} />
          </label>
        </div>
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
        {state.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}
        {state.success ? (
          <p className="text-sm text-muted-foreground sm:col-span-2">{state.success}</p>
        ) : null}
      </form>

      <div className="flex gap-3">
        {event.status !== "published" ? (
          <form action={publishEventAction}>
            <input type="hidden" name="id" value={event.id} />
            <Button type="submit" variant="secondary">
              Publicar
            </Button>
          </form>
        ) : null}
        {event.status !== "closed" ? (
          <form
            action={closeEventAction}
            onSubmit={(e) => {
              // User feedback: "la landing se despublica a cada rato" — a plain click next to
              // "Guardar cambios" was likely the cause, not a code bug (no duplicate rows, no
              // code path flips status on save). This confirm is the mitigation.
              if (!confirm("¿Cerrar este evento? Dejará de aceptar nuevos registros.")) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={event.id} />
            <Button type="submit" variant="outline">
              Cerrar
            </Button>
          </form>
        ) : null}
      </div>

      <WebhookSettings
        eventId={event.id}
        webhookUrl={event.webhookUrl}
        webhookSecret={event.webhookSecret}
      />

      <EmbedSettings embedUrl={embedUrl} embedSnippet={embedSnippet} />
    </div>
  );
}
