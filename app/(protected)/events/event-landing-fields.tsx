"use client";

import { EventImageUpload } from "./event-image-upload";
import { AgendaEditor } from "./agenda-editor";
import { SponsorLogosEditor } from "./sponsor-logos-editor";
import type { AgendaItem, SponsorLogo } from "@/modules/events";

export function EventLandingFields({
  organizationId,
  agenda,
  sponsorLogos,
  heroImageUrl,
  onHeroImageUrlChange,
  description,
}: {
  organizationId: string;
  agenda: AgendaItem[];
  sponsorLogos: SponsorLogo[];
  heroImageUrl?: string;
  onHeroImageUrlChange: (url: string | undefined) => void;
  description?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex flex-col gap-1.5 text-sm font-medium">
        Imagen de portada (opcional)
        <EventImageUpload
          organizationId={organizationId}
          label="Subir imagen"
          value={heroImageUrl}
          onUploaded={onHeroImageUrlChange}
        />
        <input type="hidden" name="heroImageUrl" value={heroImageUrl ?? ""} />
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Descripción (opcional)
        <textarea
          name="description"
          defaultValue={description ?? ""}
          maxLength={5000}
          className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </label>
      <AgendaEditor initial={agenda} />
      <SponsorLogosEditor organizationId={organizationId} initial={sponsorLogos} />
    </div>
  );
}
