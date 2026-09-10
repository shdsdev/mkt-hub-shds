"use client";

import { useActionState, useEffect, useState } from "react";
import { createStaticQrCodeAction, type CreateStaticQrFormState } from "./actions";
import { useQrPreview } from "./use-qr-preview";
import { LogoUpload } from "./logo-upload";

const initialState: CreateStaticQrFormState = {};

export function StaticQrForm({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: (qrCodeId: string) => void;
}) {
  const [state, formAction, pending] = useActionState(createStaticQrCodeAction, initialState);
  const [payload, setPayload] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("#1c1213");
  const [foregroundColor, setForegroundColor] = useState("#f7edee");
  const [errorCorrectionLevel, setErrorCorrectionLevel] = useState<"L" | "M" | "Q" | "H">("M");
  const [logoUrl, setLogoUrl] = useState<string>();

  const previewUrl = useQrPreview({
    payload: payload || undefined,
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
          <label htmlFor="payload" className="text-sm text-muted-foreground">
            Contenido — fijo, no rastreable, no editable después de crearlo
          </label>
          <input
            id="payload"
            name="payload"
            required
            value={payload}
            onChange={(event) => setPayload(event.target.value)}
            placeholder="https://ejemplo.com o cualquier texto"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-4">
          <div className="space-y-1">
            <label htmlFor="staticBackgroundColor" className="text-xs text-muted-foreground">
              Fondo
            </label>
            <input
              id="staticBackgroundColor"
              name="backgroundColor"
              type="color"
              value={backgroundColor}
              onChange={(event) => setBackgroundColor(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="staticForegroundColor" className="text-xs text-muted-foreground">
              Primer plano
            </label>
            <input
              id="staticForegroundColor"
              name="foregroundColor"
              type="color"
              value={foregroundColor}
              onChange={(event) => setForegroundColor(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="staticErrorCorrectionLevel" className="text-xs text-muted-foreground">
            Corrección de errores
          </label>
          <select
            id="staticErrorCorrectionLevel"
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
          {pending ? "Creando…" : "Crear QR estático"}
        </button>
      </div>

      <div className="flex items-center justify-center rounded-md border border-border bg-background p-4">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Vista previa del QR" className="h-48 w-48" />
        ) : (
          <p className="text-sm text-muted-foreground">Ingresa un contenido para previsualizar</p>
        )}
      </div>
    </form>
  );
}
