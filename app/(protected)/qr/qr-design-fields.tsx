"use client";

import { useState } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogoUpload } from "./logo-upload";
import { Checkbox } from "@/components/checkbox";
import { QrShapePicker } from "./qr-shape-picker";
import { ColorField } from "./color-field";
// Type-only — erased at compile time, never pulls the qr module's server-only code (db/sharp/
// jsdom) into this client bundle. See docs/ARCHITECTURE.md "Icons" note on the earlier incident
// this exact mistake caused with a runtime import.
import type { QrDesignTemplateRow, QrShapeType, QrCornerType } from "@/modules/qr";

export type QrDesignFieldsState = {
  backgroundColor: string;
  foregroundColor: string;
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
  logoUrl?: string;
  dotsType: QrShapeType;
  cornersSquareType: QrCornerType;
  cornersDotType: QrCornerType;
};

const SHAPE_OPTIONS: { value: QrShapeType; label: string }[] = [
  { value: "square", label: "Cuadrado" },
  { value: "rounded", label: "Redondeado" },
  { value: "dots", label: "Puntos" },
  { value: "classy", label: "Classy" },
  { value: "classy-rounded", label: "Classy redondeado" },
  { value: "extra-rounded", label: "Extra redondeado" },
];

const CORNER_OPTIONS: { value: QrCornerType; label: string }[] = [
  ...SHAPE_OPTIONS,
  { value: "dot", label: "Punto" },
];

// Step 4 of the wizard ("Diseño"). Presets set logoUrl to a bundled asset instead of uploading —
// same onChange path as LogoUpload's onUploaded. Applying a template overwrites all seven design
// fields at once (copy, not a live link — see docs/superpowers/specs/2026-09-10-qr-design-customization-design.md).
// "Guardar como plantilla" is local state, not part of `state`/`onChange`: the action reads it via
// its own hidden inputs (saveAsTemplate/templateName), independent of the design fields' identity.
export function QrDesignFields({
  organizationId,
  templates,
  state,
  onChange,
  active,
  templateState,
  onTemplateChange,
}: {
  organizationId: string;
  templates: QrDesignTemplateRow[];
  state: QrDesignFieldsState;
  onChange: (next: Partial<QrDesignFieldsState>) => void;
  // Whether this step is currently the visible one — steps stay mounted (hidden, not unmounted)
  // for FormData reasons, but the shape pickers fetch real preview thumbnails from the server and
  // shouldn't do that before the user has actually reached this step.
  active: boolean;
  templateState?: { saveAsTemplate: boolean; templateName: string };
  onTemplateChange?: (next: { saveAsTemplate: boolean; templateName: string }) => void;
}) {
  const [localSaveAsTemplate, setLocalSaveAsTemplate] = useState(false);
  const [localTemplateName, setLocalTemplateName] = useState("");
  const saveAsTemplate = templateState?.saveAsTemplate ?? localSaveAsTemplate;
  const templateName = templateState?.templateName ?? localTemplateName;

  function setTemplate(next: Partial<{ saveAsTemplate: boolean; templateName: string }>) {
    const value = { saveAsTemplate, templateName, ...next };
    if (onTemplateChange) onTemplateChange(value);
    else {
      setLocalSaveAsTemplate(value.saveAsTemplate);
      setLocalTemplateName(value.templateName);
    }
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    onChange({
      backgroundColor: template.backgroundColor,
      foregroundColor: template.foregroundColor,
      errorCorrectionLevel: template.errorCorrectionLevel,
      logoUrl: template.logoUrl ?? undefined,
      dotsType: template.dotsType,
      cornersSquareType: template.cornersSquareType,
      cornersDotType: template.cornersDotType,
    });
  }

  return (
    <>
      {templates.length > 0 && (
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Aplicar plantilla guardada</label>
          <Select defaultValue={null} onValueChange={(value) => value && applyTemplate(value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Elige una plantilla…" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-4">
        <ColorField
          label="Color del código QR"
          name="foregroundColor"
          value={state.foregroundColor}
          onChange={(value) => onChange({ foregroundColor: value })}
        />
        <ColorField
          label="Color del fondo"
          name="backgroundColor"
          value={state.backgroundColor}
          onChange={(value) => onChange({ backgroundColor: value })}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="errorCorrectionLevel" className="text-xs text-muted-foreground">
          Corrección de errores
          {state.logoUrl && " (se usará H automáticamente por el logo)"}
        </label>
        <Select
          name="errorCorrectionLevel"
          value={state.errorCorrectionLevel}
          onValueChange={(value) => {
            if (value) onChange({ errorCorrectionLevel: value as "L" | "M" | "Q" | "H" });
          }}
        >
          <SelectTrigger id="errorCorrectionLevel" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="L">L</SelectItem>
              <SelectItem value="M">M</SelectItem>
              <SelectItem value="Q">Q</SelectItem>
              <SelectItem value="H">H</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">Forma del cuerpo</label>
        <QrShapePicker
          field="dotsType"
          options={SHAPE_OPTIONS}
          value={state.dotsType}
          onChange={(value) => onChange({ dotsType: value })}
          context={state}
          active={active}
        />
        <input type="hidden" name="dotsType" value={state.dotsType} />
      </div>

      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">Forma del marco del ojo</label>
        <QrShapePicker
          field="cornersSquareType"
          options={CORNER_OPTIONS}
          value={state.cornersSquareType}
          onChange={(value) => onChange({ cornersSquareType: value })}
          context={state}
          active={active}
        />
        <input type="hidden" name="cornersSquareType" value={state.cornersSquareType} />
      </div>

      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">Forma del ojo</label>
        <QrShapePicker
          field="cornersDotType"
          options={CORNER_OPTIONS}
          value={state.cornersDotType}
          onChange={(value) => onChange({ cornersDotType: value })}
          context={state}
          active={active}
        />
        <input type="hidden" name="cornersDotType" value={state.cornersDotType} />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Logo</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ logoUrl: "/qr-presets/globe.svg" })}
            className={`rounded-md border px-3 py-2 text-sm ${
              state.logoUrl === "/qr-presets/globe.svg" ? "border-primary" : "border-input"
            }`}
          >
            Usar globo
          </button>
          <button
            type="button"
            onClick={() => onChange({ logoUrl: "/qr-presets/scan-me.svg" })}
            className={`rounded-md border px-3 py-2 text-sm ${
              state.logoUrl === "/qr-presets/scan-me.svg" ? "border-primary" : "border-input"
            }`}
          >
            Usar &quot;SCAN ME&quot;
          </button>
          {state.logoUrl && (
            <button
              type="button"
              onClick={() => onChange({ logoUrl: undefined })}
              className="rounded-md border border-input px-3 py-2 text-sm text-muted-foreground"
            >
              Quitar
            </button>
          )}
        </div>
        {state.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.logoUrl} alt="Logo seleccionado" className="h-12 w-12 rounded border border-border object-contain" />
        )}
        <LogoUpload organizationId={organizationId} onUploaded={(url) => onChange({ logoUrl: url })} />
        <input type="hidden" name="logoUrl" value={state.logoUrl ?? ""} />
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <Checkbox checked={saveAsTemplate} onChange={(checked) => setTemplate({ saveAsTemplate: checked })} label="Guardar como plantilla" />
        {saveAsTemplate && (
          <input
            name="templateName"
            required
            value={templateName}
            onChange={(event) => setTemplate({ templateName: event.target.value })}
            placeholder="Nombre de la plantilla"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        )}
        <input type="hidden" name="saveAsTemplate" value={saveAsTemplate ? "true" : ""} />
      </div>
    </>
  );
}
