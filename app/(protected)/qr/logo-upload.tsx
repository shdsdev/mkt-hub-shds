"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Uploads directly from the browser to Storage (Phase 5 design) — the file never passes through
// our server.
export function LogoUpload({
  organizationId,
  onUploaded,
}: {
  organizationId: string;
  onUploaded: (url: string | undefined) => void;
}) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      onUploaded(undefined);
      return;
    }

    setStatus("uploading");
    const supabase = createClient();
    const path = `${organizationId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("qr-logos").upload(path, file);

    if (error) {
      setStatus("error");
      onUploaded(undefined);
      return;
    }

    const { data } = supabase.storage.from("qr-logos").getPublicUrl(path);
    setStatus("idle");
    onUploaded(data.publicUrl);
  }

  return (
    <div className="space-y-1">
      <label htmlFor="logo" className="text-xs text-muted-foreground">
        Logo (optional — forces error-correction to H)
      </label>
      <input
        id="logo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleChange}
        className="w-full text-sm"
      />
      {status === "uploading" && (
        <p className="text-xs text-muted-foreground">Uploading…</p>
      )}
      {status === "error" && (
        <p className="text-xs text-destructive">Upload failed — try again.</p>
      )}
    </div>
  );
}
