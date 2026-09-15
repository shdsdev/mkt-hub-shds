"use client";

import { GroupSelect } from "./group-select";
import { PlacementImageUpload } from "./placement-image-upload";
import type { Folder } from "@/modules/links";
import type { Campaign } from "@/modules/campaigns";

export type QrDetailFieldsState = {
  name: string;
  grouping: { folderId?: string; campaignId?: string };
  placementImageUrl?: string;
};

// Step 2 of the wizard ("Detalles") — organizational metadata, not content or design. Hidden
// inputs carry the derived values (grouping, placement image) into the FormData the server action
// reads, same pattern the rest of this form family uses for logoUrl.
export function QrDetailFields({
  organizationId,
  folders,
  campaigns,
  state,
  onChange,
}: {
  organizationId: string;
  folders: Folder[];
  campaigns: Campaign[];
  state: QrDetailFieldsState;
  onChange: (next: Partial<QrDetailFieldsState>) => void;
}) {
  return (
    <>
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm text-muted-foreground">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          required
          value={state.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Ej. Flyer lanzamiento invierno"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">Agrupar en</label>
        <GroupSelect
          folders={folders}
          campaigns={campaigns}
          value={state.grouping}
          onChange={(grouping) => onChange({ grouping })}
        />
        <input type="hidden" name="folderId" value={state.grouping.folderId ?? ""} />
        <input type="hidden" name="campaignId" value={state.grouping.campaignId ?? ""} />
      </div>

      <PlacementImageUpload
        organizationId={organizationId}
        onUploaded={(url) => onChange({ placementImageUrl: url })}
      />
      <input type="hidden" name="placementImageUrl" value={state.placementImageUrl ?? ""} />
    </>
  );
}
