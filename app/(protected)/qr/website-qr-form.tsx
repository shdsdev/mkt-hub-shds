"use client";

import { useActionState, useEffect, useState } from "react";
import { createWebsiteQrCodeAction, type CreateWebsiteQrFormState } from "./actions";
import { useQrPreview } from "./use-qr-preview";
import { QrDetailFields, type QrDetailFieldsState } from "./qr-detail-fields";
import { QrDesignFields, type QrDesignFieldsState } from "./qr-design-fields";
import { UtmFields, type UtmFieldsState } from "./utm-fields";
import { QrWizardShell } from "./qr-wizard-shell";
import { BinaryLoader } from "@/components/binary-loader";
import { Checkbox } from "@/components/checkbox";
import type { Folder } from "@/modules/links";
import type { Campaign } from "@/modules/campaigns";
import type { UtmPreset } from "@/modules/utm";
import type { QrDesignTemplateRow } from "@/modules/qr";

const initialState: CreateWebsiteQrFormState = {};

type Step = "detail" | "data" | "design";

export function WebsiteQrForm({
  organizationId,
  folders,
  campaigns,
  utmPresets,
  templates,
  defaultLogoUrl,
  onBack,
  onCreated,
}: {
  organizationId: string;
  folders: Folder[];
  campaigns: Campaign[];
  utmPresets: UtmPreset[];
  templates: QrDesignTemplateRow[];
  defaultLogoUrl?: string;
  onBack: () => void;
  onCreated: (qrCodeId: string) => void;
}) {
  const [state, formAction, pending] = useActionState(createWebsiteQrCodeAction, initialState);
  const [step, setStep] = useState<Step>("detail");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [detail, setDetail] = useState<QrDetailFieldsState>({ name: "", grouping: {} });
  const [design, setDesign] = useState<QrDesignFieldsState>({
    backgroundColor: "#1c1213",
    foregroundColor: "#f7edee",
    errorCorrectionLevel: "M",
    logoUrl: defaultLogoUrl,
    dotsType: "square",
    cornersSquareType: "square",
    cornersDotType: "square",
  });

  const [showUtm, setShowUtm] = useState(false);
  const [utm, setUtm] = useState<UtmFieldsState>({ source: "", medium: "", campaign: "" });

  // The final QR encodes the short URL, not the raw destination — this preview is a visual
  // stand-in (colors/logo/shape read identically) since no short link exists until submit.
  const previewUrl = useQrPreview({
    payload: destinationUrl || undefined,
    backgroundColor: design.backgroundColor,
    foregroundColor: design.foregroundColor,
    errorCorrectionLevel: design.errorCorrectionLevel,
    logoUrl: design.logoUrl,
    dotsType: design.dotsType,
    cornersSquareType: design.cornersSquareType,
    cornersDotType: design.cornersDotType,
  });

  useEffect(() => {
    if (state.qrCodeId) onCreated(state.qrCodeId);
  }, [state.qrCodeId, onCreated]);

  const preview =
    previewUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={previewUrl} alt="Vista previa del QR" className="h-48 w-48" />
    ) : (
      <p className="text-sm text-muted-foreground">Ingresa una URL para previsualizar</p>
    );

  return (
    <form action={formAction} className="space-y-3">
      {/* All three steps stay mounted (hidden, not unmounted) so their inputs remain part of the
          form's DOM and land in FormData no matter which step is visible when "Crear código QR"
          is finally clicked — a `{step === "x" && (...)}` conditional would unmount the other
          steps' fields and silently drop them from the submission. */}
      <div hidden={step !== "detail"}>
        <QrWizardShell
          step={2}
          totalSteps={4}
          title="Sitio web"
          subtitle="Crea un enlace corto rastreable y un QR dinámico."
          onBack={onBack}
          preview={preview}
        >
          <QrDetailFields
            organizationId={organizationId}
            folders={folders}
            campaigns={campaigns}
            state={detail}
            onChange={(next) => setDetail((prev) => ({ ...prev, ...next }))}
          />
          <button
            type="button"
            disabled={!detail.name.trim()}
            onClick={() => setStep("data")}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Continuar
          </button>
        </QrWizardShell>
      </div>

      <div hidden={step !== "data"}>
        <QrWizardShell
          step={3}
          totalSteps={4}
          title="Datos"
          subtitle="La URL a la que apuntará tu código QR."
          onBack={() => setStep("detail")}
          preview={preview}
        >
          <div className="space-y-1">
            <label htmlFor="destinationUrl" className="text-sm text-muted-foreground">
              URL de destino
            </label>
            <input
              id="destinationUrl"
              name="destinationUrl"
              required
              value={destinationUrl}
              onChange={(event) => setDestinationUrl(event.target.value)}
              placeholder="https://tu-sitio.com/pagina"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Tu QR usará un enlace corto automáticamente.
            </p>
          </div>

          <div className="space-y-2">
            <Checkbox checked={showUtm} onChange={setShowUtm} label="Agregar etiquetas UTM" />
            {showUtm && (
              <UtmFields
                presets={utmPresets}
                state={utm}
                onChange={(next) => setUtm((prev) => ({ ...prev, ...next }))}
              />
            )}
          </div>

          <button
            type="button"
            disabled={!destinationUrl.trim()}
            onClick={() => setStep("design")}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Continuar
          </button>
        </QrWizardShell>
      </div>

      <div hidden={step !== "design"}>
        <QrWizardShell
          step={4}
          totalSteps={4}
          title="Diseño"
          subtitle="Colores, forma y logo del código QR."
          onBack={() => setStep("data")}
          preview={preview}
        >
          <QrDesignFields
            organizationId={organizationId}
            templates={templates}
            state={design}
            onChange={(next) => setDesign((prev) => ({ ...prev, ...next }))}
            active={step === "design"}
          />

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
            {pending ? <BinaryLoader /> : "Crear código QR"}
          </button>
        </QrWizardShell>
      </div>
    </form>
  );
}
