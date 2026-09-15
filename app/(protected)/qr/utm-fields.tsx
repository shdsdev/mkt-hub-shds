"use client";

import { useMemo, useState } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/checkbox";
import type { UtmPreset } from "@/modules/utm";

export type UtmFieldsState = {
  source: string;
  medium: string;
  campaign: string;
};

const COMMON_SOURCES = ["instagram", "facebook", "google", "tiktok", "whatsapp", "email", "youtube"];
const COMMON_MEDIUMS = ["social", "cpc", "email", "organic", "referral", "banner", "affiliate"];

// Step 3 ("Datos") of the website QR wizard, shown only when "Agregar etiquetas UTM" is checked.
// - Preset picker: SelectValue needs a function-as-children to resolve the preset's name from its
//   id (same bug/fix as GroupSelect — base-ui's default value-echo only works when the item's
//   `value` equals its display text, which an id never does).
// - source/medium/campaign are plain inputs backed by a <datalist> of common values plus every
//   value already used in this org's own presets, so suggestions grow from real usage while still
//   accepting free text for anything not listed.
// - "Guardar como preajuste UTM" mirrors the QR design template pattern: a local checkbox + name
//   field, submitted as hidden inputs the server action reads (saveUtmAsPreset/utmPresetName) and
//   turns into a real preset alongside QR creation.
export function UtmFields({
  presets,
  state,
  onChange,
}: {
  presets: UtmPreset[];
  state: UtmFieldsState;
  onChange: (next: Partial<UtmFieldsState>) => void;
}) {
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [presetName, setPresetName] = useState("");

  const sourceOptions = useMemo(
    () => Array.from(new Set([...COMMON_SOURCES, ...presets.map((p) => p.utmSource)])),
    [presets],
  );
  const mediumOptions = useMemo(
    () => Array.from(new Set([...COMMON_MEDIUMS, ...presets.map((p) => p.utmMedium)])),
    [presets],
  );
  const campaignOptions = useMemo(() => Array.from(new Set(presets.map((p) => p.utmCampaign))), [presets]);

  function applyPreset(presetId: string) {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    onChange({ source: preset.utmSource, medium: preset.utmMedium, campaign: preset.utmCampaign });
  }

  const canSaveAsPreset = Boolean(state.source.trim() && state.medium.trim() && state.campaign.trim());

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      {presets.length > 0 && (
        <Select defaultValue={null} onValueChange={(value) => value && applyPreset(value)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {(value: string | null) => (value ? (presets.find((p) => p.id === value)?.name ?? "Elige un preajuste…") : "Elige un preajuste…")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {presets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}

      <div className="grid grid-cols-3 gap-2">
        <input
          name="utmSource"
          list="utm-source-options"
          value={state.source}
          onChange={(event) => onChange({ source: event.target.value })}
          placeholder="utm_source"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          name="utmMedium"
          list="utm-medium-options"
          value={state.medium}
          onChange={(event) => onChange({ medium: event.target.value })}
          placeholder="utm_medium"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          name="utmCampaign"
          list="utm-campaign-options"
          value={state.campaign}
          onChange={(event) => onChange({ campaign: event.target.value })}
          placeholder="utm_campaign"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <datalist id="utm-source-options">
        {sourceOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <datalist id="utm-medium-options">
        {mediumOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <datalist id="utm-campaign-options">
        {campaignOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

      {canSaveAsPreset && (
        <div className="space-y-1 border-t border-border pt-2">
          <Checkbox checked={saveAsPreset} onChange={setSaveAsPreset} label="Guardar como preajuste UTM" />
          {saveAsPreset && (
            <input
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="Nombre del preajuste"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          )}
        </div>
      )}
      <input type="hidden" name="saveUtmAsPreset" value={saveAsPreset ? "true" : ""} />
      <input type="hidden" name="utmPresetName" value={presetName} />
    </div>
  );
}
