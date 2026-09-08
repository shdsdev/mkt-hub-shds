"use client";

import { useActionState, useRef } from "react";
import type { UtmPreset } from "@/modules/utm";
import { createLinkAction, type CreateLinkFormState } from "./actions";

const initialState: CreateLinkFormState = {};

export function LinkForm({ presets }: { presets: UtmPreset[] }) {
  const [state, formAction, pending] = useActionState(createLinkAction, initialState);
  const sourceRef = useRef<HTMLInputElement>(null);
  const mediumRef = useRef<HTMLInputElement>(null);
  const campaignRef = useRef<HTMLInputElement>(null);

  function applyPreset(presetId: string) {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    if (sourceRef.current) sourceRef.current.value = preset.utmSource;
    if (mediumRef.current) mediumRef.current.value = preset.utmMedium;
    if (campaignRef.current) campaignRef.current.value = preset.utmCampaign;
  }

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <h2 className="font-heading font-medium">New link</h2>

      <div className="space-y-1">
        <label htmlFor="destinationUrl" className="text-sm text-muted-foreground">
          Destination URL
        </label>
        <input
          id="destinationUrl"
          name="destinationUrl"
          type="url"
          required
          placeholder="https://example.com/page"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {presets.length > 0 && (
        <div className="space-y-1">
          <label htmlFor="preset" className="text-sm text-muted-foreground">
            UTM preset (fills the fields below — still editable)
          </label>
          <select
            id="preset"
            onChange={(event) => applyPreset(event.target.value)}
            defaultValue=""
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Choose a preset…
            </option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <input
          ref={sourceRef}
          name="utmSource"
          placeholder="utm_source"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          ref={mediumRef}
          name="utmMedium"
          placeholder="utm_medium"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          ref={campaignRef}
          name="utmCampaign"
          placeholder="utm_campaign"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create link"}
      </button>
    </form>
  );
}
