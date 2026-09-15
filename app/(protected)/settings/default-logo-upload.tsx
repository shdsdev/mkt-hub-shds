"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BinaryLoader } from "@/components/binary-loader";
import { updateDefaultLogoAction } from "./actions";

// Same direct-to-Storage pattern as app/(protected)/qr/logo-upload.tsx, reusing the qr-logos
// bucket (this is a logo, same asset kind — not the qr-placement-images bucket). On upload,
// invokes the server action directly with a FormData instead of going through a <form> submit,
// since there's no other field on this page's form to bundle it with.
export function DefaultLogoUpload({
  organizationId,
  currentLogoUrl,
}: {
  organizationId: string;
  currentLogoUrl?: string;
}) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    const supabase = createClient();
    const path = `${organizationId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("qr-logos").upload(path, file);

    if (error) {
      setStatus("error");
      return;
    }

    const { data } = supabase.storage.from("qr-logos").getPublicUrl(path);
    setStatus("idle");
    setLogoUrl(data.publicUrl);

    const formData = new FormData();
    formData.set("logoUrl", data.publicUrl);
    await updateDefaultLogoAction(formData);
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="Logotipo por defecto" className="h-16 w-16 rounded-md border border-border object-contain" />
      )}
      <label htmlFor="defaultLogo" className="text-sm text-muted-foreground">
        Logotipo por defecto — se pre-carga en cada código QR nuevo (igual reemplazable por QR)
      </label>
      <input
        id="defaultLogo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleChange}
        className="w-full text-sm"
      />
      {status === "uploading" && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BinaryLoader /> Subiendo…
        </p>
      )}
      {status === "error" && (
        <p className="text-xs text-destructive">Error al subir el archivo — intenta de nuevo.</p>
      )}
    </div>
  );
}
