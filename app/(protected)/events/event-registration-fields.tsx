"use client";

import { Checkbox } from "@/components/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RegistrationFieldRenderer } from "@/components/registration-field-renderer";
import { useState } from "react";
import type { ClientBrandOption, RegistrationCustomField, RegistrationFormConfig } from "@/modules/events";
import { toggleClientBrandOption } from "@/lib/events/registration-form-ui";
import {
  addCustomField,
  moveCustomField,
  removeCustomField,
  updateCustomField,
  type CustomFieldType,
} from "./registration-field-builder";

type RegistrationField = "phone" | "company" | "jobTitle" | "state";
type OptionGroup = "clientBrands" | "interests";

const customFieldTypes: readonly [CustomFieldType, string][] = [
  ["short_text", "Texto corto"],
  ["long_text", "Texto largo"],
  ["number", "Número"],
  ["email", "Correo electrónico"],
  ["phone", "Teléfono"],
  ["date", "Fecha"],
  ["checkbox", "Casilla de verificación"],
  ["select", "Selección única"],
  ["select_multiple", "Selección múltiple"],
];

export function EventRegistrationFields({
  initialFormConfig,
}: {
  initialFormConfig: RegistrationFormConfig;
}) {
  const [formConfig, setFormConfig] = useState(initialFormConfig);
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>("short_text");

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
        options: group === "clientBrands"
          ? toggleClientBrandOption(current.clientBrands.options, option as ClientBrandOption, enabled)
          : enabled
            ? [...current[group].options, option]
            : current[group].options.filter((value) => value !== option),
      },
    }));
  }

  function updateCustomFieldState(id: string, changes: Partial<RegistrationCustomField>) {
    setFormConfig((current) => ({
      ...current,
      customFields: updateCustomField(current.customFields, id, changes),
    }));
  }

  function addField() {
    setFormConfig((current) => ({
      ...current,
      customFields: addCustomField(current.customFields, newFieldType),
    }));
  }

  function addOption(field: RegistrationCustomField & { options: { value: string; label: string }[] }) {
    updateCustomFieldState(field.id, {
      options: [...field.options, { value: `option-${field.options.length + 1}`, label: `Opción ${field.options.length + 1}` }],
    });
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
        {(["phone", "company", "jobTitle", "state"] as const).map((field) => {
          const labels = { phone: "Teléfono", company: "Empresa", jobTitle: "Puesto", state: "Estado" };
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
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-background/60 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold">Campos personalizados</h3>
            <p className="text-xs text-muted-foreground">Agregá preguntas para el titular del registro.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={newFieldType} onValueChange={(value) => { if (value) setNewFieldType(value as CustomFieldType); }}>
              <SelectTrigger className="w-full sm:w-52" aria-label="Tipo de campo nuevo">
                <SelectValue>{customFieldTypes.find(([value]) => value === newFieldType)?.[1]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {customFieldTypes.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={addField}>Agregar campo</Button>
          </div>
        </div>
        {formConfig.customFields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Todavía no agregaste campos personalizados.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {formConfig.customFields.map((field, index) => (
              <article key={field.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        Etiqueta
                        <Input value={field.label} onChange={(event) => updateCustomFieldState(field.id, { label: event.target.value })} />
                      </label>
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        Ayuda
                        <Input value={field.description} onChange={(event) => updateCustomFieldState(field.id, { description: event.target.value })} />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      <Checkbox checked={field.enabled} onChange={(checked) => updateCustomFieldState(field.id, { enabled: checked, required: checked ? field.required : false })} label="Activo" />
                      <Checkbox checked={field.required} disabled={!field.enabled} onChange={(checked) => updateCustomFieldState(field.id, { required: checked })} label="Obligatorio" />
                      <Select
                        value={field.section}
                        onValueChange={(value) => {
                          if (value === "personal" || value === "preferences") {
                            updateCustomFieldState(field.id, { section: value });
                          }
                        }}
                      >
                        <SelectTrigger className="h-9 w-full sm:w-48" aria-label={`Sección de ${field.label}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="personal">Tus datos</SelectItem>
                          <SelectItem value="preferences">Preferencias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {field.type === "number" ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1.5 text-sm font-medium">Mínimo<Input type="number" value={field.min ?? ""} onChange={(event) => updateCustomFieldState(field.id, { min: event.target.value ? Number(event.target.value) : undefined })} /></label>
                        <label className="flex flex-col gap-1.5 text-sm font-medium">Máximo<Input type="number" value={field.max ?? ""} onChange={(event) => updateCustomFieldState(field.id, { max: event.target.value ? Number(event.target.value) : undefined })} /></label>
                      </div>
                    ) : null}
                    {field.type === "checkbox" ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1.5 text-sm font-medium">Texto del enlace<Input value={field.link?.text ?? ""} onChange={(event) => updateCustomFieldState(field.id, { link: { url: field.link?.url ?? "/", text: event.target.value } })} /></label>
                        <label className="flex flex-col gap-1.5 text-sm font-medium">URL del enlace<Input value={field.link?.url ?? ""} onChange={(event) => updateCustomFieldState(field.id, { link: { url: event.target.value, text: field.link?.text ?? "Ver información" } })} /></label>
                      </div>
                    ) : null}
                    {field.type === "select" || field.type === "select_multiple" ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">Opciones</p><Button type="button" variant="ghost" size="sm" onClick={() => addOption(field)}>Agregar opción</Button></div>
                        {field.options.map((option, optionIndex) => (
                          <div key={`${field.id}-${optionIndex}`} className="grid gap-2 sm:grid-cols-2">
                            <Input aria-label={`Valor de opción ${optionIndex + 1}`} value={option.value} onChange={(event) => updateCustomFieldState(field.id, { options: field.options.map((current, index) => index === optionIndex ? { ...current, value: event.target.value } : current) })} />
                            <Input aria-label={`Etiqueta de opción ${optionIndex + 1}`} value={option.label} onChange={(event) => updateCustomFieldState(field.id, { options: field.options.map((current, index) => index === optionIndex ? { ...current, label: event.target.value } : current) })} />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => setFormConfig((current) => ({ ...current, customFields: moveCustomField(current.customFields, field.id, index - 1) }))}>Subir</Button>
                    <Button type="button" variant="ghost" size="sm" disabled={index === formConfig.customFields.length - 1} onClick={() => setFormConfig((current) => ({ ...current, customFields: moveCustomField(current.customFields, field.id, index + 1) }))}>Bajar</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setFormConfig((current) => ({ ...current, customFields: removeCustomField(current.customFields, field.id) }))}>Eliminar</Button>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-dashed border-border p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Vista previa</p>
                  <RegistrationFieldRenderer field={field} disabled />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
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
