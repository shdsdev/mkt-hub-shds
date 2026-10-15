"use client";

import { Checkbox } from "@/components/checkbox";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import type { RegistrationFormConfig } from "@/modules/events";

type RegistrationField = "phone" | "company" | "jobTitle";
type OptionGroup = "clientBrands" | "interests";

export function EventRegistrationFields({
  initialFormConfig,
}: {
  initialFormConfig: RegistrationFormConfig;
}) {
  const [formConfig, setFormConfig] = useState(initialFormConfig);

  function updateField(field: RegistrationField, key: "visible" | "required", value: boolean) {
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

  function updateOptionGroup(group: OptionGroup, option: string, enabled: boolean) {
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
    <div className="flex flex-col gap-4 rounded-md border border-border p-4">
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
              <Checkbox
                checked={formConfig.fields[field].visible}
                onChange={(checked) => updateField(field, "visible", checked)}
                label="Mostrar"
              />
              <Checkbox
                checked={formConfig.fields[field].required}
                disabled={!formConfig.fields[field].visible}
                onChange={(checked) => updateField(field, "required", checked)}
                label="Obligatorio"
              />
            </div>
          );
        })}
      </div>
      <Checkbox
        checked={formConfig.companion.enabled}
        onChange={(checked) => setFormConfig((current) => ({ ...current, companion: { enabled: checked } }))}
        label="Permitir un acompañante"
      />
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Cliente / marca</legend>
        <Checkbox
          checked={formConfig.clientBrands.enabled}
          onChange={(checked) => setFormConfig((current) => ({ ...current, clientBrands: { ...current.clientBrands, enabled: checked } }))}
          label="Mostrar selección de marca"
        />
        <div className="grid gap-2 sm:grid-cols-3">
          {(["shades", "bmighty", "drapery"] as const).map((option) => (
            <Checkbox
              key={option}
              checked={formConfig.clientBrands.options.includes(option)}
              disabled={!formConfig.clientBrands.enabled}
              onChange={(checked) => updateOptionGroup("clientBrands", option, checked)}
              label={option === "bmighty" ? "BMighty" : option[0].toUpperCase() + option.slice(1)}
            />
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Intereses</legend>
        <Checkbox
          checked={formConfig.interests.enabled}
          onChange={(checked) => setFormConfig((current) => ({ ...current, interests: { ...current.interests, enabled: checked } }))}
          label="Mostrar intereses"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ["battery-motors", "Motores de baterías"],
            ["wifi-automation", "Motores WiFi y automatización"],
            ["curtains", "Cortinería"],
            ["manual-and-motorized-rods", "Cortineros manuales y motorizados"],
          ] as const).map(([option, label]) => (
            <Checkbox
              key={option}
              checked={formConfig.interests.options.includes(option)}
              disabled={!formConfig.interests.enabled}
              onChange={(checked) => updateOptionGroup("interests", option, checked)}
              label={label}
            />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Texto de privacidad
          <Input value={formConfig.consent.privacy.text} onChange={(event) => setFormConfig((current) => ({ ...current, consent: { ...current.consent, privacy: { ...current.consent.privacy, text: event.target.value } } }))} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          URL de privacidad
          <Input value={formConfig.consent.privacy.url} onChange={(event) => setFormConfig((current) => ({ ...current, consent: { ...current.consent, privacy: { ...current.consent.privacy, url: event.target.value } } }))} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Texto de términos
          <Input value={formConfig.consent.terms.text} onChange={(event) => setFormConfig((current) => ({ ...current, consent: { ...current.consent, terms: { ...current.consent.terms, text: event.target.value } } }))} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          URL de términos
          <Input value={formConfig.consent.terms.url} onChange={(event) => setFormConfig((current) => ({ ...current, consent: { ...current.consent, terms: { ...current.consent.terms, url: event.target.value } } }))} />
        </label>
      </div>
      <Checkbox
        checked={formConfig.consent.marketing.enabled}
        onChange={(checked) => setFormConfig((current) => ({ ...current, consent: { ...current.consent, marketing: { ...current.consent.marketing, enabled: checked } } }))}
        label="Solicitar consentimiento para comunicaciones comerciales"
      />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Texto de comunicaciones comerciales
        <Input value={formConfig.consent.marketing.text} onChange={(event) => setFormConfig((current) => ({ ...current, consent: { ...current.consent, marketing: { ...current.consent.marketing, text: event.target.value } } }))} />
      </label>
    </div>
  );
}
