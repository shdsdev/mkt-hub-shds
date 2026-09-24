"use client";

import { useActionState, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { UtmPreset, TaxonomyOption } from "@/modules/utm";
import type { Campaign } from "@/modules/campaigns";
import {
  createUtmPresetAction,
  updateUtmPresetAction,
  deleteUtmPresetAction,
  type CreateUtmPresetFormState,
} from "../actions";
import { BinaryLoader } from "@/components/binary-loader";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type SourceMode = "controlled" | "partner" | "external";
type CustomParamRow = { key: string; value: string };

const createInitialState: CreateUtmPresetFormState = {};

const STATUS_LABEL: Record<string, string> = {
  active: "activa",
  draft: "borrador",
  archived: "archivada",
};

export function groupByCategory(options: TaxonomyOption[]): Array<[string, TaxonomyOption[]]> {
  const map = new Map<string, TaxonomyOption[]>();
  for (const option of options) {
    const group = map.get(option.category) ?? [];
    group.push(option);
    map.set(option.category, group);
  }
  return [...map.entries()];
}

function UtmFieldLabel({
  htmlFor,
  children,
  help,
}: {
  htmlFor?: string;
  children: string;
  help: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="text-xs text-muted-foreground uppercase">
        {children}
      </label>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={`Ayuda sobre ${children}`}
              className="flex size-4 items-center justify-center rounded-full border border-muted-foreground/50 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ?
            </button>
          }
        />
        <TooltipContent side="right" className="max-w-64 leading-relaxed">
          {help}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function UtmPresetsForm({
  presets,
  campaigns,
  sourceOptions,
  mediumOptions,
}: {
  presets: UtmPreset[];
  campaigns: Campaign[];
  sourceOptions: TaxonomyOption[];
  mediumOptions: TaxonomyOption[];
}) {
  const [createState, createFormAction, createPending] = useActionState(
    createUtmPresetAction,
    createInitialState,
  );

  const [sourceMode, setSourceMode] = useState<SourceMode>("controlled");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [status, setStatus] = useState("active");
  const [campaignPrefill, setCampaignPrefill] = useState("");
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [customParams, setCustomParams] = useState<CustomParamRow[]>([]);

  const sourceGroups = useMemo(() => groupByCategory(sourceOptions), [sourceOptions]);
  const mediumGroups = useMemo(() => groupByCategory(mediumOptions), [mediumOptions]);

  const pairingWarning = useMemo(() => {
    if (!source || !medium) return null;
    const sourceOption = sourceOptions.find((option) => option.value === source);
    if (
      sourceOption?.recommendedWith &&
      sourceOption.recommendedWith.length > 0 &&
      !sourceOption.recommendedWith.includes(medium)
    ) {
      return `El source "${source}" no se recomienda con el medium "${medium}".`;
    }
    return null;
  }, [source, medium, sourceOptions]);

  function addCustomParam() {
    setCustomParams((rows) => [...rows, { key: "", value: "" }]);
  }
  function updateCustomParam(index: number, field: keyof CustomParamRow, value: string) {
    setCustomParams((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }
  function removeCustomParam(index: number) {
    setCustomParams((rows) => rows.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6">
      <form
        action={createFormAction}
        className="space-y-4 rounded-lg border border-border bg-card p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="utm-name" className="text-xs text-muted-foreground uppercase">
              Nombre
            </label>
            <input
              id="utm-name"
              name="name"
              required
              placeholder="Ej. Lanzamiento verano"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="utm-status" className="text-xs text-muted-foreground uppercase">
              Estado
            </label>
            <input type="hidden" name="status" value={status} />
            <Select value={status} onValueChange={(value) => setStatus(value ?? "active")}>
              <SelectTrigger id="utm-status" className="w-full bg-background">
                <SelectValue placeholder="Elegí un estado" />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectGroup>
                  <SelectItem value="active">Activa</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="archived">Archivada</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="utm-description" className="text-xs text-muted-foreground uppercase">
              Descripción
            </label>
            <textarea
              id="utm-description"
              name="description"
              rows={2}
              placeholder="Opcional"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <UtmFieldLabel help="¿De dónde llegó la visita? Elegí la plataforma, partner u objeto físico. Ejemplo: instagram o muestrario.">
            Source
          </UtmFieldLabel>
          <div className="flex flex-wrap gap-2">
            {(["controlled", "partner", "external"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setSourceMode(mode);
                  if (mode !== "controlled") setSource("");
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  sourceMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {mode === "controlled" ? "Taxonomía" : mode === "partner" ? "Partner" : "Externo"}
              </button>
            ))}
          </div>
          <input type="hidden" name="sourceMode" value={sourceMode} />
          {sourceMode === "controlled" ? (
            <>
              <input type="hidden" name="utmSource" value={source} />
              <Select value={source} onValueChange={(value) => setSource(value ?? "") }>
                <SelectTrigger aria-label="Elegir un source" className="w-full bg-background">
                  <SelectValue placeholder="Elegí un source…" />
                </SelectTrigger>
                <SelectContent align="start" className="max-h-72">
                  {sourceGroups.map(([category, options]) => (
                    <SelectGroup key={category}>
                      <SelectLabel>{category}</SelectLabel>
                      {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <input
              name="utmSource"
              required
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder={sourceMode === "partner" ? "Ej. mi partner agency" : "Ej. external platform"}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          )}
        </div>

        <div className="space-y-1">
          <UtmFieldLabel htmlFor="utm-medium" help="¿A través de qué tipo de canal llegó? Ejemplo: social, paid_social, email o qr.">
            Medium
          </UtmFieldLabel>
          <input type="hidden" name="utmMedium" value={medium} />
          <Select value={medium} onValueChange={(value) => setMedium(value ?? "") }>
            <SelectTrigger id="utm-medium" className="w-full bg-background">
              <SelectValue placeholder="Elegí un medium…" />
            </SelectTrigger>
            <SelectContent align="start" className="max-h-72">
              {mediumGroups.map(([category, options]) => (
                <SelectGroup key={category}>
                  <SelectLabel>{category}</SelectLabel>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        {pairingWarning && (
          <p role="status" className="text-sm text-amber-600">
            {pairingWarning}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <UtmFieldLabel htmlFor="utm-campaign" help="¿Qué campaña o iniciativa generó la visita? Ejemplo: lanzamiento_verano_2026.">
              Campaign
            </UtmFieldLabel>
            <input
              id="utm-campaign"
              name="utmCampaign"
              required
              value={campaign}
              onChange={(event) => setCampaign(event.target.value)}
              placeholder="Ej. verano_2026"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {campaigns.length > 0 && (
            <div className="space-y-1">
              <label htmlFor="campaign-prefill" className="text-xs text-muted-foreground uppercase">
                Prellenar desde campaña
              </label>
              <Select
                value={campaignPrefill}
                onValueChange={(value) => {
                  const nextValue = value ?? "";
                  setCampaignPrefill(nextValue);
                  if (nextValue) setCampaign(nextValue);
                }}
              >
                <SelectTrigger id="campaign-prefill" className="w-full bg-background">
                  <SelectValue placeholder="Elegí una campaña…" />
                </SelectTrigger>
                <SelectContent align="start" className="max-h-72">
                  <SelectGroup>
                    <SelectLabel>Campañas existentes</SelectLabel>
                    {campaigns.map((campaignOption) => (
                      <SelectItem key={campaignOption.id} value={campaignOption.name}>
                        {campaignOption.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <UtmFieldLabel htmlFor="utm-term" help="Keyword o término de búsqueda, cuando aplique. Ejemplo: cortinas_hotel.">
              Term
            </UtmFieldLabel>
            <input
              id="utm-term"
              name="utmTerm"
              placeholder="Opcional"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <UtmFieldLabel htmlFor="utm-content" help="¿Qué pieza, producto, creativo o ubicación originó el clic? Ejemplo: story o blackout_siena.">
              Content
            </UtmFieldLabel>
            <input
              id="utm-content"
              name="utmContent"
              placeholder="Opcional"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <UtmFieldLabel htmlFor="utm-id" help="Identificador interno de la campaña. Ejemplo: ms26 o promo_sep26.">
              ID
            </UtmFieldLabel>
            <input
              id="utm-id"
              name="utmId"
              placeholder="Opcional"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <UtmFieldLabel help="Datos operativos que no son UTM. Ejemplo: qr_id=qr_000382. No uses claves que empiecen con utm_.">
              Parámetros personalizados
            </UtmFieldLabel>
            <button
              type="button"
              onClick={addCustomParam}
              className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
            >
              <Plus size={14} /> Agregar
            </button>
          </div>
          {customParams.map((row, index) => (
            <div key={index} className="flex gap-2">
              <input
                aria-label={`Clave ${index + 1}`}
                value={row.key}
                onChange={(event) => updateCustomParam(index, "key", event.target.value)}
                placeholder="clave"
                className="w-1/2 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                aria-label={`Valor ${index + 1}`}
                value={row.value}
                onChange={(event) => updateCustomParam(index, "value", event.target.value)}
                placeholder="valor"
                className="w-1/2 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeCustomParam(index)}
                aria-label={`Quitar parámetro ${index + 1}`}
                className="rounded-md p-2 text-muted-foreground hover:text-destructive"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <input type="hidden" name="customParameters" value={JSON.stringify(customParams)} />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={createPending}
            className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground disabled:opacity-50"
          >
            {createPending ? <BinaryLoader /> : "Guardar plantilla"}
          </button>
          {createState.error && (
            <p role="alert" className="text-sm text-destructive">
              {createState.error}
            </p>
          )}
          {createState.success && (
            <p role="status" className="text-sm text-emerald-600">
              {createState.success}
            </p>
          )}
        </div>
      </form>

      <div className="space-y-3">
        <h3 className="font-heading font-medium">Tus plantillas</h3>
        {presets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no guardaste ninguna plantilla.</p>
        ) : (
          <ul className="space-y-2">
            {presets.map((preset) => (
              <li key={preset.id} className="rounded-lg border border-border bg-card p-3">
                {editingPresetId === preset.id ? (
                  <EditUtmPresetForm
                    preset={preset}
                    sourceOptions={sourceOptions}
                    mediumOptions={mediumOptions}
                    onCancel={() => setEditingPresetId(null)}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{preset.name}</p>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {STATUS_LABEL[preset.status]}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    source={preset.utmSource} · medium={preset.utmMedium} · campaign={preset.utmCampaign}
                    {preset.utmTerm && ` · term=${preset.utmTerm}`}
                    {preset.utmContent && ` · content=${preset.utmContent}`}
                    {preset.utmId && ` · id=${preset.utmId}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPresetId(preset.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil data-icon="inline-start" />
                    Editar
                  </button>
                  <form
                    action={deleteUtmPresetAction}
                    onSubmit={(event) => {
                      if (!window.confirm(`¿Eliminar definitivamente la plantilla "${preset.name}"?`)) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="id" value={preset.id} />
                    <button
                      type="submit"
                      aria-label={`Eliminar ${preset.name}`}
                      className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 data-icon="inline-start" />
                      Eliminar
                    </button>
                  </form>
                </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EditUtmPresetForm({
  preset,
  sourceOptions,
  mediumOptions,
  onCancel,
}: {
  preset: UtmPreset;
  sourceOptions: TaxonomyOption[];
  mediumOptions: TaxonomyOption[];
  onCancel: () => void;
}) {
  const [formState, formAction, pending] = useActionState(updateUtmPresetAction, createInitialState);
  const [sourceMode, setSourceMode] = useState<SourceMode>(
    sourceOptions.some((option) => option.value === preset.utmSource) ? "controlled" : "external",
  );
  const [source, setSource] = useState(preset.utmSource);
  const [medium, setMedium] = useState(preset.utmMedium);
  const [status, setStatus] = useState(preset.status);
  const [customParams, setCustomParams] = useState<CustomParamRow[]>(preset.customParameters);
  const sourceGroups = useMemo(() => groupByCategory(sourceOptions), [sourceOptions]);
  const mediumGroups = useMemo(() => groupByCategory(mediumOptions), [mediumOptions]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={preset.id} />
      <input type="hidden" name="sourceMode" value={sourceMode} />
      <input type="hidden" name="utmSource" value={source} />
      <input type="hidden" name="utmMedium" value={medium} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="customParameters" value={JSON.stringify(customParams)} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="name" required defaultValue={preset.name} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <Select value={status} onValueChange={(value) => setStatus((value ?? "active") as typeof status)}>
          <SelectTrigger className="w-full bg-background"><SelectValue /></SelectTrigger>
          <SelectContent align="start"><SelectGroup><SelectItem value="active">Activa</SelectItem><SelectItem value="draft">Borrador</SelectItem><SelectItem value="archived">Archivada</SelectItem></SelectGroup></SelectContent>
        </Select>
        <textarea name="description" defaultValue={preset.description ?? ""} placeholder="Descripción opcional" rows={2} className="sm:col-span-2 rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["controlled", "partner", "external"] as const).map((mode) => (
          <button key={mode} type="button" onClick={() => setSourceMode(mode)} className={sourceMode === mode ? "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground" : "rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"}>
            {mode === "controlled" ? "Taxonomía" : mode === "partner" ? "Partner" : "Externo"}
          </button>
        ))}
      </div>

      {sourceMode === "controlled" ? (
        <Select value={source} onValueChange={(value) => setSource(value ?? "")}>
          <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Elegí un source…" /></SelectTrigger>
          <SelectContent align="start" className="max-h-72">{sourceGroups.map(([category, options]) => <SelectGroup key={category}><SelectLabel>{category}</SelectLabel>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup>)}</SelectContent>
        </Select>
      ) : (
        <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Source personalizado" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
      )}

      <Select value={medium} onValueChange={(value) => setMedium(value ?? "")}>
        <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Elegí un medium…" /></SelectTrigger>
        <SelectContent align="start" className="max-h-72">{mediumGroups.map(([category, options]) => <SelectGroup key={category}><SelectLabel>{category}</SelectLabel>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup>)}</SelectContent>
      </Select>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="utmCampaign" required defaultValue={preset.utmCampaign} placeholder="Campaign" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <input name="utmTerm" defaultValue={preset.utmTerm ?? ""} placeholder="Term opcional" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <input name="utmContent" defaultValue={preset.utmContent ?? ""} placeholder="Content opcional" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <input name="utmId" defaultValue={preset.utmId ?? ""} placeholder="ID opcional" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>

      <div className="flex flex-col gap-2">
        {customParams.map((row, index) => (
          <div key={index} className="flex gap-2">
            <input value={row.key} onChange={(event) => setCustomParams((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value } : item))} placeholder="clave" className="w-1/2 rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <input value={row.value} onChange={(event) => setCustomParams((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} placeholder="valor" className="w-1/2 rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <button type="button" onClick={() => setCustomParams((rows) => rows.filter((_, itemIndex) => itemIndex !== index))} className="rounded-md p-2 text-muted-foreground hover:text-destructive"><X /></button>
          </div>
        ))}
        <button type="button" onClick={() => setCustomParams((rows) => [...rows, { key: "", value: "" }])} className="w-fit rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">Agregar parámetro</button>
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{pending ? <BinaryLoader /> : "Guardar cambios"}</button>
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
        {formState.error && <p role="alert" className="text-sm text-destructive">{formState.error}</p>}
      </div>
    </form>
  );
}
