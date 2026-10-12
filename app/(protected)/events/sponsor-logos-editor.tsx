"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SponsorLogo } from "@/modules/events";
import { EventImageUpload } from "./event-image-upload";

export function SponsorLogosEditor({
  organizationId,
  initial,
}: {
  organizationId: string;
  initial: SponsorLogo[];
}) {
  const [items, setItems] = useState<SponsorLogo[]>(initial);

  function update(index: number, patch: Partial<SponsorLogo>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Logos de sponsors</p>
      <input type="hidden" name="sponsorLogos" value={JSON.stringify(items)} />
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <EventImageUpload
            organizationId={organizationId}
            label="Subir logo"
            value={item.url}
            onUploaded={(url) => update(index, { url: url ?? "" })}
          />
          <Input
            value={item.name ?? ""}
            onChange={(e) => update(index, { name: e.target.value })}
            placeholder="Nombre (opcional)"
            className="max-w-48"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
          >
            Quitar
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => setItems((prev) => [...prev, { url: "" }])}
      >
        Agregar sponsor
      </Button>
    </div>
  );
}
