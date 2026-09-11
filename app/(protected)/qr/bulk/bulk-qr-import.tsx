"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Download, DownloadCloud, ArrowRight, QrCode, UploadCloud, Upload } from "lucide";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BinaryLoader } from "@/components/binary-loader";
import { HoverMorphIcon } from "@/components/hover-morph-icon";
import { createBulkWebsiteQrCodesAction, type BulkQrImportSummary } from "../actions";
import { parseBulkQrCsv, type BulkQrCsvPreview } from "./bulk-csv";

function StatusBadge({
  variant,
  children,
}: {
  variant: "ready" | "invalid" | "excluded" | "created" | "failed";
  children: React.ReactNode;
}) {
  const styles =
    variant === "ready" || variant === "created"
      ? "bg-accent/20 text-accent"
      : variant === "invalid" || variant === "failed"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${styles}`}>{children}</span>;
}

function PreviewRow({
  rowNumber,
  title,
  url,
  badge,
  detail,
}: {
  rowNumber: number;
  title: string;
  url: string;
  badge: React.ReactNode;
  detail?: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
      <span className="shrink-0 font-mono text-xs text-muted-foreground">#{rowNumber}</span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium">{title || "Sin título"}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">{url}</p>
        {detail && <p className="text-xs text-destructive">{detail}</p>}
      </div>
      {badge}
    </li>
  );
}

// Step header matching the reference's numbered-step layout — a small circular index badge
// instead of a literal "1." so it reads as UI chrome, not copy the translator would touch.
function StepHeader({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-semibold text-primary">
        {step}
      </span>
      <h2 className="font-medium">{title}</h2>
    </div>
  );
}

export function BulkQrImport() {
  const [preview, setPreview] = useState<BulkQrCsvPreview | null>(null);
  const [summary, setSummary] = useState<BulkQrImportSummary | null>(null);
  const [fileName, setFileName] = useState<string>();
  const [dragActive, setDragActive] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    setSummary(null);
    if (!file) {
      setPreview(null);
      setFileName(undefined);
      return;
    }

    setFileName(file.name);
    try {
      setPreview(parseBulkQrCsv(await file.text()));
    } catch {
      setPreview({
        readyRows: [],
        invalidRows: [],
        excludedRows: [],
        fileError: "No se pudo leer el archivo CSV.",
      });
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleSubmit() {
    if (!preview || preview.readyRows.length === 0 || isPending) return;

    startTransition(async () => {
      setSummary(await createBulkWebsiteQrCodesAction(preview.readyRows));
    });
  }

  const readyCount = preview?.readyRows.length ?? 0;
  const createLabel = readyCount === 1 ? "Crear 1 código QR" : `Crear ${readyCount} códigos QR`;

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <StepHeader step={1} title="Descarga la plantilla en CSV" />
          <a
            href="/qr/bulk/template"
            download
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10"
          >
            <HoverMorphIcon idle={Download} active={DownloadCloud} />
            Descargar CSV
          </a>
        </div>
        <p className="text-sm text-muted-foreground">
          La primera fila es el encabezado. Usa las columnas URL y Título del código QR (referencia),
          con un máximo de 200 filas.
        </p>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-6">
        <StepHeader step={2} title="Sube el archivo actualizado" />

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
          }}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragActive ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
          }`}
        >
          <HoverMorphIcon idle={UploadCloud} active={Upload} size={22} hovered={dragActive} />
          <p className="text-sm">
            <span className="font-medium text-accent">Subir un archivo CSV</span>
            <span className="text-muted-foreground"> o soltarlo aquí</span>
          </p>
          {fileName && (
            <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <FileText size={14} />
              {fileName}
            </p>
          )}
          <input
            ref={fileInputRef}
            id="bulk-qr-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => handleFile(event.target.files?.[0])}
            onClick={(event) => event.stopPropagation()}
            className="hidden"
          />
        </div>
      </section>

      {preview?.fileError && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {preview.fileError}
        </p>
      )}

      {preview && !preview.fileError && (
        <section className="space-y-6 rounded-lg border border-border bg-card p-6" aria-label="Vista previa de importación">
          {preview.readyRows.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-medium">Listas para crear ({preview.readyRows.length})</h2>
              <ul className="space-y-1.5">
                {preview.readyRows.map((row) => (
                  <PreviewRow
                    key={row.rowNumber}
                    rowNumber={row.rowNumber}
                    title={row.title}
                    url={row.url}
                    badge={<StatusBadge variant="ready">Lista</StatusBadge>}
                  />
                ))}
              </ul>
            </div>
          )}

          {preview.invalidRows.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-medium">Filas con errores ({preview.invalidRows.length})</h2>
              <ul className="space-y-1.5">
                {preview.invalidRows.map((row) => (
                  <PreviewRow
                    key={row.rowNumber}
                    rowNumber={row.rowNumber}
                    title={row.title}
                    url={row.url}
                    detail={row.error}
                    badge={<StatusBadge variant="invalid">Error</StatusBadge>}
                  />
                ))}
              </ul>
            </div>
          )}

          {preview.excludedRows.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-medium">Filas excluidas por el límite ({preview.excludedRows.length})</h2>
              <ul className="space-y-1.5">
                {preview.excludedRows.map((row) => (
                  <PreviewRow
                    key={row.rowNumber}
                    rowNumber={row.rowNumber}
                    title={row.title}
                    url={row.url}
                    badge={<StatusBadge variant="excluded">Excluida</StatusBadge>}
                  />
                ))}
              </ul>
            </div>
          )}

          {readyCount > 0 && (
            <>
              <Separator />
              <div className="flex items-center gap-3">
                <Button type="button" onClick={handleSubmit} disabled={isPending}>
                  {isPending ? (
                    <>
                      <BinaryLoader /> Creando códigos QR…
                    </>
                  ) : (
                    createLabel
                  )}
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      {summary && (
        <section className="space-y-4 rounded-lg border border-border bg-card p-6" aria-labelledby="bulk-qr-results">
          <h2 id="bulk-qr-results" className="font-medium">
            Resultado de la importación
          </h2>

          {summary.error && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {summary.error}
            </p>
          )}

          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-muted-foreground">
              Solicitados: <span className="font-medium text-foreground">{summary.requested}</span>
            </span>
            <span className="text-muted-foreground">
              Creados: <span className="font-medium text-accent">{summary.created}</span>
            </span>
            <span className="text-muted-foreground">
              Fallidos: <span className="font-medium text-destructive">{summary.failed}</span>
            </span>
          </div>

          <ul className="space-y-1.5">
            {summary.results.map((result, index) => (
              <PreviewRow
                key={`${result.rowNumber}-${result.status}-${index}`}
                rowNumber={result.rowNumber}
                title={result.title}
                url={result.status === "created" ? result.qrCodeId : ""}
                detail={result.status === "failed" ? result.error : undefined}
                badge={
                  <StatusBadge variant={result.status === "created" ? "created" : "failed"}>
                    {result.status === "created" ? "Creado" : "Falló"}
                  </StatusBadge>
                }
              />
            ))}
          </ul>

          <Link
            href="/qr"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            <HoverMorphIcon idle={QrCode} active={ArrowRight} />
            Ver códigos QR
          </Link>
        </section>
      )}
    </div>
  );
}
