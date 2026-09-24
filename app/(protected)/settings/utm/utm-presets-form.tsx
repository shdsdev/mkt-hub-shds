"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide";
import type { UtmPreset } from "@/modules/utm";
import { createUtmPresetAction, deleteUtmPresetAction } from "../actions";
import { BinaryLoader } from "@/components/binary-loader";
import { HoverMorphIcon } from "@/components/hover-morph-icon";

const createInitialState: { error?: string } = {};
const deleteInitialState: { error?: string } = {};

export function UtmPresetsForm({ presets }: { presets: UtmPreset[] }) {
  const [createState, createFormAction, createPending] = useActionState(
    createUtmPresetAction,
    createInitialState,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteUtmPresetAction,
    deleteInitialState,
  );

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
            <label htmlFor="utm-source" className="text-xs text-muted-foreground uppercase">
              Source
            </label>
            <input
              id="utm-source"
              name="utmSource"
              required
              placeholder="Ej. instagram"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="utm-medium" className="text-xs text-muted-foreground uppercase">
              Medium
            </label>
            <input
              id="utm-medium"
              name="utmMedium"
              required
              placeholder="Ej. qr"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="utm-campaign" className="text-xs text-muted-foreground uppercase">
              Campaign
            </label>
            <input
              id="utm-campaign"
              name="utmCampaign"
              required
              placeholder="Ej. verano-2026"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="utm-term" className="text-xs text-muted-foreground uppercase">
              Term
            </label>
            <input
              id="utm-term"
              name="utmTerm"
              placeholder="Opcional"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="utm-content" className="text-xs text-muted-foreground uppercase">
              Content
            </label>
            <input
              id="utm-content"
              name="utmContent"
              placeholder="Opcional"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
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
        </div>
      </form>

      <div className="space-y-3">
        <h3 className="font-heading font-medium">Tus plantillas</h3>
        {presets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no guardaste ninguna plantilla.</p>
        ) : (
          <ul className="space-y-2">
            {presets.map((preset) => (
              <li
                key={preset.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{preset.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    source={preset.utmSource} · medium={preset.utmMedium} · campaign={preset.utmCampaign}
                    {preset.utmTerm && ` · term=${preset.utmTerm}`}
                    {preset.utmContent && ` · content=${preset.utmContent}`}
                  </p>
                </div>
                <form action={deleteFormAction}>
                  <input type="hidden" name="id" value={preset.id} />
                  <button
                    type="submit"
                    disabled={deletePending}
                    aria-label={`Eliminar ${preset.name}`}
                    className="rounded-md p-2 text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    {deletePending ? <BinaryLoader /> : <HoverMorphIcon idle={Trash2} active={Trash2} size={16} />}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {deleteState.error && (
          <p role="alert" className="text-sm text-destructive">
            {deleteState.error}
          </p>
        )}
      </div>
    </div>
  );
}
