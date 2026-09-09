"use client";

import { useActionState, useEffect, useState } from "react";
import { createWebsiteQrCodeAction, type CreateWebsiteQrFormState } from "./actions";
import { useQrPreview } from "./use-qr-preview";
import { LogoUpload } from "./logo-upload";

const initialState: CreateWebsiteQrFormState = {};

export function WebsiteQrForm({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: (qrCodeId: string) => void;
}) {
  const [state, formAction, pending] = useActionState(createWebsiteQrCodeAction, initialState);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("#1c1213");
  const [foregroundColor, setForegroundColor] = useState("#f7edee");
  const [errorCorrectionLevel, setErrorCorrectionLevel] = useState<"L" | "M" | "Q" | "H">("M");
  const [logoUrl, setLogoUrl] = useState<string>();

  // The final QR encodes the short URL, not the raw destination — this preview is a visual
  // stand-in (colors/logo/shape read identically) since no short link exists until submit.
  const previewUrl = useQrPreview({
    payload: destinationUrl || undefined,
    backgroundColor,
    foregroundColor,
    errorCorrectionLevel,
    logoUrl,
  });

  useEffect(() => {
    if (state.qrCodeId) onCreated(state.qrCodeId);
  }, [state.qrCodeId, onCreated]);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="destinationUrl" className="text-sm text-muted-foreground">
            Destination URL
          </label>
          <input
            id="destinationUrl"
            name="destinationUrl"
            required
            value={destinationUrl}
            onChange={(event) => setDestinationUrl(event.target.value)}
            placeholder="https://your-site.com/page"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-4">
          <div className="space-y-1">
            <label htmlFor="backgroundColor" className="text-xs text-muted-foreground">
              Background
            </label>
            <input
              id="backgroundColor"
              name="backgroundColor"
              type="color"
              value={backgroundColor}
              onChange={(event) => setBackgroundColor(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="foregroundColor" className="text-xs text-muted-foreground">
              Foreground
            </label>
            <input
              id="foregroundColor"
              name="foregroundColor"
              type="color"
              value={foregroundColor}
              onChange={(event) => setForegroundColor(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="errorCorrectionLevel" className="text-xs text-muted-foreground">
            Error correction
          </label>
          <select
            id="errorCorrectionLevel"
            name="errorCorrectionLevel"
            value={errorCorrectionLevel}
            disabled={Boolean(logoUrl)}
            onChange={(event) => setErrorCorrectionLevel(event.target.value as "L" | "M" | "Q" | "H")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="L">L</option>
            <option value="M">M</option>
            <option value="Q">Q</option>
            <option value="H">H</option>
          </select>
        </div>

        <LogoUpload organizationId={organizationId} onUploaded={setLogoUrl} />
        <input type="hidden" name="logoUrl" value={logoUrl ?? ""} />

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
          {pending ? "Creating…" : "Create QR code"}
        </button>
      </div>

      <div className="flex items-center justify-center rounded-md border border-border bg-background p-4">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="QR preview" className="h-48 w-48" />
        ) : (
          <p className="text-sm text-muted-foreground">Enter a URL to preview</p>
        )}
      </div>
    </form>
  );
}
