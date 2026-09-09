"use client";

import { useActionState, useState } from "react";
import type { ShortLink } from "@/modules/links";
import { createDynamicQrCodeAction, type CreateDynamicQrFormState } from "./actions";
import { useQrPreview } from "./use-qr-preview";
import { LogoUpload } from "./logo-upload";

const initialState: CreateDynamicQrFormState = {};

export function DynamicQrForm({
  shortLinks,
  organizationId,
}: {
  shortLinks: ShortLink[];
  organizationId: string;
}) {
  const [state, formAction, pending] = useActionState(createDynamicQrCodeAction, initialState);
  const [shortLinkId, setShortLinkId] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("#1c130f");
  const [foregroundColor, setForegroundColor] = useState("#f7eeeb");
  const [errorCorrectionLevel, setErrorCorrectionLevel] = useState<"L" | "M" | "Q" | "H">("M");
  const [logoUrl, setLogoUrl] = useState<string>();

  const previewUrl = useQrPreview({
    shortLinkId: shortLinkId || undefined,
    backgroundColor,
    foregroundColor,
    errorCorrectionLevel,
    logoUrl,
  });

  if (shortLinks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Create a short link on the Links page first — a dynamic QR needs one to point at.
      </p>
    );
  }

  return (
    <form action={formAction} className="grid grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="shortLinkId" className="text-sm text-muted-foreground">
            Short link
          </label>
          <select
            id="shortLinkId"
            name="shortLinkId"
            required
            value={shortLinkId}
            onChange={(event) => setShortLinkId(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Choose a short link…
            </option>
            {shortLinks.map((shortLink) => (
              <option key={shortLink.id} value={shortLink.id}>
                {shortLink.slug}
              </option>
            ))}
          </select>
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
          {pending ? "Creating…" : "Create dynamic QR"}
        </button>
      </div>

      <div className="flex items-center justify-center rounded-md border border-border bg-background p-4">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="QR preview" className="h-48 w-48" />
        ) : (
          <p className="text-sm text-muted-foreground">Pick a short link to preview</p>
        )}
      </div>
    </form>
  );
}
