"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BinaryLoader } from "@/components/binary-loader";

// Uploads directly from the browser to Storage, same pattern as LogoUpload — separate bucket
// (qr-placement-images) since this is a photo of where the QR is deployed (a flyer, a magazine
// page), not the logo embedded inside the QR image itself.
export function PlacementImageUpload({
  organizationId,
  onUploaded,
}: {
  organizationId: string;
  onUploaded: (url: string | undefined) => void;
}) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [fileName, setFileName] = useState<string>();

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setFileName(undefined);
      onUploaded(undefined);
      return;
    }
    setFileName(file.name);

    setStatus("uploading");
    const supabase = createClient();
    const path = `${organizationId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("qr-placement-images").upload(path, file);

    if (error) {
      setStatus("error");
      onUploaded(undefined);
      return;
    }

    const { data } = supabase.storage.from("qr-placement-images").getPublicUrl(path);
    setStatus("idle");
    onUploaded(data.publicUrl);
  }

  return (
    <div className="space-y-1">
      <label htmlFor="placementImage" className="text-xs text-muted-foreground">
        Dónde se usará este QR: flyer, revista, catálogo…
      </label>
      <div className="flex items-center gap-2">
        <label
          htmlFor="placementImage"
          className="cursor-pointer rounded-md border border-input bg-black/25 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-black/35"
        >
          Adjuntar referencia
        </label>
        {fileName && <span className="truncate text-xs text-muted-foreground">{fileName}</span>}
      </div>
      <input
        id="placementImage"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleChange}
        className="sr-only"
      />
      {status === "uploading" && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BinaryLoader /> Subiendo…
        </p>
      )}
      {status === "error" && (
        <p className="text-xs text-destructive">
          Error al subir el archivo — intenta de nuevo.
        </p>
      )}
    </div>
  );
}
