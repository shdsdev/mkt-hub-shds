"use client";

import { useActionState } from "react";
import type { UtmPreset } from "@/modules/utm";
import { createUtmPresetAction, type CreateUtmPresetFormState } from "./actions";

const initialState: CreateUtmPresetFormState = {};

export function UtmPresetForm({ presets }: { presets: UtmPreset[] }) {
  const [state, formAction, pending] = useActionState(createUtmPresetAction, initialState);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="font-heading font-medium">Preajustes UTM</h2>

      <ul className="space-y-1 text-sm text-muted-foreground">
        {presets.length === 0 && <li>Aún no hay preajustes.</li>}
        {presets.map((preset) => (
          <li key={preset.id}>
            {preset.name}: {preset.utmSource} / {preset.utmMedium} / {preset.utmCampaign}
          </li>
        ))}
      </ul>

      <form action={formAction} className="grid grid-cols-2 gap-2">
        <input
          name="name"
          placeholder="Nombre del preajuste"
          className="col-span-2 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          name="utmSource"
          placeholder="utm_source"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          name="utmMedium"
          placeholder="utm_medium"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          name="utmCampaign"
          placeholder="utm_campaign"
          className="col-span-2 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="col-span-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar preajuste"}
        </button>
      </form>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}
