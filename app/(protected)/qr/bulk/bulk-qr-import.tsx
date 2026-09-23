"use client";

import { useRef, useState, useTransition } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GroupSelect } from "../group-select";
import { QrDesignFields, type QrDesignFieldsState } from "../qr-design-fields";
import { useQrPreview } from "../use-qr-preview";
import { createBulkWebsiteQrCodesAction, type BulkQrImportSummary } from "../actions";
import { parseBulkQrCsv, type BulkQrCsvPreview } from "./bulk-csv";
import { canAdvanceBulkQrWizard } from "./bulk-wizard-state";
import type { Folder } from "@/modules/links";
import type { Campaign } from "@/modules/campaigns";
import type { QrDesignTemplateRow } from "@/modules/qr";

export type BulkQrImportProps = {
  organizationId: string;
  folders: Folder[];
  campaigns: Campaign[];
  templates: QrDesignTemplateRow[];
  defaultLogoUrl?: string;
};

type Step = "csv" | "configuration" | "review";

function hasUtm(row: BulkQrCsvPreview["rows"][number]) {
  return Boolean(row.utmSource || row.utmMedium || row.utmCampaign || row.utmTerm || row.utmContent);
}

function StepHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-semibold text-primary">
        {number}
      </span>
      <h2 className="font-medium">{title}</h2>
    </div>
  );
}

export function BulkQrImport({ organizationId, folders, campaigns, templates, defaultLogoUrl }: BulkQrImportProps) {
  const [step, setStep] = useState<Step>("csv");
  const [preview, setPreview] = useState<BulkQrCsvPreview | null>(null);
  const [fileName, setFileName] = useState<string>();
  const [grouping, setGrouping] = useState<{ folderId?: string; campaignId?: string }>({});
  const [design, setDesign] = useState<QrDesignFieldsState>({
    backgroundColor: "#1c1213",
    foregroundColor: "#f7edee",
    errorCorrectionLevel: "M",
    logoUrl: defaultLogoUrl,
    dotsType: "square",
    cornersSquareType: "square",
    cornersDotType: "square",
  });
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [summary, setSummary] = useState<BulkQrImportSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAdvance = canAdvanceBulkQrWizard({ preview, ...grouping, saveAsTemplate, templateName });
  const previewUrl = useQrPreview({
    payload: preview?.rows[0]?.url,
    backgroundColor: design.backgroundColor,
    foregroundColor: design.foregroundColor,
    errorCorrectionLevel: design.errorCorrectionLevel,
    logoUrl: design.logoUrl,
    dotsType: design.dotsType,
    cornersSquareType: design.cornersSquareType,
    cornersDotType: design.cornersDotType,
  });

  async function handleFile(file: File | undefined) {
    setStep("csv");
    setFileName(file?.name);
    if (!file) {
      setPreview(null);
      return;
    }
    try {
      setPreview(parseBulkQrCsv(await file.text()));
    } catch {
      setPreview({ rows: [], invalidRows: [], fileError: "No se pudo leer el archivo CSV." });
    }
  }

  function handleCreate() {
    if (!preview) return;
    startTransition(async () => {
      setSummary(
        await createBulkWebsiteQrCodesAction({
          rows: preview.rows,
          ...grouping,
          design,
          saveAsTemplate,
          templateName,
        }),
      );
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section hidden={step !== "csv"} className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <StepHeader number={1} title="Archivo CSV" />
          <a
            href="/qr/bulk/template"
            download
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10"
          >
            <Download size={16} /> Descargar plantilla
          </a>
        </div>
        <p className="text-sm text-muted-foreground">
          Descarga la plantilla exacta, complétala localmente y vuelve a subirla. Se validarán todas las filas.
        </p>
        <input
          ref={fileInputRef}
          id="bulk-qr-csv"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => handleFile(event.target.files?.[0])}
          className="hidden"
        />
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload size={16} /> Subir CSV
        </Button>
        {fileName && <p className="font-mono text-xs text-muted-foreground">{fileName}</p>}
        {preview?.fileError && <p role="alert" className="text-sm text-destructive">{preview.fileError}</p>}
        {preview?.invalidRows.map((row) => (
          <p key={row.rowNumber} role="alert" className="text-sm text-destructive">
            Fila {row.rowNumber}: {row.error}
          </p>
        ))}
        {preview && !preview.fileError && preview.invalidRows.length === 0 && (
          <p className="text-sm text-muted-foreground">{preview.rows.length} filas listas para configurar.</p>
        )}
        <div className="flex justify-end">
          <Button type="button" disabled={!preview || Boolean(preview.fileError) || preview.invalidRows.length > 0 || preview.rows.length === 0} onClick={() => setStep("configuration")}>
            Continuar
          </Button>
        </div>
      </section>

      <section hidden={step !== "configuration"} className="space-y-6 rounded-lg border border-border bg-card p-6">
        <StepHeader number={2} title="Configuración compartida" />
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Carpeta o campaña</label>
          <GroupSelect folders={folders} campaigns={campaigns} value={grouping} onChange={setGrouping} required />
        </div>
        <QrDesignFields
          organizationId={organizationId}
          templates={templates}
          state={design}
          onChange={(next) => setDesign((current) => ({ ...current, ...next }))}
          active={step === "configuration"}
          templateState={{ saveAsTemplate, templateName }}
          onTemplateChange={(next) => {
            setSaveAsTemplate(next.saveAsTemplate);
            setTemplateName(next.templateName);
          }}
        />
        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => setStep("csv")}>Atrás</Button>
          <Button type="button" disabled={!canAdvance} onClick={() => setStep("review")}>Revisar lote</Button>
        </div>
      </section>

      <section hidden={step !== "review"} className="space-y-6 rounded-lg border border-border bg-card p-6">
        <StepHeader number={3} title="Revisión" />
        <p className="text-sm">Se crearán {preview?.rows.length ?? 0} códigos QR.</p>
        <p className="text-sm text-muted-foreground">
          Grupo: {grouping.folderId ? folders.find((folder) => folder.id === grouping.folderId)?.name : campaigns.find((campaign) => campaign.id === grouping.campaignId)?.name}
        </p>
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Vista previa del código QR del lote"
            className="h-48 w-48 rounded-md border border-border bg-white p-2 object-contain"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No hay una vista previa del código QR disponible.</p>
        )}
        <ul className="space-y-2">
          {preview?.rows.map((row) => (
            <li key={row.rowNumber} className="rounded-md border border-border px-3 py-2 text-sm">
              <span className="font-medium">{row.title}</span> <span className="text-muted-foreground">{row.url}</span>{" "}
              <span className="text-xs text-muted-foreground">{hasUtm(row) ? "Con UTM" : "Sin UTM"}</span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt>Color QR</dt><dd>{design.foregroundColor}</dd>
          <dt>Color de fondo</dt><dd>{design.backgroundColor}</dd>
          <dt>Corrección de errores</dt><dd>{design.errorCorrectionLevel}</dd>
          <dt>Logo</dt><dd>{design.logoUrl ?? "Sin logo"}</dd>
        </dl>
        {summary?.error && (
          <p role="alert" className="text-sm text-destructive">
            {summary.error}
          </p>
        )}
        {summary && summary.failed > 0 && (
          <ul className="space-y-1">
            {summary.results.map((result) =>
              result.status === "failed" ? (
                <li key={result.rowNumber} role="alert" className="text-sm text-destructive">
                  Fila {result.rowNumber}: {result.error}
                </li>
              ) : null,
            )}
          </ul>
        )}
        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => setStep("configuration")}>Atrás</Button>
          <Button type="button" disabled={!canAdvance || isPending} onClick={handleCreate}>
            {isPending ? "Creando…" : "Crear códigos QR"}
          </Button>
        </div>
      </section>
    </div>
  );
}
