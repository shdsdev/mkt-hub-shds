"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BinaryLoader } from "@/components/binary-loader";

// Same direct-to-Storage-from-the-browser pattern as app/(protected)/qr/placement-image-upload.tsx,
// pointed at the 'event-landing-images' bucket (drizzle/0019_purple_ultimatum.sql) shared by the
// hero image and every sponsor logo — all small, admin-uploaded, publicly-readable images for the
// same public landing page.
export function EventImageUpload({
  organizationId,
  label,
  value,
  onUploaded,
}: {
  organizationId: string;
  label: string;
  value?: string;
  onUploaded: (url: string | undefined) => void;
}) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    const supabase = createClient();
    const path = `${organizationId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("event-landing-images").upload(path, file);

    if (error) {
      setStatus("error");
      return;
    }

    const { data } = supabase.storage.from("event-landing-images").getPublicUrl(path);
    setStatus("idle");
    onUploaded(data.publicUrl);
  }

  const inputId = `event-image-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="flex items-center gap-2">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local asset
        <img src={value} alt="" className="size-10 rounded-md border border-border object-cover" />
      ) : null}
      <label
        htmlFor={inputId}
        className="cursor-pointer rounded-md border border-input bg-black/25 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-black/35"
      >
        {value ? "Cambiar" : label}
      </label>
      {value ? (
        <button
          type="button"
          onClick={() => onUploaded(undefined)}
          className="text-xs text-muted-foreground underline"
        >
          Quitar
        </button>
      ) : null}
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleChange}
        className="sr-only"
      />
      {status === "uploading" && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <BinaryLoader /> Subiendo…
        </span>
      )}
      {status === "error" && <span className="text-xs text-destructive">Error al subir.</span>}
    </div>
  );
}
